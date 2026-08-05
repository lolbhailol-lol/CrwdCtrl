import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, CheckCircle } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import { openCashfreeCheckout, buildVerifiedPaymentFields, classifyCheckoutError } from '../../utils/useCashfree';
import PaymentErrorModal from '../../components/PaymentErrorModal';
import { getPendingPayment, clearPendingPayment, shouldResumePendingPayment } from '../../utils/deepLinks';
import { verifyPaymentWithRetry, goToBookings } from '../../utils/paymentNavigation';
import { buildEventPriceBreakdown } from '../../utils/platformFee';
import { resolveTrekPlatformFeePercent } from '../../utils/trekRegistrationFee';
import { API_BASE_URL, publicFetchJSONRetry } from '../../services/api/client';
import { resolveAuthToken, getBearerAuthHeaders, hasUsableAuthToken } from '../../utils/authToken';
import { useBookingSuccessPopup } from '../../hooks/useSuccessPopup';
import { eventShowPath } from '../../utils/slugRoutes';
import {
    getEventShowTiers,
    findEventShowTier,
    resolveEventShowFee,
    resolveTierParticipantCount,
    formatInr,
} from '../../utils/eventShowTiers';

const API = API_BASE_URL;

const FILE_TYPES = ['file', 'image'];
const BLOOD_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Prefer not to say'];
const DRIVE_FIELD_NAMES = new Set(['join_drive', 'join_independence_day_drive', 'independence_day_drive']);
const DRIVE_ONLY_OPTION = 'Drive only (Free)';
const DRIVE_AND_TRACKDAY_OPTION = 'Drive + Trackday';
const TRACKDAY_ONLY_OPTION = 'Trackday only';

function draftKey(eventId) {
    return `event_reg_draft_${eventId}`;
}

function getInitialEventRegistrationUi(eventId, search) {
    if (!eventId) return { paying: false, step: 0 };
    const returnPath = `/events/${eventId}/register`;
    const resuming = shouldResumePendingPayment(getPendingPayment(), returnPath, search);
    if (resuming) return { paying: true, step: Number.MAX_SAFE_INTEGER };
    return { paying: false, step: 0 };
}

function isDriveOnlyTier(tier) {
    if (!tier) return false;
    if (String(tier.id || '') === 'tier_drive_only') return true;
    const blob = `${tier.name || ''} ${tier.description || ''}`.toLowerCase();
    return /drive only|no trackday/.test(blob);
}

function normalizeDriveChoice(raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    if (/drive only/i.test(v) || (/^yes/i.test(v) && /free/i.test(v) && !/trackday/i.test(v))) {
        return DRIVE_ONLY_OPTION;
    }
    if (/drive\s*\+\s*trackday|both/i.test(v)) return DRIVE_AND_TRACKDAY_OPTION;
    if (/trackday only|^no/i.test(v)) return TRACKDAY_ONLY_OPTION;
    if (/^yes/i.test(v)) return DRIVE_AND_TRACKDAY_OPTION;
    return v;
}

function isDriveOnlyChoice(choice) {
    return normalizeDriveChoice(choice) === DRIVE_ONLY_OPTION;
}

function isTrackdayOnlyChoice(choice) {
    return normalizeDriveChoice(choice) === TRACKDAY_ONLY_OPTION;
}

function pickCustomer(values) {
    const find = (keys) => {
        for (const k of Object.keys(values)) {
            if (keys.some((needle) => k.toLowerCase().includes(needle))) {
                const v = values[k];
                if (v && typeof v === 'string') return v;
            }
        }
        return '';
    };
    return {
        name: String(values.name || values.leader_name || find(['name']) || '').trim(),
        email: String(values.email || find(['email', 'e_mail']) || '').trim(),
        phone: String(values.phone || find(['phone', 'contact', 'mobile']) || '').trim(),
    };
}

export default function EventRegistrationPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { eventId } = useParams();
    const initialUi = getInitialEventRegistrationUi(eventId, location.search);
    const { isDark } = useDarkMode();
    const {
        user,
        isAuthenticated,
        isLoading: authLoading,
        token: authToken,
        isAuthProcessing,
        isRedirectProcessing,
    } = useAuth();
    const { refreshNotifications } = useNotifications();

    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [event, setEvent] = useState(location.state?.event || null);
    const [loading, setLoading] = useState(!location.state?.event);
    const [step, setStep] = useState(initialUi.step === Number.MAX_SAFE_INTEGER ? 0 : initialUi.step);
    const [values, setValues] = useState({});
    const [files, setFiles] = useState({});
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(initialUi.paying);
    const [done, setDone] = useState(false);
    const [paymentResumeError, setPaymentResumeError] = useState('');
    const [registrationId, setRegistrationId] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponInfo, setCouponInfo] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [showCouponField, setShowCouponField] = useState(true);
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
    const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [uploadingProof, setUploadingProof] = useState(false);
    const [selectedTierId, setSelectedTierId] = useState(() => {
        try {
            return new URLSearchParams(window.location.search).get('tier') || location.state?.tierId || '';
        } catch {
            return location.state?.tierId || '';
        }
    });
    const retryRef = useRef(null);
    const resumeRef = useRef(false);

    const isAuthed = useCallback(
        () => isAuthenticated || hasUsableAuthToken(authToken),
        [isAuthenticated, authToken],
    );

    const getAuthToken = useCallback(
        () => resolveAuthToken(authToken),
        [authToken],
    );

    useEffect(() => {
        if (authLoading || isAuthProcessing || isRedirectProcessing) return;
        if (!isAuthed()) setShowLogin(true);
    }, [authLoading, isAuthProcessing, isRedirectProcessing, isAuthed]);

    useEffect(() => {
        if (isAuthenticated && showLogin) setShowLogin(false);
        if (isAuthenticated && showRegister) setShowRegister(false);
    }, [isAuthenticated, showLogin, showRegister]);

    useEffect(() => {
        if (!eventId) { setLoading(false); return; }
        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API}/events/${eventId}?t=${Date.now()}`);
                const d = await r.json();
                if (!cancelled && d.show) setEvent(d.show);
            } catch {
                /* keep state event if present */
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [eventId]);

    useEffect(() => {
        if (!event) return;
        const canonical = `${eventShowPath(event)}/register`;
        if (window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [event, navigate, location.state]);

    const reg = event?.registration || {};
    const isOrganizerQr = reg.mode === 'organizer_qr';
    const packages = useMemo(() => {
        if (!event) return [];
        // Prefer explicit tiers mode; also accept docs that have tiers[] even if mode was lost in client state
        if (event.pricingMode === 'tiers' || (Array.isArray(event.tiers) && event.tiers.length > 0)) {
            return getEventShowTiers({ ...event, pricingMode: 'tiers' });
        }
        return [];
    }, [event]);
    const tiersMode = packages.length > 0;
    const pricedEvent = useMemo(
        () => (tiersMode ? { ...event, pricingMode: 'tiers', tiers: event?.tiers || packages } : event),
        [event, tiersMode, packages],
    );
    const selectedTier = findEventShowTier(pricedEvent, selectedTierId);
    const driverCount = resolveTierParticipantCount(selectedTier);
    const priced = resolveEventShowFee(pricedEvent, selectedTierId);
    const ticketPrice = priced.fee;
    const platformFeePercent = isOrganizerQr ? 0 : resolveTrekPlatformFeePercent(event?.platformFeePercent, 2.5);
    const breakdown = useMemo(
        () => buildEventPriceBreakdown(ticketPrice, platformFeePercent),
        [ticketPrice, platformFeePercent],
    );
    const payableAmount = couponInfo?.amountAfterDiscount != null
        ? Number(couponInfo.amountAfterDiscount)
        : breakdown.totalAmount;
    const title = event?.displayName || event?.title || 'Event';
    const joinDriveRaw = String(
        values.join_drive || values.join_independence_day_drive || values.independence_day_drive || '',
    ).trim();
    const driveChoice = normalizeDriveChoice(joinDriveRaw);
    const driveOnlyPath = isDriveOnlyChoice(driveChoice);
    const skippingDrive = isTrackdayOnlyChoice(driveChoice);
    const driveOnlyTier = useMemo(
        () => packages.find((t) => isDriveOnlyTier(t)) || null,
        [packages],
    );

    const visiblePackages = useMemo(() => {
        // Drive-only path skips package picker; otherwise hide free drive-only tier
        return packages.filter((tier) => !isDriveOnlyTier(tier));
    }, [packages]);

    // Auto-select free Drive-only package so user can skip Trackday and register free
    useEffect(() => {
        if (!driveOnlyPath || !driveOnlyTier) return;
        if (selectedTierId !== driveOnlyTier.id) {
            setSelectedTierId(driveOnlyTier.id);
        }
    }, [driveOnlyPath, driveOnlyTier, selectedTierId]);

    // If they leave Drive-only path, clear a free drive tier so they must pick Trackday
    useEffect(() => {
        if (driveOnlyPath) return;
        if (selectedTierId && isDriveOnlyTier(selectedTier)) {
            setSelectedTierId('');
        }
    }, [driveOnlyPath, selectedTierId, selectedTier]);

    useBookingSuccessPopup(done, {
        name: title,
        paid: ticketPrice > 0,
        bookingId: registrationId,
        ticketType: 'event',
    });

    const formSteps = useMemo(() => {
        const configuredSteps = (() => {
            if (reg.formType === 'MULTI_STEP' && Array.isArray(reg.steps) && reg.steps.length > 0) {
                return reg.steps.map((s, i) => ({
                    title: s.stepTitle || `Step ${i + 1}`,
                    description: s.stepDescription || '',
                    fields: (s.fields || []).filter((f) => f.label && f.fieldName),
                }));
            }
            const fields = (reg.formSchema || []).filter((f) => f.label && f.fieldName);
            return fields.length ? [{ title: 'Your Details', description: '', fields }] : [];
        })();

        const driveFields = [];
        const detailFields = [];
        configuredSteps.forEach((s) => {
            (s.fields || []).forEach((f) => {
                if (DRIVE_FIELD_NAMES.has(String(f.fieldName || ''))) driveFields.push(f);
                else detailFields.push(f);
            });
        });

        const steps = [];
        if (driveFields.length) {
            steps.push({
                title: 'What are you joining?',
                description: 'Independence Day Drive is free. Pick Drive only to skip Trackday and register instantly, or add a Trackday package.',
                fields: driveFields.map((f) => {
                    if (!DRIVE_FIELD_NAMES.has(String(f.fieldName || ''))) return f;
                    return {
                        ...f,
                        label: 'Choose your registration',
                        options: [DRIVE_ONLY_OPTION, DRIVE_AND_TRACKDAY_OPTION, TRACKDAY_ONLY_OPTION],
                    };
                }),
            });
        }

        // Trackday packages only when they want Trackday (skip entirely for Drive-only free path)
        if (tiersMode && !driveOnlyPath) {
            steps.push({
                title: 'Trackday package',
                description: skippingDrive
                    ? 'Select a Trackday package.'
                    : 'Select your Trackday package (Drive is already included free).',
                packageSelect: true,
                fields: [],
            });
        }

        const count = Math.max(1, driverCount || 1);
        const isGroupPackage = count > 1 && !driveOnlyPath;
        // Group packages: only the registering leader fills details (no per-driver forms)

        const labeledDetailFields = (detailFields.length
            ? detailFields
            : [
                { id: 'f_name', label: 'Full Name', fieldName: 'name', type: 'text', required: true, placeholder: 'Your full name', options: [] },
                { id: 'f_email', label: 'Email', fieldName: 'email', type: 'email', required: true, placeholder: 'you@email.com', options: [] },
                { id: 'f_phone', label: 'Phone', fieldName: 'phone', type: 'tel', required: true, placeholder: '10-digit mobile', options: [] },
                { id: 'f_blood', label: 'Blood Group', fieldName: 'blood_group', type: 'select', required: true, placeholder: '', options: BLOOD_OPTIONS },
                { id: 'f_vehicle', label: 'Vehicle details', fieldName: 'vehicle_details', type: 'text', required: false, placeholder: 'Make / model (optional)', options: [] },
            ]
        ).map((f) => {
            const key = String(f.fieldName || '').toLowerCase();
            // Drive-only: make blood group optional (convoy, not track)
            if (driveOnlyPath && key === 'blood_group') {
                return { ...f, required: false };
            }
            if (isGroupPackage && (key === 'name' || key === 'full_name' || key === 'leader_name')) {
                return {
                    ...f,
                    fieldName: key === 'leader_name' ? f.fieldName : 'name',
                    label: 'Leader name',
                    placeholder: f.placeholder || 'Team leader full name',
                };
            }
            return f;
        });

        steps.push({
            title: driveOnlyPath ? 'Your details' : (isGroupPackage ? 'Leader details' : 'Your Details'),
            description: driveOnlyPath
                ? 'Free Independence Day Drive registration — no Trackday fee.'
                : (isGroupPackage
                    ? `Group package for ${count} drivers — only the registering leader’s details are needed.`
                    : ''),
            fields: labeledDetailFields,
        });

        return steps;
    }, [reg.formType, reg.steps, reg.formSchema, tiersMode, driverCount, driveOnlyPath, skippingDrive]);

    // Sync tier from query; clear drive-only if they answered No
    useEffect(() => {
        if (!event || !tiersMode) return;
        try {
            const fromQuery = new URLSearchParams(window.location.search).get('tier') || '';
            if (fromQuery && findEventShowTier(pricedEvent, fromQuery) && fromQuery !== selectedTierId) {
                setSelectedTierId(fromQuery);
                return;
            }
        } catch { /* ignore */ }
        if (selectedTierId && findEventShowTier(pricedEvent, selectedTierId)) {
            if (skippingDrive && isDriveOnlyTier(selectedTier)) {
                setSelectedTierId('');
            }
            return;
        }
    }, [event, tiersMode, selectedTierId, skippingDrive, selectedTier, pricedEvent]);

    useEffect(() => {
        setCouponInfo(null);
    }, [selectedTierId]);

    const allSteps = useMemo(
        () => [...formSteps, {
            title: ticketPrice > 0 ? 'Confirm & Pay' : 'Confirm registration',
            payment: true,
        }],
        [formSteps, ticketPrice],
    );
    const allFields = useMemo(() => formSteps.flatMap((s) => s.fields || []), [formSteps]);

    useEffect(() => {
        if (step > allSteps.length - 1) setStep(Math.max(0, allSteps.length - 1));
    }, [allSteps.length, step]);

    // Prefill name / email / phone from logged-in user (incl. Google sign-in)
    useEffect(() => {
        if (!user || !allFields.length) return;
        const userName = String(user.name || user.fullName || user.displayName || '').trim();
        const userEmail = String(user.email || '').trim();
        const userPhone = String(user.phone || user.mobile || user.phoneNumber || '').trim();
        if (!userName && !userEmail && !userPhone) return;

        setValues((prev) => {
            const next = { ...prev };
            let changed = false;
            allFields.forEach((f) => {
                const key = f.fieldName;
                const name = String(key || '').toLowerCase();
                const current = String(next[key] ?? '').trim();
                if (current) return;

                const isNameField = (name === 'name' || name === 'full_name' || name === 'leader_name' || name.endsWith('_name') || name.includes('full_name'))
                    && !name.includes('user')
                    && !name.includes('org')
                    && !name.includes('college')
                    && !name.includes('team')
                    && !/^driver_[2-9]_name$/.test(name)
                    && !/^driver_1[0-9]_name$/.test(name);
                const isEmailField = name === 'email' || name.includes('email') || name.includes('e_mail');
                const isPhoneField = name === 'phone' || name.includes('phone') || name.includes('mobile') || name.includes('contact_no') || name.includes('whatsapp');
                if (isPhoneField && /^driver_[2-9]_phone$/.test(name)) return;

                if (isNameField && userName) {
                    next[key] = userName;
                    changed = true;
                } else if (isEmailField && userEmail) {
                    next[key] = userEmail;
                    changed = true;
                } else if (isPhoneField && userPhone) {
                    next[key] = userPhone;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [user, allFields]);

    const inp = `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'}`;

    const setVal = (name, v) => setValues((f) => ({ ...f, [name]: v }));

    const renderField = (field) => {
        const val = values[field.fieldName] ?? '';
        if (field.type === 'textarea') {
            return <textarea rows={3} placeholder={field.placeholder || ''} value={val} onChange={(e) => setVal(field.fieldName, e.target.value)} className={`${inp} resize-none`} />;
        }
        if (field.type === 'select') {
            return (
                <select value={val} onChange={(e) => setVal(field.fieldName, e.target.value)} className={inp}>
                    <option value="">Select...</option>
                    {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        }
        if (field.type === 'radio') {
            return (
                <div className="space-y-2">
                    {(field.options || []).map((o) => (
                        <label key={o} className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" name={field.fieldName} value={o} checked={val === o} onChange={() => setVal(field.fieldName, o)} className="accent-[#0ECCEE]" />
                            <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{o}</span>
                        </label>
                    ))}
                </div>
            );
        }
        if (field.type === 'checkbox') {
            const arr = Array.isArray(val) ? val : [];
            const toggle = (o) => setVal(field.fieldName, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
            return (
                <div className="space-y-2">
                    {(field.options || []).map((o) => (
                        <label key={o} className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={arr.includes(o)} onChange={() => toggle(o)} className="accent-[#0ECCEE]" />
                            <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{o}</span>
                        </label>
                    ))}
                </div>
            );
        }
        if (FILE_TYPES.includes(field.type)) {
            const raw = files[field.fieldName];
            const selected = Array.isArray(raw) ? raw : (raw ? [raw] : []);
            const removeFile = (i) => setFiles((prev) => {
                const arr = (Array.isArray(prev[field.fieldName]) ? prev[field.fieldName] : (prev[field.fieldName] ? [prev[field.fieldName]] : [])).filter((_, j) => j !== i);
                const next = { ...prev };
                if (arr.length) next[field.fieldName] = arr; else delete next[field.fieldName];
                return next;
            });
            return (
                <div className="space-y-2">
                    <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer ${isDark ? 'border-gray-600 bg-[#1D1E20]' : 'border-gray-300 bg-white'}`}>
                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{field.placeholder || (field.type === 'image' ? 'Add image(s)' : 'Add file(s)')}</span>
                        <input
                            type="file"
                            multiple
                            accept={field.type === 'image' ? 'image/*' : 'image/*,.pdf,.doc,.docx'}
                            className="hidden"
                            onChange={(e) => {
                                const picked = Array.from(e.target.files || []);
                                if (picked.length) {
                                    setFiles((prev) => {
                                        const existing = Array.isArray(prev[field.fieldName]) ? prev[field.fieldName] : (prev[field.fieldName] ? [prev[field.fieldName]] : []);
                                        return { ...prev, [field.fieldName]: [...existing, ...picked] };
                                    });
                                }
                                e.target.value = '';
                            }}
                        />
                    </label>
                    {selected.length > 0 && (
                        <ul className="space-y-1">
                            {selected.map((file, i) => (
                                <li key={`${file.name}-${i}`} className={`flex items-center justify-between gap-2 text-xs px-2.5 py-1.5 rounded-md ${isDark ? 'bg-[#1D1E20] text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                                    <span className="truncate">{file.name}</span>
                                    <button type="button" onClick={() => removeFile(i)} className="shrink-0 text-red-400 hover:text-red-500">Remove</button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            );
        }
        return (
            <input
                type={field.type === 'date' ? 'date' : field.type || 'text'}
                placeholder={field.placeholder || ''}
                value={val}
                onChange={(e) => setVal(field.fieldName, e.target.value)}
                className={inp}
                style={field.type === 'date' ? { colorScheme: isDark ? 'dark' : 'light' } : undefined}
            />
        );
    };

    const validateStep = (idx) => {
        const s = allSteps[idx];
        if (!s || s.payment) return true;
        if (s.packageSelect) {
            if (tiersMode && !findEventShowTier(pricedEvent, selectedTierId)) {
                setError('Please select a Trackday package.');
                return false;
            }
            if (isDriveOnlyTier(selectedTier)) {
                setError('Please select a Trackday package.');
                return false;
            }
            return true;
        }
        // Drive-only path must have free package selected (auto-set)
        if (driveOnlyPath && !findEventShowTier(pricedEvent, selectedTierId)) {
            if (driveOnlyTier?.id) setSelectedTierId(driveOnlyTier.id);
        }
        const missing = s.fields.filter((f) => {
            if (!f.required) return false;
            if (FILE_TYPES.includes(f.type)) {
                const v = files[f.fieldName];
                return Array.isArray(v) ? v.length === 0 : !v;
            }
            const v = values[f.fieldName];
            if (Array.isArray(v)) return v.length === 0;
            return !String(v ?? '').trim();
        });
        if (missing.length > 0) {
            setError(`Please fill: ${missing.map((f) => f.label).join(', ')}`);
            return false;
        }
        return true;
    };

    const submitRegistration = useCallback(async ({
        paymentOrderId,
        paymentId,
        amountPaid,
        valuesOverride,
        filesOverride,
        tierIdOverride,
    } = {}) => {
        const token = getAuthToken();
        if (!token) { setShowLogin(true); throw new Error('Please log in to register.'); }

        const submissionValues = { ...(valuesOverride ?? values) };
        const submissionFiles = filesOverride ?? files;
        const tierIdToUse = tierIdOverride || selectedTierId;
        const tierToUse = findEventShowTier(pricedEvent, tierIdToUse) || selectedTier;

        // Normalize drive answer for storage / dashboard
        const driveRaw = String(
            submissionValues.join_drive
            || submissionValues.join_independence_day_drive
            || submissionValues.independence_day_drive
            || '',
        ).trim();
        const choice = normalizeDriveChoice(driveRaw);
        if (choice === DRIVE_ONLY_OPTION || choice === DRIVE_AND_TRACKDAY_OPTION) {
            submissionValues.join_drive = 'Yes';
            submissionValues.registration_type = choice === DRIVE_ONLY_OPTION ? 'drive_only' : 'drive_and_trackday';
        } else if (choice === TRACKDAY_ONLY_OPTION) {
            submissionValues.join_drive = 'No';
            submissionValues.registration_type = 'trackday_only';
        } else if (driveRaw) {
            submissionValues.join_drive = driveRaw;
        }

        if (driverCount > 1 && !isDriveOnlyTier(tierToUse)) {
            submissionValues.driver_count = String(driverCount);
            submissionValues.leader_name = submissionValues.name || submissionValues.leader_name || '';
        }
        if (tierToUse?.name) {
            submissionValues.package_name = tierToUse.name;
        }

        const fd = new FormData();
        const textResponses = {};
        allFields.forEach((f) => {
            if (FILE_TYPES.includes(f.type)) {
                const v = submissionFiles[f.fieldName];
                const arr = Array.isArray(v) ? v : (v ? [v] : []);
                arr.forEach((file) => fd.append(f.fieldName, file));
            } else if (submissionValues[f.fieldName] !== undefined) {
                textResponses[f.fieldName] = submissionValues[f.fieldName];
            }
        });
        ['name', 'email', 'phone', 'blood_group', 'vehicle_details', 'join_drive', 'driver_count', 'leader_name', 'package_name', 'registration_type', 'payment_screenshot_url', 'transaction_id'].forEach((key) => {
            if (submissionValues[key] !== undefined && textResponses[key] === undefined) {
                textResponses[key] = submissionValues[key];
            }
        });

        fd.append('responses', JSON.stringify(textResponses));
        if (paymentOrderId) fd.append('payment_order_id', paymentOrderId);
        if (paymentId) fd.append('payment_id', paymentId);
        if (tierIdToUse) fd.append('tierId', tierIdToUse);
        if (submissionValues.payment_screenshot_url) fd.append('paymentScreenshotUrl', String(submissionValues.payment_screenshot_url));
        if (submissionValues.transaction_id) fd.append('transactionId', String(submissionValues.transaction_id));
        if (couponCode.trim()) fd.append('couponCode', couponCode.trim().toUpperCase());

        const res = await fetch(`${API}/registrations/events/${eventId}/custom`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');
        sessionStorage.removeItem(draftKey(eventId));
        refreshNotifications?.();
        const regId = data.registrationId || data._id || data.registration?._id || data.registration?.id;
        if (regId) setRegistrationId(String(regId));
        void amountPaid;
        return data;
    }, [allFields, files, values, eventId, refreshNotifications, selectedTierId, getAuthToken, driverCount, selectedTier, pricedEvent, couponCode]);

    // Resume after Cashfree redirect
    useEffect(() => {
        if (!eventId || loading || resumeRef.current) return;
        const pending = getPendingPayment();
        const returnPath = `/events/${eventId}/register`;
        if (!shouldResumePendingPayment(pending, returnPath, location.search)) return;

        resumeRef.current = true;
        setPaying(true);
        setPaymentResumeError('');
        setError('');
        const token = getAuthToken();

        let draftValues = {};
        const rawDraft = sessionStorage.getItem(draftKey(eventId));
        if (rawDraft) {
            try {
                const parsed = JSON.parse(rawDraft);
                draftValues = parsed.values || {};
                if (Object.keys(draftValues).length > 0) setValues(draftValues);
                if (parsed.tierId) setSelectedTierId(parsed.tierId);
            } catch { /* ignore */ }
        }

        (async () => {
            try {
                if (!token) {
                    clearPendingPayment();
                    setShowLogin(true);
                    setPaymentResumeError('Please log in to complete registration after payment.');
                    setPaying(false);
                    return;
                }
                const { ok, data: v } = await verifyPaymentWithRetry(API, pending.orderId, { token, kind: 'fest' });
                if (!ok || !v?.verified) {
                    clearPendingPayment();
                    const unpaid = /pending|ACTIVE|not found|not successful/i.test(v?.message || '');
                    setPaymentResumeError(
                        unpaid
                            ? 'Payment was not completed. Tap Pay to try again.'
                            : (v?.message || 'Payment could not be verified.'),
                    );
                    setPaying(false);
                    return;
                }
                clearPendingPayment();
                const verified = buildVerifiedPaymentFields(v, pending.orderId);
                await submitRegistration({
                    paymentOrderId: verified.payment_order_id || pending.orderId,
                    paymentId: verified.payment_id,
                    amountPaid: breakdown.totalAmount,
                    valuesOverride: draftValues,
                    filesOverride: {},
                });
                sessionStorage.removeItem(draftKey(eventId));
                const params = new URLSearchParams(location.search);
                ['order_id', 'order_token', 'cf_payment_id', 'payment_id'].forEach((key) => params.delete(key));
                const nextSearch = params.toString();
                navigate(
                    { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
                    { replace: true },
                );
                setDone(true);
            } catch (e) {
                clearPendingPayment();
                setPaymentResumeError(e.message || 'Could not complete registration after payment');
            } finally {
                setPaying(false);
            }
        })();
    }, [eventId, loading, location.search, location.pathname, navigate, submitRegistration, breakdown.totalAmount]);

    const handleFinalSubmit = async () => {
        setError('');
        if (!isAuthed()) { setShowLogin(true); setError('Please log in to register.'); return; }

        const showId = event?._id || event?.id || eventId;

        if (tiersMode && !findEventShowTier(pricedEvent, selectedTierId)) {
            if (driveOnlyPath && driveOnlyTier?.id) {
                setSelectedTierId(driveOnlyTier.id);
            } else {
                setError(driveOnlyPath ? 'Drive-only package is missing. Please refresh.' : 'Please select a Trackday package.');
                const pkgIdx = allSteps.findIndex((s) => s.packageSelect);
                if (pkgIdx >= 0) setStep(pkgIdx);
                return;
            }
        }

        // Drive-only / free package — submit directly (no Cashfree)
        const feeNow = Math.max(0, Number(resolveEventShowFee(pricedEvent, selectedTierId || driveOnlyTier?.id).fee) || 0);
        if (feeNow <= 0 || driveOnlyPath) {
            setPaying(true);
            try {
                const tierForSubmit = selectedTierId || driveOnlyTier?.id || '';
                if (tierForSubmit && tierForSubmit !== selectedTierId) setSelectedTierId(tierForSubmit);
                await submitRegistration({ amountPaid: 0, tierIdOverride: tierForSubmit });
                setDone(true);
            } catch (e) {
                setError(e.message || 'Registration failed');
            } finally {
                setPaying(false);
            }
            return;
        }

        if (isOrganizerQr) {
            if (payableAmount > 0) {
                if (!paymentScreenshotUrl) {
                    setError('Please upload your payment screenshot.');
                    return;
                }
                if (String(transactionId || '').trim().length < 4) {
                    setError('Please enter your UPI / transaction ID (at least 4 characters).');
                    return;
                }
            }
            setPaying(true);
            try {
                await submitRegistration({
                    amountPaid: payableAmount,
                    valuesOverride: {
                        ...values,
                        payment_screenshot_url: payableAmount > 0 ? paymentScreenshotUrl : '',
                        transaction_id: payableAmount > 0 ? transactionId.trim() : '',
                    },
                });
                setDone(true);
            } catch (e) {
                setError(e.message || 'Registration failed');
            } finally {
                setPaying(false);
            }
            return;
        }

        const customer = pickCustomer(values);
        if (!customer.email) { setError('An email field is required to complete payment.'); return; }

        sessionStorage.setItem(draftKey(eventId), JSON.stringify({ values, tierId: selectedTierId }));
        setPaying(true);
        try {
            const token = getAuthToken();
            if (!token) {
                setShowLogin(true);
                setError('Please log in to register.');
                setPaying(false);
                return;
            }
            const showIdStr = String(showId || '').trim();
            const orderRes = await fetch(`${API}/payment/order`, {
                method: 'POST',
                headers: getBearerAuthHeaders(token),
                body: JSON.stringify({
                    eventShowId: showIdStr,
                    tierId: String(selectedTierId || '').trim() || undefined,
                    customerName: customer.name || user?.name || 'Customer',
                    customerEmail: customer.email || user?.email || '',
                    customerPhone: customer.phone || user?.phone || user?.phoneNumber || '',
                    couponCode: couponCode.trim() || undefined,
                }),
            });
            const order = await orderRes.json().catch(() => ({}));

            // Backend may report free package even if UI thought it was paid
            if (order?.free || /does not require payment/i.test(order?.message || '')) {
                await submitRegistration({ amountPaid: 0 });
                setDone(true);
                setPaying(false);
                return;
            }

            if (!orderRes.ok || !order.paymentSessionId) {
                const msg = order.message || order.error || `Payment failed (${orderRes.status})`;
                if (/select a registration tier|invalid registration tier|package/i.test(msg)) {
                    const pkgIdx = allSteps.findIndex((s) => s.packageSelect);
                    if (pkgIdx >= 0) setStep(pkgIdx);
                }
                setError(msg);
                setPaying(false);
                return;
            }

            let checkout;
            try {
                checkout = await openCashfreeCheckout({
                    paymentSessionId: order.paymentSessionId,
                    orderId: order.orderId,
                    returnPath: `/events/${eventId}/register`,
                    entityType: 'event',
                    cashfreeMode: order.cashfreeMode,
                });
            } catch (checkoutErr) {
                const { kind, message } = classifyCheckoutError(checkoutErr);
                setPaying(false);
                if (kind !== 'cancelled') {
                    retryRef.current = () => handleFinalSubmit();
                    setPaymentModal({ open: true, message, orderId: order.orderId });
                }
                return;
            }

            if (checkout?.redirectDeferred) {
                setStep(allSteps.length - 1);
                setPaying(true);
                return;
            }

            const checkoutPaymentId = checkout?.paymentDetails?.paymentId || checkout?.paymentDetails?.cf_payment_id || '';
            const vRes = await fetch(`${API}/payment/verify`, {
                method: 'POST',
                headers: getBearerAuthHeaders(token),
                body: JSON.stringify({ payment_order_id: order.orderId, payment_id: checkoutPaymentId }),
            });
            const v = await vRes.json();
            if (v.verified) {
                const verified = buildVerifiedPaymentFields(v, order.orderId);
                await submitRegistration({
                    paymentOrderId: verified.payment_order_id || order.orderId,
                    paymentId: verified.payment_id,
                    amountPaid: order.totalAmount ?? breakdown.totalAmount,
                });
                setDone(true);
                setPaying(false);
            } else {
                setError(v.message || 'Payment verification failed. Contact support.');
                setPaying(false);
            }
        } catch (e) {
            setError('Payment error: ' + e.message);
            setPaying(false);
        }
    };

    const uploadPaymentProof = async (file) => {
        if (!file) return;
        setUploadingProof(true);
        setError('');
        try {
            const token = getAuthToken();
            if (!token) {
                setShowLogin(true);
                throw new Error('Please log in to upload payment screenshot.');
            }
            const fd = new FormData();
            fd.append('image', file);
            const uploadRes = await fetch(`${API}/users/upload/image`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await uploadRes.json().catch(() => ({}));
            if (!uploadRes.ok) throw new Error(data.message || 'Upload failed');
            setPaymentScreenshotUrl(data.url || '');
        } catch (e) {
            setError(e.message || 'Could not upload screenshot');
        } finally {
            setUploadingProof(false);
        }
    };

    const applyCoupon = async () => {
        setCouponError('');
        const code = couponCode.trim();
        if (!code) {
            setCouponInfo(null);
            return;
        }
        setCouponLoading(true);
        try {
            const { data } = await publicFetchJSONRetry('/payment/coupon-validate', {
                method: 'POST',
                body: { eventShowId: eventId, tierId: selectedTierId || undefined, couponCode: code },
                retries: 4,
                timeout: 25000,
            });
            setCouponInfo(data);
            setShowCouponField(true);
        } catch (e) {
            setCouponInfo(null);
            const msg = e?.message || 'Invalid coupon';
            const network = e?.isNetworkError || e?.code === 'ERR_NETWORK' || /failed to fetch|network error|timeout/i.test(msg);
            setCouponError(
                network
                    ? 'Could not reach the server. Tap Apply again — or open in Chrome/Safari if you are in Instagram.'
                    : msg,
            );
        } finally {
            setCouponLoading(false);
        }
    };

    const next = () => {
        setError('');
        if (!isAuthed()) { setShowLogin(true); setError('Please log in to register.'); return; }
        if (!validateStep(step)) return;
        if (step < allSteps.length - 1) setStep((s) => s + 1);
    };
    const back = () => (step === 0 ? navigate(-1) : setStep((s) => s - 1));

    if (loading && !done && !paying) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (paying && !done) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex flex-col items-center justify-center px-4">
                {paymentResumeError ? (
                    <div className="text-center max-w-md">
                        <p className={`text-sm mb-6 ${isDark ? 'text-red-300' : 'text-red-600'}`}>{paymentResumeError}</p>
                        <button
                            type="button"
                            onClick={() => { setPaymentResumeError(''); setStep(allSteps.length - 1); }}
                            className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                        >
                            Back to registration
                        </button>
                    </div>
                ) : (
                    <>
                        <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
                        <p className={`text-sm text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Verifying payment and completing your registration...
                        </p>
                    </>
                )}
            </div>
        );
    }

    if (!event && !done) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Event not found.</p>
                <button type="button" onClick={() => navigate('/events')} className="text-[#0ECCEE] text-sm font-semibold">Browse events</button>
            </div>
        );
    }

    if (reg.status !== 'open' || !['internal_form', 'organizer_qr'].includes(reg.mode)) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Registration is not open for this event.</p>
                <button type="button" onClick={() => navigate(`/events/${eventId}`)} className="text-[#0ECCEE] text-sm font-semibold">Back to event</button>
            </div>
        );
    }

    if (done) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
                    <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {ticketPrice > 0
                            ? (isOrganizerQr
                                ? (reg.qrAutoConfirm ? '🎉 Registration Confirmed!' : '✅ Payment Proof Submitted!')
                                : '🎉 Payment Successful!')
                            : '🎉 Registration Confirmed!'}
                    </h1>
                    <p className={`mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        You're registered for <span className="text-[#0ECCEE] font-semibold">{title}</span>.
                    </p>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {isOrganizerQr && ticketPrice > 0 && !reg.qrAutoConfirm
                            ? 'Your registration is pending organizer approval. You can track status in My Bookings.'
                            : 'Download your ticket or view all bookings whenever you&apos;re ready.'}
                    </p>
                    <div className="flex flex-col gap-3">
                        {registrationId && (
                            <button type="button" onClick={() => navigate(`/qr-ticket/${registrationId}?type=event`, { state: { refreshBookings: true } })} className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">
                                Download Ticket
                            </button>
                        )}
                        <button type="button" onClick={() => goToBookings(navigate)} className={`w-full py-3.5 rounded-xl font-semibold transition ${registrationId ? (isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100') : 'text-black bg-[#0ECCEE] hover:opacity-90'}`}>
                            View My Bookings
                        </button>
                        <button type="button" onClick={() => navigate('/events')} className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Browse more events
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const current = allSteps[step];
    const isPaymentStep = !!current?.payment;

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-dvh pt-[calc(env(safe-area-inset-top)+0.5rem)] pb-[max(6rem,env(safe-area-inset-bottom)+5rem)]">
            <PaymentErrorModal
                open={paymentModal.open}
                message={paymentModal.message}
                orderId={paymentModal.orderId}
                onClose={() => setPaymentModal({ open: false, message: '', orderId: '' })}
                onRetry={() => { setPaymentModal({ open: false, message: '', orderId: '' }); retryRef.current?.(); }}
            />
            <div className="max-w-lg mx-auto px-4 sm:px-6">
                <div className="flex items-start gap-3 mb-4 pt-10">
                    <button onClick={back} className={`p-2 rounded-lg shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}>
                        <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`text-lg sm:text-xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Register: {title}</h1>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{current?.title}</p>
                    </div>
                </div>

                {error && (
                    <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>{error}</div>
                )}

                {!isAuthed() && (
                    <div className={`rounded-2xl p-4 mb-4 border text-center ${isDark ? 'bg-[#111213] border-gray-700' : 'bg-white border-gray-100 shadow-md'}`}>
                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Log in to register for this event.</p>
                        <button type="button" onClick={() => setShowLogin(true)} className="px-5 py-2.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">Log in to continue</button>
                    </div>
                )}

                <div className={`space-y-4 ${!isAuthed() ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Progress (trek-style stepper) */}
                    <div className={`rounded-2xl p-4 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {step + 1} of {allSteps.length}</span>
                        </div>
                        <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300" style={{ width: `${((step + 1) / allSteps.length) * 100}%` }} />
                        </div>
                        <div className="flex justify-between">
                            {allSteps.map((s, i) => (
                                <div key={s.title + i} className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        i === step ? 'bg-[#0ECCEE] text-black'
                                        : i < step ? 'bg-green-600 text-white'
                                        : isDark ? 'bg-gray-600 text-gray-300'
                                        : 'bg-gray-300 text-gray-600'
                                    }`}>
                                        {i < step ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-1 text-center max-w-[80px] truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected package summary — run-club style, shown on every step once chosen */}
                    {selectedTier && !current?.packageSelect && (
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Registration
                                </p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {title}
                                </p>
                            </div>
                            <div className="px-4 py-3 space-y-2.5">
                                <div className="min-w-0">
                                    <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Package</p>
                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {selectedTier.name}
                                    </p>
                                    {selectedTier.description ? (
                                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {selectedTier.description}
                                        </p>
                                    ) : null}
                                </div>
                                <div className={`flex justify-between text-sm py-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Drivers</span>
                                    <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {driverCount} {driverCount === 1 ? 'driver' : 'drivers'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Package fee</span>
                                    <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        {ticketPrice > 0 ? formatInr(ticketPrice) : 'Free'}
                                    </span>
                                </div>
                                {ticketPrice > 0 && breakdown.platformFee > 0 ? (
                                    <div className="flex justify-between text-sm">
                                        <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                            Platform fee ({platformFeePercent}%)
                                        </span>
                                        <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {formatInr(breakdown.platformFee)}
                                        </span>
                                    </div>
                                ) : null}
                                {ticketPrice > 0 ? (
                                    <div className={`flex justify-between text-sm pt-2 border-t font-bold text-[#0ECCEE] ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                        <span>Total</span>
                                        <span>₹{payableAmount.toLocaleString('en-IN')}</span>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    )}

                    {/* Package / form step */}
                    {!isPaymentStep && current?.packageSelect && (
                        <div className={`rounded-2xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                            <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {skippingDrive
                                    ? 'Select a Trackday package.'
                                    : 'Select your Trackday package. Independence Day Drive is included free.'}
                                {platformFeePercent > 0 ? ' Platform fee is added at checkout.' : ''}
                            </p>
                            <div className="space-y-4">
                                {(() => {
                                    const groups = [
                                        {
                                            key: 'solo',
                                            title: 'Solo Participant Package',
                                            note: null,
                                            tiers: visiblePackages.filter((t) => /solo/i.test(t.name)),
                                        },
                                        {
                                            key: 'trio',
                                            title: 'Trio Participant Package',
                                            note: 'Group package — 3 drivers. Register as the team leader.',
                                            tiers: visiblePackages.filter((t) => /trio/i.test(t.name)),
                                        },
                                        {
                                            key: 'quattro',
                                            title: 'Quattro Participant Package',
                                            note: 'Group package — 4 drivers. Register as the team leader.',
                                            tiers: visiblePackages.filter((t) => /quattro/i.test(t.name)),
                                        },
                                        {
                                            key: 'penta',
                                            title: 'Penta Participant Package',
                                            note: 'Group package — 5 drivers. Register as the team leader.',
                                            tiers: visiblePackages.filter((t) => /penta/i.test(t.name)),
                                        },
                                    ];
                                    const groupedIds = new Set(groups.flatMap((g) => g.tiers.map((t) => t.id)));
                                    const other = visiblePackages.filter((t) => !groupedIds.has(t.id));
                                    if (other.length) {
                                        groups.push({ key: 'other', title: 'Other packages', note: null, tiers: other });
                                    }
                                    return groups.filter((g) => g.tiers.length > 0).map((group) => (
                                        <div key={group.key} className="space-y-2">
                                            <div>
                                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {group.title}
                                                </p>
                                                {group.note ? (
                                                    <p className={`text-[11px] mt-0.5 leading-relaxed ${isDark ? 'text-amber-300/90' : 'text-amber-700'}`}>
                                                        {group.note}
                                                    </p>
                                                ) : null}
                                            </div>
                                            {group.tiers.map((tier) => {
                                                const selected = selectedTierId === tier.id;
                                                const count = resolveTierParticipantCount(tier);
                                                const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';
                                                return (
                                                    <button
                                                        key={tier.id}
                                                        type="button"
                                                        onClick={() => setSelectedTierId(tier.id)}
                                                        className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                                                            selected
                                                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/10'
                                                                : isDark
                                                                    ? 'border-gray-700 bg-[#1D1E20] hover:border-gray-500'
                                                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tier.name}</p>
                                                                {tier.description ? (
                                                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                        {tier.description}
                                                                    </p>
                                                                ) : null}
                                                                {count > 1 ? (
                                                                    <p className={`text-[11px] mt-1 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                        {count} drivers · leader registers
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            <span className={`shrink-0 text-sm font-bold ${Number(tier.fee) > 0 ? 'text-[#0ECCEE]' : 'text-green-500'}`}>
                                                                {feeLabel}
                                                            </span>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}

                    {!isPaymentStep && !current?.packageSelect && (
                        <div className={`rounded-2xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                            {current?.description && <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{current.description}</p>}
                            <div className="space-y-4">
                                {(current?.fields || []).map((field) => (
                                    <div key={field.id || field.fieldName}>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {field.label}{field.required && <span className="text-red-400 ml-1">*</span>}
                                        </label>
                                        {renderField(field)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Payment / confirm step */}
                    {isPaymentStep && (
                        <div className={`rounded-2xl overflow-hidden border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                            {ticketPrice > 0 ? (
                                <div className={`px-4 py-3.5 flex items-start justify-between gap-3 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                                    <div className="min-w-0">
                                        <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {isOrganizerQr ? 'Amount to pay' : 'Amount payable'}
                                        </p>
                                        <p className={`text-2xl font-bold leading-tight tabular-nums ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            ₹{payableAmount.toLocaleString('en-IN')}
                                        </p>
                                        <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            {couponInfo?.couponApplied
                                                ? `was ₹${Number(couponInfo.amountBeforeDiscount ?? breakdown.totalAmount).toLocaleString('en-IN')}`
                                                : selectedTier
                                                    ? selectedTier.name
                                                    : 'Registration fee'}
                                        </p>
                                    </div>
                                    {!showCouponField && !couponInfo?.couponApplied ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowCouponField(true)}
                                            className="shrink-0 text-xs font-semibold text-[#0ECCEE] pt-1"
                                        >
                                            Coupon
                                        </button>
                                    ) : null}
                                </div>
                            ) : (
                                <div className={`px-4 py-3.5 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Confirm Registration</p>
                                </div>
                            )}

                            {ticketPrice > 0 && (showCouponField || couponInfo?.couponApplied) ? (
                                <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-700/60 bg-[#111213]' : 'border-gray-200 bg-white'}`}>
                                    {couponInfo?.couponApplied ? (
                                        <div className={`rounded-xl px-3.5 py-3 border ${isDark ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-green-50 border-green-200'}`}>
                                            <div className="flex items-center gap-3">
                                                <CheckCircle size={18} className="text-emerald-400 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-sm font-bold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                                        Applied · {couponInfo.couponCode}
                                                    </p>
                                                    <p className={`text-[11px] mt-0.5 ${isDark ? 'text-emerald-200/70' : 'text-emerald-800/80'}`}>
                                                        You save ₹{Number(couponInfo.discountAmount || 0).toLocaleString('en-IN')}
                                                        {payableAmount === 0 ? ' · No payment needed' : ''}
                                                    </p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setCouponInfo(null);
                                                        setCouponCode('');
                                                        setCouponError('');
                                                    }}
                                                    className={`text-[11px] font-semibold shrink-0 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                                                >
                                                    Change
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex gap-2">
                                                <input
                                                    value={couponCode}
                                                    onChange={(e) => {
                                                        setCouponCode(e.target.value.toUpperCase());
                                                        setCouponInfo(null);
                                                        setCouponError('');
                                                    }}
                                                    placeholder="Enter coupon"
                                                    className={`flex-1 min-w-0 h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#0ECCEE] ${
                                                        isDark
                                                            ? 'bg-[#0E0E0F] border-gray-700 text-white placeholder-gray-600'
                                                            : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                                                    }`}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={applyCoupon}
                                                    disabled={couponLoading || !couponCode.trim()}
                                                    className="h-10 px-3.5 rounded-lg bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-50"
                                                >
                                                    {couponLoading ? '…' : 'Apply'}
                                                </button>
                                            </div>
                                            {couponError ? <p className="text-[11px] text-red-400 mt-1.5">{couponError}</p> : null}
                                        </>
                                    )}
                                </div>
                            ) : null}

                            <div className={`px-4 py-4 border-t space-y-3 ${isDark ? 'border-gray-700/60 bg-[#111213]' : 'border-gray-200 bg-white'}`}>
                            {ticketPrice > 0 ? (
                                <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {selectedTier ? (
                                        <div className="flex justify-between gap-4">
                                            <span>Package</span>
                                            <span className="text-right font-medium">{selectedTier.name}</span>
                                        </div>
                                    ) : null}
                                    <div className="flex justify-between gap-4"><span>Drivers</span><span>{driverCount} {driverCount === 1 ? 'driver' : 'drivers'}</span></div>
                                    <div className="flex justify-between gap-4"><span>Package fee</span><span>₹{breakdown.ticketPrice.toLocaleString('en-IN')}</span></div>
                                    {breakdown.platformFee > 0 ? (
                                        <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            <span>Platform fee ({platformFeePercent}%)</span>
                                            <span>₹{breakdown.platformFee}</span>
                                        </div>
                                    ) : null}
                                    {couponInfo?.couponApplied ? <div className="flex justify-between gap-4 text-green-400"><span>Coupon Discount</span><span>-₹{couponInfo.discountAmount}</span></div> : null}
                                    <div className={`flex justify-between gap-4 pt-2.5 mt-1 border-t font-bold text-base text-[#0ECCEE] ${isDark ? 'border-gray-700' : 'border-gray-100'}`}><span>Amount Payable</span><span>₹{payableAmount.toLocaleString('en-IN')}</span></div>
                                    {isOrganizerQr && payableAmount > 0 ? (
                                        <div className={`mt-3 rounded-xl border p-3 space-y-3 ${isDark ? 'border-gray-700 bg-[#1D1E20]' : 'border-gray-100 bg-white shadow-sm'}`}>
                                            {reg.paymentQR ? (
                                                <div className="flex items-start gap-3">
                                                    <img src={reg.paymentQR} alt="Payment QR" className="h-28 w-28 rounded-xl object-contain bg-white p-1.5 border border-gray-200 shrink-0" />
                                                    <div className="flex-1 min-w-0 pt-0.5">
                                                        <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                            Pay ₹{payableAmount.toLocaleString('en-IN')} via UPI
                                                        </p>
                                                        {reg.paymentUpiId ? (
                                                            <p className={`text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                UPI ID: <span className="font-semibold break-all">{reg.paymentUpiId}</span>
                                                            </p>
                                                        ) : null}
                                                        {reg.paymentQRMessage ? (
                                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{reg.paymentQRMessage}</p>
                                                        ) : (
                                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                Scan QR, pay the amount above, then upload screenshot + UTR.
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-red-400">Payment QR not configured yet. Please contact organizer.</p>
                                            )}
                                            <label className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer ${
                                                isDark ? 'border-gray-600 bg-[#111213]' : 'border-gray-200 bg-white'
                                            } ${uploadingProof ? 'opacity-60 pointer-events-none' : ''}`}>
                                                {paymentScreenshotUrl ? (
                                                    <img src={paymentScreenshotUrl} alt="" className="size-12 rounded-lg object-cover shrink-0" />
                                                ) : (
                                                    <div className={`size-12 rounded-lg border border-dashed flex items-center justify-center text-[10px] ${isDark ? 'border-gray-600 text-gray-500' : 'border-gray-300 text-gray-400'}`}>
                                                        Proof
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p className={`text-xs font-semibold ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                                                        {uploadingProof ? 'Uploading…' : paymentScreenshotUrl ? 'Screenshot added' : 'Upload payment screenshot'}
                                                    </p>
                                                    <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        {paymentScreenshotUrl ? 'Tap to change' : 'Choose from gallery or camera'}
                                                    </p>
                                                </div>
                                                <span className="text-xs font-semibold text-[#0ECCEE] shrink-0">
                                                    {paymentScreenshotUrl ? 'Change' : 'Add'}
                                                </span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) uploadPaymentProof(file);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                            <input
                                                type="text"
                                                value={transactionId}
                                                onChange={(e) => setTransactionId(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                                                placeholder="UPI / transaction ID (UTR)"
                                                className={`w-full px-3 py-2.5 rounded-xl border text-sm ${isDark ? 'bg-[#111213] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                                            />
                                        </div>
                                    ) : isOrganizerQr && payableAmount === 0 ? (
                                        <p className={`text-xs mt-2 ${isDark ? 'text-emerald-300/80' : 'text-emerald-700'}`}>
                                            Coupon covers the full amount — no QR payment needed.
                                        </p>
                                    ) : (
                                        <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Secure payment via Cashfree
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {driveOnlyPath
                                        ? 'Independence Day Drive only — free. Confirm to finish registration (no payment).'
                                        : 'This registration is free. Click confirm to complete.'}
                                </p>
                            )}
                            </div>
                        </div>
                    )}

                    {/* Nav buttons */}
                    <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-100 shadow-md'}`}>
                        <button type="button" onClick={back} disabled={paying} className={`px-4 sm:px-6 py-3 rounded-xl border font-medium text-sm ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}>
                            {step === 0 ? 'Cancel' : 'Previous'}
                        </button>
                        {isPaymentStep ? (
                            <button type="button" onClick={handleFinalSubmit} disabled={paying} className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:opacity-90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                {paying ? (<><Loader className="w-4 h-4 animate-spin" /> Processing...</>) : ticketPrice > 0
                                    ? (isOrganizerQr
                                        ? (payableAmount <= 0
                                            ? 'Confirm Registration'
                                            : (reg.qrAutoConfirm ? 'Submit Payment Proof & Register' : 'Submit Proof for Approval'))
                                        : `Pay ₹${payableAmount.toLocaleString('en-IN')} & Register`)
                                    : 'Confirm Registration'}
                            </button>
                        ) : (
                            <button type="button" onClick={next} disabled={paying} className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:opacity-90 active:scale-[0.98] transition-all text-sm">
                                Next Step
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin
                        googleOnly
                        title="Sign in to register"
                        subtitle="One tap with Google — then finish registration"
                        onClose={() => setShowLogin(false)}
                    />
                </div>
            )}
            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={() => setShowRegister(false)} onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }} />
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, CheckCircle, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';

import { openCashfreeCheckout, buildVerifiedPaymentFields, classifyCheckoutError } from '../../utils/useCashfree';
import PaymentErrorModal from '../../components/PaymentErrorModal';
import {
    getPendingPayment,
    clearPendingPayment,
    shouldResumePendingPayment,
} from '../../utils/deepLinks';
import {
    goToBookings,
    verifyPaymentWithRetry,
} from '../../utils/paymentNavigation';
import { buildTrekPriceBreakdown } from '../../utils/platformFee';
import { resolveTrekPlatformFeePercent } from '../../utils/trekRegistrationFee';
import { isTrekFormFieldEmpty } from '../../constants/trekFormFields';
import { mergeRunFormFields } from '../../utils/formFieldDedupe';
import { API_BASE_URL, publicFetchJSONRetry } from '../../services/api/client';
import {
    resolveAuthToken,
    getBearerAuthHeaders,
    hasUsableAuthToken,
    isAuthFailureMessage,
} from '../../utils/authToken';
import { useBookingSuccessPopup } from '../../hooks/useSuccessPopup';
import { evaluateUserRegistrationAccess, getGenderPhaseStepNotice, isGenderPhaseRestricted } from '../../utils/trekGenderRegistration';
import GenderQuickPick from '../../components/GenderQuickPick';
import { trekPath, toSlug } from '../../utils/slugRoutes';
import {
    classifyDetailLoadError,
    isTransientDetailError,
    createDetailCache,
    DETAIL_FETCH_OPTS,
} from '../../utils/detailPageLoad';

const API = API_BASE_URL;
const trekDetailCache = createDetailCache('crwdctrl_trek_detail_v1_');

/** True when nav/cache trek belongs to the current /trek/:id route (id or name slug). */
function trekMatchesRouteParam(trek, routeParam) {
    if (!trek || !routeParam) return false;
    const param = String(routeParam);
    const tid = String(trek._id || trek.id || '');
    if (tid && tid === param) return true;
    const nameSlug = toSlug(trek.trekName || trek.title || '');
    return Boolean(nameSlug && nameSlug === param);
}

function trekDraftKey(trekId) {
    return `trek_booking_draft_${trekId}`;
}

function generateDates(baseDate) {
    const base = baseDate ? new Date(baseDate) : new Date();
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i * 7);
        dates.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
    }
    return dates;
}

const STEPS = ['Date & Time', 'Your Details', 'Confirm'];

function getInitialTrekBookingUi(trekId, search) {
    const defaults = {
        step: 1,
        payDone: false,
        paying: false,
        selDate: '',
        selTime: '',
        people: 1,
        extraFields: {},
        bookingGender: '',
    };
    if (!trekId) return defaults;

    let draft = {};
    const raw = sessionStorage.getItem(trekDraftKey(trekId));
    if (raw) {
        try {
            draft = JSON.parse(raw);
        } catch {
            draft = {};
        }
    }

    const returnPath = `/trek/${trekId}/book`;
    const resumingPayment = shouldResumePendingPayment(
        getPendingPayment(),
        returnPath,
        search,
    );

    if (resumingPayment) {
        return {
            step: 3,
            payDone: false,
            paying: true,
            selDate: draft.selDate || '',
            selTime: draft.selTime || '',
            people: Math.max(1, Number(draft.people) || 1),
            extraFields: draft.extraFields || {},
            bookingGender: draft.bookingGender || '',
        };
    }

    return {
        step: 1,
        payDone: false,
        paying: false,
        selDate: draft.selDate || '',
        selTime: draft.selTime || '',
        people: Math.max(1, Number(draft.people) || 1),
        extraFields: draft.extraFields || {},
        bookingGender: draft.bookingGender || '',
    };
}

export default function TrekBookingPage() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { id }    = useParams();
    const initialUi = getInitialTrekBookingUi(id, location.search);
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
    const paymentResumeRef = useRef(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);

    const isAuthed = useCallback(() => {
        // Context token can lag one tick behind storage after modal login — check both.
        return hasUsableAuthToken(authToken) || hasUsableAuthToken(null) || Boolean(isAuthenticated);
    }, [authToken, isAuthenticated]);

    const handleCloseLogin = () => setShowLogin(false);
    const handleCloseRegister = () => setShowRegister(false);
    const handleSwitchToRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };
    const handleSwitchToLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    useEffect(() => {
        // Dismiss auth modals as soon as a session exists (context or storage).
        if (isAuthed()) {
            setShowLogin(false);
            setShowRegister(false);
            setError((prev) => (isAuthFailureMessage(prev) ? '' : prev));
        }
    }, [authToken, isAuthenticated, isAuthed]);

    // Force-login effect moved below once trek.requireLogin is known

    const [trek, setTrek] = useState(() => {
        const navTrek = location.state?.trek;
        return trekMatchesRouteParam(navTrek, id) ? navTrek : null;
    });
    const [genderRegistration, setGenderRegistration] = useState(() => (
        trekMatchesRouteParam(location.state?.trek, id)
            ? (location.state?.genderRegistration || null)
            : null
    ));
    // Always fetch before painting registration UI so default/demo fields never flash for another trek
    const [loadingTrek, setLoadingTrek] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [step,        setStep]       = useState(initialUi.step);
    const [selDate,     setSelDate]    = useState(initialUi.selDate);
    const [selTime,     setSelTime]    = useState(initialUi.selTime);
    const [people,      setPeople]     = useState(initialUi.people);
    const [extraFields, setExtraFields] = useState(initialUi.extraFields);
    const [error,       setError]      = useState('');
    const [paying,      setPaying]     = useState(initialUi.paying);
    const [payDone,     setPayDone]    = useState(initialUi.payDone);
    const [paymentId,   setPaymentId]  = useState('');
    const [bookingId,   setBookingId]  = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponInfo, setCouponInfo] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
    const [postPaymentError, setPostPaymentError] = useState('');
    const [bookingGender, setBookingGender] = useState(initialUi.bookingGender || '');
    const [existingBookingId, setExistingBookingId] = useState('');
    const [existingBookingStatus, setExistingBookingStatus] = useState('');
    const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [uploadingProof, setUploadingProof] = useState(false);
    const [upiCopied, setUpiCopied] = useState(false);
    const [pendingReviewDone, setPendingReviewDone] = useState(false);
    const [bookingAccessToken, setBookingAccessToken] = useState('');
    const retryCheckoutRef = useRef(null);

    const requireLogin = trek?.registration?.requireLogin !== false;

    const requireAuthOrLogin = useCallback((message = 'Please log in to book this trek.') => {
        if (!requireLogin) return true;
        if (isAuthed()) return true;
        setShowLogin(true);
        setError(message);
        return false;
    }, [isAuthed, requireLogin]);

    const trekName  = trek?.trekName || trek?.title || 'Trek';
    const fee       = Number(trek?.registrationFee) || 0;
    const regMode = trek?.registration?.mode || 'internal_form';
    const isOrganizerQr = regMode === 'organizer_qr';
    const paymentQR = trek?.registration?.paymentQR || '';
    const paymentUpiId = trek?.registration?.paymentUpiId || '';
    const paymentQRMessage = trek?.registration?.paymentQRMessage || '';
    const showSuccess = step === 3 && payDone && !paying;
    const showProcessing = step === 3 && paying;
    const loggedIn = isAuthed();

    useEffect(() => {
        if (authLoading || isAuthProcessing || isRedirectProcessing) return;
        if (!trek || loadingTrek) return;
        if (loggedIn) {
            setShowLogin(false);
            return;
        }
        if (requireLogin) setShowLogin(true);
    }, [authLoading, isAuthProcessing, isRedirectProcessing, loggedIn, requireLogin, trek, loadingTrek]);

    const trekAccessQuery = bookingAccessToken
        ? `?type=trek&access=${encodeURIComponent(bookingAccessToken)}`
        : '?type=trek';

    useBookingSuccessPopup(showSuccess && !pendingReviewDone, {
        name: trekName,
        paid: payDone && fee > 0,
        bookingId,
        ticketType: 'trek',
    });
    const platformPct = resolveTrekPlatformFeePercent(trek?.platformFeePercent, 3);
    const reg       = trek?.registration || {};
    // Soft UI ceiling only — trek maxParticipants is the real capacity limit on the server.
    // 0 in admin = unlimited; legacy "10" default is also treated as unlimited.
    const configuredMax = Number(reg.maxPeoplePerBooking);
    const maxPeople = Number.isFinite(configuredMax) && configuredMax > 0 && configuredMax !== 10
        ? Math.min(200, configuredMax)
        : 200;
    const dates = useMemo(
        () => (reg.availableDates?.length ? reg.availableDates : generateDates(trek?.trekDate)),
        [reg.availableDates, trek?.trekDate],
    );
    const times = useMemo(
        () => (reg.timeSlots?.length ? reg.timeSlots : trek?.departureTime ? [trek.departureTime] : ['6:00 AM', '8:30 AM']),
        [reg.timeSlots, trek?.departureTime],
    );
    useEffect(() => {
        setPeople((p) => Math.min(maxPeople, Math.max(1, Number(p) || 1)));
    }, [trek?._id, trek?.id, maxPeople]);

    const genderAccess = useMemo(
        () => evaluateUserRegistrationAccess({
            genderRegistration,
            userGender: bookingGender,
            people,
        }),
        [genderRegistration, bookingGender, people],
    );

    const step1Blocked = !bookingGender || (
        genderRegistration?.enabled
        && bookingGender
        && genderAccess.canRegister === false
    );

    const phaseStepNotice = genderRegistration?.enabled
        && isGenderPhaseRestricted(genderRegistration.phase)
        ? getGenderPhaseStepNotice(genderRegistration.phase)
        : null;

    const showGenderPhaseError = Boolean(
        genderRegistration?.enabled
        && bookingGender
        && genderAccess.canRegister === false
        && isGenderPhaseRestricted(genderRegistration.phase),
    );

    const regSchema = useMemo(() => {
        // While loading, skip DEFAULT demo fields — avoid flashing generic registration form
        if (loadingTrek) return [];
        // Always merge name/phone/email defaults so payment + tickets never fail with
        // "Email is required" when admins only added custom fields.
        const custom = (reg.formSchema || []).filter((f) => f?.label?.trim() && f?.fieldName?.trim());
        return mergeRunFormFields(custom);
    }, [reg.formSchema, loadingTrek]);

    const sheetsInstructions = reg.formInstructions || '';

    useEffect(() => {
        const trekId = id || location.state?.trek?._id || location.state?.trek?.id;
        const navTrek = location.state?.trek;
        const seedOk = trekMatchesRouteParam(navTrek, id);
        const cached = trekId ? trekDetailCache.read(trekId) : null;
        const cacheOk = trekMatchesRouteParam(cached, id);
        const fallback = seedOk ? navTrek : (cacheOk ? cached : null);

        // Always wait for API — seeded cards lack formSchema/fee and flash demo defaults + Free
        setLoadingTrek(true);
        // Keep existingBookingId until the authenticated refetch returns — clearing it
        // on login made the page flash back to the login wall.
        setError('');
        setPostPaymentError('');
        setLoadError('');
        setTrek(fallback);
        setGenderRegistration(seedOk ? (location.state?.genderRegistration || null) : null);

        if (!trekId) {
            setLoadingTrek(false);
            return undefined;
        }

        const controller = new AbortController();
        (async () => {
            try {
                const res = await publicFetchJSONRetry(`/treks/${encodeURIComponent(trekId)}`, {
                    signal: controller.signal,
                    ...DETAIL_FETCH_OPTS,
                    headers: getBearerAuthHeaders(authToken),
                });
                if (controller.signal.aborted) return;
                const d = res?.data;
                if (d?.trek) {
                    setTrek(d.trek);
                    setGenderRegistration(d.genderRegistration || null);
                    trekDetailCache.write(trekId, d.trek);
                    if (d.trek._id) trekDetailCache.write(String(d.trek._id), d.trek);
                    if (d.trek.slug) trekDetailCache.write(String(d.trek.slug), d.trek);
                    if (d.userBooking?.bookingId) {
                        setExistingBookingId(String(d.userBooking.bookingId));
                        setExistingBookingStatus(String(d.userBooking.status || 'confirmed'));
                    } else if (isAuthenticated || hasUsableAuthToken(authToken)) {
                        // Logged in and no booking for this trek — clear stale guest/previous state
                        setExistingBookingId('');
                        setExistingBookingStatus('');
                    }
                    setLoadError('');
                } else if (fallback) {
                    setTrek(fallback);
                    setLoadError('');
                } else {
                    setTrek(null);
                    setLoadError('not_found');
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                if (fallback) {
                    setTrek(fallback);
                    setLoadError('');
                } else {
                    setTrek(null);
                    setLoadError(classifyDetailLoadError(err));
                }
            } finally {
                if (!controller.signal.aborted) setLoadingTrek(false);
            }
        })();

        return () => controller.abort();
    }, [id, isAuthenticated, authToken, location.state]);

    useEffect(() => {
        if (!trek) return;
        const canonical = `${trekPath(trek)}/book`;
        if (window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [trek, navigate, location.state]);

    useEffect(() => {
        if (!trek) return;
        setSelDate((prev) => prev || dates[0] || '');
        setSelTime((prev) => prev || times[0] || '');
    }, [trek, dates, times]);

    useEffect(() => {
        const trekId = id || trek?._id || trek?.id;
        if (!trekId) return;

        const returnPath = `/trek/${trekId}/book`;
        if (shouldResumePendingPayment(getPendingPayment(), returnPath, location.search)) {
            return;
        }

        // Clear form whenever route trek changes or user starts a fresh booking
        if (location.state?.freshBooking) {
            sessionStorage.removeItem(trekDraftKey(trekId));
            setStep(1);
            setPayDone(false);
            setPaying(false);
            setExtraFields({});
            setBookingGender('');
            setSelDate('');
            setSelTime('');
            setCouponCode('');
            setCouponInfo(null);
            setCouponError('');
            setError('');
            return;
        }

        if (loadingTrek) return;

        const raw = sessionStorage.getItem(trekDraftKey(trekId));
        if (!raw) {
            setExtraFields({});
            setBookingGender('');
            setSelDate('');
            setSelTime('');
            setStep(1);
            return;
        }
        try {
            const draft = JSON.parse(raw);
            setExtraFields(draft.extraFields || {});
            setSelDate(draft.selDate || '');
            setSelTime(draft.selTime || '');
            setPeople(Math.min(maxPeople, Math.max(1, Number(draft.people) || 1)));
            setBookingGender(draft.bookingGender || '');
            setStep(1);
            setPayDone(false);
            setPaying(false);
        } catch {
            /* ignore corrupt draft */
        }
    }, [id, trek?._id, trek?.id, loadingTrek, location.search, location.state?.freshBooking, maxPeople]);

    useEffect(() => {
        const trekId = id || trek?._id || trek?.id;
        if (!user || !trekId || sessionStorage.getItem(trekDraftKey(trekId))) return;
        setExtraFields((prev) => {
            if (Object.keys(prev).length > 0) return prev;
            return {
                full_name: user.name || user.fullName || '',
                email: user.email || '',
                contact_no: user.phone || user.mobile || '',
            };
        });
    }, [user, id, trek?._id, trek?.id]);

    const scrollFieldIntoView = useCallback((e) => {
        const el = e.target;
        window.setTimeout(() => {
            el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }, 280);
    }, []);

    const saveDraft = useCallback((overrides = {}) => {
        const trekId = id || trek?._id || trek?.id;
        if (!trekId) return;
        sessionStorage.setItem(trekDraftKey(trekId), JSON.stringify({
            extraFields,
            selDate,
            selTime,
            people,
            step,
            bookingGender,
            ...overrides,
        }));
    }, [id, trek, extraFields, selDate, selTime, people, step, bookingGender]);

    const buildFormData = useCallback(() => {
        if (bookingGender) {
            return { ...extraFields, gender: bookingGender };
        }
        return extraFields;
    }, [extraFields, bookingGender]);

    const baseFee = fee * people;
    // Organizer QR: user pays trek fee via UPI (no CrwdCtrl platform fee)
    const { platformFee = 0, totalAmount: total = 0 } = fee > 0
        ? (isOrganizerQr
            ? { platformFee: 0, totalAmount: baseFee }
            : buildTrekPriceBreakdown(baseFee, platformPct))
        : { platformFee: 0, totalAmount: 0 };
    const payableAmount = isOrganizerQr ? total : (couponInfo?.amountAfterDiscount ?? total);

    const inp = `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`;

    const renderField = (field) => {
        const val = extraFields[field.fieldName] ?? (field.type === 'checkbox' ? [] : '');
        const onChange = (v) => setExtraFields(f => ({ ...f, [field.fieldName]: v }));

        if (field.type === 'textarea') {
            return (
                <textarea rows={3} placeholder={field.placeholder || ''}
                    value={val}
                    onChange={e => onChange(e.target.value)}
                    onFocus={scrollFieldIntoView}
                    className={`${inp} resize-none`} />
            );
        }
        if (field.type === 'select') {
            return (
                <select value={val} onChange={e => onChange(e.target.value)} onFocus={scrollFieldIntoView} className={inp}>
                    <option value="">Select...</option>
                    {(field.options || []).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        }
        if (field.type === 'radio') {
            return (
                <div className="space-y-2">
                    {(field.options || []).filter(Boolean).map((o) => (
                        <label key={o} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="radio"
                                name={field.fieldName}
                                value={o}
                                checked={val === o}
                                onChange={() => onChange(o)}
                                className="accent-[#0ECCEE]"
                            />
                            <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{o}</span>
                        </label>
                    ))}
                </div>
            );
        }
        if (field.type === 'checkbox') {
            const arr = Array.isArray(val) ? val : [];
            const toggle = (o) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
            return (
                <div className="space-y-2">
                    {(field.options || []).filter(Boolean).map((o) => (
                        <label key={o} className="flex items-center gap-2.5 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={arr.includes(o)}
                                onChange={() => toggle(o)}
                                className="accent-[#0ECCEE]"
                            />
                            <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{o}</span>
                        </label>
                    ))}
                </div>
            );
        }
        if (field.type === 'agree') {
            const checked = val === true || val === 'yes' || val === 'true';
            return (
                <label
                    className={`flex items-start gap-3 cursor-pointer rounded-xl border-2 p-3.5 transition-colors ${
                        checked
                            ? isDark ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/5' : 'border-[#0ECCEE]/40 bg-[#0ECCEE]/5'
                            : isDark ? 'border-gray-600 bg-[#1D1E20] hover:border-gray-500' : 'border-gray-300 bg-white hover:border-gray-400'
                    }`}
                >
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onChange(e.target.checked ? 'yes' : '')}
                        className="accent-[#0ECCEE] mt-0.5 shrink-0 size-4"
                    />
                    <span className={`text-sm leading-relaxed ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {field.label || 'I agree to the terms and conditions'}
                        {field.required && <span className="text-red-400 ml-1">*</span>}
                    </span>
                </label>
            );
        }
        if (field.type === 'file' || field.type === 'image') {
            return (
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${isDark ? 'border-gray-600 hover:border-[#0ECCEE] bg-[#1D1E20]' : 'border-gray-300 hover:border-[#0ECCEE] bg-white'}`}>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {val ? String(val).slice(0, 24) + '…' : field.placeholder || (field.type === 'image' ? 'Choose image' : 'Choose file')}
                    </span>
                    <input
                        type="file"
                        accept={field.type === 'image' ? 'image/*' : 'image/*,.pdf'}
                        className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f.name); }}
                    />
                </label>
            );
        }
        return (
            <input type={field.type || 'text'} placeholder={field.placeholder || ''}
                value={val}
                onChange={e => onChange(e.target.value)}
                onFocus={scrollFieldIntoView}
                autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'name'}
                className={inp} />
        );
    };

    const submitTrekRegistration = async ({
        paymentOrderId,
        paymentId,
        amountPaid,
        formData = buildFormData(),
        booking = {},
    }) => {
        // Prefer Mongo id so register works even if route param is a name slug
        const trekId = trek?._id || trek?.id || id;
        if (!trekId) throw new Error('Trek not found');

        if (requireLogin && !isAuthed()) {
            setShowLogin(true);
            throw new Error('Please log in to complete your booking.');
        }
        const headers = isAuthed()
            ? getBearerAuthHeaders(authToken)
            : { 'Content-Type': 'application/json' };
        const regRes = await fetch(`${API}/treks/${trekId}/register`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                formData,
                bookingDetails: {
                    date: booking.date ?? selDate,
                    time: booking.time ?? selTime,
                    people,
                    amountPaid: amountPaid ?? 0,
                    paymentId: paymentId || '',
                    payment_order_id: paymentOrderId || '',
                    paymentScreenshotUrl: booking.paymentScreenshotUrl || '',
                    transactionId: booking.transactionId || '',
                },
            }),
        });
        const regData = await regRes.json().catch(() => ({}));
        if (!regRes.ok) {
            if (regRes.status === 401 || isAuthFailureMessage(regData.message)) {
                if (requireLogin || regData.requireLogin) {
                    setShowLogin(true);
                    throw new Error('Please log in again to complete your booking.');
                }
            }
            if (regRes.status === 409 && /already have a registration|already has a registration/i.test(regData.message || '')) {
                setExistingBookingId(regData.bookingId ? String(regData.bookingId) : 'existing');
                setExistingBookingStatus(/waiting for organizer/i.test(regData.message || '') ? 'pending' : 'confirmed');
                if (regData.accessToken) setBookingAccessToken(String(regData.accessToken));
            }
            throw new Error(regData.message || 'Registration failed after payment');
        }
        sessionStorage.removeItem(trekDraftKey(String(id || trekId)));
        refreshNotifications();
        const savedBookingId = regData.bookingId || regData._id || '';
        if (savedBookingId) setBookingId(String(savedBookingId));
        if (regData.accessToken) setBookingAccessToken(String(regData.accessToken));
        return regData;
    };

    const uploadPaymentProof = async (file) => {
        if (!file) return;
        setUploadingProof(true);
        setError('');
        try {
            const fd = new FormData();
            fd.append('image', file);
            const token = resolveAuthToken(authToken);
            const trekId = trek?._id || trek?.id || id;
            const uploadUrl = (!requireLogin || !token)
                ? `${API}/treks/${trekId}/payment-screenshot`
                : `${API}/users/upload/image`;
            const uploadRes = await fetch(uploadUrl, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
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
            const res = await fetch(`${API}/payment/coupon-validate`, {
                method: 'POST',
                headers: hasUsableAuthToken(authToken)
                    ? getBearerAuthHeaders(authToken)
                    : { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trekId: trek?._id || trek?.id || id, people, couponCode: code }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Invalid coupon');
            setCouponInfo(data);
        } catch (e) {
            setCouponInfo(null);
            setCouponError(e.message || 'Invalid coupon');
        } finally {
            setCouponLoading(false);
        }
    };

    useEffect(() => {
        const trekId = id || trek?._id || trek?.id;
        if (!trekId || loadingTrek || paymentResumeRef.current) return;

        const pending = getPendingPayment();
        const returnPath = `/trek/${trekId}/book`;
        if (!shouldResumePendingPayment(pending, returnPath, location.search)) return;

        paymentResumeRef.current = true;
        setStep(3);
        setPayDone(false);
        setPaying(true);
        setError('');

        (async () => {
            let paymentVerified = false;
            try {
                let draft = {};
                const rawDraft = sessionStorage.getItem(trekDraftKey(trekId));
                if (rawDraft) {
                    try { draft = JSON.parse(rawDraft); } catch { /* ignore */ }
                }
                if (draft.extraFields) setExtraFields(draft.extraFields);
                if (draft.selDate) setSelDate(draft.selDate);
                if (draft.selTime) setSelTime(draft.selTime);
                if (draft.bookingGender) setBookingGender(draft.bookingGender);
                const resumePeople = Math.min(maxPeople, Math.max(1, Number(draft.people) || people || 1));
                if (draft.people) setPeople(resumePeople);

                const { ok, data: v } = await verifyPaymentWithRetry(API, pending.orderId, { kind: 'trek' });

                if (!ok || !v?.verified) {
                    clearPendingPayment();
                    const unpaid = /pending|ACTIVE|not found|not successful/i.test(v.message || '');
                    setStep(2);
                    setPayDone(false);
                    setPostPaymentError('');
                    setError(
                        unpaid
                            ? 'Payment was not completed. Tap Pay to try again.'
                            : (v.message || 'Payment verification failed after redirect. Contact support.'),
                    );
                    setPaying(false);
                    return;
                }

                paymentVerified = true;
                setPostPaymentError('');

                const verified = buildVerifiedPaymentFields(v, pending.orderId);
                setPaymentId(verified.payment_id);
                setPayDone(true);
                await submitTrekRegistration({
                    paymentOrderId: verified.payment_order_id || pending.orderId,
                    paymentId: verified.payment_id,
                    amountPaid: v.totalAmount ?? total,
                    formData: draft.extraFields
                        ? { ...draft.extraFields, ...(draft.bookingGender ? { gender: draft.bookingGender } : {}) }
                        : buildFormData(),
                    booking: {
                        date: draft.selDate || selDate,
                        time: draft.selTime || selTime,
                        people: resumePeople,
                    },
                });
                clearPendingPayment();
                setStep(3);
                const params = new URLSearchParams(location.search);
                ['order_id', 'order_token', 'cf_payment_id', 'payment_id'].forEach((key) => params.delete(key));
                const nextSearch = params.toString();
                navigate(
                    { pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : '' },
                    { replace: true },
                );
            } catch (e) {
                if (paymentVerified) {
                    setStep(3);
                    setPayDone(true);
                    setPostPaymentError(e.message || 'Payment received but booking could not be completed. Check My Bookings.');
                    setError('');
                } else {
                    setStep(2);
                    setPayDone(false);
                    setPostPaymentError('');
                    setError(e.message || 'Could not complete booking after payment');
                }
            } finally {
                setPaying(false);
            }
        })();
    }, [id, trek, loadingTrek, navigate, location.search]);

    const next = async () => {
        setError('');
        if (!requireAuthOrLogin('Please log in to book this trek.')) {
            return;
        }
        if (step === 1) {
            if (!bookingGender) {
                setError('Please select Female or Male to continue.');
                return;
            }
            if (genderRegistration?.enabled && genderAccess.canRegister === false) {
                setError(genderAccess.message || 'You cannot register with this selection right now.');
                return;
            }
            saveDraft({ step: 2, bookingGender });
            setStep(2);
            return;
        }

        if (step === 2) {
            if (genderRegistration?.enabled && !genderAccess.canRegister) {
                setError(genderAccess.message || 'You cannot register for this trek right now.');
                return;
            }
            const missing = regSchema.filter((f) => f.required && isTrekFormFieldEmpty(f, extraFields[f.fieldName]));
            if (missing.length > 0) { setError(`Please fill: ${missing.map(f => f.label).join(', ')}`); return; }

            const customerEmail = String(
                extraFields.email
                || extraFields.e_mail_id
                || extraFields.e_mail
                || user?.email
                || '',
            ).trim();
            if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
                setError('Please enter a valid email — needed for your ticket and confirmation.');
                return;
            }
            // Keep email on formData so backend extractEmail always finds it
            const formData = {
                ...buildFormData(),
                email: customerEmail,
            };
            if (!extraFields.email) {
                setExtraFields((f) => ({ ...f, email: customerEmail }));
            }

            if (!requireAuthOrLogin('Your session expired. Please log in again to pay.')) {
                setPaying(false);
                return;
            }

            if (total <= 0) {
                try {
                    await submitTrekRegistration({ amountPaid: 0, formData });
                    setStep(3);
                    setPayDone(true);
                    setPaying(false);
                } catch (e) {
                    if (/already have a registration/i.test(e.message || '')) {
                        setExistingBookingId('existing');
                        setExistingBookingStatus(/waiting for organizer/i.test(e.message || '') ? 'pending' : 'confirmed');
                    }
                    setError(e.message || 'Registration failed');
                }
                return;
            }

            if (isOrganizerQr) {
                if (!paymentQR) {
                    setError('Organizer payment QR is not configured yet. Please contact the trek organizer.');
                    return;
                }
                if (!paymentScreenshotUrl) {
                    setError('Please upload your payment screenshot.');
                    return;
                }
                if (String(transactionId || '').trim().length < 4) {
                    setError('Please enter your UPI / transaction ID (at least 4 characters).');
                    return;
                }
                setPaying(true);
                try {
                    const regData = await submitTrekRegistration({
                        amountPaid: payableAmount,
                        formData,
                        booking: {
                            paymentScreenshotUrl,
                            transactionId,
                        },
                    });
                    setStep(3);
                    setPayDone(true);
                    setPendingReviewDone(!!regData?.pendingReview);
                } catch (e) {
                    if (/already have a registration/i.test(e.message || '')) {
                        setExistingBookingId(e.bookingId || 'existing');
                        setExistingBookingStatus(/waiting for organizer/i.test(e.message || '') ? 'pending' : 'confirmed');
                    }
                    setError(e.message || 'Registration failed');
                } finally {
                    setPaying(false);
                }
                return;
            }

            saveDraft({ step: 2, extraFields: { ...extraFields, email: customerEmail } });

            setPaying(true);
            try {
                const res = await fetch(`${API}/payment/trek-order`, {
                    method: 'POST',
                    headers: hasUsableAuthToken(authToken)
                        ? getBearerAuthHeaders(authToken)
                        : { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        trekId: trek?._id || trek?.id || id,
                        trekName,
                        people,
                        formData,
                        customerName: extraFields.full_name || extraFields.name || extraFields.fullname || '',
                        customerEmail,
                        customerPhone:
                            extraFields.contact_no ||
                            extraFields.phone ||
                            extraFields.contact ||
                            extraFields.mobile ||
                            '',
                        couponCode: couponCode.trim() || undefined,
                    }),
                });
                const order = await res.json().catch(() => ({}));
                if (!res.ok) {
                    if (res.status === 401 || isAuthFailureMessage(order.message) || order.requireLogin) {
                        setShowLogin(true);
                        setError(order.message || 'Please log in to continue payment.');
                        setPaying(false);
                        return;
                    }
                    if (res.status === 409 && /already have a registration|already has a registration/i.test(order.message || '')) {
                        setExistingBookingId(order.bookingId ? String(order.bookingId) : 'existing');
                        setExistingBookingStatus(/waiting for organizer/i.test(order.message || '') ? 'pending' : 'confirmed');
                        if (order.accessToken) setBookingAccessToken(String(order.accessToken));
                    }
                    setError(order.message || 'Failed to create order.');
                    setPaying(false);
                    return;
                }
                if (!order.paymentSessionId) {
                    setError('Payment session missing from server. Restart backend and try again.');
                    setPaying(false);
                    return;
                }

                saveDraft({ step: 2, extraFields: buildFormData(), selDate, selTime, people, bookingGender });

                let checkoutResult;
                try {
                    checkoutResult = await openCashfreeCheckout({
                        paymentSessionId: order.paymentSessionId,
                        orderId: order.orderId,
                        returnPath: `/trek/${id || trek?._id || trek?.id}/book`,
                        entityType: 'trek',
                        cashfreeMode: order.cashfreeMode,
                    });
                } catch (checkoutErr) {
                    const { kind, message } = classifyCheckoutError(checkoutErr);
                    setStep(2);
                    setPayDone(false);
                    setPaying(false);
                    if (kind !== 'cancelled') {
                        retryCheckoutRef.current = () => next();
                        setPaymentModal({ open: true, message, orderId: order.orderId });
                    }
                    return;
                }

                if (checkoutResult?.redirectDeferred) {
                    setStep(3);
                    setPaying(true);
                    return;
                }

                setStep(3);
                setPaying(true);

                const checkoutPaymentId =
                    checkoutResult?.paymentDetails?.paymentId ||
                    checkoutResult?.paymentDetails?.cf_payment_id ||
                    '';

                const { ok, data: v } = await verifyPaymentWithRetry(API, order.orderId, {
                    kind: 'trek',
                    token: resolveAuthToken(authToken),
                });
                if (ok && v?.verified) {
                    const verified = buildVerifiedPaymentFields(v, order.orderId);
                    setPaymentId(verified.payment_id || checkoutPaymentId);
                    await submitTrekRegistration({
                        paymentOrderId: verified.payment_order_id || order.orderId,
                        paymentId: verified.payment_id || checkoutPaymentId,
                        amountPaid: order.totalAmount ?? total,
                    });
                    setPayDone(true);
                    setPaying(false);
                } else {
                    setStep(2);
                    setPayDone(false);
                    setPaying(false);
                    setError(v?.message || 'Payment verification failed. Contact support.');
                }
            } catch (e) {
                setStep(2);
                setPayDone(false);
                setPaying(false);
                setError('Payment error: ' + e.message);
            }
        }
    };

    const back = () => step === 1 ? navigate(-1) : setStep(s => s - 1);

    const hasStoredSession = loggedIn || hasUsableAuthToken(authToken) || hasUsableAuthToken(null);
    const waitingOnAuth = !hasStoredSession && (authLoading || isAuthProcessing || isRedirectProcessing);

    if ((loadingTrek || waitingOnAuth) && !showSuccess && !showProcessing) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (!trek && !showSuccess && !showProcessing) {
        const isNetwork = isTransientDetailError(loadError);
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isNetwork ? "Couldn't load this trek" : 'Trek not found'}
                </p>
                <p className={`text-sm text-center max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isNetwork
                        ? 'Slow network or server waking up — tap Retry.'
                        : 'Open booking from the trek page, or the link may be outdated.'}
                </p>
                {isNetwork ? (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                    >
                        Retry
                    </button>
                ) : null}
                <button type="button" onClick={() => navigate('/treks')} className="text-[#0ECCEE] text-sm font-semibold">
                    Browse treks
                </button>
            </div>
        );
    }

    if (existingBookingId && !showSuccess && !showProcessing) {
        const ticketId = existingBookingId !== 'existing' ? existingBookingId : '';
        const isPending = existingBookingStatus === 'pending';
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <CheckCircle className={`w-14 h-14 mx-auto mb-5 ${isPending ? 'text-amber-400' : 'text-[#0ECCEE]'}`} />
                    <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isPending ? 'Awaiting approval' : 'Already registered'}
                    </h1>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isPending ? (
                            <>
                                Your payment for <span className="text-[#0ECCEE] font-semibold">{trekName}</span> is waiting for organizer approval. You’ll get a ticket once it’s confirmed.
                            </>
                        ) : (
                            <>
                                You already have one registration for <span className="text-[#0ECCEE] font-semibold">{trekName}</span> with this account. Only one ticket is allowed per login.
                            </>
                        )}
                    </p>
                    <div className="flex flex-col gap-3">
                        {ticketId && !isPending ? (
                            <button
                                type="button"
                                onClick={() => navigate(`/qr-ticket/${ticketId}${trekAccessQuery}`)}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                            >
                                View Ticket
                            </button>
                        ) : null}
                        {ticketId && isPending ? (
                            <button
                                type="button"
                                onClick={() => navigate(`/registration-details/${ticketId}${trekAccessQuery}`)}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                            >
                                View registration
                            </button>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => goToBookings(navigate)}
                            className={`w-full py-3.5 rounded-xl font-semibold transition ${
                                ticketId
                                    ? isDark
                                        ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                                        : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                                    : 'text-black bg-[#0ECCEE] hover:opacity-90'
                            }`}
                        >
                            View My Bookings
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/trek/${id || trek?._id || trek?.id}`)}
                            className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
                                isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Back to trek
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (showProcessing) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center px-4">
                <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
                <p className={`text-sm text-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    Verifying payment and confirming your booking...
                </p>
            </div>
        );
    }

    // ── Post-payment registration error ──
    if (postPaymentError && step === 3 && payDone && !paying) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <p className={`text-sm mb-6 ${isDark ? 'text-red-300' : 'text-red-600'}`}>{postPaymentError}</p>
                    <div className="flex flex-col gap-3">
                        <button
                            type="button"
                            onClick={() => goToBookings(navigate)}
                            className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                        >
                            View My Bookings
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPostPaymentError(''); setStep(2); setPayDone(false); }}
                            className={`w-full py-3.5 rounded-xl font-semibold transition ${
                                isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                            }`}
                        >
                            Back to booking form
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Success Screen ──
    if (showSuccess) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <CheckCircle className={`w-16 h-16 mx-auto mb-6 ${pendingReviewDone ? 'text-amber-400' : 'text-green-500'}`} />
                    <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {pendingReviewDone
                            ? 'Payment submitted'
                            : payDone ? '🎉 Payment Successful!' : '🎉 Booking Confirmed!'}
                    </h1>
                    <p className={`mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {pendingReviewDone ? (
                            <>Your payment for <span className="text-[#0ECCEE] font-semibold">{trekName}</span> is waiting for organizer approval.</>
                        ) : (
                            <>Your booking for <span className="text-[#0ECCEE] font-semibold">{trekName}</span> has been confirmed.</>
                        )}
                    </p>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {pendingReviewDone
                            ? 'You’ll get a confirmation email and ticket once the trek organizer approves your screenshot.'
                            : 'Download your ticket or view all bookings whenever you’re ready.'}
                    </p>

                    <div className={`rounded-xl p-5 mb-6 text-left ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Booking Details</p>
                        {[
                            { label: 'Date',  value: selDate || '—' },
                            { label: 'Time',  value: selTime },
                            { label: 'Tickets', value: '1 person' },
                            { label: 'Trek Fee', value: fee > 0 ? `₹${baseFee.toLocaleString('en-IN')}` : 'Free' },
                            ...(total > 0 ? [{ label: 'Total Paid', value: `₹${total.toLocaleString('en-IN')}` }] : []),
                            ...(paymentId    ? [{ label: 'Payment ID',  value: paymentId.slice(0, 18) + '…' }] : []),
                        ].map(r => (
                            <div key={r.label} className={`flex justify-between text-sm py-2 border-b last:border-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{r.label}</span>
                                <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {bookingId && !pendingReviewDone && (
                            <button
                                type="button"
                                onClick={() => navigate(`/qr-ticket/${bookingId}${trekAccessQuery}`, { state: { refreshBookings: true } })}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                            >
                                Download Ticket
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => goToBookings(navigate)}
                            className={`w-full py-3.5 rounded-xl font-semibold transition ${
                                bookingId && !pendingReviewDone
                                    ? isDark
                                        ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                                        : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                                    : 'text-black bg-[#0ECCEE] hover:opacity-90'
                            }`}
                        >
                            View My Bookings
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/treks')}
                            className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${
                                isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            Browse more treks
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crwdctrl-page crwdctrl-page--content trek-booking-page min-h-dvh pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)] pb-[max(6rem,env(safe-area-inset-bottom)+5rem)]">
            <PaymentErrorModal
                open={paymentModal.open}
                message={paymentModal.message}
                orderId={paymentModal.orderId}
                onClose={() => setPaymentModal({ open: false, message: '', orderId: '' })}
                onRetry={() => {
                    setPaymentModal({ open: false, message: '', orderId: '' });
                    retryCheckoutRef.current?.();
                }}
            />
            <div className="max-w-lg mx-auto px-4 sm:px-6">

                {/* Header */}
                <div className="flex items-start gap-3 mb-4 sm:mb-6 pt-10">
                    <button
                        onClick={back}
                        className={`p-2 rounded-lg transition-colors shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}
                    >
                        <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Book: {trekName}
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {STEPS[step - 1]}
                        </p>
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                        {error}
                    </div>
                )}

                {!loggedIn && requireLogin && (
                    <div className={`rounded-xl p-4 mb-4 border text-center ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Log in to book this trek and receive booking notifications.
                        </p>
                        <button
                            type="button"
                            onClick={() => setShowLogin(true)}
                            className="px-5 py-2.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                        >
                            Log in to continue
                        </button>
                    </div>
                )}

                {!loggedIn && !requireLogin && (
                    <div className={`rounded-xl p-3 mb-4 border text-sm ${isDark ? 'bg-[#1D1E20] border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
                        Guest checkout is on — no account needed. Optionally{' '}
                        <button type="button" onClick={() => setShowLogin(true)} className="text-[#0ECCEE] font-semibold underline">
                            log in
                        </button>
                        {' '}to save this booking under My Bookings.
                    </div>
                )}

                {/* Card */}
                <div className={`rounded-2xl p-4 sm:p-6 border ${isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'} ${!loggedIn && requireLogin ? 'opacity-50 pointer-events-none' : ''}`}>

                    {/* Step Progress */}
                    <div className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {step} of {STEPS.length}</span>
                        </div>
                        <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div
                                className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300"
                                style={{ width: `${(step / STEPS.length) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between">
                            {STEPS.map((s, i) => (
                                <div key={s} className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        i + 1 === step ? 'bg-[#0ECCEE] text-black'
                                        : i + 1 < step  ? 'bg-green-600 text-white'
                                        : isDark        ? 'bg-gray-600 text-gray-300'
                                        :                  'bg-gray-300 text-gray-600'
                                    }`}>
                                        {i + 1 < step ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-1 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Step 1: Date, Time, People ── */}
                    {step === 1 && (
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>
                                Select Date & Time
                            </h3>
                            <div className="space-y-5">

                                {/* Date chips */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Choose Date</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {dates.map((d, i) => (
                                            <button key={i} type="button" onClick={() => setSelDate(d)}
                                                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors whitespace-nowrap ${
                                                    selDate === d
                                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                                        : isDark ? 'border-gray-600 text-gray-300 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                                }`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Time chips */}
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Departure Time</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {times.map(t => (
                                            <button key={t} type="button" onClick={() => setSelTime(t)}
                                                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                                                    selTime === t
                                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 text-[#0ECCEE]'
                                                        : isDark ? 'border-gray-600 text-gray-300 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'
                                                }`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {phaseStepNotice ? (
                                    <p className={`text-xs leading-relaxed rounded-lg px-3 py-2.5 ${isDark ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/25' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'}`}>
                                        {phaseStepNotice}
                                    </p>
                                ) : null}
                                <GenderQuickPick
                                    value={bookingGender}
                                    onChange={(g) => {
                                        setBookingGender(g);
                                        setError('');
                                    }}
                                    label="You are"
                                    error={showGenderPhaseError ? genderAccess.message : undefined}
                                />

                                {/* Party size — one registration per login */}
                                <div className={`rounded-xl p-3 border flex items-center justify-between gap-4 ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <div>
                                        <p className={`text-xs font-medium mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>People</p>
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() => { setCouponInfo(null); setPeople((p) => Math.max(1, p - 1)); }}
                                                className={`w-8 h-8 rounded-l-lg flex items-center justify-center border transition-colors ${isDark ? 'bg-[#111213] border-gray-600 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}
                                            >
                                                <ChevronLeft size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                            </button>
                                            <div className={`w-10 h-8 flex items-center justify-center border-y ${isDark ? 'bg-[#111213] border-gray-600' : 'bg-white border-gray-300'}`}>
                                                <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{people}</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setCouponInfo(null); setPeople((p) => Math.min(maxPeople, p + 1)); }}
                                                className={`w-8 h-8 rounded-r-lg flex items-center justify-center border transition-colors ${isDark ? 'bg-[#111213] border-gray-600 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}
                                            >
                                                <ChevronRight size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                            </button>
                                        </div>
                                        <p className={`text-[10px] mt-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            One registration per login
                                            {Number.isFinite(configuredMax) && configuredMax > 0 && configuredMax !== 10
                                                ? ` · max ${maxPeople}`
                                                : ''}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            {people > 1 ? 'Entry total' : 'Entry Fee'}
                                        </p>
                                        {fee > 0 ? (
                                            <>
                                                <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    ₹{baseFee.toLocaleString('en-IN')}
                                                </p>
                                                {people > 1 ? (
                                                    <p className={`text-[10px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        ₹{fee.toLocaleString('en-IN')} × {people}
                                                    </p>
                                                ) : null}
                                            </>
                                        ) : (
                                            <p className="text-lg font-bold text-green-500">Free</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Form Fields ── */}
                    {step === 2 && (
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>
                                Your Details
                            </h3>

                            {sheetsInstructions && (
                                <div className={`rounded-lg p-3 mb-4 border text-xs ${isDark ? 'bg-amber-900/20 border-amber-700/40 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                                    {sheetsInstructions}
                                </div>
                            )}

                            <div className="space-y-4">
                                {regSchema.map(field => (
                                    <div key={field.id || field.fieldName}>
                                        {field.type === 'agree' ? (
                                            renderField(field)
                                        ) : (
                                            <>
                                                <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {field.label}
                                                    {field.required && <span className="text-red-400 ml-1">*</span>}
                                                </label>
                                                {renderField(field)}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isOrganizerQr && fee > 0 ? (
                                <div className={`mt-5 rounded-xl border p-4 space-y-3 ${isDark ? 'border-gray-700 bg-[#0E0E0F]' : 'border-gray-200 bg-white'}`}>
                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Pay ₹{payableAmount.toLocaleString('en-IN')} via UPI
                                    </p>
                                    <div className="flex gap-3 items-start">
                                        {paymentQR ? (
                                            <div className="shrink-0 size-[132px] rounded-xl overflow-hidden border border-gray-700 bg-white p-1">
                                                <img src={paymentQR} alt="Payment QR" className="size-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className={`shrink-0 size-[132px] rounded-xl flex items-center justify-center text-[10px] text-center px-2 ${isDark ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-500'}`}>
                                                QR not set
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1 space-y-2">
                                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {trek?.registration?.qrAutoConfirm
                                                    ? 'Scan QR or pay on UPI, then upload proof. Your booking confirms as soon as you submit.'
                                                    : 'Scan QR or pay on UPI, then upload proof. The organizer will approve your booking.'}
                                            </p>
                                            {paymentUpiId ? (
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            await navigator.clipboard.writeText(paymentUpiId);
                                                            setUpiCopied(true);
                                                            setTimeout(() => setUpiCopied(false), 2000);
                                                        } catch {
                                                            setError('Could not copy UPI ID');
                                                        }
                                                    }}
                                                    className={`w-full flex items-center justify-between gap-2 h-10 px-3 rounded-lg text-left ${
                                                        isDark ? 'bg-[#1D1E20] border border-gray-700' : 'bg-gray-50 border border-gray-200'
                                                    }`}
                                                >
                                                    <span className={`text-xs font-mono truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        {paymentUpiId}
                                                    </span>
                                                    <span className="text-xs font-bold text-[#0ECCEE] shrink-0">
                                                        {upiCopied ? 'Copied' : 'Copy'}
                                                    </span>
                                                </button>
                                            ) : null}
                                            {paymentQRMessage ? (
                                                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{paymentQRMessage}</p>
                                            ) : null}
                                        </div>
                                    </div>
                                    <label className={`flex items-center gap-3 px-1 py-2 cursor-pointer ${uploadingProof ? 'opacity-60 pointer-events-none' : ''}`}>
                                        {paymentScreenshotUrl ? (
                                            <img src={paymentScreenshotUrl} alt="" className="size-11 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className={`size-11 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] border border-gray-700' : 'bg-gray-100'}`}>
                                                {uploadingProof
                                                    ? <Loader className="w-4 h-4 animate-spin text-[#0ECCEE]" />
                                                    : <ImagePlus size={18} className="text-[#0ECCEE]" />}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {uploadingProof ? 'Uploading…' : paymentScreenshotUrl ? 'Screenshot added' : 'Payment screenshot'}
                                            </p>
                                            <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                {paymentScreenshotUrl ? 'Tap to change' : 'Gallery or camera'}
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                e.target.value = '';
                                                uploadPaymentProof(file);
                                            }}
                                        />
                                    </label>
                                    <input
                                        type="text"
                                        value={transactionId}
                                        onChange={(e) => setTransactionId(e.target.value)}
                                        placeholder="UPI / Transaction ID"
                                        className={inp}
                                    />
                                </div>
                            ) : null}
                        </div>
                    )}

                    {/* Payment breakdown (step 2, paid trek) */}
                    {step === 2 && fee > 0 && !isOrganizerQr && (
                        <div className={`mt-4 rounded-xl p-4 border overflow-hidden ${isDark ? 'bg-[#111213] border-[#0ECCEE]/30' : 'bg-gray-50 border-[#0ECCEE]/40'}`}>
                            <div className="mb-3 min-w-0">
                                <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Coupon code</p>
                                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 w-full items-center">
                                    <input
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                        placeholder="Enter coupon"
                                        className={`w-full min-w-0 h-10 px-3 rounded-lg border text-sm focus:outline-none focus:border-[#0ECCEE] ${isDark ? 'bg-[#1D1E20] border-gray-700 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={applyCoupon}
                                        disabled={couponLoading || !couponCode.trim()}
                                        className="h-10 shrink-0 px-4 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm whitespace-nowrap disabled:opacity-50"
                                    >
                                        {couponLoading ? '…' : (couponInfo?.couponApplied && couponInfo?.couponCode === couponCode.trim().toUpperCase() ? 'Applied' : 'Apply')}
                                    </button>
                                </div>
                                {couponError ? <p className="text-xs text-red-400 mt-1">{couponError}</p> : null}
                                {couponInfo?.couponApplied ? (
                                    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}`}>
                                        Coupon `{couponInfo.couponCode}` applied · You save ₹{couponInfo.discountAmount}
                                    </div>
                                ) : null}
                            </div>
                            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Breakdown</p>
                            <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <div className="flex justify-between gap-4">
                                    <span>Ticket Price</span>
                                    <span>₹{fee.toLocaleString('en-IN')}</span>
                                </div>
                                {platformFee > 0 ? (
                                    <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        <span>Platform Fee ({platformPct}%)</span>
                                        <span>₹{platformFee}</span>
                                    </div>
                                ) : null}
                                {couponInfo?.couponApplied ? (
                                    <div className="flex justify-between gap-4 text-green-400">
                                        <span>Coupon Discount</span>
                                        <span>-₹{couponInfo.discountAmount}</span>
                                    </div>
                                ) : null}
                                <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]">
                                    <span>Amount Payable</span>
                                    <span>₹{payableAmount.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {platformFee > 0
                                    ? 'Includes all charges · Secure payment via Cashfree'
                                    : 'Secure payment via Cashfree · No platform fee'}
                            </p>
                        </div>
                    )}

                    {/* Nav buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-5">
                        <button
                            type="button"
                            onClick={back}
                            disabled={paying}
                            className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}
                        >
                            {step === 1 ? 'Cancel' : 'Previous Step'}
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            disabled={paying || (step === 1 && step1Blocked)}
                            className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ECCEE]/10 disabled:opacity-60"
                        >
                            {paying ? (
                                <><Loader className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : step === 2 && total > 0 ? (
                                isOrganizerQr
                                    ? `Submit payment · ₹${payableAmount.toLocaleString('en-IN')}`
                                    : `Pay ₹${payableAmount.toLocaleString('en-IN')} & Book`
                            ) : step === 2 ? (
                                'Confirm Booking'
                            ) : (
                                'Next Step'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                </div>
            )}

            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

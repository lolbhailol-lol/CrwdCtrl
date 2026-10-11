import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, CheckCircle, ImagePlus, ChevronLeft, ChevronRight, Check, Upload } from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { useNotifications } from '../../../context/NotificationsContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import CrwdCtrlRegister from '../../../pages/auth/register';
import { buildVerifiedPaymentFields } from '../../../utils/useCashfree';
import { runRazorpayCheckoutAndVerify, sanitizeRazorpayContact } from '../../../utils/useRazorpay';
import { useInAppBack } from '../../../hooks/useInAppBack';

import PaymentErrorModal from '../../../components/PaymentErrorModal';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import { RegistrationStatusVisual } from '../../../components/RegistrationStatusVisual';
import {
    getPendingPayment,
    clearPendingPayment,
    shouldResumePendingPayment,
} from '../../../utils/deepLinks';
import {
    goToBookings,
    verifyPaymentWithRetry,
    pollPaymentUntilVerified,
    PAYMENT_BACKGROUND_MAX_WAIT_MS,
    classifyVerifyError,
    clearCashfreeReturnAndPending,
} from '../../../utils/paymentNavigation';
import { buildTrekPriceBreakdown } from '../../../utils/platformFee';
import { resolveTrekPlatformFeePercent } from '../../../utils/trekRegistrationFee';
import { isTrekFormFieldEmpty } from '../../../constants/trekFormFields';
import { mergeRunFormFields } from '../../../utils/formFieldDedupe';
import { API_BASE_URL, publicFetchJSONRetry } from '../../../services/api/client';
import {
    resolveAuthToken,
    getBearerAuthHeaders,
    hasUsableAuthToken,
    isAuthFailureMessage,
} from '../../../utils/authToken';
import { useBookingSuccessPopup } from '../../../hooks/useSuccessPopup';
import { evaluateUserRegistrationAccess, getGenderPhaseStepNotice, isGenderPhaseRestricted } from '../../../utils/trekGenderRegistration';
import GenderQuickPick from '../../../components/GenderQuickPick';
import { trekPath, entityMatchesRouteParam } from '../../../utils/slugRoutes';
import {
    classifyDetailLoadError,
    createDetailCache,
    DETAIL_FETCH_OPTS,
} from '../../../utils/detailPageLoad';
import {
    createAuthModalHandlers,
    getInitialBookingUiState,
    runCashfreeCheckoutAndVerify,
    setPaymentFlowToStepTwo,
    setPaymentFlowToSuccess,
} from '../../../utils/bookingFlowShared';
import { openLoginSheet } from '../../../utils/loginFlow';

const API = API_BASE_URL;
const trekDetailCache = createDetailCache('crwdctrl_trek_detail_v1_');

/** True when nav/cache trek belongs to the current /trek/:id route (id, slug, or alias). */
function trekMatchesRouteParam(trek, routeParam) {
    return entityMatchesRouteParam(trek, routeParam, ['trekName', 'title']);
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

const STEPS_TIME = ['Date & Time', 'Your Details', 'Confirm'];
const STEPS_MEETING = ['Date & Meet', 'Your Details', 'Confirm'];

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
    return getInitialBookingUiState({
        entityId: trekId,
        search,
        returnPath: `/trek/${trekId}/book`,
        defaults,
        draftKeyFactory: trekDraftKey,
        restoreStepFromDraft: false,
    });
}

export default function TrekBookingPage() {
    const navigate  = useNavigate();
    const goBack = useInAppBack();
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

    const {
        handleCloseLogin,
        handleCloseRegister,
        handleSwitchToLogin,
    } = createAuthModalHandlers({ setShowLogin, setShowRegister });

    const openLogin = useCallback(() => {
        openLoginSheet({
            returnPath: `${window.location.pathname}${window.location.search || ''}`,
        });
        setShowLogin(true);
    }, []);

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
        openLogin();
        setError(message);
        return false;
    }, [isAuthed, requireLogin, openLogin]);

    const trekName  = trek?.trekName || trek?.title || 'Trek';
    const fee       = Number(trek?.registrationFee) || 0;
    const regMode = trek?.registration?.mode || 'internal_form';
    const isOrganizerQr = regMode === 'organizer_qr';
    const communityGateway = trek?.communityId?.paymentGateway === 'razorpay' ? 'razorpay' : 'cashfree';
    const usesRazorpay = !isOrganizerQr && communityGateway === 'razorpay';
    const paymentQR = trek?.registration?.paymentQR || '';
    const paymentUpiId = trek?.registration?.paymentUpiId || '';
    const paymentQRMessage = trek?.registration?.paymentQRMessage || '';
    const showSuccess = step === 3 && payDone && !paying;
    const showProcessing = step === 3 && paying;
    const loggedIn = isAuthed();

    useEffect(() => {
        if (loggedIn && showLogin) setShowLogin(false);
    }, [loggedIn, showLogin]);

    const trekAccessQuery = bookingAccessToken
        ? `?type=trek&access=${encodeURIComponent(bookingAccessToken)}`
        : '?type=trek';

    useBookingSuccessPopup(showSuccess && !pendingReviewDone, {
        name: trekName,
        paid: payDone && fee > 0,
        bookingId,
        ticketType: 'trek',
    });
    const platformPct = usesRazorpay
        ? 0
        : resolveTrekPlatformFeePercent(trek?.platformFeePercent, 3);
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
    const meetingPoints = useMemo(
        () => (Array.isArray(reg.locationOptions) ? reg.locationOptions.map((s) => String(s || '').trim()).filter(Boolean) : []),
        [reg.locationOptions],
    );
    const times = useMemo(
        () => (reg.timeSlots?.length ? reg.timeSlots : trek?.departureTime ? [trek.departureTime] : []),
        [reg.timeSlots, trek?.departureTime],
    );
    /** Prefer meeting points on step 1 when organizer added them; else fall back to time slots. */
    const step1Choices = meetingPoints.length ? meetingPoints : times;
    const step1ChoiceLabel = meetingPoints.length ? 'Meeting Point' : 'Departure Time';
    const usesMeetingPoints = meetingPoints.length > 0;
    const STEPS = usesMeetingPoints ? STEPS_MEETING : STEPS_TIME;
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
        step1Choices.length > 0 && !selTime
    ) || (
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
                    if (d.userBooking?.bookingId && d.userBooking.status === 'pending') {
                        setExistingBookingId(String(d.userBooking.bookingId));
                        setExistingBookingStatus('pending');
                    } else if (isAuthenticated || hasUsableAuthToken(authToken)) {
                        // Logged in — confirmed past bookings do not block a new ticket
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
            confirmStep: 3,
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
    // Organizer QR / Razorpay: user pays trek fee only (no CrwdCtrl platform fee)
    const { platformFee = 0, totalAmount: total = 0 } = fee > 0
        ? (isOrganizerQr || usesRazorpay
            ? { platformFee: 0, totalAmount: baseFee }
            : buildTrekPriceBreakdown(baseFee, platformPct))
        : { platformFee: 0, totalAmount: 0 };
    const payableAmount = isOrganizerQr ? total : (couponInfo?.amountAfterDiscount ?? total);

    const inp = `w-full px-3.5 py-2.5 rounded-xl border text-sm transition-all duration-200 outline-none ${
        isDark
            ? 'bg-[#15171C] border-white/10 text-white placeholder-gray-500 hover:border-white/20 focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]/30 focus:bg-[#181B22]'
            : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 hover:border-gray-300 focus:bg-white focus:border-[#0ECCEE] focus:ring-1 focus:ring-[#0ECCEE]/30'
    }`;

    const renderField = (field) => {
        const val = extraFields[field.fieldName] ?? (field.type === 'checkbox' ? [] : '');
        const onChange = (v) => setExtraFields(f => ({ ...f, [field.fieldName]: v }));

        if (field.type === 'textarea') {
            return (
                <textarea rows={3} placeholder={field.placeholder || ''}
                    value={val}
                    onChange={e => onChange(e.target.value)}
                    onFocus={scrollFieldIntoView}
                    className={`${inp} resize-none leading-relaxed`} />
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
                    {(field.options || []).filter(Boolean).map((o) => {
                        const isChecked = val === o;
                        return (
                            <label
                                key={o}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                    isChecked
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                                        : isDark
                                            ? 'border-white/10 bg-[#151618] hover:border-white/20'
                                            : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all shrink-0 ${
                                    isChecked
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]'
                                        : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white'
                                }`}>
                                    {isChecked && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
                                </div>
                                <input
                                    type="radio"
                                    name={field.fieldName}
                                    value={o}
                                    checked={isChecked}
                                    onChange={() => onChange(o)}
                                    className="sr-only"
                                />
                                <span className={`text-sm font-medium ${
                                    isChecked
                                        ? (isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold')
                                        : (isDark ? 'text-gray-300' : 'text-gray-700')
                                }`}>
                                    {o}
                                </span>
                            </label>
                        );
                    })}
                </div>
            );
        }
        if (field.type === 'checkbox') {
            const arr = Array.isArray(val) ? val : [];
            const toggle = (o) => onChange(arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]);
            return (
                <div className="space-y-2">
                    {(field.options || []).filter(Boolean).map((o) => {
                        const isChecked = arr.includes(o);
                        return (
                            <label
                                key={o}
                                className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                                    isChecked
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                                        : isDark
                                            ? 'border-white/10 bg-[#151618] hover:border-white/20'
                                            : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
                                }`}
                            >
                                <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                    isChecked
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE] text-black'
                                        : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white'
                                }`}>
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                </div>
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggle(o)}
                                    className="sr-only"
                                />
                                <span className={`text-sm font-medium ${
                                    isChecked
                                        ? (isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold')
                                        : (isDark ? 'text-gray-300' : 'text-gray-700')
                                }`}>
                                    {o}
                                </span>
                            </label>
                        );
                    })}
                </div>
            );
        }
        if (field.type === 'agree') {
            const checked = val === true || val === 'yes' || val === 'true';
            return (
                <label
                    className={`flex items-start gap-3 cursor-pointer rounded-xl border p-3.5 transition-all select-none ${
                        checked
                            ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                            : isDark ? 'border-white/10 bg-[#151618] hover:border-white/20' : 'border-gray-200 bg-gray-50/60 hover:border-gray-300'
                    }`}
                >
                    <div className={`w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                        checked
                            ? 'border-[#0ECCEE] bg-[#0ECCEE] text-black'
                            : isDark ? 'border-gray-600 bg-transparent' : 'border-gray-300 bg-white'
                    }`}>
                        {checked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onChange(e.target.checked ? 'yes' : '')}
                        className="sr-only"
                    />
                    <span className={`text-sm leading-relaxed ${checked ? (isDark ? 'text-white font-semibold' : 'text-gray-900 font-semibold') : (isDark ? 'text-gray-300' : 'text-gray-700')}`}>
                        {field.label || 'I agree to the terms and conditions'}
                        {field.required && <span className="text-[#0ECCEE] font-bold ml-1">*</span>}
                    </span>
                </label>
            );
        }
        if (field.type === 'file' || field.type === 'image') {
            return (
                <label className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed transition-all cursor-pointer group ${
                    isDark
                        ? 'border-white/15 bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#0ECCEE]/50'
                        : 'border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-[#0ECCEE]'
                }`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                        isDark ? 'bg-white/5 text-[#0ECCEE] group-hover:bg-[#0ECCEE]/20' : 'bg-[#0ECCEE]/10 text-[#0ECCEE]'
                    }`}>
                        <Upload className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                        <span className={`text-xs font-semibold block ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {val ? String(val) : (field.placeholder || (field.type === 'image' ? 'Click to upload image' : 'Click to upload document'))}
                        </span>
                        <span className={`text-[11px] mt-0.5 block ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            {field.type === 'image' ? 'JPG, PNG, WebP supported' : 'PDF, DOC, Images supported'}
                        </span>
                    </div>
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
        razorpaySignature = '',
    }) => {
        // Prefer Mongo id so register works even if route param is a name slug
        const trekId = trek?._id || trek?.id || id;
        if (!trekId) throw new Error('Trek not found');

        if (requireLogin && !isAuthed()) {
            openLogin();
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
                    ...(razorpaySignature
                        ? { razorpay_signature: razorpaySignature, signature: razorpaySignature }
                        : {}),
                },
                ...(razorpaySignature ? { razorpay_signature: razorpaySignature } : {}),
            }),
        });
        const regData = await regRes.json().catch(() => ({}));
        if (!regRes.ok) {
            if (regRes.status === 401 || isAuthFailureMessage(regData.message)) {
                if (requireLogin || regData.requireLogin) {
                    openLogin();
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
        setError((prev) => (prev && /failed to fetch|network error/i.test(prev) ? '' : prev));
        const code = couponCode.trim();
        if (!code) {
            setCouponInfo(null);
            return;
        }
        const trekId = trek?._id || trek?.id || id;
        if (!trekId) {
            setCouponError('Trek not loaded yet — wait a moment and try again.');
            return;
        }
        setCouponLoading(true);
        try {
            const { data } = await publicFetchJSONRetry('/payment/coupon-validate', {
                method: 'POST',
                body: { trekId, people, couponCode: code },
                headers: hasUsableAuthToken(authToken)
                    ? { Authorization: `Bearer ${resolveAuthToken(authToken)}` }
                    : {},
                retries: 3,
                timeout: 20000,
            });
            setCouponInfo(data);
        } catch (e) {
            setCouponInfo(null);
            const msg = e?.message || 'Invalid coupon';
            const network = e?.isNetworkError || e?.code === 'ERR_NETWORK' || /failed to fetch|network error|timeout/i.test(msg);
            setCouponError(
                network
                    ? 'Could not reach the server. Check your connection and tap Apply again — or open in Chrome/Safari if you are in Instagram.'
                    : msg,
            );
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

                const draftEmail = String(
                    draft?.extraFields?.email
                    || draft?.extraFields?.e_mail_id
                    || draft?.extraFields?.e_mail
                    || '',
                ).trim();
                const verifyResult = await pollPaymentUntilVerified(API, pending.orderId, {
                    kind: 'trek',
                    search: location.search,
                    token: resolveAuthToken(authToken),
                    customerEmail: draftEmail,
                }, { maxWaitMs: PAYMENT_BACKGROUND_MAX_WAIT_MS });

                if (verifyResult.status === 'cancelled') {
                    clearCashfreeReturnAndPending(navigate, location);
                    clearPendingPayment();
                    setStep(2);
                    setPayDone(false);
                    setPostPaymentError('');
                    setError('Payment cancelled.');
                    setPaying(false);
                    return;
                }

                if (!verifyResult.ok || !verifyResult.verified) {
                    const { kind, message } = classifyVerifyError(verifyResult);
                    if (kind === 'cancelled' || kind === 'failed') clearPendingPayment();
                    setStep(3);
                    setPayDone(false);
                    setPostPaymentError('');
                    setError(
                        kind === 'pending'
                            ? 'Payment is confirming. Check My Bookings — do not pay again.'
                            : (message || 'Payment verification failed after redirect. Contact support.'),
                    );
                    setPaying(false);
                    return;
                }

                const v = verifyResult.data;
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
            if (step1Choices.length > 0 && !selTime) {
                setError(usesMeetingPoints ? 'Please select a meeting point.' : 'Please select a departure time.');
                return;
            }
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
                        bookingDetails: {
                            date: selDate || '',
                            time: selTime || '',
                        },
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
                        openLogin();
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
                if (!order.orderId) {
                    setError('Payment order missing from server. Restart backend and try again.');
                    setPaying(false);
                    return;
                }

                const orderGateway = order.gateway === 'razorpay' ? 'razorpay' : 'cashfree';
                if (orderGateway === 'cashfree' && !order.paymentSessionId) {
                    setError('Payment session missing from server. Restart backend and try again.');
                    setPaying(false);
                    return;
                }

                saveDraft({ step: 2, extraFields: buildFormData(), selDate, selTime, people, bookingGender });

                const formSnapshot = buildFormData();
                const customerPhoneRaw =
                    formSnapshot.contact_no ||
                    formSnapshot.phone ||
                    formSnapshot.contact ||
                    formSnapshot.mobile ||
                    formSnapshot.whatsapp ||
                    formSnapshot.mobile_number ||
                    formSnapshot.phone_number ||
                    extraFields.contact_no ||
                    extraFields.phone ||
                    extraFields.contact ||
                    extraFields.mobile ||
                    user?.phoneNumber ||
                    user?.phone ||
                    '';
                const customerPhone = sanitizeRazorpayContact(customerPhoneRaw);

                let checkoutFlow;
                // Server found a Razorpay order that is already paid (verify/booking failed
                // earlier). Skip Checkout — reopen would fail on a completed order.
                if (orderGateway === 'razorpay' && order.alreadyPaid) {
                    const verification = await verifyPaymentWithRetry(API, order.orderId, {
                        kind: 'trek',
                        token: resolveAuthToken(authToken),
                        customerEmail,
                        paymentId: order.paymentId || undefined,
                    });
                    const verifiedPayload = verification?.data || verification;
                    checkoutFlow = verification?.ok && verifiedPayload?.verified
                        ? {
                            status: 'verified',
                            verified: {
                                payment_order_id:
                                  verifiedPayload.payment_order_id || order.orderId,
                                payment_id:
                                  verifiedPayload.payment_id || order.paymentId || '',
                            },
                            checkoutPaymentId:
                              verifiedPayload.payment_id || order.paymentId || '',
                            signature: '',
                        }
                        : {
                            status: 'verify_failed',
                            message:
                              verifiedPayload?.message
                              || verification?.classified?.message
                              || 'Could not confirm prior payment',
                            verification: verifiedPayload || verification,
                        };
                } else if (orderGateway === 'razorpay') {
                    if (!customerPhone) {
                        setError('Enter a valid 10-digit mobile number on the form, then tap Pay again.');
                        setPaying(false);
                        return;
                    }
                    checkoutFlow = await runRazorpayCheckoutAndVerify({
                        order,
                        displayName: trekName,
                        merchantName: trek?.communityId?.name || 'TrekkVede',
                        prefill: {
                            name: formSnapshot.full_name || formSnapshot.name || formSnapshot.fullname || user?.name || '',
                            email: customerEmail,
                            contact: customerPhone,
                        },
                        verifyOrder: ({ orderId, paymentId, signature }) =>
                            verifyPaymentWithRetry(API, orderId, {
                                kind: 'trek',
                                token: resolveAuthToken(authToken),
                                customerEmail,
                                paymentId,
                                signature,
                            }),
                    });
                } else {
                    checkoutFlow = await runCashfreeCheckoutAndVerify({
                        order,
                        returnPath: `/trek/${id || trek?._id || trek?.id}/book`,
                        entityType: 'trek',
                        cashfreeMode: order.cashfreeMode,
                        verifyOrder: ({ orderId }) => verifyPaymentWithRetry(API, orderId, {
                            kind: 'trek',
                            token: resolveAuthToken(authToken),
                            customerEmail,
                        }),
                    });
                }

                if (checkoutFlow.status === 'redirect_deferred') {
                    setStep(3);
                    setPaying(true);
                    return;
                }

                if (checkoutFlow.status === 'cancelled') {
                    setPaymentFlowToStepTwo({
                        setStep,
                        setPayDone,
                        setPaying,
                        setError,
                        message: '',
                    });
                    return;
                }

                if (checkoutFlow.status === 'checkout_error') {
                    setPaymentFlowToStepTwo({
                        setStep,
                        setPayDone,
                        setPaying,
                        setError,
                        message: '',
                    });
                    retryCheckoutRef.current = () => next();
                    setPaymentModal({ open: true, message: checkoutFlow.message, orderId: order.orderId });
                    return;
                }

                if (checkoutFlow.status === 'verify_failed') {
                    const { message: verifyMsg } = classifyVerifyError(
                      checkoutFlow.verification || { message: checkoutFlow.message },
                    );
                    setPaymentFlowToStepTwo({
                        setStep,
                        setPayDone,
                        setPaying,
                        setError,
                        message: '',
                    });
                    retryCheckoutRef.current = () => next();
                    setPaymentModal({
                        open: true,
                        message:
                          verifyMsg
                          || checkoutFlow.message
                          || 'Payment verification failed. If money was deducted, check My Bookings — do not pay again.',
                        orderId: order.orderId,
                    });
                    return;
                }

                setStep(3);
                setPaying(true);

                if (checkoutFlow.status === 'verified') {
                    const { verified, checkoutPaymentId, signature } = checkoutFlow;
                    setPaymentId(verified.payment_id || checkoutPaymentId);
                    try {
                        await submitTrekRegistration({
                            paymentOrderId: verified.payment_order_id || order.orderId,
                            paymentId: verified.payment_id || checkoutPaymentId,
                            amountPaid: order.totalAmount ?? total,
                            razorpaySignature: signature || verified.razorpay_signature || '',
                        });
                        setPaymentFlowToSuccess({ setPayDone, setPaying, setError });
                    } catch (regErr) {
                        // Money already captured — never send user back to pay again
                        setStep(3);
                        setPayDone(true);
                        setPaying(false);
                        setError('');
                        setPostPaymentError(
                            regErr?.message
                            || 'Payment received but booking could not be completed. Check My Bookings — do not pay again.',
                        );
                    }
                } else {
                    setPaymentFlowToStepTwo({
                        setStep,
                        setPayDone,
                        setPaying,
                        setError,
                        message: checkoutFlow.message || 'Payment verification failed. Contact support.',
                    });
                }
            } catch (e) {
                setPaymentFlowToStepTwo({
                    setStep,
                    setPayDone,
                    setPaying,
                    setError,
                    message: 'Payment error: ' + e.message,
                });
            }
        }
    };

    const back = () => step === 1 ? goBack() : setStep(s => s - 1);

    const hasStoredSession = loggedIn || hasUsableAuthToken(authToken) || hasUsableAuthToken(null);
    const waitingOnAuth = !hasStoredSession && (authLoading || isAuthProcessing || isRedirectProcessing);

    if ((loadingTrek || waitingOnAuth) && !showSuccess && !showProcessing) {
        return <InlinePageLoader variant="booking" fullScreen label="Loading booking" />;
    }

    if (!trek && !showSuccess && !showProcessing) {
        const isNotFound = loadError === 'not_found';
        const isRetryable = !isNotFound;
        return (
            <div className="crwdctrl-page crwdctrl-page--flat min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isRetryable ? "Couldn't load this trek" : 'This trek is no longer available'}
                </p>
                <p className={`text-sm text-center max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isRetryable
                        ? 'Slow network or server waking up — tap Retry.'
                        : 'Open booking from the trek page, or the link may be outdated.'}
                </p>
                {isRetryable ? (
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
            <div className="crwdctrl-page crwdctrl-page--flat min-h-dvh flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <CheckCircle className={`w-14 h-14 mx-auto mb-5 ${isPending ? 'text-amber-400' : 'text-[#0ECCEE]'}`} />
                    <h1 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isPending ? 'Awaiting approval' : 'Booking in progress'}
                    </h1>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {isPending ? (
                            <>
                                Your payment for <span className="text-[#0ECCEE] font-semibold">{trekName}</span> is waiting for organizer approval. You’ll get a ticket once it’s confirmed.
                            </>
                        ) : (
                            <>
                                Finish or view your current booking for <span className="text-[#0ECCEE] font-semibold">{trekName}</span>. You can book again anytime after this one is done.
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
                        {!isPending ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setExistingBookingId('');
                                    setExistingBookingStatus('');
                                }}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition"
                            >
                                Book again
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
            <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex flex-col items-center justify-center px-4">
                <RegistrationStatusVisual
                    mode="processing"
                    isDark={isDark}
                    subtitle="Verifying payment and confirming your booking..."
                    showProgress={false}
                />
            </div>
        );
    }

    // ── Post-payment registration error ──
    if (postPaymentError && step === 3 && payDone && !paying) {
        return (
            <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4">
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
            <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4">
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
                            { label: usesMeetingPoints ? 'Meeting Point' : 'Time', value: selTime || '—' },
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
        <div className="crwdctrl-page crwdctrl-page--content trek-booking-page min-h-dvh pt-[calc(var(--safe-top)+0.5rem)] sm:pt-[calc(var(--safe-top)+1rem)] pb-[max(6rem,var(--safe-bottom)+5rem)]">
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
            <div className="max-w-xl mx-auto px-4 sm:px-6">

                {/* Glassmorphic Header Card */}
                <div className={`rounded-3xl p-4 sm:p-5 mb-5 border backdrop-blur-xl transition-all ${
                    isDark
                        ? 'bg-[#121215]/95 border-white/10 shadow-2xl text-white'
                        : 'bg-white/95 border-gray-200/80 shadow-lg text-gray-900'
                }`}>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={back}
                            className={`p-2.5 rounded-2xl transition-all shrink-0 active:scale-95 ${
                                isDark ? 'bg-white/10 hover:bg-white/15 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                            }`}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30">
                                    Trek Booking
                                </span>
                                <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Step {step} of {STEPS.length}
                                </span>
                            </div>
                            <h1 className={`text-lg sm:text-xl font-bold truncate mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                {trekName}
                            </h1>
                        </div>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className={`rounded-2xl p-4 mb-5 text-sm border flex items-center gap-3 ${
                        isDark ? 'bg-red-950/40 border-red-800/60 text-red-300' : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                        <span className="shrink-0 text-base">⚠️</span>
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {!loggedIn && requireLogin && (
                    <div className={`rounded-3xl p-5 mb-5 border text-center backdrop-blur-md ${
                        isDark ? 'bg-[#121215] border-white/10 text-white' : 'bg-white border-gray-200 shadow-md text-gray-900'
                    }`}>
                        <p className={`text-sm mb-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Log in to book this trek and view your tickets under My Bookings.
                        </p>
                        <button
                            type="button"
                            onClick={() => openLogin()}
                            className="w-full py-3 rounded-2xl font-bold text-black bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 shadow-lg shadow-[#0ECCEE]/20 transition-all active:scale-95"
                        >
                            Log in with Google to continue
                        </button>
                    </div>
                )}

                {!loggedIn && !requireLogin && (
                    <div className={`rounded-2xl p-3.5 mb-5 border text-xs leading-relaxed ${
                        isDark ? 'bg-[#121215] border-white/10 text-gray-300' : 'bg-blue-50/70 border-blue-200 text-blue-900'
                    }`}>
                        ⚡ Guest checkout is on — no account needed.{' '}
                        <button type="button" onClick={() => openLogin()} className="text-[#0ECCEE] font-bold underline">
                            Log in
                        </button>
                        {' '}to save this booking under My Bookings.
                    </div>
                )}

                {/* Main Content Booking Card */}
                <div className={`rounded-3xl p-5 sm:p-7 border backdrop-blur-xl transition-all ${
                    isDark ? 'bg-[#121215] border-white/10 shadow-2xl' : 'bg-white border-gray-100 shadow-xl'
                } ${!loggedIn && requireLogin ? 'opacity-50 pointer-events-none' : ''}`}>

                    {/* Step Progress Bar */}
                    <div className={`rounded-2xl p-4 mb-6 border ${
                        isDark ? 'bg-[#18181b] border-white/5' : 'bg-gray-50 border-gray-200/80'
                    }`}>
                        <div className="flex items-center justify-between mb-2">
                            <h3 className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                Booking Progress
                            </h3>
                            <span className="text-xs font-bold text-[#0ECCEE]">
                                {Math.round((step / STEPS.length) * 100)}%
                            </span>
                        </div>
                        <div className={`w-full rounded-full h-2 mb-4 overflow-hidden ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                            <div
                                className="bg-gradient-to-r from-[#0ECCEE] to-[#00b4d8] h-2 rounded-full transition-all duration-500 ease-out shadow-[0_0_10px_rgba(14,204,238,0.5)]"
                                style={{ width: `${(step / STEPS.length) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between items-center">
                            {STEPS.map((s, i) => (
                                <div key={s} className="flex flex-col items-center gap-1">
                                    <div className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                        i + 1 === step
                                            ? 'bg-[#0ECCEE] text-black ring-4 ring-[#0ECCEE]/20 shadow-md scale-105'
                                            : i + 1 < step
                                            ? 'bg-emerald-500 text-white'
                                            : isDark
                                            ? 'bg-gray-800 text-gray-500'
                                            : 'bg-gray-200 text-gray-500'
                                    }`}>
                                        {i + 1 < step ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-[11px] font-semibold ${
                                        i + 1 === step
                                            ? isDark ? 'text-white font-bold' : 'text-gray-900 font-bold'
                                            : isDark ? 'text-gray-500' : 'text-gray-400'
                                    }`}>
                                        {s}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Step 1: Date, Time, People ── */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-700/30">
                                <h3 className={`text-sm font-bold tracking-wide uppercase ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    {usesMeetingPoints ? '1. Select Date & Meeting Point' : '1. Select Date & Time'}
                                </h3>
                            </div>

                            {/* Date Chips */}
                            <div>
                                <label className={`block text-xs font-semibold uppercase tracking-wider mb-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Available Dates
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    {dates.map((d, i) => {
                                        const selected = selDate === d;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setSelDate(d)}
                                                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 ${
                                                    selected
                                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE] shadow-[0_0_12px_rgba(14,204,238,0.2)] font-bold'
                                                        : isDark
                                                        ? 'border-white/10 bg-[#18181b] text-gray-300 hover:border-gray-600'
                                                        : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                                                }`}
                                            >
                                                📅 {d}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Meeting point / Time */}
                            {step1Choices.length > 0 ? (
                                <div>
                                    <label className={`block text-xs font-semibold uppercase tracking-wider mb-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {step1ChoiceLabel}
                                    </label>
                                    <div className="flex gap-2 flex-wrap">
                                        {step1Choices.map((t) => {
                                            const selected = selTime === t;
                                            return (
                                                <button
                                                    key={t}
                                                    type="button"
                                                    onClick={() => setSelTime(t)}
                                                    className={`px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-95 ${
                                                        selected
                                                            ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE] shadow-[0_0_12px_rgba(14,204,238,0.2)] font-bold'
                                                            : isDark
                                                            ? 'border-white/10 bg-[#18181b] text-gray-300 hover:border-gray-600'
                                                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300'
                                                    }`}
                                                >
                                                    📍 {t}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : null}

                            {phaseStepNotice ? (
                                <p className={`text-xs leading-relaxed rounded-xl px-3.5 py-3 ${isDark ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/25' : 'bg-cyan-50 text-cyan-800 border border-cyan-200'}`}>
                                    {phaseStepNotice}
                                </p>
                            ) : null}

                            <GenderQuickPick
                                value={bookingGender}
                                onChange={(g) => {
                                    setBookingGender(g);
                                    setError('');
                                }}
                                label="Gender"
                                error={showGenderPhaseError ? genderAccess.message : undefined}
                            />

                            {/* Party Size Selector */}
                            <div className={`rounded-2xl p-4 border flex items-center justify-between gap-4 ${
                                isDark ? 'bg-[#18181b] border-white/10' : 'bg-gray-50 border-gray-200'
                            }`}>
                                <div>
                                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Number of Trekkers
                                    </p>
                                    <div className="flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => { setCouponInfo(null); setPeople((p) => Math.max(1, p - 1)); }}
                                            className={`size-9 rounded-l-xl flex items-center justify-center border transition-all active:scale-95 ${
                                                isDark ? 'bg-[#121215] border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                                            }`}
                                        >
                                            <ChevronLeft size={16} />
                                        </button>
                                        <div className={`w-12 h-9 flex items-center justify-center border-y font-bold text-sm ${
                                            isDark ? 'bg-[#121215] border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'
                                        }`}>
                                            {people}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setCouponInfo(null); setPeople((p) => Math.min(maxPeople, p + 1)); }}
                                            className={`size-9 rounded-r-xl flex items-center justify-center border transition-all active:scale-95 ${
                                                isDark ? 'bg-[#121215] border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-300 text-gray-800 hover:bg-gray-100'
                                            }`}
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        {people > 1 ? 'Total Entry Fee' : 'Trek Fee'}
                                    </p>
                                    {fee > 0 ? (
                                        <>
                                            <p className={`text-xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                ₹{baseFee.toLocaleString('en-IN')}
                                            </p>
                                            {people > 1 ? (
                                                <p className={`text-[11px] font-medium ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                    ₹{fee.toLocaleString('en-IN')} × {people} trekkers
                                                </p>
                                            ) : null}
                                        </>
                                    ) : (
                                        <p className="text-xl font-bold text-emerald-400">Free</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Step 2: Form Fields ── */}
                    {step === 2 && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-700/30">
                                <h3 className={`text-sm font-bold tracking-wide uppercase ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                    2. Trekker Details
                                </h3>
                            </div>

                            {sheetsInstructions && (
                                <div className={`rounded-xl p-3.5 border text-xs leading-relaxed ${
                                    isDark ? 'bg-amber-950/40 border-amber-800/60 text-amber-300' : 'bg-amber-50 border-amber-300 text-amber-800'
                                }`}>
                                    {sheetsInstructions}
                                </div>
                            )}

                            <div className="space-y-4">
                                {regSchema.map((field) => (
                                    <div key={field.id || field.fieldName} className="group">
                                        {field.type === 'agree' ? (
                                            renderField(field)
                                        ) : (
                                            <>
                                                <label className={`block text-[11px] font-semibold uppercase tracking-wider mb-1 transition-colors ${
                                                    isDark ? 'text-gray-300 group-focus-within:text-[#0ECCEE]' : 'text-gray-700 group-focus-within:text-[#0ECCEE]'
                                                }`}>
                                                    {field.label}
                                                    {field.required ? (
                                                        <span className="text-[#0ECCEE] font-bold ml-1">*</span>
                                                    ) : (
                                                        <span className={`text-[10px] lowercase tracking-normal ml-1 font-normal ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            (optional)
                                                        </span>
                                                    )}
                                                </label>
                                                {renderField(field)}
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {isOrganizerQr && fee > 0 ? (
                                <div className={`mt-5 rounded-2xl border p-4 sm:p-5 space-y-4 ${
                                    isDark ? 'border-white/10 bg-[#18181b]' : 'border-gray-200 bg-gray-50'
                                }`}>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Pay ₹{payableAmount.toLocaleString('en-IN')} via UPI QR
                                        </p>
                                    </div>
                                    <div className="flex gap-4 items-start">
                                        {paymentQR ? (
                                            <div className="shrink-0 size-[132px] rounded-2xl overflow-hidden border border-gray-700 bg-white p-1.5 shadow-md">
                                                <img src={paymentQR} alt="Payment QR" className="size-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className={`shrink-0 size-[132px] rounded-2xl flex items-center justify-center text-[10px] text-center px-2 font-medium ${
                                                isDark ? 'bg-gray-800 text-red-400' : 'bg-gray-100 text-red-500'
                                            }`}>
                                                QR not configured
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1 space-y-2.5">
                                            <p className={`text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                {trek?.registration?.qrAutoConfirm
                                                    ? 'Scan QR on any UPI app, complete payment, then upload payment screenshot.'
                                                    : 'Scan QR on UPI, pay the amount, and upload your payment screenshot.'}
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
                                                    className={`w-full flex items-center justify-between gap-2 h-10 px-3 rounded-xl text-left border transition-all ${
                                                        isDark ? 'bg-[#121215] border-white/10 hover:border-gray-600' : 'bg-white border-gray-300 hover:border-gray-400'
                                                    }`}
                                                >
                                                    <span className={`text-xs font-mono truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                                        {paymentUpiId}
                                                    </span>
                                                    <span className="text-xs font-bold text-[#0ECCEE] shrink-0">
                                                        {upiCopied ? 'Copied ✓' : 'Copy'}
                                                    </span>
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                    <label className={`flex items-center gap-3 p-3 rounded-xl border border-dashed cursor-pointer transition-all ${
                                        isDark ? 'border-gray-700 hover:border-[#0ECCEE] bg-[#121215]' : 'border-gray-300 hover:border-[#0ECCEE] bg-white'
                                    } ${uploadingProof ? 'opacity-60 pointer-events-none' : ''}`}>
                                        {paymentScreenshotUrl ? (
                                            <img src={paymentScreenshotUrl} alt="" className="size-11 rounded-lg object-cover shrink-0" />
                                        ) : (
                                            <div className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
                                                isDark ? 'bg-white/5' : 'bg-gray-100'
                                            }`}>
                                                {uploadingProof
                                                    ? <Loader className="w-5 h-5 animate-spin text-[#0ECCEE]" />
                                                    : <ImagePlus size={20} className="text-[#0ECCEE]" />}
                                            </div>
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {uploadingProof ? 'Uploading proof…' : paymentScreenshotUrl ? 'Screenshot Uploaded ✓' : 'Upload Payment Screenshot'}
                                            </p>
                                            <p className={`text-[11px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {paymentScreenshotUrl ? 'Tap to change screenshot' : 'Select image from gallery'}
                                            </p>
                                        </div>
                                        <input
                                            type="file"
                                            accept="image/*"
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
                                        placeholder="UPI Ref / Transaction ID"
                                        className={inp}
                                    />
                                </div>
                            ) : null}

                            {/* Payment Summary & Coupon Card */}
                            {fee > 0 && !isOrganizerQr && (
                                <div className={`mt-5 rounded-2xl p-4 sm:p-5 border transition-all ${
                                    isDark ? 'bg-[#18181b] border-white/10' : 'bg-gray-50 border-gray-200'
                                }`}>
                                    <div className="mb-4 min-w-0">
                                        <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            Apply Coupon
                                        </p>
                                        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 w-full items-center">
                                            <input
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                                placeholder="Enter promo code"
                                                className={`w-full min-w-0 h-10 px-3.5 rounded-xl border text-xs font-semibold focus:outline-none focus:border-[#0ECCEE] ${
                                                    isDark ? 'bg-[#121215] border-white/10 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900'
                                                }`}
                                            />
                                            <button
                                                type="button"
                                                onClick={applyCoupon}
                                                disabled={couponLoading || !couponCode.trim()}
                                                className="h-10 shrink-0 px-4 rounded-xl bg-[#0ECCEE] text-black font-bold text-xs whitespace-nowrap active:scale-95 transition-all disabled:opacity-50"
                                            >
                                                {couponLoading ? '…' : (couponInfo?.couponApplied && couponInfo?.couponCode === couponCode.trim().toUpperCase() ? 'Applied ✓' : 'Apply')}
                                            </button>
                                        </div>
                                        {couponError ? <p className="text-xs text-red-400 mt-1.5 font-medium">{couponError}</p> : null}
                                        {couponInfo?.couponApplied ? (
                                            <div className={`mt-2 rounded-xl border px-3 py-2 text-xs font-medium ${
                                                isDark ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                            }`}>
                                                🎉 Coupon `{couponInfo.couponCode}` applied · You save ₹{couponInfo.discountAmount}!
                                            </div>
                                        ) : null}
                                    </div>

                                    <p className={`text-xs font-bold uppercase tracking-wider mb-2.5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        Payment Summary
                                    </p>
                                    <div className={`space-y-2 text-xs font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                        <div className="flex justify-between gap-4">
                                            <span>Ticket Price ({people} trekker{people > 1 ? 's' : ''})</span>
                                            <span>₹{fee.toLocaleString('en-IN')}</span>
                                        </div>
                                        {platformFee > 0 ? (
                                            <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                <span>Platform Convenience Fee ({platformPct}%)</span>
                                                <span>₹{platformFee}</span>
                                            </div>
                                        ) : null}
                                        {couponInfo?.couponApplied ? (
                                            <div className="flex justify-between gap-4 text-emerald-400 font-bold">
                                                <span>Coupon Discount</span>
                                                <span>-₹{couponInfo.discountAmount}</span>
                                            </div>
                                        ) : null}
                                        <div className="flex justify-between gap-4 pt-3 mt-1 border-t border-gray-700/50 font-bold text-base text-[#0ECCEE]">
                                            <span>Total Amount Payable</span>
                                            <span>₹{payableAmount.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                    <p className={`text-[11px] mt-2.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        🔒 {platformFee > 0
                                            ? 'Includes all charges · Safe & encrypted checkout via Cashfree'
                                            : usesRazorpay
                                                ? 'Safe & encrypted checkout via Razorpay'
                                                : 'Safe & encrypted checkout via Cashfree · No platform fee'}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Action Navigation Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-700/30 mt-6">
                        <button
                            type="button"
                            onClick={back}
                            disabled={paying}
                            className={`px-5 sm:px-6 py-3 rounded-xl border font-semibold text-sm transition-all duration-200 cursor-pointer active:scale-98 ${
                                isDark ? 'border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08] hover:text-white' : 'border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {step === 1 ? 'Cancel' : '← Previous Step'}
                        </button>
                        <button
                            type="button"
                            onClick={next}
                            disabled={paying || (step === 1 && step1Blocked)}
                            className="flex-1 px-6 py-3 rounded-xl bg-gradient-to-r from-[#0ECCEE] to-[#00b4d8] hover:opacity-95 active:scale-[0.98] text-black font-extrabold text-sm shadow-lg shadow-[#0ECCEE]/25 hover:shadow-xl hover:shadow-[#0ECCEE]/35 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {paying ? (
                                <><Loader className="w-4 h-4 animate-spin text-black" /> Processing Payment...</>
                            ) : step === 2 && total > 0 ? (
                                isOrganizerQr
                                    ? `Submit Payment · ₹${payableAmount.toLocaleString('en-IN')}`
                                    : `Pay ₹${payableAmount.toLocaleString('en-IN')} & Confirm Trek`
                            ) : step === 2 ? (
                                'Confirm Free Trek Booking'
                            ) : (
                                'Continue to Details →'
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin
                        googleOnly
                        title="Sign in to book"
                        subtitle="One tap with Google — then finish your trek booking"
                        onClose={handleCloseLogin}
                    />
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

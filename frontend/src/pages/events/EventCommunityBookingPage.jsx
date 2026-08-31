import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, Loader, CheckCircle, Clock, Check, CalendarX } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationsContext';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import { buildVerifiedPaymentFields } from '../../utils/useCashfree';
import { useInAppBack } from '../../hooks/useInAppBack';

import PaymentErrorModal from '../../components/PaymentErrorModal';
import GenderQuickPick from '../../components/GenderQuickPick';
import RunCheckoutPanel from '../../components/sports/RunCheckoutPanel';
import DetailPageLoader from '../../components/DetailPageLoader';
import {
    getPendingPayment,
    clearPendingPayment,
    shouldResumePendingPayment,
} from '../../utils/deepLinks';
import {
    goToBookings,
    verifyPaymentWithRetry,
    pollPaymentUntilVerified,
    PAYMENT_BACKGROUND_MAX_WAIT_MS,
    classifyVerifyError,
    clearCashfreeReturnAndPending,
} from '../../utils/paymentNavigation';
import { API_BASE_URL, publicFetchJSONRetry } from '../../services/api/client';
import { isInAppBrowser } from '../../config/apiBase';
import { useBookingSuccessPopup } from '../../hooks/useSuccessPopup';
import { eventCommunityEventPath, entityMatchesRouteParam } from '../../utils/slugRoutes';
import { evaluateUserRegistrationAccess } from '../../utils/trekGenderRegistration';
import { mergeRunFormFields, profileToRunFormData, isDefaultContactField, responseAliasGroup } from '../../utils/formFieldDedupe';
import { resolveAuthToken, getBearerAuthHeaders, hasUsableAuthToken, isAuthFailureMessage } from '../../utils/authToken';
import {
    classifyDetailLoadError,
    createDetailCache,
    DETAIL_FETCH_OPTS,
} from '../../utils/detailPageLoad';
import {
    createAuthModalHandlers,
    getInitialBookingUiState,
    runCashfreeCheckoutAndVerify,
    registrationIdFromVerifyPayload,
    setPaymentFlowToStepTwo,
    setPaymentFlowToSuccess,
} from '../../utils/bookingFlowShared';
import { openLoginSheet } from '../../utils/loginFlow';
import { organizerHubCopy, sportsQrTicketPath } from '../../utils/listingHubCopy';
import {
    findSportsTier,
    getSportsTiers,
    isTiersPricing,
    resolveSportsPerPersonFee,
    resolveOptionalAddOn,
    formatInr,
} from '../../utils/sportsTiers';
import {
    bookingPage1Fields,
    buildBookingStepLabels,
    isBookingPage1Field,
    isStandaloneQuestionField,
    resolveFormAutoCouponCode,
    selectOptionLabels,
    shortBookingStepLabel,
    standaloneQuestionFields,
} from '../../utils/formOptionCoupons';

const runDetailCache = createDetailCache('crwdctrl_event_community_detail_v18_');

const API = API_BASE_URL;
const copy = organizerHubCopy(true);

function runDraftKey(eventId) {
    return `event_community_booking_draft_${eventId}`;
}

function formatRunDate(baseDate) {
    if (!baseDate) return '';
    const d = new Date(baseDate);
    if (Number.isNaN(d.getTime())) return String(baseDate);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isGenderChoiceField(field) {
    const key = String(field?.fieldName || '').toLowerCase();
    if (key === 'gender') return true;
    const labels = selectOptionLabels(field);
    return labels.some((o) => /^female$/i.test(o))
        && labels.some((o) => /^male$/i.test(o))
        && labels.length <= 3;
}

function sameGenderPartyHint(gender) {
    const value = String(gender || '').trim();
    if (!value) return '';
    if (/^f/i.test(value)) {
        return 'You chose Female. You can register multiple people in this booking, but all of them must be women. You cannot add men to this registration.';
    }
    if (/^m/i.test(value)) {
        return 'You chose Male. You can register multiple people in this booking, but all of them must be men. You cannot add women to this registration.';
    }
    return `This booking is for ${value} only. Extra people must be the same gender — mixed groups are not allowed.`;
}

function collectBookingFormAnswers(schema, extraFields = {}) {
    const src = extraFields && typeof extraFields === 'object' ? extraFields : {};
    const out = { ...src };
    for (const field of Array.isArray(schema) ? schema : []) {
        const name = String(field?.fieldName || '').trim();
        if (!name) continue;
        const value = src[name];
        if (value === undefined || value === null || String(value).trim() === '') continue;
        out[name] = value;
    }
    return out;
}

function getInitialUi(eventId, search, locationState) {
    const defaults = { step: 1, payDone: false, paying: false, selDate: '', selTime: '', people: 1, extraFields: {}, tierId: '', addOnSelected: false };
    const returnPath = `/events/community-event/${eventId}/book`;
    const pending = getPendingPayment();
    const resuming = shouldResumePendingPayment(pending, returnPath, search);
    const fresh = Boolean(locationState?.freshBooking) && !resuming;

    if (fresh && eventId) {
        try { sessionStorage.removeItem(runDraftKey(eventId)); } catch { /* ignore */ }
    }

    const params = new URLSearchParams(search || '');
    const tierFromQuery = params.get('tier') || '';
    const tierId = tierFromQuery || locationState?.tierId || '';

    return getInitialBookingUiState({
        entityId: eventId,
        search,
        returnPath,
        defaults: {
            ...defaults,
            tierId: tierId || defaults.tierId,
        },
        draftKeyFactory: runDraftKey,
        restoreStepFromDraft: !fresh,
    });
}

export default function EventCommunityBookingPage() {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const { id } = useParams();
    const initialUi = getInitialUi(id, location.search, location.state);
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
        return isAuthenticated || hasUsableAuthToken(authToken);
    }, [isAuthenticated, authToken]);

    const {
        handleCloseLogin: closeLoginSheet,
        handleCloseRegister,
        handleSwitchToRegister: _handleSwitchToRegister,
        handleSwitchToLogin,
    } = createAuthModalHandlers({ setShowLogin, setShowRegister });

    const openLogin = useCallback(() => {
        openLoginSheet({
            returnPath: `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}`,
        });
        setShowLogin(true);
    }, []);

    useEffect(() => {
        if (isAuthenticated && showLogin) setShowLogin(false);
        if (isAuthenticated && showRegister) setShowRegister(false);
    }, [isAuthenticated, showLogin, showRegister]);

    const [event, setEvent] = useState(location.state?.event || null);
    const [loadingEvent, setLoadingEvent] = useState(!location.state?.event);
    const [loadError, setLoadError] = useState('');
    const [step, setStep] = useState(initialUi.step);
    const [selDate, setSelDate] = useState(initialUi.selDate);
    const [selTime, setSelTime] = useState(initialUi.selTime);
    const [people, setPeople] = useState(initialUi.people);
    const [selectedTierId, setSelectedTierId] = useState(initialUi.tierId || '');
    const [addOnSelected, setAddOnSelected] = useState(Boolean(initialUi.addOnSelected));
    const [extraFields, setExtraFields] = useState(initialUi.extraFields);
    const [error, setError] = useState('');
    const [paying, setPayingState] = useState(initialUi.paying);
    const payingRef = useRef(false);
    const setPaying = useCallback((v) => {
        const nextVal = typeof v === 'function' ? v(payingRef.current) : v;
        payingRef.current = Boolean(nextVal);
        setPayingState(nextVal);
    }, []);
    const [payDone, setPayDone] = useState(initialUi.payDone);
    const [paymentId, setPaymentId] = useState('');
    const [cashfreeOrderId, setCashfreeOrderId] = useState('');
    const [bookingId, setBookingId] = useState('');
    const [couponCode, setCouponCode] = useState('');
    const [couponInfo, setCouponInfo] = useState(null);
    const [couponLoading, setCouponLoading] = useState(false);
    const [couponError, setCouponError] = useState('');
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
    const [paymentScreenshotUrl, setPaymentScreenshotUrl] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [uploadingProof, setUploadingProof] = useState(false);
    const [upiCopied, setUpiCopied] = useState(false);
    const [showTierIncludes, setShowTierIncludes] = useState(false);
    const retryCheckoutRef = useRef(null);
    const couponSourceRef = useRef(null);
    const couponCodeRef = useRef('');
    const couponReqIdRef = useRef(0);
    const applyCouponRef = useRef(async () => {});

    const requireLogin = event?.registration?.requireLogin !== false;
    const loggedIn = isAuthed();
    const formLocked = requireLogin && !loggedIn;

    const handleCloseLogin = () => {
        if (loggedIn) {
            closeLoginSheet();
            return;
        }
        if (formLocked) {
            goBack();
            return;
        }
        closeLoginSheet();
    };

    useEffect(() => {
        if (loggedIn && showLogin) setShowLogin(false);
    }, [loggedIn, showLogin]);

    const uploadPaymentScreenshot = useCallback(async (file) => {
        if (!file) return;
        setUploadingProof(true);
        setError('');
        try {
            const token = resolveAuthToken(authToken);
            const fd = new FormData();
            fd.append('image', file);
            const evId = event?._id || event?.id || id;
            const uploadUrl = (!requireLogin || !token)
                ? `${API}/sports/${evId}/payment-screenshot`
                : `${API}/users/upload/image`;
            const res = await fetch(uploadUrl, {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: fd,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || data.message || 'Upload failed');
            setPaymentScreenshotUrl(data.url || '');
        } catch (err) {
            setError(err.message || 'Screenshot upload failed');
        } finally {
            setUploadingProof(false);
        }
    }, [authToken, event, id, requireLogin]);

    const eventName = event?.title || event?.name || 'Run';
    const clubName =
        event?.runClub?.name ||
        location.state?.runClub?.name ||
        event?.clubName ||
        'The club';
    const selectedTier = event ? findSportsTier(event, selectedTierId) : null;
    const priced = event
        ? resolveSportsPerPersonFee(event, selectedTierId)
        : { fee: 0, tier: null, error: null };
    const fee = priced.fee;
    const optionalAddOn = event ? resolveOptionalAddOn(event) : null;
    const addOnFeePerPerson = optionalAddOn && addOnSelected ? optionalAddOn.fee : 0;
    const chargePerPerson = fee + addOnFeePerPerson;
    const isFreeFlow = chargePerPerson <= 0;
    const extraQuestionFields = useMemo(
        () => standaloneQuestionFields(event?.registration?.formSchema || []),
        [event?.registration?.formSchema],
    );
    const extraCount = extraQuestionFields.length;
    const detailsStep = isFreeFlow ? null : 2 + extraCount;
    const confirmStep = (isFreeFlow ? 2 : 3) + extraCount;
    const bookingSteps = buildBookingStepLabels(isFreeFlow, extraQuestionFields);
    const successStep = confirmStep;
    const questionField = extraQuestionFields[step - 2] || null;
    const regMode = event?.registration?.mode || 'internal_form';
    const isOrganizerQr = regMode === 'organizer_qr';
    const paymentQR = event?.registration?.paymentQR || '';
    const paymentQRMessage = event?.registration?.paymentQRMessage || '';
    const paymentUpiId = event?.registration?.paymentUpiId || '';
    const showSuccess = isFreeFlow
        ? step === confirmStep && payDone && !paying
        : step === confirmStep && payDone && !paying;
    const showProcessing = isFreeFlow
        ? step === confirmStep && paying
        : step === confirmStep && paying;
    const qrNeedsReview = chargePerPerson > 0 && isOrganizerQr && !(couponInfo?.amountAfterDiscount === 0);

    useBookingSuccessPopup(showSuccess && !qrNeedsReview, {
        name: eventName,
        paid: payDone && chargePerPerson > 0 && !isOrganizerQr,
        bookingId,
        ticketQuery: 'type=sports&hub=events',
    });
    const reg = event?.registration || {};
    // Runs use a single event date + optional reporting time (no multi-date slots)
    const runDateLabel = useMemo(() => formatRunDate(event?.eventDate), [event?.eventDate]);
    const runTimeLabel = String(event?.reportingTime || '').trim();
    const maxPeople = Number.isFinite(Number(reg.maxPeoplePerBooking)) && Number(reg.maxPeoplePerBooking) > 0
        ? Number(reg.maxPeoplePerBooking)
        : (event?.maxParticipants || 10);
    const genderRegistration = event?.genderRegistration || null;
    const bookingGender = extraFields.gender || extraFields.sex || '';
    const genderAccess = useMemo(
        () => evaluateUserRegistrationAccess({
            genderRegistration,
            userGender: bookingGender,
            people,
        }),
        [genderRegistration, bookingGender, people],
    );
    const genderRemaining = useMemo(() => {
        if (!genderRegistration?.enabled || !bookingGender) return null;
        const g = String(bookingGender).toLowerCase();
        const bucket = g.startsWith('f') ? 'female' : g.startsWith('m') ? 'male' : 'others';
        const quota = genderRegistration.quotas?.[bucket];
        if (!quota?.cap) return null;
        return Math.max(0, (quota.remaining ?? (quota.cap - quota.filled)) || 0);
    }, [genderRegistration, bookingGender]);
    const onePersonFreeLimit = isFreeFlow && loggedIn;
    const isTouchGrassEvent = /touch[-]?grass/i.test(
        [event?.slug, ...(event?.previousSlugs || []), id].filter(Boolean).join(' '),
    );
    const singlePersonBooking = onePersonFreeLimit
        || Number(reg.maxPeoplePerBooking) === 1
        || isTouchGrassEvent;
    const maxSelectablePeople = singlePersonBooking
        ? 1
        : Math.min(maxPeople, genderRemaining == null ? maxPeople : Math.max(1, genderRemaining));

    const regSchema = useMemo(() => mergeRunFormFields(reg.formSchema || []), [reg.formSchema]);
    const page1CouponFields = useMemo(() => bookingPage1Fields(reg.formSchema || []), [reg.formSchema]);
    const step2Fields = useMemo(
        () => regSchema.filter((field) => !isBookingPage1Field(field) && !isStandaloneQuestionField(field)),
        [regSchema],
    );
    const autoCouponCode = useMemo(
        () => resolveFormAutoCouponCode(reg.formSchema || [], extraFields),
        [reg.formSchema, extraFields],
    );

    const formInstructions = reg.formInstructions || '';

    useEffect(() => {
        const evId = id || location.state?.event?._id || location.state?.event?.id;
        if (!evId) {
            setLoadingEvent(false);
            return undefined;
        }

        const navEvent = location.state?.event;
        const seedOk = entityMatchesRouteParam(navEvent, id, ['title', 'name']);
        const cached = runDetailCache.read(evId);
        const cacheOk = entityMatchesRouteParam(cached, id, ['title', 'name']);
        const fallback = seedOk ? navEvent : (cacheOk ? cached : null);

        if (fallback) {
            setEvent(fallback);
            setLoadError('');
            setLoadingEvent(false);
        } else {
            setEvent(null);
            setLoadError('');
            setLoadingEvent(true);
        }

        const controller = new AbortController();
        (async () => {
            try {
                const res = await publicFetchJSONRetry(`/sports/${encodeURIComponent(evId)}`, {
                    signal: controller.signal,
                    ...DETAIL_FETCH_OPTS,
                });
                if (controller.signal.aborted) return;
                if (res?.data?.event) {
                    setEvent(res.data.event);
                    runDetailCache.write(evId, res.data.event);
                    if (res.data.event._id) runDetailCache.write(String(res.data.event._id), res.data.event);
                    if (res.data.event.slug) runDetailCache.write(String(res.data.event.slug), res.data.event);
                    setLoadError('');
                } else if (fallback) {
                    setEvent(fallback);
                    setLoadError('');
                } else {
                    setEvent(null);
                    setLoadError('not_found');
                }
            } catch (err) {
                if (controller.signal.aborted) return;
                if (fallback) {
                    setEvent(fallback);
                    setLoadError('');
                } else {
                    setEvent(null);
                    setLoadError(classifyDetailLoadError(err));
                }
            } finally {
                if (!controller.signal.aborted) setLoadingEvent(false);
            }
        })();

        return () => controller.abort();
    }, [id, location.state?.event]);

    useEffect(() => {
        if (!event) return;
        const canonical = `${eventCommunityEventPath(event)}/book`;
        const params = new URLSearchParams(window.location.search || '');
        let tierParam = params.get('tier') || selectedTierId || '';

        // Tiered runs: shared /book links often omit ?tier= — default to first tier
        // instead of bouncing back to detail (looks like “link doesn’t open”).
        if (isTiersPricing(event) && !findSportsTier(event, tierParam)) {
            const fallbackTier = getSportsTiers(event)[0];
            if (fallbackTier?.id) {
                tierParam = fallbackTier.id;
                if (tierParam !== selectedTierId) setSelectedTierId(tierParam);
            } else {
                navigate(eventCommunityEventPath(event), { replace: true, state: { event, runClub: location.state?.runClub } });
                return;
            }
        }

        if (tierParam && tierParam !== selectedTierId) setSelectedTierId(tierParam);
        const nextSearch = tierParam ? `?tier=${encodeURIComponent(tierParam)}` : '';
        if (window.location.pathname !== canonical || (tierParam && !window.location.search.includes(tierParam))) {
            navigate(`${canonical}${nextSearch}`, { replace: true, state: { ...location.state, tierId: tierParam } });
        }
    }, [event, navigate, location.state, selectedTierId]);

    useEffect(() => {
        if (!event) return;
        setSelDate((prev) => prev || runDateLabel || '');
        setSelTime((prev) => prev || runTimeLabel || '');
    }, [event, runDateLabel, runTimeLabel]);

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!evId) return;
        const returnPath = `/events/community-event/${evId}/book`;
        if (!shouldResumePendingPayment(getPendingPayment(), returnPath, location.search)) return;

        const raw = sessionStorage.getItem(runDraftKey(evId));
        if (!raw) return;
        try {
            const draft = JSON.parse(raw);
            if (draft.extraFields) setExtraFields(draft.extraFields);
            if (draft.selDate) setSelDate(draft.selDate);
            if (draft.selTime) setSelTime(draft.selTime);
            if (draft.people) setPeople(draft.people);
            if (draft.tierId) setSelectedTierId(draft.tierId);
            if (typeof draft.addOnSelected === 'boolean') setAddOnSelected(draft.addOnSelected);
            if (draft.step) setStep(draft.step);
        } catch { /* ignore corrupt draft */ }
    }, [id, event?._id, event?.id, location.search]);

    // Free runs only have 2 steps when there are no extra questions; clamp old drafts
    useEffect(() => {
        if (!event || !isFreeFlow || extraCount > 0) return;
        if (payDone && step > confirmStep) setStep(confirmStep);
        else if (!payDone && step > 1) setStep(1);
    }, [event, isFreeFlow, extraCount, confirmStep, payDone, step]);

    // Free run policy: one seat per logged-in account.
    useEffect(() => {
        if (!singlePersonBooking) return;
        if (people !== 1) setPeople(1);
    }, [singlePersonBooking, people]);

    couponCodeRef.current = couponCode;

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!user || !evId || sessionStorage.getItem(runDraftKey(evId))) return;
        setExtraFields((prev) => {
            const profile = profileToRunFormData(user);
            if (!profile.full_name && !profile.email) return prev;
            // Always refresh defaults from Google/profile when empty; keep any custom answers
            return {
                ...profile,
                ...prev,
                full_name: prev.full_name || profile.full_name || '',
                email: prev.email || profile.email || '',
                contact_no: prev.contact_no || profile.contact_no || '',
                name: prev.name || profile.name || '',
            };
        });
    }, [user, id, event?._id, event?.id]);

    const scrollFieldIntoView = useCallback((e) => {
        const el = e.target;
        window.setTimeout(() => { el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); }, 150);
    }, []);

    const saveDraft = useCallback((overrides = {}) => {
        const evId = id || event?._id || event?.id;
        if (!evId) return;
        sessionStorage.setItem(runDraftKey(evId), JSON.stringify({
            extraFields,
            selDate,
            selTime,
            people,
            step,
            confirmStep,
            tierId: selectedTierId,
            addOnSelected,
            ...overrides,
        }));
    }, [id, event, extraFields, selDate, selTime, people, step, confirmStep, selectedTierId, addOnSelected]);

    // Debounce draft writes — avoid sessionStorage thrash on every keystroke (mobile lag)
    useEffect(() => {
        if (!event || payDone || paying) return;
        const t = window.setTimeout(() => saveDraft(), 400);
        return () => window.clearTimeout(t);
    }, [saveDraft, event, payDone, paying]);

    const baseFee = chargePerPerson * people;
    const total = baseFee;
    const payableAmount = couponInfo?.amountAfterDiscount != null
        ? Number(couponInfo.amountAfterDiscount)
        : baseFee;

    const inp = `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`;

    const setExtraFieldValue = (fieldName, v, { couponSelect } = {}) => {
        if (couponSelect && couponSourceRef.current === 'cleared') {
            couponSourceRef.current = null;
        }
        setExtraFields((f) => ({ ...f, [fieldName]: v }));
    };

    const clearAppliedCoupon = () => {
        couponSourceRef.current = 'cleared';
        setCouponInfo(null);
        setCouponCode('');
        setCouponError('');
    };

    const renderField = (field, { couponSelect } = {}) => {
        const val = extraFields[field.fieldName] || '';
        const onChange = (v) => setExtraFieldValue(field.fieldName, v, { couponSelect });
        const labels = selectOptionLabels(field);
        const isGender = isGenderChoiceField(field);

        if (field.type === 'textarea') {
            return (
                <textarea rows={3} placeholder={field.placeholder || ''} value={val}
                    onChange={(e) => onChange(e.target.value)} onFocus={scrollFieldIntoView}
                    className={`${inp} resize-none`} />
            );
        }
        if (field.type === 'select' || field.type === 'radio') {
            if (isGender) {
                return (
                    <GenderQuickPick
                        value={val}
                        onChange={onChange}
                        label="Gender"
                        hint={
                            singlePersonBooking
                                ? (genderRegistration?.enabled && genderRemaining != null
                                    ? `${genderRemaining} ${String(val).toLowerCase().startsWith('f') ? 'women' : 'men'} seat${genderRemaining === 1 ? '' : 's'} left`
                                    : '')
                                : sameGenderPartyHint(val)
                        }
                    />
                );
            }
            const stacked = couponSelect || labels.some((o) => o.length > 28) || labels.length > 4;
            return (
                <div className={stacked ? 'space-y-2' : 'flex flex-wrap gap-2'}>
                    {labels.map((o) => {
                        const selected = val === o;
                        return (
                            <button
                                key={o}
                                type="button"
                                onClick={() => onChange(selected ? '' : o)}
                                className={`${stacked ? 'w-full text-left px-3.5 py-2.5' : 'px-3 py-2'} rounded-xl border text-sm font-medium transition-colors ${
                                    selected
                                        ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                        : isDark
                                            ? 'border-gray-700 bg-[#0E0F10] text-gray-200 hover:border-gray-500'
                                            : 'border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-300'
                                }`}
                            >
                                {o}
                            </button>
                        );
                    })}
                </div>
            );
        }
        if (field.type === 'file') {
            return (
                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${isDark ? 'border-gray-600 hover:border-[#0ECCEE] bg-[#1D1E20]' : 'border-gray-300 hover:border-[#0ECCEE] bg-white'}`}>
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {val ? val.slice(0, 24) + '…' : field.placeholder || 'Choose file'}
                    </span>
                    <input type="file" accept="image/*,.pdf" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f.name); }} />
                </label>
            );
        }
        return (
            <input type={field.type || 'text'} placeholder={field.placeholder || ''} value={val}
                onChange={(e) => onChange(e.target.value)} onFocus={scrollFieldIntoView}
                autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'name'}
                className={inp} />
        );
    };

    const submitRunRegistration = async ({
        paymentOrderId,
        paymentId: payId,
        amountPaid,
        formData = extraFields,
        booking = {},
    }) => {
        const evId = event?._id || event?.id || id;
        if (!evId) throw new Error('Event not found');

        if (requireLogin && !isAuthed()) {
            openLogin();
            throw new Error('Please log in to complete your booking.');
        }
        const headers = isAuthed()
            ? getBearerAuthHeaders(authToken)
            : { 'Content-Type': 'application/json' };
        const answers = collectBookingFormAnswers(
            event?.registration?.formSchema,
            { ...extraFields, ...(formData && typeof formData === 'object' ? formData : {}) },
        );
        const res = await fetch(`${API}/category-registrations/sports/${evId}/register`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                formData: answers,
                responses: answers,
                bookingDetails: {
                    date: booking.date ?? selDate,
                    time: booking.time ?? selTime,
                    people: booking.people ?? (singlePersonBooking ? 1 : people),
                    amountPaid: amountPaid ?? 0,
                    paymentId: payId || '',
                    payment_order_id: paymentOrderId || '',
                    paymentScreenshotUrl: booking.paymentScreenshotUrl ?? paymentScreenshotUrl,
                    transactionId: booking.transactionId ?? transactionId,
                    couponCode: booking.couponCode ?? (couponCode.trim() || undefined),
                    tierId: booking.tierId ?? selectedTierId ?? undefined,
                    addOnSelected: booking.addOnSelected ?? addOnSelected,
                },
            }),
        });
        const regData = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (res.status === 401 || isAuthFailureMessage(regData.message)) {
                if (requireLogin || regData.requireLogin) {
                    openLogin();
                    throw new Error('Please log in again to complete your booking.');
                }
            }
            // Race / stale client: server may already have the registration
            if (
                (res.status === 409 || regData.alreadyRegistered)
                && (regData.registration || regData.alreadyRegistered)
            ) {
                const existingId = regData.registration?._id || regData.registration?.id;
                if (existingId) {
                    sessionStorage.removeItem(runDraftKey(evId));
                    refreshNotifications();
                    setBookingId(String(existingId));
                    return { ...regData, alreadyRegistered: true };
                }
                // Payment already used but body lacked registration — treat as recoverable
                if (res.status === 409) {
                    throw new Error(
                        regData.message || 'This payment was already used. Open My Bookings to view your ticket.',
                    );
                }
            }
            throw new Error(regData.message || 'Registration failed after payment');
        }

        sessionStorage.removeItem(runDraftKey(evId));
        refreshNotifications();
        const savedId = regData.registration?._id || regData.registration?.id || regData._id || '';
        if (savedId) setBookingId(String(savedId));
        return regData;
    };

    const applyCoupon = useCallback(async (opts = {}) => {
        const silent = Boolean(opts.silent);
        const source = opts.source || 'manual';
        const code = String(opts.code ?? couponCodeRef.current).trim();
        setCouponError('');
        setError((prev) => (prev && /failed to fetch|network error/i.test(prev) ? '' : prev));
        if (!code) {
            setCouponInfo(null);
            return;
        }
        const eventId = event?._id || event?.id || id;
        if (!eventId) {
            if (!silent) setCouponError('Event not loaded yet — wait a moment and try again.');
            return;
        }
        const urlTier = (() => {
            try {
                return new URLSearchParams(window.location.search).get('tier') || '';
            } catch {
                return '';
            }
        })();
        const tiers = event ? getSportsTiers(event) : [];
        const effectiveTierId = String(
            selectedTierId || urlTier || location.state?.tierId || tiers[0]?.id || '',
        ).trim();
        if (isTiersPricing(event) && !effectiveTierId) {
            setCouponError('Please select a registration tier first.');
            return;
        }
        const effectiveFee = event
            ? resolveSportsPerPersonFee(event, effectiveTierId).fee
            : fee;
        const effectiveAddOnFee = optionalAddOn && addOnSelected ? optionalAddOn.fee : 0;
        const ticketTotal = (effectiveFee + effectiveAddOnFee) * Math.max(1, Number(people) || 1);
        const reqId = ++couponReqIdRef.current;
        setCouponLoading(true);
        try {
            const { data } = await publicFetchJSONRetry('/payment/coupon-validate', {
                method: 'POST',
                body: {
                    eventId,
                    people,
                    couponCode: code,
                    tierId: effectiveTierId || undefined,
                    addOnSelected: Boolean(addOnSelected && optionalAddOn),
                    expectedTicketTotal: ticketTotal,
                },
                retries: silent ? 1 : 3,
                timeout: silent ? 12000 : 20000,
            });
            if (reqId !== couponReqIdRef.current) return;
            if (data.couponApplied) {
                couponSourceRef.current = source;
                setCouponCode(String(data.couponCode || code).toUpperCase());
                setCouponInfo(data);
            } else {
                setCouponInfo(null);
                if (source === 'form') setCouponError('');
            }
        } catch (e) {
            if (reqId !== couponReqIdRef.current) return;
            setCouponInfo(null);
            const msg = e?.message || 'Invalid coupon';
            const network = e?.isNetworkError || e?.code === 'ERR_NETWORK' || /failed to fetch|network error|timeout/i.test(msg);
            setCouponError(
                network
                    ? (silent
                        ? ''
                        : (isInAppBrowser()
                            ? 'Instagram browser blocked the request. Tap Apply again, or open this page in Chrome/Safari.'
                            : 'Could not reach the server. Check your connection and tap Apply again.'))
                    : msg,
            );
        } finally {
            if (reqId === couponReqIdRef.current) setCouponLoading(false);
        }
    }, [event, id, selectedTierId, location.state?.tierId, addOnSelected, optionalAddOn, people, fee]);

    applyCouponRef.current = applyCoupon;

    useEffect(() => {
        if (!event || loadingEvent || chargePerPerson <= 0) return;
        if (couponSourceRef.current === 'cleared') return;
        const manual = couponSourceRef.current === 'manual';
        const code = (manual ? couponCodeRef.current : autoCouponCode).trim();
        if (!code) {
            if (couponSourceRef.current === 'form') {
                setCouponInfo(null);
                setCouponCode('');
                setCouponError('');
                couponSourceRef.current = null;
            }
            return;
        }
        applyCouponRef.current({
            code,
            source: manual ? 'manual' : 'form',
            silent: true,
        });
    }, [autoCouponCode, people, selectedTierId, addOnSelected, event, loadingEvent, chargePerPerson]);

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!evId || loadingEvent || !event || paymentResumeRef.current) return;

        const pending = getPendingPayment();
        const returnPath = `/events/community-event/${evId}/book`;
        if (!shouldResumePendingPayment(pending, returnPath, location.search)) return;

        paymentResumeRef.current = true;
        setStep(confirmStep);
        setPayDone(false);
        setPaying(true);
        setError('');

        (async () => {
            try {
                let draft = {};
                const rawDraft = sessionStorage.getItem(runDraftKey(evId));
                if (rawDraft) { try { draft = JSON.parse(rawDraft); } catch { /* ignore */ } }
                if (draft.extraFields) setExtraFields(draft.extraFields);
                if (draft.selDate) setSelDate(draft.selDate);
                if (draft.selTime) setSelTime(draft.selTime);
                if (draft.people) setPeople(draft.people);
                if (draft.tierId) setSelectedTierId(draft.tierId);
                if (typeof draft.addOnSelected === 'boolean') setAddOnSelected(draft.addOnSelected);

                const draftEmail = String(
                    draft?.extraFields?.email
                    || draft?.extraFields?.e_mail_id
                    || draft?.extraFields?.e_mail
                    || pending?.customerEmail
                    || '',
                ).trim();
                const verifyResult = await pollPaymentUntilVerified(API, pending.orderId, {
                    kind: 'sports',
                    search: location.search,
                    token: resolveAuthToken(authToken),
                    customerEmail: draftEmail,
                }, { maxWaitMs: PAYMENT_BACKGROUND_MAX_WAIT_MS });

                if (verifyResult.status === 'cancelled') {
                    clearCashfreeReturnAndPending(navigate, location);
                    clearPendingPayment();
                    setStep(detailsStep || 2);
                    setPayDone(false);
                    setError('Payment cancelled.');
                    setPaying(false);
                    return;
                }

                if (!verifyResult.ok || !verifyResult.verified) {
                    const { kind, message } = classifyVerifyError(verifyResult);
                    if (kind === 'cancelled' || kind === 'failed') clearPendingPayment();
                    setStep(confirmStep);
                    setPayDone(false);
                    setError(
                        kind === 'pending'
                            ? 'Payment is confirming. Check My Bookings — do not pay again.'
                            : (message || 'Payment verification failed after redirect. Contact support.'),
                    );
                    setPaying(false);
                    return;
                }

                clearPendingPayment();

                const v = verifyResult.data;
                const registrationId = registrationIdFromVerifyPayload(v);
                const verified = buildVerifiedPaymentFields(v, pending.orderId);
                setPaymentId(verified.payment_id);
                setCashfreeOrderId(verified.payment_order_id || pending.orderId || '');
                setPayDone(true);
                if (registrationId) {
                    sessionStorage.removeItem(runDraftKey(evId));
                    refreshNotifications();
                    setBookingId(String(registrationId));
                    setStep(confirmStep);
                    return;
                }
                await submitRunRegistration({
                    paymentOrderId: verified.payment_order_id || pending.orderId,
                    paymentId: verified.payment_id,
                    amountPaid: v.totalAmount ?? total,
                    formData: draft.extraFields || extraFields,
                    booking: {
                        date: draft.selDate || selDate,
                        time: draft.selTime || selTime,
                        people: singlePersonBooking ? 1 : (draft.people || people),
                        tierId: draft.tierId || selectedTierId,
                        addOnSelected: typeof draft.addOnSelected === 'boolean' ? draft.addOnSelected : addOnSelected,
                    },
                });
                setStep(confirmStep);
            } catch (e) {
                setStep(detailsStep || 2);
                setPayDone(false);
                setError(e.message || 'Could not complete booking after payment');
            } finally {
                setPaying(false);
            }
        })();
    }, [id, event, loadingEvent, navigate, location.search, confirmStep, detailsStep]);

    const next = async () => {
        setError('');
        if (payingRef.current || paying) return;
        if (singlePersonBooking && people !== 1) setPeople(1);
        if (requireLogin && !isAuthed()) {
            openLogin();
            setError('Please log in to book this event.');
            return;
        }

        const isFreeRun = isFreeFlow;
        // Free run with no extra questions: party size → confirm
        if (step === 1 && isFreeRun && extraCount === 0) {
            const missingPage1 = page1CouponFields.filter((f) => {
                if (!f.required) return false;
                return !String(extraFields[f.fieldName] || '').trim();
            });
            if (missingPage1.length > 0) {
                setError(`Please select: ${missingPage1.map((f) => f.label).join(', ')}`);
                return;
            }
            const formData = {
                ...profileToRunFormData(user),
                ...extraFields,
            };
            if (!formData.full_name) formData.full_name = user?.name || user?.fullName || '';
            if (!formData.email) formData.email = user?.email || '';
            if (!formData.contact_no) {
                formData.contact_no = user?.phoneNumber || user?.phone || user?.mobile || '';
            }
            if (!formData.full_name?.trim() || !formData.email?.trim()) {
                setError('Sign in with Google so we can reserve your spot.');
                openLogin();
                return;
            }
            setExtraFields(formData);
            setPaying(true);
            try {
                await submitRunRegistration({
                    amountPaid: 0,
                    formData,
                    booking: {
                        people: 1,
                        couponCode: couponCode.trim() || undefined,
                        tierId: selectedTierId || undefined,
                        addOnSelected: Boolean(addOnSelected && optionalAddOn),
                    },
                });
                setStep(2);
                setPayDone(true);
            } catch (e) {
                setError(e.message || 'Registration failed');
            } finally {
                setPaying(false);
            }
            return;
        }

        if (step === 1) {
            const missingPage1 = page1CouponFields.filter((f) => {
                if (!f.required) return false;
                return !String(extraFields[f.fieldName] || '').trim();
            });
            if (missingPage1.length > 0) {
                setError(`Please select: ${missingPage1.map((f) => f.label).join(', ')}`);
                return;
            }
            if (genderRegistration?.enabled && genderAccess.canRegister === false) {
                setError(genderAccess.message || 'No seats left for this gender.');
                return;
            }
            setStep(2);
            return;
        }

        if (questionField) {
            if (questionField.required && !String(extraFields[questionField.fieldName] || '').trim()) {
                setError(`Please select: ${questionField.label}`);
                return;
            }
            if (isFreeRun && step + 1 >= confirmStep) {
                const formData = {
                    ...profileToRunFormData(user),
                    ...extraFields,
                };
                if (!formData.full_name) formData.full_name = user?.name || user?.fullName || '';
                if (!formData.email) formData.email = user?.email || '';
                if (!formData.contact_no) {
                    formData.contact_no = user?.phoneNumber || user?.phone || user?.mobile || '';
                }
                if (!formData.full_name?.trim() || !formData.email?.trim()) {
                    setError('Sign in with Google so we can reserve your spot.');
                    openLogin();
                    return;
                }
                setExtraFields(formData);
                setPaying(true);
                try {
                    await submitRunRegistration({
                        amountPaid: 0,
                        formData,
                        booking: {
                            people: 1,
                            couponCode: couponCode.trim() || undefined,
                            tierId: selectedTierId || undefined,
                            addOnSelected: Boolean(addOnSelected && optionalAddOn),
                        },
                    });
                    setStep(confirmStep);
                    setPayDone(true);
                } catch (e) {
                    setError(e.message || 'Registration failed');
                } finally {
                    setPaying(false);
                }
                return;
            }
            setStep((s) => s + 1);
            return;
        }

        if (step === detailsStep) {
            const mergedFields = {
                ...profileToRunFormData(user),
                ...extraFields,
            };
            const customerEmail = String(
                mergedFields.email || mergedFields.e_mail_id || mergedFields.e_mail || '',
            ).trim();
            const skipPhoneRequirement = Boolean(
                isFreeRun
                && isAuthed()
                && String(mergedFields.full_name || mergedFields.name || '').trim()
                && customerEmail,
            );
            const missing = regSchema.filter((f) => {
                if (!f.required) return false;
                if (
                    skipPhoneRequirement
                    && isDefaultContactField(f)
                    && responseAliasGroup(f.fieldName) === 'phone'
                ) {
                    return false;
                }
                const val = mergedFields[f.fieldName]?.toString().trim();
                return !val;
            });
            if (missing.length > 0) { setError(`Please fill: ${missing.map((f) => f.label).join(', ')}`); return; }

            if (!customerEmail) { setError('Email is required to complete your booking.'); return; }
            const customerPhone = String(mergedFields.contact_no || mergedFields.phone || mergedFields.mobile || '')
                .replace(/\D/g, '')
                .slice(-10);
            const needsCashfreePhone = payableAmount > 0 && !isOrganizerQr;
            if (
                needsCashfreePhone
                && !skipPhoneRequirement
                && (customerPhone.length !== 10 || customerPhone === '9999999999')
            ) {
                setError('Enter a 10-digit mobile number');
                return;
            }
            setExtraFields(mergedFields);

            if (payableAmount <= 0) {
                try {
                    setPaying(true);
                    await submitRunRegistration({
                        amountPaid: 0,
                        formData: mergedFields,
                        booking: {
                            couponCode: couponCode.trim() || undefined,
                        },
                    });
                    setStep(successStep);
                    setPayDone(true);
                } catch (e) {
                    setError(e.message || 'Registration failed');
                } finally {
                    setPaying(false);
                }
                return;
            }

            if (isOrganizerQr) {
                if (payableAmount > 0) {
                    if (!paymentQR) {
                        setError('Organizer payment QR is not configured yet. Please contact the club.');
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
                }
                setPaying(true);
                try {
                    await submitRunRegistration({
                        amountPaid: payableAmount,
                        formData: mergedFields,
                        booking: {
                            paymentScreenshotUrl: payableAmount > 0 ? paymentScreenshotUrl : '',
                            transactionId: payableAmount > 0 ? transactionId : '',
                            couponCode: couponCode.trim() || undefined,
                        },
                    });
                    setStep(confirmStep);
                    setPayDone(true);
                } catch (e) {
                    setError(e.message || 'Registration failed');
                } finally {
                    setPaying(false);
                }
                return;
            }

            saveDraft({ step: detailsStep });
            setPaying(true);
            try {
                const res = await fetch(`${API}/payment/sports-order`, {
                    method: 'POST',
                    headers: getBearerAuthHeaders(authToken),
                    body: JSON.stringify({
                        eventId: event._id || event.id || id,
                        eventName,
                        people: singlePersonBooking ? 1 : people,
                        customerName: mergedFields.full_name || mergedFields.name || extraFields.full_name || extraFields.name || '',
                        customerEmail,
                        customerPhone,
                        couponCode: couponCode.trim() || undefined,
                        tierId: selectedTierId || undefined,
                        addOnSelected: Boolean(addOnSelected && optionalAddOn),
                        gender: mergedFields.gender || mergedFields.sex || extraFields.gender || extraFields.sex || '',
                        formData: collectBookingFormAnswers(event?.registration?.formSchema, mergedFields),
                    }),
                });
                const order = await res.json();
                if (order?.skipPayment || Number(order?.totalAmount) === 0) {
                    await submitRunRegistration({
                        amountPaid: 0,
                        formData: mergedFields,
                        booking: {
                            couponCode: couponCode.trim() || undefined,
                            tierId: selectedTierId,
                            addOnSelected: Boolean(addOnSelected && optionalAddOn),
                        },
                    });
                    setStep(confirmStep);
                    setPayDone(true);
                    setPaying(false);
                    return;
                }
                if (!res.ok) {
                    if (res.status === 401 || isAuthFailureMessage(order.message) || order.requireLogin) {
                        if (requireLogin || order.requireLogin) {
                            openLogin();
                            setError('Please log in to book this event.');
                            setPaying(false);
                            return;
                        }
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

                saveDraft({
                    step: detailsStep,
                    extraFields: mergedFields,
                    selDate,
                    selTime,
                    people,
                    tierId: selectedTierId,
                    addOnSelected,
                });

                const checkoutFlow = await runCashfreeCheckoutAndVerify({
                    order,
                    returnPath: `/events/community-event/${id || event?._id || event?.id}/book`,
                    entityType: 'sports',
                    cashfreeMode: order.cashfreeMode,
                    customerEmail,
                    verifyOrder: ({ orderId, paymentId }) => verifyPaymentWithRetry(API, orderId, {
                        kind: 'sports',
                        paymentId,
                        token: resolveAuthToken(authToken),
                        customerEmail,
                    }),
                });

                if (checkoutFlow.status === 'redirect_deferred') {
                    setStep(confirmStep);
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
                        step: detailsStep || 2,
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
                        step: detailsStep || 2,
                    });
                    retryCheckoutRef.current = () => next();
                    setPaymentModal({ open: true, message: checkoutFlow.message, orderId: order.orderId });
                    return;
                }

                setStep(confirmStep);
                setPaying(true);

                if (checkoutFlow.status === 'verified') {
                    const { verified, registrationId } = checkoutFlow;
                    setPaymentId(verified.payment_id);
                    setCashfreeOrderId(verified.payment_order_id || order.orderId || '');
                    if (registrationId) {
                        sessionStorage.removeItem(runDraftKey(id || event?._id || event?.id));
                        refreshNotifications();
                        setBookingId(String(registrationId));
                        setPaymentFlowToSuccess({ setPayDone, setPaying, setError });
                        return;
                    }
                    await submitRunRegistration({
                        paymentOrderId: verified.payment_order_id || order.orderId,
                        paymentId: verified.payment_id,
                        amountPaid: order.totalAmount ?? total,
                        formData: mergedFields,
                    });
                    setPaymentFlowToSuccess({ setPayDone, setPaying, setError });
                } else {
                    setPaymentFlowToStepTwo({
                        setStep,
                        setPayDone,
                        setPaying,
                        setError,
                        message: checkoutFlow.message || 'Payment verification failed. Contact support.',
                        step: detailsStep || 2,
                    });
                }
            } catch (e) {
                setPaymentFlowToStepTwo({
                    setStep,
                    setPayDone,
                    setPaying,
                    setError,
                    message: 'Payment error: ' + e.message,
                    step: detailsStep || 2,
                });
            }
        }
    };

    const back = () => {
        if (step !== 1) {
            setStep((s) => s - 1);
            return;
        }
        const evId = id || event?._id || event?.id;
        if (evId) {
            try { sessionStorage.removeItem(runDraftKey(evId)); } catch { /* ignore */ }
        }
        goBack();
    };

    const hasStoredSession = !!localStorage.getItem('crwdctrl_token');
    const waitingOnAuth = hasStoredSession && (authLoading || isAuthProcessing || isRedirectProcessing);
    const showLoginOverlay = formLocked && !showSuccess && !showProcessing && !waitingOnAuth && !isRedirectProcessing;

    const loginOverlay = showLoginOverlay || showLogin ? (
        <CrwdCtrlLogin
            googleOnly
            title="Sign in to book"
            subtitle="Your form is ready below — one tap with Google to start filling it"
            onClose={handleCloseLogin}
        />
    ) : null;

    if ((loadingEvent || waitingOnAuth) && !showSuccess && !showProcessing) {
        return (
            <>
                <DetailPageLoader label="Loading booking" variant="booking" />
                {loginOverlay}
            </>
        );
    }

    if (!event && !showSuccess && !showProcessing) {
        const isNotFound = loadError === 'not_found';
        const isRetryable = !isNotFound;
        return (
            <div className="crwdctrl-page crwdctrl-page--flat min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isRetryable ? "Couldn't load this event" : 'This event is no longer available'}
                </p>
                <p className={`text-sm text-center max-w-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {isRetryable
                        ? 'Slow network or server waking up — tap Retry.'
                        : 'Open booking from the event page, or the link may be outdated.'}
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
                <button type="button" onClick={() => navigate('/events')} className="text-[#0ECCEE] text-sm font-semibold">
                    Browse events
                </button>
            </div>
        );
    }

    const registrationClosed = event?.registration?.status === 'closed';
    const registrationFull = Boolean(event?.isFull)
        || (event?.seatsRemaining === 0 && Number(event?.maxParticipants) > 0);
    if ((registrationClosed || registrationFull) && !showSuccess && !showProcessing) {
        return (
            <div className="crwdctrl-page crwdctrl-page--flat min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <CalendarX className={`size-10 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={`text-sm text-center font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {registrationClosed ? copy.closed : copy.full}
                </p>
                <button
                    type="button"
                    onClick={() => navigate(event ? eventCommunityEventPath(event) : '/events')}
                    className="text-[#0ECCEE] text-sm font-semibold"
                >
                    Back to event
                </button>
            </div>
        );
    }

    if (showProcessing) {
        return <DetailPageLoader label="Confirming your booking" />;
    }

    if (showSuccess) {
        const isPendingQr = chargePerPerson > 0 && isOrganizerQr && payableAmount > 0 && !event?.registration?.qrAutoConfirm;
        return (
            <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    {isPendingQr ? (
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-500/15">
                            <Clock className="w-9 h-9 text-amber-400" />
                        </div>
                    ) : (
                        <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
                    )}
                    <h1 className={`text-3xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {isPendingQr
                            ? 'Payment submitted'
                            : chargePerPerson > 0
                                ? '🎉 Payment Successful!'
                                : '🎉 Booking Confirmed!'}
                    </h1>
                    <p className={`${isPendingQr ? 'mb-2' : 'mb-6'} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {isPendingQr ? (
                            <>{clubName} will confirm your payment soon.</>
                        ) : (
                            <>
                                Your booking for <span className="text-[#0ECCEE] font-semibold">{eventName}</span> has been confirmed.
                            </>
                        )}
                    </p>
                    {isPendingQr ? (
                        <p className={`mb-6 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            Holds for 48 hours if not reviewed.
                        </p>
                    ) : null}

                    <div className={`rounded-xl p-5 mb-6 text-left ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {isPendingQr || total > 0 ? 'Receipt' : 'Booking Details'}
                        </p>
                        {[
                            { label: 'Status', value: isPendingQr ? 'Pending community approval' : 'Confirmed' },
                            { label: 'Date', value: selDate || '—' },
                            ...(selTime ? [{ label: 'Time', value: selTime }] : []),
                            ...(singlePersonBooking ? [] : [{ label: 'People', value: `${people} ${people > 1 ? 'people' : 'person'}` }]),
                            ...(selectedTier ? [{ label: 'Tier', value: selectedTier.name }] : []),
                            ...(optionalAddOn && addOnSelected
                                ? [{ label: optionalAddOn.label, value: formatInr(optionalAddOn.fee * people) }]
                                : []),
                            { label: 'Entry Fee', value: fee > 0 ? formatInr(fee * people) : 'Free' },
                            ...(isPendingQr
                                ? [{ label: 'Amount paid to community', value: `₹${payableAmount.toLocaleString('en-IN')}` }]
                                : total > 0
                                    ? [{ label: 'Total Paid', value: `₹${total.toLocaleString('en-IN')}` }]
                                    : []),
                            ...(total > 0 && !isPendingQr
                                ? [{ label: 'Platform fee', value: '₹0' }]
                                : []),
                            ...(cashfreeOrderId ? [{ label: 'Order ID', value: cashfreeOrderId }] : []),
                            ...(paymentId ? [{ label: 'Payment ID', value: paymentId.slice(0, 18) + '…' }] : []),
                            ...(transactionId && isPendingQr ? [{ label: 'UPI / Txn ID', value: transactionId }] : []),
                        ].map((r) => (
                            <div key={r.label} className={`flex justify-between text-sm py-2 border-b last:border-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{r.label}</span>
                                <span className={`font-semibold text-right max-w-[60%] break-all ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {bookingId && !isPendingQr && (
                            <button type="button"
                                onClick={() => navigate(sportsQrTicketPath(bookingId, true), { state: { refreshBookings: true } })}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">
                                Download Ticket
                            </button>
                        )}
                        <button type="button"
                            onClick={() => {
                                const pending = isPendingQr && bookingId
                                    ? {
                                        id: bookingId,
                                        name: eventName,
                                        image: event?.coverImage || event?.images?.[0] || null,
                                        date: event?.eventDate || selDate || null,
                                        venue: event?.venue || event?.city || '',
                                        type: 'sports',
                                        status: 'upcoming',
                                        registrationStatus: 'pending',
                                        registrationType: 'sports',
                                        isCompetition: false,
                                        isTrek: false,
                                        isSports: true,
                                        clubName,
                                        paymentAmount: payableAmount,
                                        paymentStatus: 'pending',
                                        amountPaid: payableAmount,
                                        registeredAt: new Date().toISOString(),
                                    }
                                    : null;
                                goToBookings(navigate, pending);
                            }}
                            className={`w-full py-3.5 rounded-xl font-semibold transition ${
                                isPendingQr || !bookingId
                                    ? 'text-black bg-[#0ECCEE] hover:opacity-90'
                                    : isDark
                                        ? 'border border-gray-600 text-gray-200 hover:bg-gray-800'
                                        : 'border border-gray-300 text-gray-800 hover:bg-gray-100'
                            }`}>
                            View My Bookings
                        </button>
                        <button type="button"
                            onClick={() => navigate('/events')}
                            className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Browse more events
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-dvh pt-[calc(var(--safe-top)+0.5rem)] sm:pt-[calc(var(--safe-top)+1rem)] pb-[max(6rem,var(--safe-bottom)+5rem)]">
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
            <div className={`max-w-lg mx-auto px-4 sm:px-6 transition-opacity duration-300 ${formLocked ? 'opacity-90' : ''}`}>

                {formLocked ? (
                    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${isDark ? 'bg-[#0ECCEE]/10 border-[#0ECCEE]/30 text-[#0ECCEE]' : 'bg-cyan-50 border-cyan-200 text-cyan-800'}`}>
                        Preview the form below — sign in with Google to fill and book.
                    </div>
                ) : null}

                <div className="flex items-start gap-3 mb-4 sm:mb-6 pt-10">
                    <button onClick={back} className={`p-2 rounded-lg transition-colors shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}>
                        <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Book: {eventName}
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{bookingSteps[step - 1]}</p>
                    </div>
                </div>

                {error && (
                    <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                        {error}
                    </div>
                )}

                {!loggedIn && !requireLogin && (
                    <div className={`rounded-xl p-3 mb-4 border text-sm ${isDark ? 'bg-[#1D1E20] border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-600'}`}>
                        Guest checkout is on — no account needed. Optionally{' '}
                        <button type="button" onClick={() => openLogin()} className="text-[#0ECCEE] font-semibold underline">
                            log in
                        </button>
                        {' '}to save this booking under My Bookings.
                    </div>
                )}

                <div className={`rounded-2xl p-4 sm:p-6 border ${isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'} ${formLocked ? 'pointer-events-none select-none blur-[2px] saturate-75' : ''}`}>

                    <div className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {step} of {bookingSteps.length}</span>
                        </div>
                        <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300" style={{ width: `${(step / bookingSteps.length) * 100}%` }} />
                        </div>
                        <div className="flex justify-between">
                            {bookingSteps.map((s, i) => (
                                <div key={`${s}-${i}`} className="flex flex-col items-center min-w-0 flex-1">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        i + 1 === step ? 'bg-[#0ECCEE] text-black'
                                        : i + 1 < step ? 'bg-green-600 text-white'
                                        : isDark ? 'bg-gray-600 text-gray-300'
                                        : 'bg-gray-300 text-gray-600'
                                    }`}>
                                        {i + 1 < step ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-[10px] mt-1 text-center leading-tight px-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className={`rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Booking
                                </p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {runDateLabel || 'Date TBA'}
                                    {runTimeLabel ? ` · ${runTimeLabel}` : ''}
                                </p>
                            </div>

                            <div className="px-4 py-3 space-y-3">
                                {selectedTier ? (
                                    <div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Tier</p>
                                                <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {selectedTier.name}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => navigate(eventCommunityEventPath(event), { state: { event } })}
                                                className="text-[11px] font-semibold text-[#0ECCEE] shrink-0"
                                            >
                                                Change
                                            </button>
                                        </div>
                                        {Array.isArray(selectedTier.inclusions) && selectedTier.inclusions.length > 0 ? (
                                            <div className={`mt-2 rounded-xl ${isDark ? 'bg-[#0E0F10]' : 'bg-gray-50'}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowTierIncludes((v) => !v)}
                                                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium ${
                                                        isDark ? 'text-gray-300' : 'text-gray-600'
                                                    }`}
                                                >
                                                    <span>What’s included ({selectedTier.inclusions.length})</span>
                                                    <ChevronDown
                                                        size={14}
                                                        className={`text-[#0ECCEE] transition-transform ${showTierIncludes ? 'rotate-180' : ''}`}
                                                    />
                                                </button>
                                                {showTierIncludes ? (
                                                    <ul className="px-3 pb-2.5 space-y-1.5">
                                                        {selectedTier.inclusions.map((item, i) => (
                                                            <li key={i} className={`flex gap-2 text-xs leading-snug ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                <Check size={12} className="text-[#0ECCEE] shrink-0 mt-0.5" strokeWidth={3} />
                                                                <span>{item}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </div>
                                ) : null}

                                {optionalAddOn ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setAddOnSelected((v) => !v);
                                        }}
                                        className={`w-full text-left rounded-2xl border px-3.5 py-3.5 transition-all active:scale-[0.99] ${
                                            addOnSelected
                                                ? isDark
                                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                                                    : 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-sm'
                                                : isDark
                                                    ? 'border-gray-700 bg-[#0E0F10] hover:border-gray-600'
                                                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span
                                                className={`mt-0.5 size-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                    addOnSelected
                                                        ? 'border-[#0ECCEE] bg-[#0ECCEE] text-black'
                                                        : isDark
                                                            ? 'border-gray-600 bg-transparent'
                                                            : 'border-gray-300 bg-white'
                                                }`}
                                                aria-hidden
                                            >
                                                {addOnSelected ? (
                                                    <Check size={13} strokeWidth={3} />
                                                ) : null}
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="flex items-start justify-between gap-2">
                                                    <span>
                                                        <span className={`block text-[10px] font-semibold uppercase tracking-wider ${
                                                            addOnSelected ? 'text-[#0ECCEE]' : isDark ? 'text-gray-500' : 'text-gray-400'
                                                        }`}>
                                                            Optional add-on
                                                        </span>
                                                        <span className={`block text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {optionalAddOn.label}
                                                        </span>
                                                    </span>
                                                    <span className={`shrink-0 text-sm font-bold tabular-nums ${
                                                        addOnSelected ? 'text-[#0ECCEE]' : isDark ? 'text-white' : 'text-gray-900'
                                                    }`}>
                                                        +{formatInr(optionalAddOn.fee)}
                                                    </span>
                                                </span>
                                                <span className={`block text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {addOnSelected
                                                        ? people > 1
                                                            ? `Added · ${formatInr(optionalAddOn.fee)} × ${people} = ${formatInr(optionalAddOn.fee * people)}`
                                                            : 'Added to your total'
                                                        : 'Tap to add · charged per person'}
                                                </span>
                                            </span>
                                        </div>
                                    </button>
                                ) : null}

                                {page1CouponFields.length > 0 ? (
                                    <div className={`space-y-4 pt-1 ${(selectedTier || optionalAddOn) ? `border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} pt-3` : ''}`}>
                                        {page1CouponFields.map((field) => (
                                            <div key={field.id || field.fieldName}>
                                                {isGenderChoiceField(field) ? null : (
                                                <p className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                    {field.label}
                                                    {field.required ? <span className="text-red-400 ml-0.5">*</span> : null}
                                                </p>
                                                )}
                                                {renderField(field, { couponSelect: true })}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}

                                {singlePersonBooking ? null : (
                                <div className={`pt-1 ${(selectedTier || optionalAddOn || page1CouponFields.length) ? `border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} pt-3` : ''}`}>
                                    <p className={`text-[11px] mb-1.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>People</p>
                                    {genderRegistration?.enabled && bookingGender && genderRemaining != null ? (
                                        <p className={`text-[11px] mb-1.5 ${genderRemaining <= 0 ? 'text-red-400' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {genderRemaining} {String(bookingGender).toLowerCase().startsWith('f') ? 'women' : 'men'} seat{genderRemaining === 1 ? '' : 's'} left
                                        </p>
                                    ) : null}
                                    <div className="flex items-center">
                                        <button
                                            type="button"
                                            onClick={() => { setPeople((p) => Math.max(1, p - 1)); }}
                                            disabled={people <= 1}
                                            className={`w-8 h-8 rounded-l-lg flex items-center justify-center border transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-700 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}
                                        >
                                            <ChevronLeft size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                        <div className={`w-10 h-8 flex items-center justify-center border-y ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-300'}`}>
                                            <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{people}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setPeople((p) => Math.min(maxSelectablePeople, p + 1)); }}
                                            disabled={people >= maxSelectablePeople}
                                            className={`w-8 h-8 rounded-r-lg flex items-center justify-center border transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-700 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}
                                        >
                                            <ChevronRight size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                        </button>
                                    </div>
                                    {onePersonFreeLimit ? (
                                        <p className={`text-[10px] mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            Free run: 1 person per login.
                                        </p>
                                    ) : null}
                                </div>
                                )}

                                {chargePerPerson > 0 ? (
                                    <div className={`rounded-xl px-3.5 py-3 ${(page1CouponFields.length || selectedTier || optionalAddOn) ? `border-t ${isDark ? 'border-gray-800' : 'border-gray-100'} pt-3 mt-1` : ''} ${isDark ? 'bg-[#0ECCEE]/8 border border-[#0ECCEE]/20' : 'bg-cyan-50 border border-cyan-100'}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    Estimated total
                                                </p>
                                                {couponInfo?.couponApplied ? (
                                                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                                                        {couponInfo.couponCode} · save {formatInr(couponInfo.discountAmount || 0)}
                                                    </p>
                                                ) : couponError && autoCouponCode ? (
                                                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-amber-400/80' : 'text-amber-700'}`}>
                                                        {couponError}
                                                    </p>
                                                ) : couponLoading && autoCouponCode ? (
                                                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        Checking coupon…
                                                    </p>
                                                ) : (people > 1 || addOnFeePerPerson > 0) ? (
                                                    <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {formatInr(chargePerPerson)} × {people}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xl font-bold tabular-nums text-[#0ECCEE] leading-tight">
                                                    {formatInr(couponInfo?.couponApplied
                                                        ? Number(couponInfo.amountAfterDiscount ?? baseFee)
                                                        : baseFee)}
                                                </p>
                                                {couponInfo?.couponApplied ? (
                                                    <p className={`text-[10px] line-through ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {formatInr(couponInfo.amountBeforeDiscount ?? baseFee)}
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`rounded-xl px-3.5 py-3 text-center ${isDark ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-emerald-50 border border-emerald-200'}`}>
                                        <p className="text-lg font-bold text-emerald-500 leading-tight">Free run</p>
                                        <p className={`text-[10px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No payment on next step</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {questionField ? (
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {shortBookingStepLabel(questionField)}
                                </p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {questionField.label}
                                    {questionField.required ? <span className="text-red-400 ml-1">*</span> : null}
                                </p>
                            </div>
                            <div className="px-4 py-4">
                                {renderField(questionField, { couponSelect: true })}
                            </div>
                        </div>
                    ) : null}

                    {step === detailsStep && !isFreeFlow && (
                        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-white border-gray-200 shadow-sm'}`}>
                            <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
                                <p className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    Your details
                                </p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Complete the form to book
                                </p>
                            </div>

                            <div className="px-4 py-4 space-y-4">
                                {formInstructions && (
                                    <div className={`rounded-lg p-3 border text-xs ${isDark ? 'bg-amber-900/20 border-amber-700/40 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                                        {formInstructions}
                                    </div>
                                )}

                                {step2Fields.map((field) => (
                                    <div key={field.id || field.fieldName}>
                                        {isGenderChoiceField(field) ? null : (
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {field.label}
                                            {field.required && <span className="text-red-400 ml-1">*</span>}
                                        </label>
                                        )}
                                        {renderField(field)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === detailsStep && !isFreeFlow && chargePerPerson > 0 && (
                        <div className="mt-3">
                            <RunCheckoutPanel
                                mode={isOrganizerQr ? 'organizer_qr' : 'cashfree'}
                                isDark={isDark}
                                feeLabel={copy.feeLabel}
                                approverLabel={copy.checkoutApprover}
                                payableAmount={payableAmount}
                                baseFee={baseFee}
                                chargePerPerson={chargePerPerson}
                                feePerPerson={fee}
                                people={people}
                                optionalAddOnLabel={optionalAddOn?.label}
                                addOnFeePerPerson={addOnFeePerPerson}
                                couponInfo={couponInfo}
                                couponCode={couponCode}
                                couponLoading={couponLoading}
                                couponError={couponError}
                                onCouponCodeChange={(v) => {
                                    couponSourceRef.current = 'cleared';
                                    setCouponCode(v);
                                    setCouponInfo(null);
                                    setCouponError('');
                                }}
                                onApplyCoupon={() => applyCoupon({ source: 'manual' })}
                                onClearCoupon={clearAppliedCoupon}
                                paymentQR={paymentQR}
                                paymentUpiId={paymentUpiId}
                                paymentQRMessage={paymentQRMessage}
                                qrAutoConfirm={Boolean(event?.registration?.qrAutoConfirm)}
                                upiCopied={upiCopied}
                                onCopyUpi={async () => {
                                    try {
                                        await navigator.clipboard.writeText(paymentUpiId);
                                        setUpiCopied(true);
                                        setTimeout(() => setUpiCopied(false), 2000);
                                    } catch {
                                        setError('Could not copy UPI ID');
                                    }
                                }}
                                paymentScreenshotUrl={paymentScreenshotUrl}
                                uploadingProof={uploadingProof}
                                onUploadScreenshot={uploadPaymentScreenshot}
                                onRemoveScreenshot={() => setPaymentScreenshotUrl('')}
                                transactionId={transactionId}
                                onTransactionIdChange={setTransactionId}
                            />
                        </div>
                    )}

                    {step === detailsStep && !isFreeFlow && chargePerPerson <= 0 && (
                        <div className={`mt-4 rounded-xl p-4 border ${isDark ? 'bg-emerald-900/15 border-emerald-700/40' : 'bg-emerald-50 border-emerald-200'}`}>
                            <p className={`text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-800'}`}>Free run</p>
                            <p className={`text-xs mt-1 ${isDark ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                                {isAuthed() && (user?.email || user?.name)
                                    ? 'We’ll use your Google account details for the organizer guest list.'
                                    : 'No payment needed — confirm your details to reserve your spot.'}
                            </p>
                        </div>
                    )}

                    {!(isFreeFlow && step === confirmStep) ? (
                    <div className="flex flex-col sm:flex-row gap-3 pt-5">
                        <button type="button" onClick={back} disabled={paying}
                            className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}>
                            {step === 1 ? 'Cancel' : 'Previous Step'}
                        </button>
                        <button type="button" onClick={next} disabled={paying || uploadingProof}
                            className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ECCEE]/10 disabled:opacity-60">
                            {paying ? (
                                <><Loader className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : step === 1 && isFreeFlow && extraCount === 0 ? (
                                'Confirm free spot'
                            ) : step === detailsStep && chargePerPerson > 0 && isOrganizerQr ? (
                                payableAmount > 0
                                    ? `Pay ₹${payableAmount.toLocaleString('en-IN')} · Submit proof`
                                    : 'Confirm free booking'
                            ) : step === detailsStep && total > 0 ? (
                                `Pay ₹${payableAmount.toLocaleString('en-IN')} & Book`
                            ) : step === detailsStep ? (
                                'Confirm free booking'
                            ) : (
                                'Next Step'
                            )}
                        </button>
                    </div>
                    ) : null}
                </div>
            </div>

            {loginOverlay}

            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

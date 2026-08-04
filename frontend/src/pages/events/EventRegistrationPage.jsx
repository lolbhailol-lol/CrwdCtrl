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
import { API_BASE_URL, publicFetchJSONRetry } from '../../services/api/client';
import { useBookingSuccessPopup } from '../../hooks/useSuccessPopup';
import { eventShowPath } from '../../utils/slugRoutes';

const API = API_BASE_URL;

const FILE_TYPES = ['file', 'image'];

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
        name: find(['name']),
        email: find(['email', 'e_mail']),
        phone: find(['phone', 'contact', 'mobile']),
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
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
    const retryRef = useRef(null);
    const resumeRef = useRef(false);

    const isAuthed = useCallback(() => isAuthenticated || !!authToken || !!localStorage.getItem('crwdctrl_token'), [isAuthenticated, authToken]);

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
    const ticketPrice = Number(event?.ticketPrice) || 0;
    const platformFeePercent = Number(event?.platformFeePercent) || 2.5;
    const breakdown = useMemo(
        () => buildEventPriceBreakdown(ticketPrice, platformFeePercent),
        [ticketPrice, platformFeePercent],
    );
    const payableAmount = couponInfo?.amountAfterDiscount ?? breakdown.totalAmount;
    const title = event?.displayName || event?.title || 'Event';

    useBookingSuccessPopup(done, {
        name: title,
        paid: ticketPrice > 0,
        bookingId: registrationId,
        ticketType: 'event',
    });

    const formSteps = useMemo(() => {
        if (reg.formType === 'MULTI_STEP' && Array.isArray(reg.steps) && reg.steps.length > 0) {
            return reg.steps.map((s, i) => ({
                title: s.stepTitle || `Step ${i + 1}`,
                description: s.stepDescription || '',
                fields: (s.fields || []).filter((f) => f.label && f.fieldName),
            }));
        }
        const fields = (reg.formSchema || []).filter((f) => f.label && f.fieldName);
        return [{ title: 'Your Details', description: '', fields }];
    }, [reg.formType, reg.steps, reg.formSchema]);

    const allSteps = useMemo(() => [...formSteps, { title: 'Confirm & Pay', payment: true }], [formSteps]);
    const allFields = useMemo(() => formSteps.flatMap((s) => s.fields), [formSteps]);

    // Prefill basic info from the logged-in user
    useEffect(() => {
        if (!user) return;
        setValues((prev) => {
            if (Object.keys(prev).length > 0) return prev;
            const next = {};
            allFields.forEach((f) => {
                const name = f.fieldName.toLowerCase();
                if (name.includes('name') && (user.name || user.fullName)) next[f.fieldName] = user.name || user.fullName;
                else if (name.includes('email') && user.email) next[f.fieldName] = user.email;
                else if ((name.includes('phone') || name.includes('contact') || name.includes('mobile')) && (user.phone || user.mobile)) next[f.fieldName] = user.phone || user.mobile;
            });
            return next;
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
    } = {}) => {
        const token = localStorage.getItem('crwdctrl_token');
        if (!token) { setShowLogin(true); throw new Error('Please log in to register.'); }

        const submissionValues = valuesOverride ?? values;
        const submissionFiles = filesOverride ?? files;

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
        fd.append('responses', JSON.stringify(textResponses));
        if (paymentOrderId) fd.append('payment_order_id', paymentOrderId);
        if (paymentId) fd.append('payment_id', paymentId);

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
    }, [allFields, files, values, eventId, refreshNotifications]);

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
        const token = localStorage.getItem('crwdctrl_token');

        let draftValues = {};
        const rawDraft = sessionStorage.getItem(draftKey(eventId));
        if (rawDraft) {
            try {
                const parsed = JSON.parse(rawDraft);
                draftValues = parsed.values || {};
                if (Object.keys(draftValues).length > 0) setValues(draftValues);
            } catch { /* ignore */ }
        }

        (async () => {
            try {
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

        // free event — submit directly
        if (ticketPrice <= 0) {
            setPaying(true);
            try {
                await submitRegistration({ amountPaid: 0 });
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

        sessionStorage.setItem(draftKey(eventId), JSON.stringify({ values }));
        setPaying(true);
        try {
            const token = localStorage.getItem('crwdctrl_token');
            const orderRes = await fetch(`${API}/payment/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                    eventShowId: eventId,
                    customerName: customer.name,
                    customerEmail: customer.email,
                    customerPhone: customer.phone,
                    couponCode: couponCode.trim() || undefined,
                }),
            });
            const order = await orderRes.json();
            if (!orderRes.ok || !order.paymentSessionId) {
                setError(order.message || 'Failed to create payment order.');
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
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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
                body: { eventShowId: eventId, couponCode: code },
                retries: 4,
                timeout: 25000,
            });
            setCouponInfo(data);
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

    if (reg.status !== 'open' || reg.mode !== 'internal_form') {
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
                        {ticketPrice > 0 ? '🎉 Payment Successful!' : '🎉 Registration Confirmed!'}
                    </h1>
                    <p className={`mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        You're registered for <span className="text-[#0ECCEE] font-semibold">{title}</span>.
                    </p>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Download your ticket or view all bookings whenever you&apos;re ready.
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
                    <div className={`rounded-xl p-4 mb-4 border text-center ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Log in to register for this event.</p>
                        <button type="button" onClick={() => setShowLogin(true)} className="px-5 py-2.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">Log in to continue</button>
                    </div>
                )}

                <div className={`rounded-2xl p-4 sm:p-6 border ${isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'} ${!isAuthed() ? 'opacity-50 pointer-events-none' : ''}`}>
                    {/* Progress (trek-style stepper) */}
                    <div className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
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

                    {/* Form step */}
                    {!isPaymentStep && (
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            {current?.description && <p className={`text-xs mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{current.description}</p>}
                            <div className="space-y-4">
                                {current.fields.map((field) => (
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
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-[#0ECCEE]/30' : 'bg-gray-50 border-[#0ECCEE]/40'}`}>
                            {ticketPrice > 0 && (
                                <div className="mb-3">
                                    <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Coupon code</p>
                                    <div className="flex gap-2">
                                        <input value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} placeholder="Enter coupon" className={`flex-1 px-3 py-2 rounded-lg border ${isDark ? 'bg-[#1D1E20] border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-900'}`} />
                                        <button type="button" onClick={applyCoupon} disabled={couponLoading} className="px-3 py-2 rounded-lg bg-[#0ECCEE] text-black font-semibold text-sm">
                                            {couponLoading ? 'Applying...' : (couponInfo?.couponApplied && couponInfo?.couponCode === couponCode.trim().toUpperCase() ? 'Applied' : 'Apply')}
                                        </button>
                                    </div>
                                    {couponError ? <p className="text-xs text-red-400 mt-1">{couponError}</p> : null}
                                    {couponInfo?.couponApplied ? (
                                        <div className={`mt-2 rounded-lg border px-3 py-2 text-xs transition-all duration-300 animate-pulse ${isDark ? 'bg-green-900/20 border-green-700/40 text-green-300' : 'bg-green-50 border-green-300 text-green-700'}`}>
                                            Coupon `{couponInfo.couponCode}` applied · You save ₹{couponInfo.discountAmount}
                                        </div>
                                    ) : null}
                                </div>
                            )}
                            <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{ticketPrice > 0 ? 'Payment Breakdown' : 'Confirm Registration'}</p>
                            {ticketPrice > 0 ? (
                                <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    <div className="flex justify-between gap-4"><span>Registration Fee</span><span>₹{breakdown.ticketPrice.toLocaleString('en-IN')}</span></div>
                                    <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}><span>Platform Fee</span><span>₹{breakdown.platformFee}</span></div>
                                    {couponInfo?.couponApplied ? <div className="flex justify-between gap-4 text-green-400"><span>Coupon Discount</span><span>-₹{couponInfo.discountAmount}</span></div> : null}
                                    <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]"><span>Amount Payable</span><span>₹{payableAmount.toLocaleString('en-IN')}</span></div>
                                    <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Includes all charges · Secure payment via Cashfree</p>
                                </div>
                            ) : (
                                <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>This event is free. Click confirm to complete your registration.</p>
                            )}
                        </div>
                    )}

                    {/* Nav buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-5">
                        <button type="button" onClick={back} disabled={paying} className={`px-4 sm:px-6 py-3 rounded-xl border font-medium text-sm ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}>
                            {step === 0 ? 'Cancel' : 'Previous'}
                        </button>
                        {isPaymentStep ? (
                            <button type="button" onClick={handleFinalSubmit} disabled={paying} className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:opacity-90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                                {paying ? (<><Loader className="w-4 h-4 animate-spin" /> Processing...</>) : ticketPrice > 0 ? `Pay ₹${payableAmount.toLocaleString('en-IN')} & Register` : 'Confirm Registration'}
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

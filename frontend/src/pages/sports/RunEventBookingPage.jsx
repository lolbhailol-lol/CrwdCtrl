import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader, CheckCircle } from 'lucide-react';
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
import { calculatePlatformFee } from '../../utils/platformFee';
import { API_BASE_URL } from '../../services/api/client';

const API = API_BASE_URL;

const DEFAULT_RUN_FORM_FIELDS = [
    { id: 'default_full_name', label: 'Full Name', fieldName: 'full_name', type: 'text', required: true, placeholder: 'Enter your full name' },
    { id: 'default_contact', label: 'Contact No.', fieldName: 'contact_no', type: 'tel', required: true, placeholder: '10-digit mobile number' },
    { id: 'default_email', label: 'E-mail', fieldName: 'email', type: 'email', required: true, placeholder: 'your@email.com' },
];

function runDraftKey(eventId) {
    return `sports_booking_draft_${eventId}`;
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

function getInitialUi(eventId, search) {
    const defaults = { step: 1, payDone: false, paying: false, selDate: '', selTime: '', people: 1, extraFields: {} };
    if (!eventId) return defaults;

    let draft = {};
    const raw = sessionStorage.getItem(runDraftKey(eventId));
    if (raw) {
        try { draft = JSON.parse(raw); } catch { draft = {}; }
    }

    const returnPath = `/sports/run/${eventId}/book`;
    const resuming = shouldResumePendingPayment(getPendingPayment(), returnPath, search);

    if (resuming) {
        return {
            step: 3, payDone: false, paying: true,
            selDate: draft.selDate || '', selTime: draft.selTime || '',
            people: draft.people || 1, extraFields: draft.extraFields || {},
        };
    }

    return {
        step: draft.step || 1, payDone: false, paying: false,
        selDate: draft.selDate || '', selTime: draft.selTime || '',
        people: draft.people || 1, extraFields: draft.extraFields || {},
    };
}

export default function RunEventBookingPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const initialUi = getInitialUi(id, location.search);
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
        return isAuthenticated || !!authToken || !!localStorage.getItem('crwdctrl_token');
    }, [isAuthenticated, authToken]);

    const handleCloseLogin = () => setShowLogin(false);
    const handleCloseRegister = () => setShowRegister(false);
    const handleSwitchToRegister = () => { setShowLogin(false); setShowRegister(true); };
    const handleSwitchToLogin = () => { setShowRegister(false); setShowLogin(true); };

    useEffect(() => {
        if (authLoading || isAuthProcessing || isRedirectProcessing) return;
        if (!isAuthed()) setShowLogin(true);
    }, [authLoading, isAuthProcessing, isRedirectProcessing, isAuthed]);

    useEffect(() => {
        if (isAuthenticated && showLogin) setShowLogin(false);
        if (isAuthenticated && showRegister) setShowRegister(false);
    }, [isAuthenticated, showLogin, showRegister]);

    const [event, setEvent] = useState(location.state?.event || null);
    const [loadingEvent, setLoadingEvent] = useState(!location.state?.event);
    const [step, setStep] = useState(initialUi.step);
    const [selDate, setSelDate] = useState(initialUi.selDate);
    const [selTime, setSelTime] = useState(initialUi.selTime);
    const [people, setPeople] = useState(initialUi.people);
    const [extraFields, setExtraFields] = useState(initialUi.extraFields);
    const [error, setError] = useState('');
    const [paying, setPaying] = useState(initialUi.paying);
    const [payDone, setPayDone] = useState(initialUi.payDone);
    const [paymentId, setPaymentId] = useState('');
    const [bookingId, setBookingId] = useState('');
    const [paymentModal, setPaymentModal] = useState({ open: false, message: '', orderId: '' });
    const retryCheckoutRef = useRef(null);

    const eventName = event?.title || event?.name || 'Run';
    const fee = Number(event?.registrationFee) || 0;
    const reg = event?.registration || {};
    const dates = useMemo(
        () => (reg.availableDates?.length ? reg.availableDates : generateDates(event?.eventDate)),
        [reg.availableDates, event?.eventDate],
    );
    const times = useMemo(
        () => (reg.timeSlots?.length ? reg.timeSlots : event?.reportingTime ? [event.reportingTime] : ['6:00 AM', '7:30 AM']),
        [reg.timeSlots, event?.reportingTime],
    );
    const maxPeople = reg.maxPeoplePerBooking || event?.maxParticipants || 10;

    const regSchema = useMemo(() => {
        const custom = (reg.formSchema || []).filter((f) => f?.label?.trim() && f?.fieldName?.trim());
        return custom.length > 0 ? [...DEFAULT_RUN_FORM_FIELDS, ...custom] : DEFAULT_RUN_FORM_FIELDS;
    }, [reg.formSchema]);

    const formInstructions = reg.formInstructions || '';

    useEffect(() => {
        const evId = id || location.state?.event?._id || location.state?.event?.id;
        if (!evId) { setLoadingEvent(false); return; }

        let cancelled = false;
        (async () => {
            try {
                const r = await fetch(`${API}/sports/${evId}`);
                const d = await r.json();
                if (!cancelled && d.event) setEvent(d.event);
                else if (!cancelled && location.state?.event) setEvent(location.state.event);
            } catch {
                if (!cancelled && location.state?.event) setEvent(location.state.event);
            } finally {
                if (!cancelled) setLoadingEvent(false);
            }
        })();

        return () => { cancelled = true; };
    }, [id, location.state?.event]);

    useEffect(() => {
        if (!event) return;
        setSelDate((prev) => prev || dates[0] || '');
        setSelTime((prev) => prev || times[0] || '');
    }, [event, dates, times]);

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!evId) return;
        const returnPath = `/sports/run/${evId}/book`;
        if (shouldResumePendingPayment(getPendingPayment(), returnPath, location.search)) return;

        const raw = sessionStorage.getItem(runDraftKey(evId));
        if (!raw) return;
        try {
            const draft = JSON.parse(raw);
            if (draft.extraFields) setExtraFields(draft.extraFields);
            if (draft.selDate) setSelDate(draft.selDate);
            if (draft.selTime) setSelTime(draft.selTime);
            if (draft.people) setPeople(draft.people);
            if (draft.step) setStep(draft.step);
        } catch { /* ignore corrupt draft */ }
    }, [id, event?._id, event?.id, location.search]);

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!user || !evId || sessionStorage.getItem(runDraftKey(evId))) return;
        setExtraFields((prev) => {
            if (Object.keys(prev).length > 0) return prev;
            return {
                full_name: user.name || user.fullName || '',
                email: user.email || '',
                contact_no: user.phone || user.mobile || '',
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
            extraFields, selDate, selTime, people, step, ...overrides,
        }));
    }, [id, event, extraFields, selDate, selTime, people, step]);

    const baseFee = fee * people;
    const platformFee = fee > 0 ? calculatePlatformFee(baseFee) : 0;
    const total = baseFee + platformFee;

    const inp = `w-full px-3 py-2.5 rounded-lg border-2 focus:border-[#0ECCEE] focus:outline-none text-sm transition-colors ${isDark ? 'bg-[#1D1E20] border-gray-600 hover:border-gray-500 text-white placeholder-gray-400' : 'bg-white border-gray-300 hover:border-gray-400 text-gray-900 placeholder-gray-500'}`;

    const renderField = (field) => {
        const val = extraFields[field.fieldName] || '';
        const onChange = (v) => setExtraFields((f) => ({ ...f, [field.fieldName]: v }));

        if (field.type === 'textarea') {
            return (
                <textarea rows={3} placeholder={field.placeholder || ''} value={val}
                    onChange={(e) => onChange(e.target.value)} onFocus={scrollFieldIntoView}
                    className={`${inp} resize-none`} />
            );
        }
        if (field.type === 'select') {
            return (
                <select value={val} onChange={(e) => onChange(e.target.value)} onFocus={scrollFieldIntoView} className={inp}>
                    <option value="">Select...</option>
                    {(field.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
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
        const evId = id || event?._id || event?.id;
        if (!evId) throw new Error('Run not found');

        const token = localStorage.getItem('crwdctrl_token') || localStorage.getItem('token');
        if (!token) {
            setShowLogin(true);
            throw new Error('Please log in to complete your booking.');
        }
        const res = await fetch(`${API}/category-registrations/sports/${evId}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
                formData,
                responses: formData,
                bookingDetails: {
                    date: booking.date ?? selDate,
                    time: booking.time ?? selTime,
                    people: booking.people ?? people,
                    amountPaid: amountPaid ?? 0,
                    paymentId: payId || '',
                    payment_order_id: paymentOrderId || '',
                },
            }),
        });
        const regData = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(regData.message || 'Registration failed after payment');

        sessionStorage.removeItem(runDraftKey(evId));
        refreshNotifications();
        const savedId = regData.registration?._id || regData.registration?.id || regData._id || '';
        if (savedId) setBookingId(String(savedId));
        return regData;
    };

    useEffect(() => {
        const evId = id || event?._id || event?.id;
        if (!evId || loadingEvent || paymentResumeRef.current) return;

        const pending = getPendingPayment();
        const returnPath = `/sports/run/${evId}/book`;
        if (!shouldResumePendingPayment(pending, returnPath, location.search)) return;

        paymentResumeRef.current = true;
        setStep(3);
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

                const { ok, data: v } = await verifyPaymentWithRetry(API, pending.orderId, { kind: 'sports' });

                if (!ok || !v?.verified) {
                    clearPendingPayment();
                    const unpaid = /pending|ACTIVE|not found|not successful/i.test(v.message || '');
                    setStep(2);
                    setPayDone(false);
                    setError(unpaid ? 'Payment was not completed. Tap Pay to try again.' : (v.message || 'Payment verification failed after redirect. Contact support.'));
                    setPaying(false);
                    return;
                }

                clearPendingPayment();

                const verified = buildVerifiedPaymentFields(v, pending.orderId);
                setPaymentId(verified.payment_id);
                setPayDone(true);
                await submitRunRegistration({
                    paymentOrderId: verified.payment_order_id || pending.orderId,
                    paymentId: verified.payment_id,
                    amountPaid: v.totalAmount ?? total,
                    formData: draft.extraFields || extraFields,
                    booking: {
                        date: draft.selDate || selDate,
                        time: draft.selTime || selTime,
                        people: draft.people || people,
                    },
                });
                setStep(3);
            } catch (e) {
                setStep(2);
                setPayDone(false);
                setError(e.message || 'Could not complete booking after payment');
            } finally {
                setPaying(false);
            }
        })();
    }, [id, event, loadingEvent, navigate, location.search]);

    const next = async () => {
        setError('');
        if (!isAuthed()) {
            setShowLogin(true);
            setError('Please log in to book this run.');
            return;
        }
        if (step === 1) { setStep(2); return; }

        if (step === 2) {
            const missing = regSchema.filter((f) => f.required && !extraFields[f.fieldName]?.toString().trim());
            if (missing.length > 0) { setError(`Please fill: ${missing.map((f) => f.label).join(', ')}`); return; }

            const customerEmail = extraFields.email || extraFields.e_mail_id || extraFields.e_mail || '';
            if (!customerEmail.trim()) { setError('Email is required to complete your booking.'); return; }

            if (total <= 0) {
                try {
                    await submitRunRegistration({ amountPaid: 0 });
                    setStep(3);
                    setPayDone(true);
                    setPaying(false);
                } catch (e) {
                    setError(e.message || 'Registration failed');
                }
                return;
            }

            saveDraft({ step: 2 });
            setPaying(true);
            try {
                const res = await fetch(`${API}/payment/sports-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        eventId: id || event._id || event.id,
                        eventName,
                        people,
                        customerName: extraFields.full_name || extraFields.name || '',
                        customerEmail,
                        customerPhone: extraFields.contact_no || extraFields.phone || extraFields.contact || extraFields.mobile || '',
                    }),
                });
                const order = await res.json();
                if (!res.ok) { setError(order.message || 'Failed to create order.'); setPaying(false); return; }
                if (!order.paymentSessionId) {
                    setError('Payment session missing from server. Restart backend and try again.');
                    setPaying(false);
                    return;
                }

                saveDraft({ step: 2, extraFields, selDate, selTime, people });

                let checkoutResult;
                try {
                    checkoutResult = await openCashfreeCheckout({
                        paymentSessionId: order.paymentSessionId,
                        orderId: order.orderId,
                        returnPath: `/sports/run/${id || event?._id || event?.id}/book`,
                        entityType: 'sports',
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

                if (checkoutResult?.redirectDeferred) { setPaying(false); return; }

                setStep(3);
                setPaying(true);

                const checkoutPaymentId =
                    checkoutResult?.paymentDetails?.paymentId ||
                    checkoutResult?.paymentDetails?.cf_payment_id || '';

                const vRes = await fetch(`${API}/payment/sports-verify`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ payment_order_id: order.orderId, payment_id: checkoutPaymentId }),
                });
                const v = await vRes.json();
                if (v.verified) {
                    const verified = buildVerifiedPaymentFields(v, order.orderId);
                    setPaymentId(verified.payment_id);
                    await submitRunRegistration({
                        paymentOrderId: verified.payment_order_id || order.orderId,
                        paymentId: verified.payment_id,
                        amountPaid: order.totalAmount ?? total,
                    });
                    setPayDone(true);
                    setPaying(false);
                } else {
                    setStep(2);
                    setPayDone(false);
                    setPaying(false);
                    setError(v.message || 'Payment verification failed. Contact support.');
                }
            } catch (e) {
                setStep(2);
                setPayDone(false);
                setPaying(false);
                setError('Payment error: ' + e.message);
            }
        }
    };

    const back = () => (step === 1 ? navigate(-1) : setStep((s) => s - 1));

    const showProcessing = step === 3 && paying;
    const showSuccess = step === 3 && payDone && !paying;

    const hasStoredSession = !!localStorage.getItem('crwdctrl_token');
    const waitingOnAuth = !hasStoredSession && (authLoading || isAuthProcessing || isRedirectProcessing);

    if ((loadingEvent || waitingOnAuth) && !showSuccess && !showProcessing) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex items-center justify-center">
                <Loader className="w-8 h-8 animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (!event && !showSuccess && !showProcessing) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-dvh flex flex-col items-center justify-center gap-3 px-6">
                <span className="text-4xl">🏃</span>
                <p className={`text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Run not found. Open booking from the run page.</p>
                <button type="button" onClick={() => navigate('/sports')} className="text-[#0ECCEE] text-sm font-semibold">Browse runs</button>
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

    if (showSuccess) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
                <div className="text-center max-w-md mx-auto p-8 w-full">
                    <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
                    <h1 className={`text-3xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {fee > 0 ? '🎉 Payment Successful!' : '🎉 Booking Confirmed!'}
                    </h1>
                    <p className={`mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        Your booking for <span className="text-[#0ECCEE] font-semibold">{eventName}</span> has been confirmed.
                    </p>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        Download your ticket or view all bookings whenever you&apos;re ready.
                    </p>

                    <div className={`rounded-xl p-5 mb-6 text-left ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                        <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Booking Details</p>
                        {[
                            { label: 'Date', value: selDate || '—' },
                            { label: 'Time', value: selTime },
                            { label: 'People', value: `${people} ${people > 1 ? 'people' : 'person'}` },
                            { label: 'Entry Fee', value: fee > 0 ? `₹${baseFee.toLocaleString('en-IN')}` : 'Free' },
                            ...(total > 0 ? [{ label: 'Total Paid', value: `₹${total.toLocaleString('en-IN')}` }] : []),
                            ...(paymentId ? [{ label: 'Payment ID', value: paymentId.slice(0, 18) + '…' }] : []),
                        ].map((r) => (
                            <div key={r.label} className={`flex justify-between text-sm py-2 border-b last:border-0 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>{r.label}</span>
                                <span className={`font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{r.value}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        {bookingId && (
                            <button type="button"
                                onClick={() => navigate(`/qr-ticket/${bookingId}?type=sports`, { state: { refreshBookings: true } })}
                                className="w-full py-3.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">
                                Download Ticket
                            </button>
                        )}
                        <button type="button"
                            onClick={() => goToBookings(navigate)}
                            className={`w-full py-3.5 rounded-xl font-semibold transition ${bookingId ? (isDark ? 'border border-gray-600 text-gray-200 hover:bg-gray-800' : 'border border-gray-300 text-gray-800 hover:bg-gray-100') : 'text-black bg-[#0ECCEE] hover:opacity-90'}`}>
                            View My Bookings
                        </button>
                        <button type="button"
                            onClick={() => navigate('/sports')}
                            className={`w-full py-2.5 rounded-xl text-sm font-medium transition ${isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}>
                            Browse more runs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="crwdctrl-page crwdctrl-page--content min-h-dvh pt-[calc(env(safe-area-inset-top)+0.5rem)] sm:pt-[calc(env(safe-area-inset-top)+1rem)] pb-[max(6rem,env(safe-area-inset-bottom)+5rem)]">
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

                <div className="flex items-start gap-3 mb-4 sm:mb-6 pt-10">
                    <button onClick={back} className={`p-2 rounded-lg transition-colors shrink-0 mt-1 ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-200'}`}>
                        <ArrowLeft className={`w-5 h-5 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                    </button>
                    <div className="min-w-0 flex-1">
                        <h1 className={`text-lg sm:text-xl lg:text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Book: {eventName}
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{STEPS[step - 1]}</p>
                    </div>
                </div>

                {error && (
                    <div className={`rounded-lg p-3 mb-4 text-sm border ${isDark ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-300 text-red-600'}`}>
                        {error}
                    </div>
                )}

                {!isAuthed() && (
                    <div className={`rounded-xl p-4 mb-4 border text-center ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-white border-gray-200'}`}>
                        <p className={`text-sm mb-3 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                            Log in to book this run and receive booking notifications.
                        </p>
                        <button type="button" onClick={() => setShowLogin(true)}
                            className="px-5 py-2.5 rounded-xl font-semibold text-black bg-[#0ECCEE] hover:opacity-90 transition">
                            Log in to continue
                        </button>
                    </div>
                )}

                <div className={`rounded-2xl p-4 sm:p-6 border ${isDark ? 'bg-[#1D1E20] border-gray-700/40' : 'bg-white border-gray-200 shadow-sm'} ${!isAuthed() ? 'opacity-50 pointer-events-none' : ''}`}>

                    <div className={`rounded-lg p-4 mb-6 ${isDark ? 'bg-[#111213]' : 'bg-gray-50'}`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Progress</h3>
                            <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Step {step} of {STEPS.length}</span>
                        </div>
                        <div className={`w-full rounded-full h-2 mb-3 ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
                            <div className="bg-[#0ECCEE] h-2 rounded-full transition-all duration-300" style={{ width: `${(step / STEPS.length) * 100}%` }} />
                        </div>
                        <div className="flex justify-between">
                            {STEPS.map((s, i) => (
                                <div key={s} className="flex flex-col items-center">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                        i + 1 === step ? 'bg-[#0ECCEE] text-black'
                                        : i + 1 < step ? 'bg-green-600 text-white'
                                        : isDark ? 'bg-gray-600 text-gray-300'
                                        : 'bg-gray-300 text-gray-600'
                                    }`}>
                                        {i + 1 < step ? '✓' : i + 1}
                                    </div>
                                    <span className={`text-xs mt-1 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{s}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {step === 1 && (
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>
                                Select Date & Time
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Choose Date</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {dates.map((d, i) => (
                                            <button key={i} type="button" onClick={() => setSelDate(d)}
                                                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors whitespace-nowrap ${selDate === d ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 text-[#0ECCEE]' : isDark ? 'border-gray-600 text-gray-300 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                                                {d}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Start Time</label>
                                    <div className="flex gap-2 flex-wrap">
                                        {times.map((t) => (
                                            <button key={t} type="button" onClick={() => setSelTime(t)}
                                                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${selTime === t ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 text-[#0ECCEE]' : isDark ? 'border-gray-600 text-gray-300 hover:border-gray-500' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className={`rounded-xl p-3 border flex items-center justify-between gap-4 ${isDark ? 'bg-[#1D1E20] border-gray-700' : 'bg-gray-100 border-gray-200'}`}>
                                    <div>
                                        <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Number of People</p>
                                        <div className="flex items-center">
                                            <button type="button" onClick={() => setPeople((p) => Math.max(1, p - 1))}
                                                className={`w-9 h-9 rounded-l-lg flex items-center justify-center border-2 border-r-0 transition-colors ${isDark ? 'bg-[#111213] border-gray-600 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}>
                                                <ChevronLeft size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                            </button>
                                            <div className={`w-12 h-9 flex items-center justify-center border-y-2 ${isDark ? 'bg-[#111213] border-gray-600' : 'bg-white border-gray-300'}`}>
                                                <span className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{people}</span>
                                            </div>
                                            <button type="button" onClick={() => setPeople((p) => Math.min(maxPeople, p + 1))}
                                                className={`w-9 h-9 rounded-r-lg flex items-center justify-center border-2 border-l-0 transition-colors ${isDark ? 'bg-[#111213] border-gray-600 hover:border-[#0ECCEE]' : 'bg-white border-gray-300 hover:border-[#0ECCEE]'}`}>
                                                <ChevronRight size={14} className={isDark ? 'text-gray-300' : 'text-gray-700'} />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`text-xs font-medium mb-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Entry Fee</p>
                                        {fee > 0 ? (
                                            <p className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{baseFee.toLocaleString('en-IN')}</p>
                                        ) : (
                                            <p className="text-lg font-bold text-green-500">Free</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className={`rounded-xl p-4 sm:p-5 border ${isDark ? 'bg-[#111213] border-gray-700/50' : 'bg-gray-50 border-gray-200'}`}>
                            <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 pb-2.5 border-b ${isDark ? 'text-gray-400 border-gray-700/70' : 'text-gray-500 border-gray-200'}`}>
                                Your Details
                            </h3>

                            {formInstructions && (
                                <div className={`rounded-lg p-3 mb-4 border text-xs ${isDark ? 'bg-amber-900/20 border-amber-700/40 text-amber-400' : 'bg-amber-50 border-amber-300 text-amber-700'}`}>
                                    {formInstructions}
                                </div>
                            )}

                            <div className="space-y-4">
                                {regSchema.map((field) => (
                                    <div key={field.id || field.fieldName}>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                            {field.label}
                                            {field.required && <span className="text-red-400 ml-1">*</span>}
                                        </label>
                                        {renderField(field)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 2 && fee > 0 && (
                        <div className={`mt-4 rounded-xl p-4 border ${isDark ? 'bg-[#111213] border-[#0ECCEE]/30' : 'bg-gray-50 border-[#0ECCEE]/40'}`}>
                            <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Breakdown</p>
                            <div className={`space-y-1.5 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                <div className="flex justify-between gap-4">
                                    <span>Ticket Price <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>× {people}</span></span>
                                    <span>₹{baseFee.toLocaleString('en-IN')}</span>
                                </div>
                                <div className={`flex justify-between gap-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    <span>Platform Fee</span>
                                    <span>₹{platformFee}</span>
                                </div>
                                <div className="flex justify-between gap-4 pt-2.5 mt-1 border-t border-gray-700 font-bold text-base text-[#0ECCEE]">
                                    <span>Amount Payable</span>
                                    <span>₹{total.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                            <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Includes all charges · Secure payment via Cashfree</p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 pt-5">
                        <button type="button" onClick={back} disabled={paying}
                            className={`px-4 sm:px-6 py-3 rounded-xl border font-medium transition-colors text-sm ${isDark ? 'border-gray-700 text-white hover:bg-gray-800/60' : 'border-gray-300 text-gray-900 hover:bg-gray-100'}`}>
                            {step === 1 ? 'Cancel' : 'Previous Step'}
                        </button>
                        <button type="button" onClick={next} disabled={paying}
                            className="flex-1 px-4 sm:px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-bold hover:bg-[#0ECCEE]/90 active:scale-[0.98] transition-all text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0ECCEE]/10 disabled:opacity-60">
                            {paying ? (
                                <><Loader className="w-4 h-4 animate-spin" /> Processing...</>
                            ) : step === 2 && total > 0 ? (
                                `Pay ₹${total.toLocaleString('en-IN')} & Book`
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

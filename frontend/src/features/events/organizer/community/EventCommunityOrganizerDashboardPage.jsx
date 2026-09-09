import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Copy, ExternalLink, RefreshCw, Hourglass, CreditCard, ChevronDown,
} from 'lucide-react';
import {
    fetchRunClubOrganizerDashboard,
    fetchRunClubOrganizerEvent,
    setRunClubOrganizerRegistrationStatus,
    updateRunClubOrganizerRegistration,
    expireRunClubOrganizerPendingPayments,
    uploadRunClubOrganizerImage,
} from '../../services/api/runClubOrganizer.api';
import { eventCommunityEventPath } from '../../utils/slugRoutes';
import DetailPageLoader, { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { organizerEventPath } from '../../utils/organizerPortalPaths';
import { getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';

const PULSE_TONES = {
    cyan: { wrap: 'border-cyan-500/20 bg-cyan-500/[0.07]', value: 'text-cyan-200', label: 'text-cyan-400/70' },
    emerald: { wrap: 'border-emerald-500/20 bg-emerald-500/[0.07]', value: 'text-emerald-200', label: 'text-emerald-400/70' },
    rose: { wrap: 'border-rose-500/20 bg-rose-500/[0.07]', value: 'text-rose-200', label: 'text-rose-400/70' },
    sky: { wrap: 'border-sky-500/20 bg-sky-500/[0.07]', value: 'text-sky-200', label: 'text-sky-400/70' },
};

function PulseCell({ label, value, hint, onClick, tone = 'cyan' }) {
    const t = PULSE_TONES[tone] || PULSE_TONES.cyan;
    const className = `rounded-xl border px-3.5 py-3.5 text-left ${t.wrap} ${
        onClick ? 'hover:brightness-110 active:scale-[0.99] cursor-pointer transition' : ''
    }`;
    const inner = (
        <>
            <p className={`text-[11px] font-medium ${t.label}`}>{label}</p>
            <p className={`text-xl font-semibold tabular-nums tracking-tight mt-1.5 leading-none ${t.value}`}>
                {value}
            </p>
            {hint ? <p className="text-[11px] text-gray-500 mt-1.5 leading-snug">{hint}</p> : null}
        </>
    );
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={className}>
                {inner}
            </button>
        );
    }
    return <div className={className}>{inner}</div>;
}

function formatEventDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

export default function EventCommunityOrganizerDashboardPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const copy = organizerHubCopy(true);
    const seedEvent = getRunClubOrganizerSession()?.events?.find(
        (e) => String(e._id) === String(eventId),
    );
    const [data, setData] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(!seedEvent);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionNotice, setActionNotice] = useState('');
    const [paymentBusy, setPaymentBusy] = useState(false);
    const [paymentDraft, setPaymentDraft] = useState({ paymentQR: '', paymentUpiId: '', paymentQRMessage: '' });
    const [qrUploading, setQrUploading] = useState(false);
    const [showManualPayment, setShowManualPayment] = useState(false);
    const [paymentHydrated, setPaymentHydrated] = useState(false);

    useEffect(() => {
        const nextSeed = getRunClubOrganizerSession()?.events?.find(
            (e) => String(e._id) === String(eventId),
        );
        setShowManualPayment(false);
        setPaymentHydrated(false);
        setPaymentDraft({ paymentQR: '', paymentUpiId: '', paymentQRMessage: '' });
        setActionNotice('');
        setCopyNotice('');
        setData(null);
        setEventDetail(null);
        setError('');
        setLoading(!nextSeed);
    }, [eventId]);

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!eventId) return;
        if (silent) setRefreshing(true);
        else {
            setLoading(true);
            setError('');
        }
        try {
            const [dash, detail] = await Promise.all([
                fetchRunClubOrganizerDashboard(eventId),
                fetchRunClubOrganizerEvent(eventId).catch(() => null),
            ]);
            if (!dash?.event) {
                throw new Error('Dashboard data missing for this event');
            }
            setData(dash);
            setEventDetail(detail?.event || null);
            const reg = detail?.event?.registration || {};
            setPaymentDraft({
                paymentQR: reg.paymentQR || '',
                paymentUpiId: reg.paymentUpiId || '',
                paymentQRMessage: reg.paymentQRMessage || '',
            });
            setPaymentHydrated(true);
            setShowManualPayment(false);
        } catch (e) {
            if (!silent) setError(e.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return undefined;
        load();
        const poll = setInterval(() => load({ silent: true }), 45000);
        return () => clearInterval(poll);
    }, [eventId, load]);

    const publicPath = useMemo(() => {
        const event = eventDetail || (data?.event ? { _id: data.event.id, title: data.event.title } : null);
        if (!event) return '';
        return eventCommunityEventPath({ ...event, listingHub: 'events' });
    }, [eventDetail, data]);

    const publicUrl = useMemo(() => {
        if (!publicPath || typeof window === 'undefined') return publicPath;
        return `${window.location.origin}${publicPath}`;
    }, [publicPath]);

    if (loading && !data) {
        return (
            <div className="space-y-4 max-w-xl mx-auto animate-pulse">
                <div className="flex items-center justify-between gap-3">
                    <h1 className="text-xl font-semibold text-white truncate">
                        {seedEvent?.title || copy.loadingDashboard}
                    </h1>
                    <DetailLoader3DIcon size="mini" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                        <div key={i} className="h-[72px] rounded-xl border border-white/10 bg-white/[0.04]" />
                    ))}
                </div>
                <div className="h-28 rounded-xl border border-white/10 bg-white/[0.04]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                <p className="text-red-300 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 text-sm text-white"
                >
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    if (!data?.event) return null;

    const { event, stats: rawStats, genderRegistration } = data;
    const stats = rawStats && typeof rawStats === 'object' ? rawStats : {};
    const registration = eventDetail?.registration || {};
    const status = eventDetail?.status || event?.status;
    const fee = Number(eventDetail?.registrationFee ?? event?.registrationFee ?? 0);
    const isPaid = fee > 0;
    const mode = registration.mode || event?.registrationMode || 'internal_form';
    const isOrganizerQr = mode === 'organizer_qr';
    const regStatus = registration.status || event?.registrationStatus || 'open';
    const isOpen = regStatus === 'open';
    const total = stats.totalBookings ?? (
        (stats.totalRegistrations ?? 0) + (isOrganizerQr ? (stats.pendingPaymentReview ?? 0) : 0)
    );
    const femaleCount = Number(stats.femaleCount)
        || Number(genderRegistration?.quotas?.female?.filled)
        || 0;
    const maleCount = Number(stats.maleCount)
        || Number(genderRegistration?.quotas?.male?.filled)
        || 0;
    const femaleCap = Number(genderRegistration?.quotas?.female?.cap || 0);
    const maleCap = Number(genderRegistration?.quotas?.male?.cap || 0);
    const guestsPath = organizerEventPath(eventId, true, 'participants');
    const checkedIn = stats.checkedIn ?? 0;
    const pendingReviewRaw = Number(stats.pendingPaymentReview ?? 0);
    const pendingReview = isOrganizerQr ? pendingReviewRaw : 0;
    const revenue = Number(stats.organizerRevenue ?? stats.revenue ?? 0);
    const grossCollected = Number(stats.grossCollected ?? revenue);
    const gatewayFees = Number(stats.gatewayFees ?? stats.platformFees ?? 0);
    const seatsFilled = Number(stats.seatsFilled ?? total);
    const isPaidEvent = isPaid || revenue > 0 || pendingReview > 0;
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const todayCount = stats.todayRegistrations ?? 0;
    const dateLabel = formatEventDate(eventDetail?.eventDate || event?.eventDate);
    const reportingTime = String(eventDetail?.reportingTime || event?.reportingTime || '').trim();
    const venue = String(eventDetail?.venue || event?.venue || '').trim();
    const city = String(eventDetail?.city || event?.city || '').trim();
    const routeMap = String(eventDetail?.routeMap || '').trim();

    const metaBits = [
        dateLabel,
        reportingTime,
        [venue, city].filter(Boolean).join(', ') || '',
    ].filter(Boolean);

    const statusLine = [
        status || 'draft',
        isOpen ? 'Booking open' : 'Booking closed',
        fee > 0 ? `₹${fee}` : 'Free',
    ].join(' · ');

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopyNotice('Copied');
            setTimeout(() => setCopyNotice(''), 2000);
        } catch {
            setCopyNotice('Copy failed');
            setTimeout(() => setCopyNotice(''), 2000);
        }
    };

    const toggleRegistration = async () => {
        const next = isOpen ? 'closed' : 'open';
        setActionBusy(true);
        setActionNotice('');
        try {
            await setRunClubOrganizerRegistrationStatus(eventId, next);
            setActionNotice(next === 'open' ? 'Registration opened' : 'Registration closed');
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Could not update registration');
        } finally {
            setActionBusy(false);
        }
    };

    const expireStale = async () => {
        setActionBusy(true);
        setActionNotice('');
        try {
            const res = await expireRunClubOrganizerPendingPayments(eventId);
            setActionNotice(res.message || `Expired ${res.expired || 0}`);
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Failed to clear old pending');
        } finally {
            setActionBusy(false);
        }
    };

    const setPaymentMode = async (manualQr) => {
        const nextMode = manualQr ? 'organizer_qr' : 'internal_form';
        if (manualQr && isPaid && !String(paymentDraft.paymentQR || eventDetail?.registration?.paymentQR || '').trim()) {
            setActionNotice(copy.paymentManualNeedsQr);
            setShowManualPayment(true);
            return;
        }
        setPaymentBusy(true);
        setActionNotice('');
        try {
            const payload = { mode: nextMode };
            if (manualQr) {
                payload.paymentQR = paymentDraft.paymentQR || eventDetail?.registration?.paymentQR || '';
                payload.paymentUpiId = paymentDraft.paymentUpiId || eventDetail?.registration?.paymentUpiId || '';
                payload.paymentQRMessage = paymentDraft.paymentQRMessage || eventDetail?.registration?.paymentQRMessage || '';
            }
            const res = await updateRunClubOrganizerRegistration(eventId, payload);
            setActionNotice(res.message || (manualQr ? 'Manual UPI enabled' : 'Cashfree enabled'));
            setShowManualPayment(false);
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Could not update payment method');
        } finally {
            setPaymentBusy(false);
        }
    };

    const uploadPaymentQr = async (file) => {
        if (!file) return;
        setQrUploading(true);
        setActionNotice('');
        try {
            const res = await uploadRunClubOrganizerImage(file);
            const url = res.url || res.imageUrl || '';
            if (!url) throw new Error('Upload failed');
            setPaymentDraft((prev) => ({ ...prev, paymentQR: url }));
            if (isOrganizerQr) {
                await updateRunClubOrganizerRegistration(eventId, {
                    mode: 'organizer_qr',
                    paymentQR: url,
                    paymentUpiId: paymentDraft.paymentUpiId,
                    paymentQRMessage: paymentDraft.paymentQRMessage,
                });
                setActionNotice('Payment QR updated');
                await load({ silent: true });
            }
        } catch (e) {
            setActionNotice(e.message || 'Could not upload QR');
        } finally {
            setQrUploading(false);
        }
    };

    const savePaymentDetails = async () => {
        setPaymentBusy(true);
        setActionNotice('');
        try {
            const res = await updateRunClubOrganizerRegistration(eventId, {
                mode: 'organizer_qr',
                paymentQR: paymentDraft.paymentQR,
                paymentUpiId: paymentDraft.paymentUpiId,
                paymentQRMessage: paymentDraft.paymentQRMessage,
            });
            setActionNotice(res.message || 'Saved');
            setShowManualPayment(false);
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Could not save');
        } finally {
            setPaymentBusy(false);
        }
    };

    return (
        <div className="space-y-5 max-w-xl mx-auto pb-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight text-white leading-snug">
                        {event.title || eventDetail?.title || 'Event'}
                    </h1>
                    {metaBits.length ? (
                        <p className="text-sm text-gray-500 leading-snug">{metaBits.join(' · ')}</p>
                    ) : null}
                    <p className={`text-xs capitalize ${isOpen ? 'text-emerald-400' : 'text-amber-400/90'}`}>
                        {statusLine}
                    </p>
                    {routeMap ? (
                        <a
                            href={routeMap}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[#0ECCEE]/80 hover:text-[#0ECCEE]"
                        >
                            Map <ExternalLink size={11} />
                        </a>
                    ) : null}
                </div>
                <button
                    type="button"
                    onClick={() => load({ silent: true })}
                    disabled={refreshing}
                    className="shrink-0 p-2 rounded-lg text-[#0ECCEE]/70 hover:text-[#0ECCEE] disabled:opacity-50"
                    aria-label="Refresh"
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
            </div>

            {actionNotice ? (
                <p className="text-xs text-emerald-300/90">{actionNotice}</p>
            ) : null}

            {/* Urgent: pending QR review */}
            {isOrganizerQr && pendingReview > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(`${guestsPath}?paymentStatus=pending_review`)}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-left"
                >
                    <span className="text-sm text-amber-100 flex items-center gap-2">
                        <Hourglass size={15} />
                        {pendingReview} payment{pendingReview === 1 ? '' : 's'} to review
                    </span>
                    <span className="text-xs font-semibold text-amber-300">Review</span>
                </button>
            ) : null}

            {/* Pulse 2×2 */}
            <div className="grid grid-cols-2 gap-2.5">
                <PulseCell
                    tone="cyan"
                    label="Bookings"
                    value={total}
                    hint={
                        seatsFilled > total
                            ? `${seatsFilled} guests · ${checkedIn} in (${checkInPct}%)`
                            : `${checkedIn} checked in · ${todayCount} today`
                    }
                    onClick={() => navigate(guestsPath)}
                />
                <PulseCell
                    tone="emerald"
                    label={gatewayFees > 0 ? 'After fees' : 'Collected'}
                    value={isPaidEvent ? `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Free'}
                    hint={
                        gatewayFees > 0
                            ? `Gross ₹${grossCollected.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : isPaid && !isOrganizerQr
                                ? 'Cashfree'
                                : isPaidEvent
                                    ? 'UPI'
                                    : undefined
                    }
                />
                <PulseCell
                    tone="rose"
                    label="Women"
                    value={femaleCount}
                    hint={femaleCap > 0 ? `${Math.max(0, femaleCap - femaleCount)} / ${femaleCap} left` : undefined}
                    onClick={() => navigate(`${guestsPath}?gender=female`)}
                />
                <PulseCell
                    tone="sky"
                    label="Men"
                    value={maleCount}
                    hint={maleCap > 0 ? `${Math.max(0, maleCap - maleCount)} / ${maleCap} left` : undefined}
                    onClick={() => navigate(`${guestsPath}?gender=male`)}
                />
            </div>

            {/* Share */}
            {publicUrl && String(status).toLowerCase() === 'published' ? (
                <div className="flex items-center gap-2 rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/[0.06] px-3 py-2.5">
                    <p className="min-w-0 flex-1 truncate text-xs text-gray-400 font-mono">{publicUrl}</p>
                    {copyNotice ? <span className="text-[11px] text-emerald-400 shrink-0">{copyNotice}</span> : null}
                    <button
                        type="button"
                        onClick={copyLink}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#0ECCEE]/25 text-xs text-[#0ECCEE]"
                    >
                        <Copy size={13} /> Copy
                    </button>
                    <a
                        href={publicPath}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0ECCEE] text-black text-xs font-semibold"
                    >
                        <ExternalLink size={13} /> Open
                    </a>
                </div>
            ) : null}

            {/* Booking + payments */}
            <div className="rounded-xl border border-white/10 bg-[#161718] p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-white">Booking</p>
                        <p className={`text-xs mt-0.5 ${isOpen ? 'text-emerald-400/90' : 'text-amber-400/80'}`}>
                            {isOpen ? copy.bookingOpen : copy.bookingClosed}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={toggleRegistration}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 ${
                            isOpen
                                ? 'border border-amber-500/30 text-amber-200 bg-amber-500/10'
                                : 'bg-emerald-400 text-black'
                        }`}
                    >
                        {actionBusy ? '…' : isOpen ? 'Close' : 'Open'}
                    </button>
                </div>

                {isPaid && paymentHydrated ? (
                    <>
                        {!isOrganizerQr ? (
                            <div className="flex items-start gap-3 pt-1 border-t border-white/5">
                                <CreditCard size={16} className="text-[#0ECCEE] mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm text-white">Online payments</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{copy.paymentCashfreeHint}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-1 border-t border-white/5 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm text-white">Manual UPI + QR</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{copy.paymentManualHint}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={paymentBusy}
                                        onClick={() => setPaymentMode(false)}
                                        className="shrink-0 text-[11px] text-gray-400 hover:text-white disabled:opacity-50"
                                    >
                                        Use Cashfree
                                    </button>
                                </div>
                                <div className="flex items-center gap-3">
                                    {(paymentDraft.paymentQR || registration.paymentQR) ? (
                                        <img
                                            src={paymentDraft.paymentQR || registration.paymentQR}
                                            alt="Payment QR"
                                            className="size-14 rounded-lg object-cover border border-white/10"
                                        />
                                    ) : null}
                                    <label className="inline-flex items-center px-3 py-2 rounded-lg border border-white/10 text-xs cursor-pointer">
                                        {qrUploading ? 'Uploading…' : 'Change QR'}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            disabled={qrUploading || paymentBusy}
                                            onChange={(e) => {
                                                uploadPaymentQr(e.target.files?.[0]);
                                                e.target.value = '';
                                            }}
                                        />
                                    </label>
                                </div>
                                {pendingReview > 0 ? (
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => navigate(`${guestsPath}?paymentStatus=pending_review`)}
                                            className="flex-1 py-2 rounded-lg bg-white text-black text-xs font-semibold"
                                        >
                                            Review {pendingReview}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={expireStale}
                                            className="px-3 py-2 rounded-lg border border-white/10 text-gray-400 text-xs disabled:opacity-50"
                                        >
                                            Clear old
                                        </button>
                                    </div>
                                ) : null}
                            </div>
                        )}

                        {!isOrganizerQr ? (
                            <button
                                type="button"
                                onClick={() => setShowManualPayment((v) => !v)}
                                className="w-full flex items-center justify-between gap-2 py-1 text-[11px] text-gray-500"
                            >
                                <span>Use your own UPI QR instead?</span>
                                <ChevronDown size={14} className={`transition-transform ${showManualPayment ? 'rotate-180' : ''}`} />
                            </button>
                        ) : null}

                        {!isOrganizerQr && showManualPayment ? (
                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 space-y-2.5">
                                <p className="text-xs text-gray-500">{copy.paymentManualHint}</p>
                                <div className="flex items-center gap-3">
                                    {paymentDraft.paymentQR ? (
                                        <img src={paymentDraft.paymentQR} alt="" className="size-14 rounded-lg object-cover border border-white/10" />
                                    ) : (
                                        <label className="inline-flex items-center px-3 py-2 rounded-lg border border-dashed border-white/20 text-xs cursor-pointer">
                                            Upload QR
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={qrUploading}
                                                onChange={(e) => {
                                                    uploadPaymentQr(e.target.files?.[0]);
                                                    e.target.value = '';
                                                }}
                                            />
                                        </label>
                                    )}
                                </div>
                                <input
                                    value={paymentDraft.paymentUpiId}
                                    onChange={(e) => setPaymentDraft((p) => ({ ...p, paymentUpiId: e.target.value.trim() }))}
                                    placeholder="UPI ID (optional)"
                                    className="w-full px-3 py-2 rounded-lg bg-[#111213] border border-white/10 text-xs"
                                />
                                <button
                                    type="button"
                                    disabled={paymentBusy || !paymentDraft.paymentQR}
                                    onClick={savePaymentDetails}
                                    className="w-full py-2 rounded-lg bg-white text-black text-xs font-semibold disabled:opacity-40"
                                >
                                    {paymentBusy ? 'Enabling…' : 'Enable manual UPI'}
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </div>
        </div>
    );
}

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Calendar, Bell, QrCode,
    Copy, ExternalLink, RefreshCw, MapPin, Link2, Share2, Sparkles, Hourglass,
    CreditCard, ChevronDown,
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
import DetailPageLoader from '../../components/DetailPageLoader';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { organizerEventPath } from '../../utils/organizerPortalPaths';

function StatTile({ label, value, tone = 'default', icon: Icon, to, hint }) {
    const navigate = useNavigate();
    const tones = {
        default: {
            card: 'border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516]',
            icon: 'bg-white/5 text-gray-300',
            value: 'text-white',
        },
        accent: {
            card: 'border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/15 to-[#0ECCEE]/5',
            icon: 'bg-[#0ECCEE]/15 text-[#0ECCEE]',
            value: 'text-white',
        },
        ok: {
            card: 'border-emerald-500/20 bg-linear-to-br from-emerald-500/15 to-emerald-500/5',
            icon: 'bg-emerald-500/15 text-emerald-300',
            value: 'text-emerald-100',
        },
        warn: {
            card: 'border-amber-500/20 bg-linear-to-br from-amber-500/15 to-amber-500/5',
            icon: 'bg-amber-500/15 text-amber-300',
            value: 'text-amber-100',
        },
        money: {
            card: 'border-teal-400/25 bg-linear-to-br from-teal-500/18 to-[#101817]',
            icon: 'bg-teal-500/15 text-teal-300',
            value: 'text-teal-200',
        },
    };
    const t = tones[tone] || tones.default;
    const className = `rounded-2xl border p-4 min-h-24 text-left transition-all duration-200 ${t.card} ${
        to ? 'hover:border-[#0ECCEE]/45 active:scale-[0.985] cursor-pointer' : ''
    }`;

    const inner = (
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium">{label}</p>
                <p className={`text-[1.5rem] leading-none font-semibold mt-2 tabular-nums tracking-tight ${t.value}`}>
                    {value}
                </p>
                {hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}
            </div>
            {Icon ? (
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>
                    <Icon size={16} strokeWidth={2.25} />
                </div>
            ) : null}
        </div>
    );

    if (to) {
        return <button type="button" onClick={() => navigate(to)} className={className}>{inner}</button>;
    }
    return <div className={className}>{inner}</div>;
}

function SectionCard({ children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-white/10 bg-[#161718]/95 backdrop-blur-sm ${className}`}>
            {children}
        </div>
    );
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
    const [data, setData] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(true);
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
        setLoading(true);
        setShowManualPayment(false);
        setPaymentHydrated(false);
        setPaymentDraft({ paymentQR: '', paymentUpiId: '', paymentQRMessage: '' });
        setActionNotice('');
        setCopyNotice('');
        setData(null);
        setEventDetail(null);
        setError('');
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

    if (loading) {
        return <DetailPageLoader label={copy.loadingDashboard} />;
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-4 max-w-md mx-auto">
                <div className="mx-auto size-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <RefreshCw size={18} className="text-red-400" />
                </div>
                <p className="text-red-300 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => load()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm text-[#0ECCEE] hover:border-[#0ECCEE]/40"
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
    const total = stats.totalRegistrations ?? 0;
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
    const pending = stats.pendingCheckIn ?? Math.max(0, total - checkedIn);
    const pendingReviewRaw = Number(stats.pendingPaymentReview ?? 0);
    const pendingReview = isOrganizerQr ? pendingReviewRaw : 0;
    const revenue = Number(stats.organizerRevenue ?? stats.revenue ?? 0);
    const grossCollected = Number(stats.grossCollected ?? revenue);
    const gatewayFees = Number(stats.gatewayFees ?? stats.platformFees ?? 0);
    const seatsFilled = Number(stats.seatsFilled ?? total);
    const isPaidEvent = isPaid || revenue > 0 || pendingReview > 0;
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const ttlHours = Number(stats?.manualExpireTtlHours ?? 72) || 72;
    const dateLabel = formatEventDate(eventDetail?.eventDate || event?.eventDate);
    const reportingTime = String(eventDetail?.reportingTime || event?.reportingTime || '').trim();
    const venue = String(eventDetail?.venue || event?.venue || '').trim();
    const city = String(eventDetail?.city || event?.city || '').trim();
    const distance = String(eventDetail?.distance || event?.distance || '').trim();
    const routeMap = String(eventDetail?.routeMap || '').trim();
    const meetVenue = venue || (eventDetail?.meetingPoint ? String(eventDetail.meetingPoint).trim() : '');

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(publicUrl);
            setCopyNotice('Link copied');
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
        <div className="space-y-4 max-w-3xl mx-auto pb-6">
            {/* Header */}
            <SectionCard className="overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/12 via-transparent to-transparent pointer-events-none" />
                <div className="relative p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2.5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0ECCEE]">
                                <Sparkles size={11} /> {copy.dashboardBadge}
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight leading-tight text-white">
                                {event.title || eventDetail?.title || 'Event'}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                                {city || venue ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin size={13} className="text-[#0ECCEE]" />
                                        {[venue, city].filter(Boolean).join(' · ')}
                                    </span>
                                ) : null}
                                {dateLabel ? <span>{dateLabel}</span> : null}
                                {reportingTime ? <span>{reportingTime}</span> : null}
                                {distance ? <span>{distance}</span> : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold capitalize border ${
                                    String(status).toLowerCase() === 'published'
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                        : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                                }`}>
                                    {status || 'draft'}
                                </span>
                                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                                    isOpen
                                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                        : 'bg-red-500/10 text-red-300 border-red-500/25'
                                }`}>
                                    Booking {isOpen ? 'open' : 'closed'}
                                </span>
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold border border-white/10 bg-white/5 text-gray-300">
                                    {fee > 0 ? `₹${fee}` : 'Free'}
                                </span>
                            </div>
                            {(meetVenue || routeMap) ? (
                                <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 space-y-1 text-xs text-gray-400">
                                    {meetVenue ? <p><span className="text-gray-500">Meet · </span>{meetVenue}</p> : null}
                                    {routeMap ? (
                                        <a href={routeMap} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0ECCEE] hover:underline">
                                            Open map <ExternalLink size={11} />
                                        </a>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                        <button
                            type="button"
                            onClick={() => load({ silent: true })}
                            disabled={refreshing}
                            className="shrink-0 p-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white disabled:opacity-50"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </SectionCard>

            {actionNotice ? (
                <div className="rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 px-3.5 py-2.5 text-xs text-[#9BE8F7]">
                    {actionNotice}
                </div>
            ) : null}

            {/* Manual QR only: pending payment review */}
            {isOrganizerQr && pendingReview > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(`${organizerEventPath(eventId, true, 'participants')}?paymentStatus=pending_review`)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 text-left hover:border-amber-400/50 transition-colors"
                >
                    <span className="text-sm font-semibold text-amber-100 flex items-center gap-2">
                        <Hourglass size={16} />
                        {pendingReview} payment{pendingReview === 1 ? '' : 's'} to review
                    </span>
                    <span className="shrink-0 text-xs font-bold text-amber-300">Review →</span>
                </button>
            ) : null}

            {/* Stats — same 4 tiles always */}
            <div className="grid grid-cols-2 gap-3">
                <StatTile
                    label="Total bookings"
                    value={total}
                    tone="accent"
                    icon={Users}
                    to={guestsPath}
                    hint={seatsFilled > total ? `${seatsFilled} guests` : 'All confirmed'}
                />
                <StatTile
                    label={gatewayFees > 0 ? 'After 1.6% gateway' : 'Collected'}
                    value={isPaidEvent ? `₹${revenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Free'}
                    tone={isPaidEvent ? 'money' : 'default'}
                    icon={IndianRupee}
                    hint={gatewayFees > 0
                        ? `Students paid ₹${grossCollected.toLocaleString('en-IN', { maximumFractionDigits: 2 })} · 1.6% ₹${gatewayFees.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
                        : isPaidEvent && seatsFilled > total
                            ? 'Group bookings included'
                            : isPaid && !isOrganizerQr
                                ? 'Via Cashfree'
                                : isPaidEvent
                                    ? 'UPI received'
                                    : undefined}
                />
                <StatTile
                    label="Women"
                    value={femaleCount}
                    tone="ok"
                    icon={Users}
                    to={`${guestsPath}?gender=female`}
                    hint={femaleCap > 0 ? `${Math.max(0, femaleCap - femaleCount)} of ${femaleCap} left` : 'Confirmed'}
                />
                <StatTile
                    label="Men"
                    value={maleCount}
                    tone="default"
                    icon={Users}
                    to={`${guestsPath}?gender=male`}
                    hint={maleCap > 0 ? `${Math.max(0, maleCap - maleCount)} of ${maleCap} left` : 'Confirmed'}
                />
                <StatTile
                    label="Checked in"
                    value={checkedIn}
                    tone="ok"
                    icon={UserCheck}
                    to={organizerEventPath(eventId, true, 'scan')}
                />
                <StatTile
                    label="Today"
                    value={stats.todayRegistrations ?? 0}
                    tone="default"
                    icon={Calendar}
                />
            </div>
            {gatewayFees > 0 ? (
                <p className="text-[11px] text-gray-500 -mt-1">
                    1.6% Cashfree gateway is deducted on each online payment. This is not a CrwdCtrl commission. UPI/QR stays in full.
                </p>
            ) : null}

            {/* Share link */}
            {publicUrl && String(status).toLowerCase() === 'published' ? (
                <SectionCard className="p-4 space-y-3">
                    <p className="text-sm font-semibold text-white">{copy.shareTitle}</p>
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                        <Link2 size={13} className="text-gray-500 shrink-0" />
                        <p className="text-[12px] text-gray-300 truncate font-mono flex-1">{publicUrl}</p>
                    </div>
                    {copyNotice ? <p className="text-[11px] text-emerald-400">{copyNotice}</p> : null}
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={copyLink}
                            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-[#0ECCEE]/40"
                        >
                            <Copy size={15} /> Copy
                        </button>
                        <a
                            href={publicPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold"
                        >
                            <ExternalLink size={15} /> Open
                        </a>
                    </div>
                </SectionCard>
            ) : null}

            {/* Check-in */}
            <SectionCard className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Check-in</p>
                    <p className="text-sm font-semibold tabular-nums text-emerald-300">{checkInPct}%</p>
                </div>
                <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                    <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${checkInPct}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    {checkedIn} of {total} checked in
                    {pending > 0 ? (
                        <button
                            type="button"
                            onClick={() => navigate(organizerEventPath(eventId, true, 'scan'))}
                            className="ml-1 text-[#0ECCEE] font-medium hover:underline"
                        >
                            · Scan now
                        </button>
                    ) : null}
                </p>
            </SectionCard>

            {/* Registration + payments */}
            <SectionCard className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Booking</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isOpen ? copy.bookingOpen : copy.bookingClosed}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={toggleRegistration}
                        className={`px-4 py-2 rounded-xl text-xs font-bold disabled:opacity-50 ${
                            isOpen
                                ? 'border border-red-500/30 text-red-300'
                                : 'bg-[#0ECCEE] text-black'
                        }`}
                    >
                        {actionBusy ? '…' : isOpen ? 'Close' : 'Open'}
                    </button>
                </div>

                {isPaid && paymentHydrated ? (
                    <>
                        {!isOrganizerQr ? (
                            <div className="flex items-center gap-3 rounded-xl border border-teal-500/20 bg-teal-500/8 px-3.5 py-3">
                                <div className="size-9 rounded-lg bg-teal-500/15 text-teal-300 flex items-center justify-center shrink-0">
                                    <CreditCard size={16} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-white">Online payments</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">{copy.paymentCashfreeHint}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-medium text-amber-100">Manual UPI + QR</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">{copy.paymentManualHint}</p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={paymentBusy}
                                        onClick={() => setPaymentMode(false)}
                                        className="shrink-0 text-[11px] font-semibold text-teal-300 hover:underline disabled:opacity-50"
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
                                    <label className="inline-flex items-center px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs font-medium cursor-pointer">
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
                                            onClick={() => navigate(`${organizerEventPath(eventId, true, 'participants')}?paymentStatus=pending_review`)}
                                            className="flex-1 py-2 rounded-lg bg-amber-400 text-black text-xs font-bold"
                                        >
                                            Review {pendingReview}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={actionBusy}
                                            onClick={expireStale}
                                            className="px-3 py-2 rounded-lg border border-amber-500/30 text-amber-200/80 text-xs disabled:opacity-50"
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
                                className="w-full flex items-center justify-between gap-2 py-2 text-[11px] text-gray-500 hover:text-gray-400"
                            >
                                <span>Use your own UPI QR instead?</span>
                                <ChevronDown size={14} className={`transition-transform ${showManualPayment ? 'rotate-180' : ''}`} />
                            </button>
                        ) : null}

                        {!isOrganizerQr && showManualPayment ? (
                            <div className="rounded-xl border border-white/10 bg-black/25 p-3 space-y-2.5">
                                <p className="text-xs text-gray-400">{copy.paymentManualHint}</p>
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
                                    className="w-full px-3 py-2 rounded-lg bg-[#111213] border border-gray-800 text-xs"
                                />
                                <button
                                    type="button"
                                    disabled={paymentBusy || !paymentDraft.paymentQR}
                                    onClick={savePaymentDetails}
                                    className="w-full py-2 rounded-lg bg-amber-400/90 text-black text-xs font-bold disabled:opacity-40"
                                >
                                    {paymentBusy ? 'Enabling…' : 'Enable manual UPI'}
                                </button>
                            </div>
                        ) : null}
                    </>
                ) : null}
            </SectionCard>

            {/* Quick actions */}
            <div className="grid grid-cols-3 gap-2.5">
                {[
                    { label: 'Guests', icon: Users, to: organizerEventPath(eventId, true, 'participants') },
                    { label: 'Scan', icon: QrCode, to: organizerEventPath(eventId, true, 'scan') },
                    { label: 'Notify', icon: Bell, to: organizerEventPath(eventId, true, 'notifications') },
                ].map((action) => (
                    <button
                        key={action.label}
                        type="button"
                        onClick={() => navigate(action.to)}
                        className="rounded-xl border border-white/10 bg-[#1a1b1d] p-3 text-center hover:border-[#0ECCEE]/35 active:scale-[0.98] transition-all"
                    >
                        <action.icon size={18} className="mx-auto text-[#0ECCEE] mb-1.5" />
                        <p className="text-xs font-semibold">{action.label}</p>
                    </button>
                ))}
            </div>
        </div>
    );
}

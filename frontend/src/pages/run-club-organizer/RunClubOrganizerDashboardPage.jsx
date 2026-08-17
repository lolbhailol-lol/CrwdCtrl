import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Calendar, Loader, Bell, QrCode,
    Copy, ExternalLink, RefreshCw, MapPin, Link2, Share2, Sparkles, Hourglass,
} from 'lucide-react';
import {
    fetchRunClubOrganizerDashboard,
    fetchRunClubOrganizerEvent,
    setRunClubOrganizerRegistrationStatus,
    expireRunClubOrganizerPendingPayments,
} from '../../services/api/runClubOrganizer.api';
import { sportRunPath } from '../../utils/slugRoutes';

function StatTile({ label, value, tone = 'default', icon: Icon, onClick, to, hint }) {
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
            card: 'border-emerald-500/20 bg-linear-to-br from-emerald-500/10 to-[#141516]',
            icon: 'bg-emerald-500/15 text-emerald-300',
            value: 'text-emerald-300',
        },
    };
    const t = tones[tone] || tones.default;
    const interactive = Boolean(onClick || to);
    const className = `group relative overflow-hidden rounded-2xl border p-4 min-h-[100px] text-left transition-all duration-200 ${t.card} ${
        interactive
            ? 'hover:border-[#0ECCEE]/45 active:scale-[0.985] cursor-pointer'
            : ''
    }`;
    const inner = (
        <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium">{label}</p>
                <p className={`text-[1.65rem] leading-none font-semibold mt-2.5 tabular-nums tracking-tight ${t.value}`}>
                    {value}
                </p>
                {hint ? <p className="text-[11px] text-gray-500 mt-2">{hint}</p> : null}
            </div>
            {Icon ? (
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>
                    <Icon size={16} strokeWidth={2.25} />
                </div>
            ) : null}
        </div>
    );
    if (to) {
        return (
            <button type="button" onClick={() => navigate(to)} className={className}>
                {inner}
            </button>
        );
    }
    if (onClick) {
        return <button type="button" onClick={onClick} className={className}>{inner}</button>;
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

export default function RunClubOrganizerDashboardPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionNotice, setActionNotice] = useState('');

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
            setData(dash);
            setEventDetail(detail?.event || null);
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
        return sportRunPath(event);
    }, [eventDetail, data]);

    const publicUrl = useMemo(() => {
        if (!publicPath || typeof window === 'undefined') return publicPath;
        return `${window.location.origin}${publicPath}`;
    }, [publicPath]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader className="animate-spin text-[#0ECCEE]" size={28} />
                <p className="text-xs text-gray-500 tracking-wide">Loading run dashboard…</p>
            </div>
        );
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

    if (!data) return null;

    const { event, stats: rawStats } = data;
    const stats = rawStats && typeof rawStats === 'object' ? rawStats : {};
    const status = eventDetail?.status || event?.status;
    const fee = Number(eventDetail?.registrationFee ?? event?.registrationFee ?? 0);
    const isPaid = fee > 0;
    const mode = eventDetail?.registration?.mode || event?.registrationMode || 'internal_form';
    const isOrganizerQr = mode === 'organizer_qr';
    const regStatus = eventDetail?.registration?.status || event?.registrationStatus || 'open';
    const isOpen = regStatus === 'open';
    const total = stats.totalRegistrations ?? 0;
    const checkedIn = stats.checkedIn ?? 0;
    const pending = stats.pendingCheckIn ?? Math.max(0, total - checkedIn);
    const pendingReview = isPaid ? Number(stats.pendingPaymentReview ?? 0) : 0;
    const showPaymentReview = isPaid && (isOrganizerQr || pendingReview > 0);
    const revenue = Number(stats.organizerRevenue ?? stats.revenue ?? 0);
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const ttlHours = Number(stats?.manualExpireTtlHours ?? stats?.pendingTtlHours ?? 72) || 72;
    const dateLabel = formatEventDate(eventDetail?.eventDate || event?.eventDate);
    const reportingTime = String(eventDetail?.reportingTime || event?.reportingTime || '').trim();
    const venue = String(eventDetail?.venue || event?.venue || '').trim();
    const city = String(eventDetail?.city || event?.city || '').trim();
    const distance = String(eventDetail?.distance || event?.distance || '').trim();
    const capacity = stats.capacity ?? eventDetail?.maxParticipants ?? null;
    const seatsLeft = stats.seatsRemaining;
    const routeMap = String(eventDetail?.routeMap || '').trim();

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

    return (
        <div className="space-y-5 max-w-3xl mx-auto">
            <SectionCard className="overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/15 via-transparent to-[#053780]/20 pointer-events-none" />
                <div className="relative p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-3">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0ECCEE]">
                                <Sparkles size={11} /> Run dashboard
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight leading-tight text-white">
                                    {event.title}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-sm text-gray-400">
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
                                {(venue || capacity || routeMap) ? (
                                    <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 space-y-1">
                                        {venue ? (
                                            <p className="text-xs text-gray-300">
                                                <span className="text-gray-500">Meet · </span>{venue}
                                            </p>
                                        ) : null}
                                        {capacity != null && Number(capacity) > 0 ? (
                                            <p className="text-[11px] text-gray-500">
                                                Capacity · {stats.seatsFilled ?? total} / {capacity}
                                                {seatsLeft != null ? ` · ${seatsLeft} left` : ''}
                                            </p>
                                        ) : (
                                            <p className="text-[11px] text-gray-500">Capacity · unlimited</p>
                                        )}
                                        {routeMap ? (
                                            <a
                                                href={routeMap}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-[11px] text-[#0ECCEE] hover:underline"
                                            >
                                                Open map <ExternalLink size={11} />
                                            </a>
                                        ) : null}
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
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
                                {isPaid ? (
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                                        isOrganizerQr
                                            ? 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                                            : 'bg-[#0ECCEE]/10 text-[#0ECCEE] border-[#0ECCEE]/25'
                                    }`}>
                                        {isOrganizerQr ? 'UPI + QR · manual review' : 'Online checkout · Cashfree'}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => load({ silent: true })}
                            disabled={refreshing}
                            className="shrink-0 p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-[#0ECCEE]/40 disabled:opacity-50"
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

            {showPaymentReview && pendingReview > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(`/run-club-organizer/events/${eventId}/participants?paymentStatus=pending_review`)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-linear-to-r from-amber-500/15 to-amber-500/5 px-4 py-4 min-h-[56px] text-left hover:border-amber-400/50 active:scale-[0.99] transition-all"
                >
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-100 flex items-center gap-2">
                            <Hourglass size={16} />
                            {pendingReview} payment{pendingReview === 1 ? '' : 's'} to review
                        </p>
                        <p className="text-[11px] text-amber-200/70 mt-0.5">
                            Check UTR / transaction ID and screenshot, then approve or reject.
                        </p>
                    </div>
                    <span className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-400 text-black text-xs font-bold">
                        Review now
                    </span>
                </button>
            ) : null}

            {publicUrl && String(status).toLowerCase() === 'published' ? (
                <SectionCard className="p-4 sm:p-5 space-y-3.5">
                    <div className="flex items-start gap-3">
                        <div className="size-10 rounded-xl bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center shrink-0">
                            <Share2 size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white">Share with runners</p>
                            <p className="text-xs text-gray-500 mt-0.5">Copy the public run page or open it in a new tab.</p>
                            <div className="mt-2.5 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                                <Link2 size={13} className="text-gray-500 shrink-0" />
                                <p className="text-[12px] text-gray-300 truncate font-mono">{publicUrl}</p>
                            </div>
                            {copyNotice ? <p className="text-[11px] text-emerald-400 mt-1.5">{copyNotice}</p> : null}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                        <button
                            type="button"
                            onClick={copyLink}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-3 min-h-12 rounded-xl border border-white/10 bg-white/5 text-sm font-medium hover:border-[#0ECCEE]/45 hover:bg-[#0ECCEE]/10 transition-colors"
                        >
                            <Copy size={15} /> Copy link
                        </button>
                        <a
                            href={publicPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-3 min-h-12 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold hover:brightness-110 transition"
                        >
                            <ExternalLink size={15} /> Open page
                        </a>
                    </div>
                </SectionCard>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
                <StatTile
                    label="Confirmed"
                    value={total}
                    tone="accent"
                    icon={Users}
                    to={`/run-club-organizer/events/${eventId}/participants`}
                    hint="Guest list"
                />
                <StatTile
                    label="Collected"
                    value={`₹${revenue.toLocaleString('en-IN')}`}
                    tone="money"
                    icon={IndianRupee}
                />
                <StatTile
                    label="Checked in"
                    value={checkedIn}
                    tone="ok"
                    icon={UserCheck}
                    to={`/run-club-organizer/events/${eventId}/scan`}
                />
                {showPaymentReview ? (
                    <StatTile
                        label="Needs review"
                        value={pendingReview}
                        tone="warn"
                        icon={Hourglass}
                        to={`/run-club-organizer/events/${eventId}/participants?paymentStatus=pending_review`}
                        hint="Payment screenshots"
                    />
                ) : (
                    <StatTile
                        label="Today"
                        value={stats.todayRegistrations ?? 0}
                        tone="default"
                        icon={Calendar}
                    />
                )}
                <StatTile
                    label="Pending check-in"
                    value={pending}
                    tone="warn"
                    icon={Clock}
                    to={`/run-club-organizer/events/${eventId}/participants?checkInStatus=pending`}
                />
                {showPaymentReview ? (
                    <StatTile
                        label="Today"
                        value={stats.todayRegistrations ?? 0}
                        tone="default"
                        icon={Calendar}
                    />
                ) : null}
            </div>

            <SectionCard className="p-4 sm:p-5 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                        <div className="size-9 rounded-xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center">
                            <UserCheck size={16} />
                        </div>
                        <div>
                            <p className="text-sm font-semibold">Check-in progress</p>
                            <p className="text-[11px] text-gray-500">Live gate status for this run</p>
                        </div>
                    </div>
                    <p className="text-lg font-semibold tabular-nums text-emerald-300">{checkInPct}%</p>
                </div>
                <div className="h-2.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
                    <div
                        className="h-full rounded-full bg-linear-to-r from-emerald-500 to-emerald-300 transition-all duration-500"
                        style={{ width: `${checkInPct}%` }}
                    />
                </div>
                <p className="text-xs text-gray-500">
                    {checkedIn} of {total} checked in
                    {pending > 0 ? ` · ${pending} still waiting` : total > 0 ? ' · all done' : ''}
                </p>
            </SectionCard>

            <SectionCard className="p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Registration</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isOpen ? 'People can book this run right now.' : 'Booking is paused for new registrations.'}
                            {isPaid ? (
                                isOrganizerQr
                                    ? ' · Runners pay via UPI — you review screenshots.'
                                    : ' · Runners pay online — bookings confirm automatically.'
                            ) : null}
                        </p>
                    </div>
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={toggleRegistration}
                        className={`px-4 py-2.5 min-h-11 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 ${
                            isOpen
                                ? 'border border-red-500/30 text-red-300 hover:bg-red-500/10'
                                : 'bg-[#0ECCEE] text-black hover:brightness-110'
                        }`}
                    >
                        {actionBusy ? '…' : isOpen ? 'Close booking' : 'Open booking'}
                    </button>
                </div>
                {showPaymentReview && pendingReview > 0 ? (
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={expireStale}
                        className="w-full px-3 py-2.5 rounded-xl border border-amber-500/25 text-amber-200/90 text-xs font-medium hover:bg-amber-500/10 disabled:opacity-50"
                        title={`Cancels pending QR payments older than ${ttlHours}h`}
                    >
                        Clear old pending ({ttlHours}h+)
                    </button>
                ) : null}
            </SectionCard>

            <div>
                <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2.5 px-0.5 font-medium">Quick actions</p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        {
                            label: 'Participants',
                            hint: 'Guests · payments',
                            icon: Users,
                            onClick: () => navigate(`/run-club-organizer/events/${eventId}/participants`),
                        },
                        {
                            label: 'Scan QR',
                            hint: 'Check-in at gate',
                            icon: QrCode,
                            onClick: () => navigate(`/run-club-organizer/events/${eventId}/scan`),
                        },
                        {
                            label: 'Notify',
                            hint: 'Remind or announce',
                            icon: Bell,
                            onClick: () => navigate(`/run-club-organizer/events/${eventId}/notifications`),
                        },
                    ].map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={action.onClick}
                            className="rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] p-4 min-h-24 text-left hover:border-[#0ECCEE]/40 active:scale-[0.985] transition-all"
                        >
                            <div className="size-9 rounded-xl bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center mb-3">
                                <action.icon size={18} />
                            </div>
                            <p className="text-sm font-semibold">{action.label}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{action.hint}</p>
                        </button>
                    ))}
                </div>
            </div>

            {pending > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(`/run-club-organizer/events/${eventId}/scan`)}
                    className="flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-linear-to-r from-amber-500/15 to-amber-500/5 px-4 py-3.5 min-h-[52px] hover:border-amber-400/50 transition-colors"
                >
                    <span className="inline-flex items-center gap-2 text-sm text-amber-100 font-medium">
                        <Clock size={16} />
                        {pending} still need check-in
                    </span>
                    <span className="text-xs text-amber-300 font-semibold shrink-0">Open scanner →</span>
                </button>
            ) : null}
        </div>
    );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Users, UserCheck, Calendar, Bell, QrCode, IndianRupee,
    Copy, ExternalLink, RefreshCw, MapPin, Link2, Sparkles, Hourglass,
} from 'lucide-react';
import {
    fetchEventOrganizerDashboard,
    setEventOrganizerRegistrationStatus,
} from '../../services/api/eventShowOrganizer.api';
import { eventShowPath } from '../../utils/slugRoutes';
import { formatEventShowDate } from '../../constants/eventsPage';
import DetailPageLoader from '../../components/DetailPageLoader';

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

export default function EventOrganizerDashboardPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
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
            setData(await fetchEventOrganizerDashboard(eventId));
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

    const event = data?.event || {};
    const publicPath = useMemo(() => (event?.id || event?._id ? eventShowPath(event) : ''), [event]);
    const publicUrl = useMemo(() => {
        if (!publicPath || typeof window === 'undefined') return publicPath;
        return `${window.location.origin}${publicPath}`;
    }, [publicPath]);

    if (loading) {
        return <DetailPageLoader label="Loading dashboard" variant="event" />;
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

    const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};
    const qr = stats.qr && typeof stats.qr === 'object' ? stats.qr : {};
    const status = event.status;
    const fee = Number(event.ticketPrice ?? 0);
    const isPaid = fee > 0 || Number(stats.revenue || 0) > 0;
    const isOrganizerQr = (event.registrationMode || event.registration?.mode) === 'organizer_qr';
    const regStatus = event.registrationStatus || event.registration?.status || 'closed';
    const isOpen = regStatus === 'open';
    const total = stats.totalRegistrations ?? 0;
    const checkedIn = stats.checkedIn ?? 0;
    const pending = stats.pendingCheckIn ?? Math.max(0, total - checkedIn);
    const pendingReview = Number(stats.pendingPaymentReview ?? stats.pendingRegistrations ?? qr.pendingReview ?? 0);
    const revenue = Number(stats.revenue || 0);
    const checkInPct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
    const dateLabel = formatEventShowDate(event.showTimings);
    const venue = String(event.venue || '').trim();
    const city = String(event.city || '').trim();
    const packages = Array.isArray(data.tiers) ? data.tiers : [];
    const guestsPath = `/event-organizer/events/${eventId}/participants`;
    const scanPath = `/event-organizer/events/${eventId}/scan`;
    const notifyPath = `/event-organizer/events/${eventId}/notifications`;
    const reviewPath = `${guestsPath}?status=pending`;

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
            const res = await setEventOrganizerRegistrationStatus(eventId, next);
            setActionNotice(res.message || (next === 'open' ? 'Registration opened' : 'Registration closed'));
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Could not update registration');
        } finally {
            setActionBusy(false);
        }
    };

    return (
        <div className="space-y-4 max-w-3xl mx-auto pb-6">
            <SectionCard className="overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/12 via-transparent to-transparent pointer-events-none" />
                <div className="relative p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2.5">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0ECCEE]">
                                <Sparkles size={11} /> Event dashboard
                            </div>
                            <h1 className="text-2xl font-semibold tracking-tight leading-tight text-white">
                                {event.title || 'Event'}
                            </h1>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                                {city || venue ? (
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin size={13} className="text-[#0ECCEE]" />
                                        {[venue, city].filter(Boolean).join(' · ')}
                                    </span>
                                ) : null}
                                {dateLabel && dateLabel !== 'Date TBA' ? <span>{dateLabel}</span> : null}
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
                                    {fee > 0 ? `₹${fee}` : (isPaid ? 'Paid' : 'Free')}
                                </span>
                            </div>
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

            {pendingReview > 0 ? (
                <button
                    type="button"
                    onClick={() => navigate(reviewPath)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3.5 text-left hover:border-amber-400/50 transition-colors"
                >
                    <span className="text-sm font-semibold text-amber-100 flex items-center gap-2">
                        <Hourglass size={16} />
                        {pendingReview} payment screenshot{pendingReview === 1 ? '' : 's'} to review
                    </span>
                    <span className="shrink-0 text-xs font-bold text-amber-300">Review →</span>
                </button>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
                <StatTile
                    label="Confirmed"
                    value={total}
                    tone="accent"
                    icon={Users}
                    to={guestsPath}
                    hint="Guest list"
                />
                <StatTile
                    label="Collected"
                    value={isPaid ? `₹${revenue.toLocaleString('en-IN')}` : 'Free'}
                    tone={isPaid ? 'money' : 'default'}
                    icon={IndianRupee}
                    hint={isOrganizerQr && isPaid ? 'UPI received' : isPaid ? 'Paid bookings' : undefined}
                />
                <StatTile
                    label="Checked in"
                    value={checkedIn}
                    tone="ok"
                    icon={UserCheck}
                    to={scanPath}
                />
                <StatTile
                    label="Today"
                    value={stats.todayRegistrations ?? 0}
                    tone="default"
                    icon={Calendar}
                />
            </div>

            {publicUrl && String(status).toLowerCase() === 'published' ? (
                <SectionCard className="p-4 space-y-3">
                    <p className="text-sm font-semibold text-white">Share event link</p>
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
                            onClick={() => navigate(scanPath)}
                            className="ml-1 text-[#0ECCEE] font-medium hover:underline"
                        >
                            · Scan now
                        </button>
                    ) : null}
                </p>
            </SectionCard>

            <SectionCard className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <p className="text-sm font-semibold">Booking</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            {isOpen ? 'Guests can register now.' : 'Registration is closed.'}
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

                {isOrganizerQr ? (
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3">
                        <p className="text-sm font-medium text-amber-100">Manual UPI + screenshot</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            Open Guests to see payment proofs and approve.
                        </p>
                        {pendingReview > 0 ? (
                            <button
                                type="button"
                                onClick={() => navigate(reviewPath)}
                                className="mt-3 w-full py-2 rounded-lg bg-amber-400 text-black text-xs font-bold"
                            >
                                Review {pendingReview}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </SectionCard>

            {packages.length > 0 ? (
                <SectionCard className="p-4 space-y-3">
                    <p className="text-sm font-semibold">Packages</p>
                    <div className="space-y-2">
                        {packages.map((t) => (
                            <div
                                key={`${t.tierId || t.tierName}-${t.count}`}
                                className="flex items-center justify-between text-sm border-b border-white/5 pb-2 last:border-0 last:pb-0"
                            >
                                <span className="text-gray-300 truncate pr-3">{t.tierName || 'Package'}</span>
                                <span className="text-gray-500 tabular-nums shrink-0">
                                    {t.count}
                                    {Number(t.revenue) > 0
                                        ? ` · ₹${Number(t.revenue).toLocaleString('en-IN')}`
                                        : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            ) : null}

            <div className="grid grid-cols-3 gap-2.5">
                {[
                    { label: 'Guests', icon: Users, to: guestsPath },
                    { label: 'Scan', icon: QrCode, to: scanPath },
                    { label: 'Notify', icon: Bell, to: notifyPath },
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

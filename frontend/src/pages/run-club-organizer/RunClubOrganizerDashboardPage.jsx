import { useEffect, useMemo, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Users, UserCheck, Clock, IndianRupee, Calendar, Loader, Bell, Copy, ExternalLink, Hourglass } from 'lucide-react';
import {
    fetchRunClubOrganizerDashboard,
    fetchRunClubOrganizerEvent,
    setRunClubOrganizerRegistrationStatus,
    expireRunClubOrganizerPendingPayments,
} from '../../services/api/runClubOrganizer.api';
import { sportRunPath } from '../../utils/slugRoutes';

function StatCard({ label, value, icon: Icon, accent, hint }) {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4">
            <div className="flex items-start justify-between gap-2">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-2xl font-bold mt-1 tabular-nums">{value}</p>
                    {hint ? <p className="text-[10px] text-gray-600 mt-1">{hint}</p> : null}
                </div>
                <div className={`size-9 rounded-lg flex items-center justify-center ${accent}`}>
                    <Icon size={16} />
                </div>
            </div>
        </div>
    );
}

export default function RunClubOrganizerDashboardPage() {
    const { eventId } = useParams();
    const [data, setData] = useState(null);
    const [eventDetail, setEventDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [copyNotice, setCopyNotice] = useState('');
    const [actionBusy, setActionBusy] = useState(false);
    const [actionNotice, setActionNotice] = useState('');

    const load = useCallback(async ({ silent = false } = {}) => {
        if (!eventId) return;
        if (!silent) {
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
            if (!silent) setError(e.message);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (!eventId) return;
        let cancelled = false;
        load();
        const poll = setInterval(() => {
            if (!cancelled) load({ silent: true });
        }, 45000);
        return () => {
            cancelled = true;
            clearInterval(poll);
        };
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

    if (loading) return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    if (error) return <div className="text-red-400 text-sm">{error}</div>;
    if (!data) return null;

    const { event, stats } = data;
    const status = eventDetail?.status || event.status;
    const fee = Number(eventDetail?.registrationFee || 0);
    const mode = eventDetail?.registration?.mode || 'internal_form';
    const regStatus = eventDetail?.registration?.status || event.registrationStatus || 'open';
    const ttlHours = stats.pendingTtlHours || 48;

    const toggleRegistration = async () => {
        const next = regStatus === 'open' ? 'closed' : 'open';
        setActionBusy(true);
        setActionNotice('');
        try {
            await setRunClubOrganizerRegistrationStatus(eventId, next);
            setActionNotice(next === 'open' ? 'Registration opened' : 'Registration closed');
            await load({ silent: true });
        } catch (e) {
            setActionNotice(e.message || 'Failed to update registration');
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
            setActionNotice(e.message || 'Failed to expire pending payments');
        } finally {
            setActionBusy(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold">{event.title}</h1>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                        status === 'published'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                    }`}>
                        {status || 'draft'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-700/40 text-gray-300">
                        {fee > 0 ? (mode === 'organizer_qr' ? 'QR payment' : 'Paid') : 'Free'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        regStatus === 'open'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-red-500/15 text-red-400'
                    }`}>
                        Reg {regStatus}
                    </span>
                </div>
                <p className="text-sm text-gray-500">
                    {event.city || '—'}
                    {event.distance ? ` · ${event.distance}` : ''} · Manage registrations & check-in
                </p>
                {actionNotice ? <p className="text-[11px] text-[#0ECCEE] mt-1">{actionNotice}</p> : null}
            </div>

            {publicUrl && status === 'published' ? (
                <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs text-gray-500 mb-1">Share with runners</p>
                        <p className="text-sm text-gray-300 break-all">{publicUrl}</p>
                        {copyNotice ? <p className="text-[11px] text-emerald-400 mt-1">{copyNotice}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(publicUrl);
                                    setCopyNotice('Copied');
                                    setTimeout(() => setCopyNotice(''), 2000);
                                } catch {
                                    setCopyNotice('Copy failed');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm hover:border-[#0ECCEE]/50"
                        >
                            <Copy size={14} /> Copy
                        </button>
                        <a
                            href={publicPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm hover:border-[#0ECCEE]/50"
                        >
                            <ExternalLink size={14} /> Open
                        </a>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
                <StatCard label="Confirmed" value={stats.totalRegistrations} icon={Users} accent="bg-blue-500/15 text-blue-400" />
                <StatCard label="Needs review" value={stats.pendingPaymentReview ?? 0} icon={Hourglass} accent="bg-amber-500/15 text-amber-400" hint="QR screenshots" />
                <StatCard
                    label="Seats left"
                    value={stats.seatsRemaining == null ? '—' : stats.seatsRemaining}
                    icon={Users}
                    accent="bg-cyan-500/15 text-cyan-400"
                    hint={stats.capacity ? `${stats.seatsFilled ?? 0} / ${stats.capacity} held` : 'No capacity limit'}
                />
                <StatCard label="Checked in" value={stats.checkedIn} icon={UserCheck} accent="bg-emerald-500/15 text-emerald-400" />
                <StatCard label="Pending check-in" value={stats.pendingCheckIn} icon={Clock} accent="bg-orange-500/15 text-orange-400" />
                <StatCard
                    label="Collected"
                    value={`₹${Number(stats.organizerRevenue ?? stats.revenue ?? 0).toLocaleString('en-IN')}`}
                    icon={IndianRupee}
                    accent="bg-purple-500/15 text-purple-400"
                />
                <StatCard
                    label="Pending ₹"
                    value={`₹${Number(stats.pendingAmountAtRisk ?? 0).toLocaleString('en-IN')}`}
                    icon={Hourglass}
                    accent="bg-amber-500/15 text-amber-400"
                    hint="Awaiting approval"
                />
                <StatCard label="Today" value={stats.todayRegistrations} icon={Calendar} accent="bg-pink-500/15 text-pink-400" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link to={`/run-club-organizer/events/${eventId}/participants`} className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl bg-[#0ECCEE] text-black text-sm font-bold">View participants</Link>
                {(stats.pendingPaymentReview ?? 0) > 0 ? (
                    <Link to={`/run-club-organizer/events/${eventId}/participants?paymentStatus=pending_review`} className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-amber-500/40 text-amber-300 text-sm font-bold hover:bg-amber-500/10">
                        Review {stats.pendingPaymentReview} payment{stats.pendingPaymentReview === 1 ? '' : 's'}
                    </Link>
                ) : null}
                <button
                    type="button"
                    disabled={actionBusy}
                    onClick={toggleRegistration}
                    className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50 disabled:opacity-50"
                >
                    {regStatus === 'open' ? 'Close registration' : 'Open registration'}
                </button>
                {(stats.pendingPaymentReview ?? 0) > 0 ? (
                    <button
                        type="button"
                        disabled={actionBusy}
                        onClick={expireStale}
                        className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-amber-500/30 text-amber-200/90 text-sm font-medium hover:bg-amber-500/10 disabled:opacity-50"
                        title={`Cancels pending QR payments older than ${ttlHours}h`}
                    >
                        Expire stale ({ttlHours}h+)
                    </button>
                ) : null}
                <Link to={`/run-club-organizer/events/${eventId}/scan`} className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50">Open QR scanner</Link>
                <Link to={`/run-club-organizer/events/${eventId}/notifications`} className="px-4 py-3.5 min-h-[52px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-700 text-sm font-medium hover:border-[#0ECCEE]/50"><Bell size={16} /> Notify runners</Link>
            </div>
        </div>
    );
}

import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Loader, Bell, QrCode, RefreshCw, ExternalLink,
} from 'lucide-react';
import {
    fetchEventOrganizerDashboard,
    setEventOrganizerRegistrationStatus,
} from '../../services/api/eventShowOrganizer.api';
import { eventShowPath } from '../../utils/slugRoutes';

function StatTile({ label, value, tone = 'default', icon: Icon, to }) {
    const navigate = useNavigate();
    const tones = {
        default: 'border-white/10 bg-[#161718]',
        accent: 'border-[#0ECCEE]/25 bg-[#0ECCEE]/10',
        ok: 'border-emerald-500/20 bg-emerald-500/10',
        warn: 'border-amber-500/20 bg-amber-500/10',
        money: 'border-emerald-500/20 bg-emerald-500/10',
    };
    return (
        <button
            type="button"
            disabled={!to}
            onClick={() => to && navigate(to)}
            className={`rounded-2xl border p-4 text-left min-h-[96px] ${tones[tone] || tones.default} ${to ? 'hover:border-[#0ECCEE]/45 cursor-pointer' : ''}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
                    <p className="text-2xl font-semibold mt-2 tabular-nums">{value}</p>
                </div>
                {Icon ? (
                    <div className="size-9 rounded-xl bg-white/5 flex items-center justify-center text-gray-300">
                        <Icon size={16} />
                    </div>
                ) : null}
            </div>
        </button>
    );
}

export default function EventOrganizerDashboardPage() {
    const { eventId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        setError('');
        try {
            setData(await fetchEventOrganizerDashboard(eventId));
        } catch (e) {
            setError(e.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => { load(); }, [load]);

    const toggleReg = async () => {
        const current = data?.event?.registrationStatus || data?.event?.registration?.status;
        const next = current === 'open' ? 'closed' : 'open';
        setBusy(true);
        setNotice('');
        try {
            const res = await setEventOrganizerRegistrationStatus(eventId, next);
            setNotice(res.message || `Registration ${next}`);
            await load();
        } catch (e) {
            setNotice(e.message || 'Update failed');
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    }
    if (error) {
        return <p className="text-red-400 text-sm">{error}</p>;
    }

    const stats = data?.stats || {};
    const segments = stats.segments || {};
    const qr = stats.qr || {};
    const event = data?.event || {};
    const regOpen = (event.registrationStatus || event.registration?.status) === 'open';
    const publicPath = eventShowPath(event);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">{event.title}</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {[event.venue, event.city].filter(Boolean).join(' · ') || 'Venue TBA'}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 text-xs text-gray-300"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    {publicPath ? (
                        <a
                            href={publicPath}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 text-xs text-gray-300"
                        >
                            <ExternalLink size={14} /> Public page
                        </a>
                    ) : null}
                </div>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium">Registration is {regOpen ? 'open' : 'closed'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Guests can only register while open.</p>
                </div>
                <button
                    type="button"
                    disabled={busy}
                    onClick={toggleReg}
                    className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-60 ${
                        regOpen ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'
                    }`}
                >
                    {busy ? 'Updating…' : (regOpen ? 'Close registration' : 'Open registration')}
                </button>
            </div>
            {notice ? <p className="text-xs text-[#0ECCEE]">{notice}</p> : null}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatTile label="Approved" value={stats.totalRegistrations || 0} tone="accent" icon={Users} to={`/event-organizer/events/${eventId}/participants?status=approved`} />
                <StatTile label="Checked in" value={stats.checkedIn || 0} tone="ok" icon={UserCheck} to={`/event-organizer/events/${eventId}/participants?checkInStatus=checked_in`} />
                <StatTile label="Pending check-in" value={stats.pendingCheckIn || 0} tone="warn" icon={Clock} to={`/event-organizer/events/${eventId}/scan`} />
                <StatTile label="Revenue" value={`₹${Number(stats.revenue || 0).toLocaleString('en-IN')}`} tone="money" icon={IndianRupee} />
            </div>

            {qr.enabled ? (
                <div className="rounded-2xl border border-purple-500/25 bg-purple-500/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-purple-300/90">QR Payments</p>
                            <p className="text-xs text-gray-500 mt-1">Proof uploads and approval status</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/event-organizer/events/${eventId}/participants?category=&paymentStatus=pending`)}
                            className="text-[11px] font-semibold text-[#0ECCEE]"
                        >
                            Review pending →
                        </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                            <p className="text-[10px] text-gray-400 uppercase">QR regs</p>
                            <p className="text-lg font-semibold text-white">{qr.totalQr || 0}</p>
                        </div>
                        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                            <p className="text-[10px] text-amber-300 uppercase">Pending</p>
                            <p className="text-lg font-semibold text-amber-200">{qr.pendingReview || 0}</p>
                        </div>
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                            <p className="text-[10px] text-emerald-300 uppercase">Approved paid</p>
                            <p className="text-lg font-semibold text-emerald-200">{qr.paidApproved || 0}</p>
                        </div>
                        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2">
                            <p className="text-[10px] text-cyan-300 uppercase">Proof uploaded</p>
                            <p className="text-lg font-semibold text-cyan-100">{qr.withProof || 0}</p>
                        </div>
                    </div>
                    <div className="mt-3 rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/10 px-3 py-2.5">
                        <p className="text-[10px] uppercase tracking-wide text-fuchsia-300">
                            CrwdCtrl commission due ({qr.commissionPercent || 2.5}%)
                        </p>
                        <p className="text-xl font-bold text-fuchsia-100 mt-1">
                            ₹{Number(qr.commissionDue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            On ₹{Number(qr.paidAmount || 0).toLocaleString('en-IN')} paid via QR
                            {' · '}
                            {qr.commissionEntries || 0} entries
                            {qr.duplicateRows ? ` · ${qr.duplicateRows} duplicate submit(s) ignored` : ''}
                        </p>
                    </div>
                </div>
            ) : null}

            {segments ? (
                <div className="grid sm:grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-amber-400/90">Independence Day Drive</p>
                        <p className="text-2xl font-semibold mt-2 tabular-nums text-amber-100">
                            {segments.independenceDriveTotal || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Drive only (free): {segments.driveOnly || 0}
                            {' · '}
                            Drive + Trackday: {segments.driveAndTrackday || 0}
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate(`/event-organizer/events/${eventId}/participants?status=approved&category=independence_drive`)}
                            className="mt-3 text-[11px] font-semibold text-[#0ECCEE]"
                        >
                            View Drive guests →
                        </button>
                    </div>
                    <div className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-4">
                        <p className="text-[11px] uppercase tracking-wide text-[#0ECCEE]/90">Trackday</p>
                        <p className="text-2xl font-semibold mt-2 tabular-nums text-cyan-100">
                            {segments.trackdayTotal || 0}
                        </p>
                        <p className="text-xs text-gray-500 mt-2">
                            Trackday only: {segments.trackdayOnly || 0}
                            {' · '}
                            With Drive: {segments.driveAndTrackday || 0}
                        </p>
                        <button
                            type="button"
                            onClick={() => navigate(`/event-organizer/events/${eventId}/participants?status=approved&category=trackday`)}
                            className="mt-3 text-[11px] font-semibold text-[#0ECCEE]"
                        >
                            View Trackday guests →
                        </button>
                    </div>
                </div>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => navigate(`/event-organizer/events/${eventId}/participants`)}
                    className="rounded-2xl border border-gray-800 bg-[#161718] p-4 text-left hover:border-[#0ECCEE]/40"
                >
                    <Users className="text-[#0ECCEE] mb-2" size={18} />
                    <p className="font-semibold">Guests</p>
                    <p className="text-xs text-gray-500 mt-1">Search, filter by Drive / Trackday, export CSV</p>
                </button>
                <button
                    type="button"
                    onClick={() => navigate(`/event-organizer/events/${eventId}/scan`)}
                    className="rounded-2xl border border-gray-800 bg-[#161718] p-4 text-left hover:border-[#0ECCEE]/40"
                >
                    <QrCode className="text-[#0ECCEE] mb-2" size={18} />
                    <p className="font-semibold">Scan QR</p>
                    <p className="text-xs text-gray-500 mt-1">Door check-in for approved tickets</p>
                </button>
                <button
                    type="button"
                    onClick={() => navigate(`/event-organizer/events/${eventId}/notifications`)}
                    className="rounded-2xl border border-gray-800 bg-[#161718] p-4 text-left hover:border-[#0ECCEE]/40 sm:col-span-2"
                >
                    <Bell className="text-[#0ECCEE] mb-2" size={18} />
                    <p className="font-semibold">Notify guests</p>
                    <p className="text-xs text-gray-500 mt-1">Send reminders or announcements in-app</p>
                </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4">
                    <h2 className="text-sm font-semibold mb-3">Independence Day Drive</h2>
                    {(data?.driveTiers || []).length > 0 ? (
                        <div className="space-y-2">
                            {(data.driveTiers || []).map((t) => (
                                <div key={`drive-${t.tierId}-${t.tierName}`} className="flex items-center justify-between text-sm border-b border-gray-800/80 pb-2 last:border-0">
                                    <span className="text-gray-300">{t.tierName || 'Drive only'}</span>
                                    <span className="text-gray-500 tabular-nums">{t.count} · Free</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">
                            {segments.driveOnly || 0} Drive-only guests
                            {segments.driveAndTrackday ? ` · ${segments.driveAndTrackday} also on Trackday` : ''}
                        </p>
                    )}
                </div>
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4">
                    <h2 className="text-sm font-semibold mb-3">Trackday packages</h2>
                    {(data?.trackdayTiers || data?.tiers || []).filter((t) => !/drive\s*only/i.test(t.tierName || '')).length > 0 ? (
                        <div className="space-y-2">
                            {(data.trackdayTiers || data.tiers || [])
                                .filter((t) => !/drive\s*only/i.test(t.tierName || ''))
                                .map((t) => (
                                    <div key={`td-${t.tierId}-${t.tierName}`} className="flex items-center justify-between text-sm border-b border-gray-800/80 pb-2 last:border-0">
                                        <span className="text-gray-300">{t.tierName || 'Package'}</span>
                                        <span className="text-gray-500 tabular-nums">
                                            {t.count} · ₹{Number(t.revenue || 0).toLocaleString('en-IN')}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">No Trackday packages yet</p>
                    )}
                </div>
            </div>

            {Array.isArray(data?.recent) && data.recent.length > 0 ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4">
                    <h2 className="text-sm font-semibold mb-3">Recent registrations</h2>
                    <div className="space-y-2">
                        {data.recent.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{p.userName || 'Guest'}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {[
                                            p.repeatLabel || null,
                                            p.categoryLabel || p.tierName,
                                            Array.isArray(p.allTier) && p.allTier.length > 1
                                                ? `${p.allTier.length} packages`
                                                : null,
                                            p.paymentStatus,
                                            p.status,
                                            p.transactionId ? 'txn saved' : null,
                                            p.paymentScreenshotUrl ? 'proof' : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                                    {Number(p.amountPaid || 0) > 0
                                        ? `₹${Number(p.amountPaid || 0).toLocaleString('en-IN')}`
                                        : 'Free'}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

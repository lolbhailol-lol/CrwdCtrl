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

            <div className="grid sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => navigate(`/event-organizer/events/${eventId}/participants`)}
                    className="rounded-2xl border border-gray-800 bg-[#161718] p-4 text-left hover:border-[#0ECCEE]/40"
                >
                    <Users className="text-[#0ECCEE] mb-2" size={18} />
                    <p className="font-semibold">Guests</p>
                    <p className="text-xs text-gray-500 mt-1">Search, filter by package / payment, export CSV</p>
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

            {Array.isArray(data?.tiers) && data.tiers.length > 0 ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4">
                    <h2 className="text-sm font-semibold mb-3">Packages</h2>
                    <div className="space-y-2">
                        {data.tiers.map((t) => (
                            <div key={`${t.tierId}-${t.tierName}`} className="flex items-center justify-between text-sm border-b border-gray-800/80 pb-2 last:border-0">
                                <span className="text-gray-300">{t.tierName || 'Package'}</span>
                                <span className="text-gray-500 tabular-nums">
                                    {t.count} · ₹{Number(t.revenue || 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}

            {Array.isArray(data?.recent) && data.recent.length > 0 ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] p-4">
                    <h2 className="text-sm font-semibold mb-3">Recent registrations</h2>
                    <div className="space-y-2">
                        {data.recent.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{p.userName || 'Guest'}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {[p.tierName, p.paymentStatus, p.status].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                                    ₹{Number(p.amountPaid || 0).toLocaleString('en-IN')}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

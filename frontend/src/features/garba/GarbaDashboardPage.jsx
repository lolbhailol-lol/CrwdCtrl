import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users, UserCheck, Hourglass, IndianRupee, ChevronLeft, RefreshCw,
} from 'lucide-react';
import {
    fetchEventOrganizerMe,
    fetchEventOrganizerDashboard,
} from '../../services/api/eventShowOrganizer.api';
import { formatEventShowDate } from '../../constants/eventsPage';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import {
    GarbaCategoryBreakdown,
    GarbaCommissionCard,
    GarbaParticipantsPanel,
    buildGarbaTiers,
    formatINR,
    isGarbaEvent,
    isOfflineCodEvent,
} from './GarbaSections';

function StatTile({ label, value, hint, icon: Icon, tone = 'default' }) {
    const tones = {
        default: 'border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516]',
        ok: 'border-emerald-500/20 bg-linear-to-br from-emerald-500/15 to-emerald-500/5',
        warn: 'border-amber-500/20 bg-linear-to-br from-amber-500/15 to-amber-500/5',
        money: 'border-teal-400/25 bg-linear-to-br from-teal-500/18 to-[#101817]',
    };
    return (
        <div className={`rounded-2xl border p-4 min-h-24 ${tones[tone]}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium">{label}</p>
                    <p className="text-[1.5rem] leading-none font-semibold mt-2 tabular-nums tracking-tight text-white">
                        {value}
                    </p>
                    {hint ? <p className="text-[11px] text-gray-500 mt-1.5">{hint}</p> : null}
                </div>
                {Icon ? (
                    <div className="size-9 rounded-xl flex items-center justify-center shrink-0 bg-white/5 text-gray-300">
                        <Icon size={16} strokeWidth={2.25} />
                    </div>
                ) : null}
            </div>
        </div>
    );
}

export default function GarbaDashboardPage() {
    const [events, setEvents] = useState([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [eventsError, setEventsError] = useState('');
    const [eventId, setEventId] = useState('');

    const [dashboard, setDashboard] = useState(null);
    const [dashLoading, setDashLoading] = useState(false);
    const [dashError, setDashError] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchEventOrganizerMe();
                const all = data.events || [];
                const garba = all.filter(isGarbaEvent);
                const list = garba.length ? garba : all;
                setEvents(list);
                if (list.length) setEventId(String(list[0]._id || list[0].id));
            } catch (e) {
                setEventsError(e.message || 'Failed to load events');
            } finally {
                setEventsLoading(false);
            }
        })();
    }, []);

    const loadDashboard = useCallback(async () => {
        if (!eventId) return;
        setDashLoading(true);
        setDashError('');
        try {
            setDashboard(await fetchEventOrganizerDashboard(eventId));
        } catch (e) {
            setDashError(e.message || 'Failed to load dashboard');
        } finally {
            setDashLoading(false);
        }
    }, [eventId]);

    useEffect(() => { loadDashboard(); }, [loadDashboard]);

    const selectEvent = (id) => {
        if (id === eventId) return;
        setEventId(id);
        setDashboard(null);
    };

    const refreshAll = () => {
        loadDashboard();
        setRefreshKey((k) => k + 1);
    };

    const event = dashboard?.event || events.find((e) => String(e._id || e.id) === eventId) || {};
    const stats = dashboard?.stats || {};
    const payments = stats.payments || {};

    const tiers = useMemo(() => buildGarbaTiers(event, dashboard?.tiers), [event, dashboard?.tiers]);

    const totalRegs = Object.entries(payments)
        .filter(([k]) => k !== 'paidAmount')
        .reduce((s, [, v]) => s + (Number(v) || 0), 0);
    const paidCount = Number(payments.paid) || 0;
    const pendingCount = Number(payments.pending) || 0;

    if (eventsLoading) {
        return <InlinePageLoader label="Loading garba events…" variant="event" />;
    }

    return (
        <div className="min-h-screen bg-[#0e0f10] text-white pb-24 lg:pb-8">
            <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <Link to="/event-organizer" className="size-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-gray-300">
                        <ChevronLeft size={18} />
                    </Link>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl font-semibold tracking-tight">Garba Events Dashboard</h1>
                        <p className="text-[13px] text-gray-500 mt-0.5">Participants, payments & categories at a glance</p>
                    </div>
                    {eventId ? (
                        <button
                            type="button"
                            onClick={refreshAll}
                            disabled={dashLoading}
                            className="shrink-0 p-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white disabled:opacity-50"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} className={dashLoading ? 'animate-spin' : ''} />
                        </button>
                    ) : null}
                </div>

                {eventsError ? (
                    <p className="mt-6 text-sm text-red-300">{eventsError}</p>
                ) : null}

                {!eventsError && events.length === 0 ? (
                    <div className="mt-6 rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                        No events assigned yet. Ask CrwdCtrl admin to assign an event to your account.
                    </div>
                ) : null}

                {/* Event switcher */}
                {events.length > 1 ? (
                    <div className="flex gap-2 mt-5 overflow-x-auto pb-1">
                        {events.map((e) => {
                            const id = String(e._id || e.id);
                            const dateLabel = formatEventShowDate(e.showTimings);
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => selectEvent(id)}
                                    className={`shrink-0 rounded-xl border px-4 py-3 text-left transition-all ${eventId === id
                                        ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10'
                                        : 'border-white/10 bg-[#161718] hover:border-white/20'
                                        }`}
                                >
                                    <p className="text-[13px] font-semibold">{e.title}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                        {[e.venue, dateLabel !== 'Date TBA' ? dateLabel : ''].filter(Boolean).join(' · ') || 'Venue TBA'}
                                    </p>
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                {eventId ? (
                    <>
                        {dashError ? (
                            <p className="mt-5 text-sm text-red-300">{dashError}</p>
                        ) : null}

                        {/* Stats */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
                            <StatTile label="Registrations" value={totalRegs} hint={`${stats.checkedIn ?? 0} checked in`} icon={Users} />
                            <StatTile label="Paid" value={paidCount} hint={`${totalRegs ? Math.round((paidCount / totalRegs) * 100) : 0}% converted`} icon={UserCheck} tone="ok" />
                            <StatTile label="Pending" value={pendingCount} hint="payment awaited" icon={Hourglass} tone="warn" />
                            <StatTile label="Revenue" value={formatINR(stats.revenue)} hint={`${stats.todayRegistrations ?? 0} bookings today`} icon={IndianRupee} tone="money" />
                        </div>

                        {isOfflineCodEvent(event) ? (
                            <GarbaCommissionCard revenue={stats.revenue} percent={event.registration?.commissionPercent} className="mt-5" />
                        ) : null}
                        <GarbaCategoryBreakdown tiers={tiers} className="mt-5" />
                        <GarbaParticipantsPanel
                            eventId={eventId}
                            tiers={tiers}
                            refreshKey={refreshKey}
                            offline={isOfflineCodEvent(event)}
                            onStatusChange={loadDashboard}
                            className="mt-5"
                        />
                    </>
                ) : null}
            </div>
        </div>
    );
}

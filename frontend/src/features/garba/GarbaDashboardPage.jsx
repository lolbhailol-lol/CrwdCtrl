import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users, UserCheck, Hourglass, IndianRupee, Search,
    ChevronLeft, Ticket, BadgeCheck, Clock3, RefreshCw, XCircle,
} from 'lucide-react';
import {
    fetchEventOrganizerMe,
    fetchEventOrganizerDashboard,
    fetchEventOrganizerParticipants,
} from '../../services/api/eventShowOrganizer.api';
import { formatEventShowDate } from '../../constants/eventsPage';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const GARBA_RE = /garba|jalsa|navratri|dandiya/i;
const PAGE_SIZE = 50;
const TIER_COLORS = ['#0ECCEE', '#F472B6', '#FBBF24', '#A78BFA', '#34D399', '#FB923C', '#60A5FA', '#F87171'];

const STATUS_TABS = [
    { id: '', label: 'All' },
    { id: 'paid', label: 'Paid' },
    { id: 'pending', label: 'Pending' },
    { id: 'failed', label: 'Failed' },
];

const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

const isGarbaEvent = (e) => GARBA_RE.test([e.title, e.displayName, e.eventHeading].filter(Boolean).join(' '));

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

function StatusPill({ status }) {
    if (status === 'paid') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 text-[11px] font-medium px-2.5 py-1">
                <BadgeCheck size={12} /> Paid
            </span>
        );
    }
    if (status === 'failed') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-300 text-[11px] font-medium px-2.5 py-1">
                <XCircle size={12} /> Failed
            </span>
        );
    }
    if (status === 'free') {
        return (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 text-gray-300 text-[11px] font-medium px-2.5 py-1">
                Free
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-300 text-[11px] font-medium px-2.5 py-1">
            <Clock3 size={12} /> Pending
        </span>
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

    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [tierFilter, setTierFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [participants, setParticipants] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState('');

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

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
        return () => clearTimeout(t);
    }, [query]);

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

    const loadParticipants = useCallback(async (page = 1) => {
        if (!eventId) return;
        setListLoading(true);
        setListError('');
        try {
            const data = await fetchEventOrganizerParticipants(eventId, {
                page,
                limit: PAGE_SIZE,
                search: debouncedQuery,
                paymentStatus: statusFilter,
                tierId: tierFilter,
            });
            const rows = data.participants || [];
            setParticipants((prev) => (page === 1 ? rows : [...prev, ...rows]));
            setPagination(data.pagination || { page, pages: 1, total: rows.length });
        } catch (e) {
            setListError(e.message || 'Failed to load participants');
        } finally {
            setListLoading(false);
        }
    }, [eventId, debouncedQuery, statusFilter, tierFilter]);

    useEffect(() => { loadParticipants(1); }, [loadParticipants]);

    const selectEvent = (id) => {
        if (id === eventId) return;
        setEventId(id);
        setDashboard(null);
        setParticipants([]);
        setQuery('');
        setDebouncedQuery('');
        setTierFilter('');
        setStatusFilter('');
    };

    const refreshAll = () => {
        loadDashboard();
        loadParticipants(1);
    };

    const event = dashboard?.event || events.find((e) => String(e._id || e.id) === eventId) || {};
    const stats = dashboard?.stats || {};
    const payments = stats.payments || {};

    const byTier = useMemo(() => {
        const eventTiers = Array.isArray(event.tiers) ? [...event.tiers] : [];
        eventTiers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const rows = Array.isArray(dashboard?.tiers) ? dashboard.tiers : [];
        const used = new Set();
        const merged = eventTiers.map((t, i) => {
            const row = rows.find((r) => (r.tierId && r.tierId === t.id) || (!r.tierId && r.tierName === t.name));
            if (row) used.add(row);
            return {
                id: t.id,
                label: t.name,
                price: Number(t.fee) || 0,
                color: TIER_COLORS[i % TIER_COLORS.length],
                sold: row?.count || 0,
                paid: row?.paid || 0,
                revenue: row?.revenue || 0,
            };
        });
        rows.filter((r) => !used.has(r)).forEach((r, i) => {
            merged.push({
                id: r.tierId || r.tierName,
                label: r.tierName || 'No package',
                price: null,
                color: TIER_COLORS[(eventTiers.length + i) % TIER_COLORS.length],
                sold: r.count || 0,
                paid: r.paid || 0,
                revenue: r.revenue || 0,
            });
        });
        return merged;
    }, [event.tiers, dashboard?.tiers]);

    const tierColor = (p) => byTier.find((t) => t.id === p.tierId || t.label === p.tierName)?.color;
    const maxSold = Math.max(1, ...byTier.map((c) => c.sold));
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
                            disabled={dashLoading || listLoading}
                            className="shrink-0 p-2.5 rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:text-white disabled:opacity-50"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} className={dashLoading || listLoading ? 'animate-spin' : ''} />
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

                        {/* Category breakdown */}
                        {byTier.length > 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-[#161718]/95 mt-5 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <Ticket size={15} className="text-gray-400" />
                                    <h2 className="text-[15px] font-semibold">By category</h2>
                                </div>
                                <div className="space-y-3">
                                    {byTier.map((c) => (
                                        <div key={c.id}>
                                            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px] mb-1.5">
                                                <span className="flex items-center gap-2 font-medium">
                                                    <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                                                    {c.label}
                                                    {c.price != null ? <span className="text-gray-500 font-normal">· {formatINR(c.price)}</span> : null}
                                                </span>
                                                <span className="tabular-nums text-gray-400">
                                                    <span className="text-white font-semibold">{c.sold}</span> sold · {c.paid} paid · <span className="text-teal-300 font-semibold">{formatINR(c.revenue)}</span>
                                                </span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{ width: `${Math.round((c.sold / maxSold) * 100)}%`, background: c.color }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {/* Participants */}
                        <div className="rounded-2xl border border-white/10 bg-[#161718]/95 mt-5 p-4">
                            <h2 className="text-[15px] font-semibold mb-3">Participants</h2>

                            <div className="relative mb-3">
                                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name, phone or email…"
                                    className="w-full rounded-xl border border-white/10 bg-[#0e0f10] pl-9 pr-3 py-2.5 text-[13px] placeholder:text-gray-600 outline-none focus:border-[#0ECCEE]/50"
                                />
                            </div>

                            <div className="flex gap-2 overflow-x-auto pb-1 mb-1">
                                <select
                                    value={tierFilter}
                                    onChange={(e) => setTierFilter(e.target.value)}
                                    className="shrink-0 rounded-lg border border-white/10 bg-[#0e0f10] text-[12px] px-2.5 py-2 outline-none"
                                >
                                    <option value="">All categories</option>
                                    {byTier.filter((c) => c.price != null).map((c) => (
                                        <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                </select>
                                <div className="flex gap-1.5">
                                    {STATUS_TABS.map((t) => (
                                        <button
                                            key={t.id || 'all'}
                                            type="button"
                                            onClick={() => setStatusFilter(t.id)}
                                            className={`shrink-0 rounded-lg border px-3 py-2 text-[12px] font-medium transition-all ${statusFilter === t.id
                                                ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/10 text-white'
                                                : 'border-white/10 text-gray-400 hover:border-white/20'
                                                }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {listError ? <p className="text-[13px] text-red-300 py-3">{listError}</p> : null}

                            <div className="divide-y divide-white/5">
                                {participants.map((p) => (
                                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-[13.5px] font-medium truncate">{p.userName || 'Guest'}</p>
                                            <p className="text-[11.5px] text-gray-500 mt-0.5 truncate">
                                                {[p.userPhone || p.userEmail].filter(Boolean).join('')}
                                                {p.tierName ? <> · <span style={{ color: tierColor(p) }}>{p.tierName}</span></> : null}
                                                {' · '}{formatINR(p.amountPaid)}
                                            </p>
                                        </div>
                                        <StatusPill status={p.paymentStatus} />
                                    </div>
                                ))}
                                {!listLoading && participants.length === 0 && !listError ? (
                                    <p className="text-[13px] text-gray-500 text-center py-8">No participants match the filters.</p>
                                ) : null}
                            </div>

                            {pagination.page < pagination.pages ? (
                                <button
                                    type="button"
                                    onClick={() => loadParticipants(pagination.page + 1)}
                                    disabled={listLoading}
                                    className="mt-3 w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-[13px] font-medium text-[#0ECCEE] hover:border-[#0ECCEE]/40 disabled:opacity-50"
                                >
                                    {listLoading ? 'Loading…' : 'Load more'}
                                </button>
                            ) : null}
                            <p className="text-[11px] text-gray-600 mt-3">
                                Showing {participants.length} of {pagination.total} participants
                            </p>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}

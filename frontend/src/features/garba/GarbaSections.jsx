import { useCallback, useEffect, useState } from 'react';
import { Search, Ticket, BadgeCheck, Clock3, XCircle } from 'lucide-react';
import { fetchEventOrganizerParticipants } from '../../services/api/eventShowOrganizer.api';

const GARBA_RE = /garba|jalsa|navratri|dandiya/i;
const PAGE_SIZE = 50;
const TIER_COLORS = ['#0ECCEE', '#F472B6', '#FBBF24', '#A78BFA', '#34D399', '#FB923C', '#60A5FA', '#F87171'];

const STATUS_TABS = [
    { id: '', label: 'All' },
    { id: 'paid', label: 'Paid' },
    { id: 'pending', label: 'Pending' },
    { id: 'failed', label: 'Failed' },
];

export const formatINR = (amount) => `₹${Number(amount || 0).toLocaleString('en-IN')}`;

export const isGarbaEvent = (e = {}) =>
    GARBA_RE.test([e.title, e.displayName, e.eventHeading].filter(Boolean).join(' '));

/** Merge the event's configured tiers (price/order) with dashboard tier counts. */
export function buildGarbaTiers(event = {}, dashboardTiers = []) {
    const eventTiers = Array.isArray(event.tiers) ? [...event.tiers] : [];
    eventTiers.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const rows = Array.isArray(dashboardTiers) ? dashboardTiers : [];
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

export function GarbaCategoryBreakdown({ tiers, className = '' }) {
    if (!tiers.length) return null;
    const maxSold = Math.max(1, ...tiers.map((c) => c.sold));
    return (
        <div className={`rounded-2xl border border-white/10 bg-[#161718]/95 p-4 ${className}`}>
            <div className="flex items-center gap-2 mb-4">
                <Ticket size={15} className="text-gray-400" />
                <h2 className="text-[15px] font-semibold">By category</h2>
            </div>
            <div className="space-y-3">
                {tiers.map((c) => (
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
    );
}

export function GarbaParticipantsPanel({ eventId, tiers, refreshKey = 0, className = '' }) {
    const [query, setQuery] = useState('');
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [tierFilter, setTierFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [participants, setParticipants] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setQuery('');
        setDebouncedQuery('');
        setTierFilter('');
        setStatusFilter('');
        setParticipants([]);
    }, [eventId]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedQuery(query.trim()), 350);
        return () => clearTimeout(t);
    }, [query]);

    const load = useCallback(async (page = 1) => {
        if (!eventId) return;
        setLoading(true);
        setError('');
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
            setError(e.message || 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    }, [eventId, debouncedQuery, statusFilter, tierFilter]);

    useEffect(() => { load(1); }, [load, refreshKey]);

    const tierColor = (p) => tiers.find((t) => t.id === p.tierId || t.label === p.tierName)?.color;

    return (
        <div className={`rounded-2xl border border-white/10 bg-[#161718]/95 p-4 ${className}`}>
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
                    {tiers.filter((c) => c.price != null).map((c) => (
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

            {error ? <p className="text-[13px] text-red-300 py-3">{error}</p> : null}

            <div className="divide-y divide-white/5">
                {participants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                            <p className="text-[13.5px] font-medium truncate">{p.userName || 'Guest'}</p>
                            <p className="text-[11.5px] text-gray-500 mt-0.5 truncate">
                                {p.userPhone || p.userEmail || ''}
                                {p.tierName ? <> · <span style={{ color: tierColor(p) }}>{p.tierName}</span></> : null}
                                {' · '}{formatINR(p.amountPaid)}
                            </p>
                        </div>
                        <StatusPill status={p.paymentStatus} />
                    </div>
                ))}
                {!loading && participants.length === 0 && !error ? (
                    <p className="text-[13px] text-gray-500 text-center py-8">No participants match the filters.</p>
                ) : null}
            </div>

            {pagination.page < pagination.pages ? (
                <button
                    type="button"
                    onClick={() => load(pagination.page + 1)}
                    disabled={loading}
                    className="mt-3 w-full py-2.5 rounded-xl border border-white/10 bg-white/5 text-[13px] font-medium text-[#0ECCEE] hover:border-[#0ECCEE]/40 disabled:opacity-50"
                >
                    {loading ? 'Loading…' : 'Load more'}
                </button>
            ) : null}
            <p className="text-[11px] text-gray-600 mt-3">
                Showing {participants.length} of {pagination.total} participants
            </p>
        </div>
    );
}

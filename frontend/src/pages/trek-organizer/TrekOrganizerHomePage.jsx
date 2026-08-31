import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mountain, MapPin, Phone, Instagram,
    ContactRound, Users, IndianRupee, Clock, Activity, CalendarDays,
} from 'lucide-react';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import {
    fetchTrekOrganizerMe,
    fetchTrekOrganizerDashboard,
} from '../../services/api/trekOrganizer.api';
import { getTrekOrganizerSession, setTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { formatBatchDate, normalizeTrekBatches } from '../../utils/trekDateDisplay';
import { getCoverImageUrl } from '../../utils/coverImages';
import { SectionCard } from './OrganizerUi';

const MAX_DASHBOARD_FETCH = 24;

function railClass({ isOpen, isPast, fillPct, seatsRemaining }) {
    if (isPast) return 'bg-gray-500';
    if (!isOpen) return 'bg-red-500';
    if (fillPct >= 90 || seatsRemaining === 0) return 'bg-amber-400';
    if (fillPct >= 60) return 'bg-amber-500';
    return 'bg-emerald-400';
}

/** Collect departure / booking dates for a trek (multi-date aware). */
function collectTrekDateKeys(trek) {
    const keys = new Set();
    normalizeTrekBatches(trek?.trekBatches, null).forEach((b) => {
        const raw = String(b.date || '').trim();
        if (raw) keys.add(raw);
    });
    const available = trek?.registration?.availableDates;
    if (Array.isArray(available)) {
        available.forEach((d) => {
            const raw = String(d || '').trim();
            if (raw) keys.add(raw);
        });
    }
    return [...keys];
}

function trekHasDate(trek, dateKey) {
    if (!dateKey) return true;
    return collectTrekDateKeys(trek).some((d) => d === dateKey || d.includes(dateKey) || dateKey.includes(d));
}

function trekBucket(trek, stats) {
    const status = String(trek.status || '').toLowerCase();
    const dateKeys = collectTrekDateKeys(trek);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let hasFuture = false;
    let hasAnyParseable = false;
    dateKeys.forEach((raw) => {
        const d = new Date(raw);
        if (!Number.isNaN(d.getTime())) {
            hasAnyParseable = true;
            if (d >= today) hasFuture = true;
        }
    });
    if (!hasAnyParseable && trek.trekDate) {
        const d = new Date(trek.trekDate);
        if (!Number.isNaN(d.getTime())) {
            hasAnyParseable = true;
            if (d >= today) hasFuture = true;
        }
    }

    const isPast = status === 'completed' || status === 'cancelled'
        || (hasAnyParseable && !hasFuture);
    const isOpen = (trek.registration?.status || 'open') === 'open';
    const capacity = Number(stats?.capacity ?? trek.maxParticipants ?? 0);
    const filled = Number(stats?.seatsFilled ?? stats?.booked ?? 0);
    const remaining = stats?.seatsRemaining != null
        ? Number(stats.seatsRemaining)
        : (capacity > 0 ? Math.max(0, capacity - filled) : null);
    const fillPct = capacity > 0 ? Math.min(100, Math.round((filled / capacity) * 100)) : 0;
    const isFull = capacity > 0 && remaining === 0;
    const todayCount = Number(stats?.today ?? 0);

    let filterKey = 'upcoming';
    if (isPast) filterKey = 'past';
    else if (isFull) filterKey = 'full';
    else if (isOpen || todayCount > 0) filterKey = 'live';

    return {
        isPast, isOpen, isFull, capacity, filled, remaining, fillPct, todayCount, filterKey, dateKeys,
    };
}

export default function TrekOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getTrekOrganizerSession();
    const [treks, setTreks] = useState(session?.treks || []);
    const [community, setCommunity] = useState(session?.community || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [trekStats, setTrekStats] = useState({});
    const [statsLoading, setStatsLoading] = useState(false);
    const [filter, setFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const data = await fetchTrekOrganizerMe();
                if (cancelled) return;
                const nextTreks = data.treks || [];
                setTreks(nextTreks);
                setCommunity(data.community || null);
                const current = getTrekOrganizerSession();
                if (current) {
                    setTrekOrganizerSession({
                        ...current,
                        organizer: data.organizer,
                        community: data.community,
                        treks: nextTreks,
                    });
                }
            } catch (e) {
                if (!cancelled) setError(e.message || 'Failed to load community');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!treks.length) {
            setTrekStats({});
            return undefined;
        }
        let cancelled = false;
        const slice = treks.slice(0, MAX_DASHBOARD_FETCH);
        setStatsLoading(true);
        (async () => {
            const entries = await Promise.all(
                slice.map(async (trek) => {
                    try {
                        const dash = await fetchTrekOrganizerDashboard(trek._id);
                        const s = dash?.stats || {};
                        const t = dash?.trek || {};
                        return [
                            String(trek._id),
                            {
                                booked: s.totalRegistrations ?? 0,
                                revenue: Number(s.organizerRevenue ?? s.revenue ?? 0),
                                pending: s.pendingCheckIn ?? Math.max(0, (s.totalRegistrations ?? 0) - (s.checkedIn ?? 0)),
                                pendingReview: Number(s.pendingReview ?? 0),
                                today: s.todayRegistrations ?? 0,
                                seatsFilled: s.seatsFilled ?? s.totalRegistrations ?? 0,
                                seatsRemaining: s.seatsRemaining,
                                capacity: t.capacity ?? s.capacity ?? trek.maxParticipants ?? 0,
                                coverImage: t.coverImage || trek.coverImage,
                                coverImages: t.coverImages || trek.coverImages,
                                images: t.images || trek.images,
                            },
                        ];
                    } catch {
                        return [String(trek._id), null];
                    }
                }),
            );
            if (cancelled) return;
            setTrekStats(Object.fromEntries(entries));
            setStatsLoading(false);
        })();
        return () => { cancelled = true; };
    }, [treks]);

    const enriched = useMemo(() => treks.map((trek) => {
        const stats = trekStats[String(trek._id)];
        const bucket = trekBucket(trek, stats);
        const coverSrc = getCoverImageUrl(
            {
                coverImage: stats?.coverImage || trek.coverImage,
                coverImages: stats?.coverImages || trek.coverImages,
                image: (stats?.images || trek.images)?.[0],
            },
            'cardPortrait',
        );
        return { trek, stats, bucket, coverSrc };
    }), [treks, trekStats]);

    const dateOptions = useMemo(() => {
        const map = new Map();
        treks.forEach((trek) => {
            collectTrekDateKeys(trek).forEach((raw) => {
                if (!map.has(raw)) {
                    map.set(raw, formatBatchDate(raw) || raw);
                }
            });
        });
        return [...map.entries()]
            .map(([value, label]) => ({ value, label }))
            .sort((a, b) => {
                const da = new Date(a.value);
                const db = new Date(b.value);
                if (!Number.isNaN(da.getTime()) && !Number.isNaN(db.getTime())) return da - db;
                return String(a.label).localeCompare(String(b.label));
            });
    }, [treks]);

    const liveStrip = useMemo(() => {
        const openCount = enriched.filter((e) => e.bucket.isOpen && !e.bucket.isPast).length;
        const todayBooked = enriched.reduce((n, e) => n + (e.bucket.todayCount || 0), 0);
        const weekRevenue = enriched.reduce((n, e) => n + Number(e.stats?.revenue || 0), 0);
        return { openCount, todayBooked, collected: weekRevenue };
    }, [enriched]);

    const filtered = useMemo(() => {
        let list = enriched;
        if (filter !== 'all') list = list.filter((e) => e.bucket.filterKey === filter);
        if (dateFilter) list = list.filter((e) => trekHasDate(e.trek, dateFilter));
        return list;
    }, [enriched, filter, dateFilter]);

    const filterChips = [
        { id: 'all', label: 'All' },
        { id: 'live', label: 'Open' },
        { id: 'upcoming', label: 'Upcoming' },
        { id: 'full', label: 'Full' },
        { id: 'past', label: 'Past' },
    ];

    if (loading) {
        return <InlinePageLoader label="Loading community…" variant="trek" />;
    }

    if (error) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="text-sm text-[#0ECCEE] hover:underline"
                >
                    Try again
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-[1600px] mx-auto space-y-5 lg:space-y-6">
            {/* Top band — community + pulse (fills laptop width) */}
            <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3 lg:gap-4">
                {community ? (
                    <SectionCard className="overflow-hidden relative min-h-[140px] lg:min-h-[160px]">
                        {community.coverImage ? (
                            <div
                                className="absolute inset-0 bg-cover bg-center"
                                style={{ backgroundImage: `url(${community.coverImage})` }}
                            />
                        ) : (
                            <div className="absolute inset-0 bg-linear-to-br from-[#053780]/80 via-[#0ECCEE]/20 to-[#0c0d0e]" />
                        )}
                        <div className="absolute inset-0 bg-linear-to-r from-[#0c0d0e]/95 via-[#0c0d0e]/75 to-[#0c0d0e]/35" />
                        <div className="relative p-5 sm:p-6 lg:p-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4 h-full min-h-[140px] lg:min-h-[160px]">
                            <div className="space-y-2 min-w-0">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0ECCEE]">
                                    Organizer home
                                </p>
                                <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-white truncate">
                                    {community.name}
                                </h1>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-300">
                                    {community.basedIn ? (
                                        <span className="inline-flex items-center gap-1.5">
                                            <MapPin size={14} className="text-[#0ECCEE]" /> {community.basedIn}
                                        </span>
                                    ) : null}
                                    <span className="text-gray-500">{treks.length} trek{treks.length === 1 ? '' : 's'}</span>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    {community.contactPhone ? (
                                        <a
                                            href={`tel:${String(community.contactPhone).replace(/\s/g, '')}`}
                                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/15 bg-black/25 text-xs text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE]"
                                        >
                                            <Phone size={12} /> {community.contactPhone}
                                        </a>
                                    ) : null}
                                    {community.contactInstagram ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/15 bg-black/25 text-xs text-gray-400">
                                            <Instagram size={12} /> {community.contactInstagram}
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/trek-organizer/customers')}
                                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold hover:brightness-110"
                            >
                                <ContactRound size={16} />
                                All customers
                            </button>
                        </div>
                    </SectionCard>
                ) : (
                    <SectionCard className="p-6">
                        <h1 className="text-xl font-semibold">Your community</h1>
                        <p className="text-sm text-gray-500 mt-1">No community linked yet.</p>
                    </SectionCard>
                )}

                {treks.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2.5 lg:gap-3">
                        <div className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-3.5 py-4 lg:px-4 lg:py-5 flex flex-col justify-center">
                            <p className="text-[10px] uppercase tracking-wide text-[#0ECCEE]/90 flex items-center gap-1.5 font-medium">
                                <Activity size={12} /> Open
                            </p>
                            <p className="text-2xl lg:text-3xl font-semibold tabular-nums text-white mt-1.5">{liveStrip.openCount}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3.5 py-4 lg:px-4 lg:py-5 flex flex-col justify-center">
                            <p className="text-[10px] uppercase tracking-wide text-emerald-400/90 font-medium">Today</p>
                            <p className="text-2xl lg:text-3xl font-semibold tabular-nums text-emerald-100 mt-1.5">{liveStrip.todayBooked}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-4 lg:px-4 lg:py-5 flex flex-col justify-center min-w-0">
                            <p className="text-[10px] uppercase tracking-wide text-amber-300/90 font-medium">Your money</p>
                            <p className="text-xl lg:text-2xl font-semibold tabular-nums text-amber-50 mt-1.5 truncate">
                                ₹{Number(liveStrip.collected).toLocaleString('en-IN')}
                            </p>
                        </div>
                    </div>
                ) : null}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                <div className="min-w-0">
                    <h2 className="text-lg lg:text-xl font-semibold tracking-tight">Your treks</h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {treks.length === 0
                            ? 'Nothing published yet'
                            : `${filtered.length} shown · tap a card to open dashboard`}
                    </p>
                </div>
                {treks.length > 0 ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 lg:gap-3 min-w-0 lg:max-w-3xl lg:flex-1 lg:justify-end">
                        <div className="flex flex-wrap gap-1.5">
                            {filterChips.map((chip) => (
                                <button
                                    key={chip.id}
                                    type="button"
                                    onClick={() => setFilter(chip.id)}
                                    className={`px-3 py-2 min-h-9 rounded-lg text-xs font-semibold border transition-colors ${
                                        filter === chip.id
                                            ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                            : 'border-white/10 text-gray-400 bg-[#161718] hover:border-[#0ECCEE]/35'
                                    }`}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                        {dateOptions.length > 0 ? (
                            <label className="relative block sm:w-52 shrink-0">
                                <CalendarDays size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                <select
                                    value={dateFilter}
                                    onChange={(e) => setDateFilter(e.target.value)}
                                    className="w-full appearance-none pl-9 pr-8 py-2.5 min-h-10 rounded-lg bg-[#161718] border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-[#0ECCEE]/50"
                                >
                                    <option value="">All dates</option>
                                    {dateOptions.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {/* Portrait grid — fills laptop in clean rows */}
            {treks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-500 text-sm bg-white/5">
                    No treks in this community yet.
                </div>
            ) : (
                <>
                    {statsLoading && Object.keys(trekStats).length === 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-3.5">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <div key={i} className="rounded-xl border border-white/10 overflow-hidden animate-pulse">
                                    <div className="aspect-[10/13] bg-white/5" />
                                    <div className="p-2 space-y-1.5">
                                        <div className="h-2.5 w-3/4 rounded bg-white/10" />
                                        <div className="h-2 w-1/2 rounded bg-white/5" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 lg:gap-3.5">
                        {filtered.map(({ trek, stats, bucket, coverSrc }, index) => (
                            <button
                                key={trek._id}
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${trek._id}`)}
                                style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
                                className="group relative flex flex-col rounded-xl overflow-hidden border border-white/10 bg-[#161718] text-left hover:border-[#0ECCEE]/50 hover:shadow-[0_8px_28px_rgba(0,0,0,0.35)] active:scale-[0.98] transition-all duration-200 animate-[fadeUp_0.35s_ease_both]"
                            >
                                <span className={`absolute left-0 top-0 bottom-0 w-0.5 z-10 ${railClass(bucket)}`} />
                                <div className="relative aspect-[10/13] w-full overflow-hidden bg-[#1A1B1D]">
                                    {coverSrc ? (
                                        <img
                                            src={coverSrc}
                                            alt=""
                                            className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                        />
                                    ) : (
                                        <div className="absolute inset-0 bg-linear-to-br from-[#053780]/70 via-[#0ECCEE]/15 to-[#141516] flex items-center justify-center">
                                            <Mountain className="text-[#0ECCEE]/45" size={22} />
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-transparent" />
                                    {bucket.todayCount > 0 ? (
                                        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[#0ECCEE] text-[8px] font-bold text-black tabular-nums">
                                            +{bucket.todayCount}
                                        </span>
                                    ) : null}
                                    <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8">
                                        <p className="text-[12px] lg:text-[13px] font-semibold text-white leading-snug line-clamp-2">
                                            {trek.trekName}
                                        </p>
                                        {trek.city ? (
                                            <p className="text-[9px] text-gray-300 mt-0.5 truncate">{trek.city}</p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="px-2 py-1.5 space-y-1 border-t border-white/5">
                                    <span className={`inline-block px-1.5 py-px rounded text-[8px] font-semibold border ${
                                        bucket.isOpen && !bucket.isPast
                                            ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                                            : bucket.isPast
                                                ? 'bg-white/5 text-gray-400 border-white/10'
                                                : 'bg-red-500/10 text-red-300 border-red-500/25'
                                    }`}>
                                        {bucket.isPast ? 'Past' : bucket.isOpen ? 'Open' : 'Closed'}
                                    </span>

                                    {stats ? (
                                        <div className="flex items-center justify-between gap-1 text-[10px] tabular-nums">
                                            <span className="inline-flex items-center gap-0.5 text-gray-300" title="Booked">
                                                <Users size={9} className="text-gray-500" />
                                                {stats.booked}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-emerald-300/90" title="Collected">
                                                <IndianRupee size={9} />
                                                {Number(stats.revenue) >= 1000
                                                    ? `${(Number(stats.revenue) / 1000).toFixed(Number(stats.revenue) >= 10000 ? 0 : 1)}k`
                                                    : Number(stats.revenue)}
                                            </span>
                                            <span className="inline-flex items-center gap-0.5 text-amber-200/90" title="Pending">
                                                <Clock size={9} />
                                                {stats.pendingReview > 0 ? stats.pendingReview : stats.pending}
                                            </span>
                                        </div>
                                    ) : statsLoading ? (
                                        <div className="h-3 rounded bg-white/5 animate-pulse" />
                                    ) : null}

                                    {stats && bucket.capacity > 0 ? (
                                        <div className="h-1 rounded-full bg-black/40 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-[#0ECCEE]/80"
                                                style={{ width: `${bucket.fillPct}%` }}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            </button>
                        ))}
                    </div>

                    {filtered.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-500 text-sm">
                            No treks match this filter{dateFilter ? ' / date' : ''}.
                            {(dateFilter || filter !== 'all') ? (
                                <button
                                    type="button"
                                    onClick={() => { setFilter('all'); setDateFilter(''); }}
                                    className="block mx-auto mt-2 text-[#0ECCEE] text-xs font-medium"
                                >
                                    Clear filters
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </>
            )}

            <style>{`
                @keyframes fadeUp {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

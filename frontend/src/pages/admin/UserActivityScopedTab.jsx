import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    CheckCircle2, Eye, Filter, Loader2, MapPin, Search, Trophy, Users,
} from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';

function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function StatPill({ label, value }) {
    return (
        <div className="rounded-xl border border-white/8 bg-[#121316] px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
            <p className="text-lg font-bold text-white mt-0.5">{value}</p>
        </div>
    );
}

/**
 * Fest → competition → page visitor activity + who registered / checked in.
 */
export default function UserActivityScopedTab({
    rangeQuery,
    buildRangeParams,
    openUserHistory,
}) {
    const [fests, setFests] = useState([]);
    const [festId, setFestId] = useState('');
    const [competitionId, setCompetitionId] = useState('');
    const [pageFilter, setPageFilter] = useState('');
    const [appliedPage, setAppliedPage] = useState('');
    const [loggedInOnly, setLoggedInOnly] = useState(false);
    const [subTab, setSubTab] = useState('visitors');
    const [visitorPage, setVisitorPage] = useState(1);

    const [loadingFests, setLoadingFests] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState(null);
    const [competitions, setCompetitions] = useState([]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoadingFests(true);
            try {
                const res = await adminFetchJSON('/admin/fests?limit=500');
                const list = Array.isArray(res?.fests) ? res.fests : Array.isArray(res) ? res : [];
                if (!cancelled) setFests(list);
            } catch (err) {
                if (!cancelled) setError(err.message || 'Failed to load fests');
            } finally {
                if (!cancelled) setLoadingFests(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        let cancelled = false;
        if (!festId) {
            setCompetitions([]);
            return undefined;
        }
        (async () => {
            try {
                const res = await adminFetchJSON(`/admin/fests/${festId}/competitions`);
                const list = Array.isArray(res?.competitions) ? res.competitions : [];
                if (!cancelled) {
                    setCompetitions(list.map((c) => ({
                        id: String(c._id || c.id),
                        name: c.name || 'Competition',
                    })));
                }
            } catch {
                if (!cancelled) setCompetitions([]);
            }
        })();
        return () => { cancelled = true; };
    }, [festId]);

    const festOptions = useMemo(
        () => [...fests].sort((a, b) => String(a.festName || '').localeCompare(String(b.festName || ''))),
        [fests],
    );

    const fetchScoped = useCallback(async () => {
        if (!festId && !competitionId && !appliedPage) {
            setData(null);
            return;
        }
        setLoading(true);
        setError('');
        try {
            const params = buildRangeParams();
            if (festId) params.set('festId', festId);
            if (competitionId) params.set('competitionId', competitionId);
            if (appliedPage.trim()) params.set('page', appliedPage.trim());
            if (loggedInOnly) params.set('loggedInOnly', 'true');
            params.set('visitorPage', String(visitorPage));
            params.set('visitorLimit', '50');
            const res = await adminFetchJSON(`/admin/user-activity/scoped?${params}`);
            setData(res);
        } catch (err) {
            setError(err.message || 'Failed to load fest activity');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [festId, competitionId, appliedPage, loggedInOnly, visitorPage, buildRangeParams]);

    useEffect(() => {
        fetchScoped();
    }, [fetchScoped, rangeQuery]);

    useEffect(() => {
        setVisitorPage(1);
        setCompetitionId('');
        setAppliedPage('');
        setPageFilter('');
        setSubTab('visitors');
    }, [festId]);

    useEffect(() => {
        setVisitorPage(1);
    }, [competitionId, appliedPage, loggedInOnly]);

    const stats = data?.stats || {};
    const regStats = data?.registrationStats || {};
    const visitors = data?.visitors || [];
    const registrations = data?.registrations || [];
    const checkedIn = registrations.filter((r) => r.checkedIn);
    const topPages = data?.topPages || [];
    const competitionBreakdown = data?.competitionBreakdown || [];
    const pagination = data?.visitorPagination || { page: 1, totalPages: 1, total: 0 };

    const applyPageFilter = (e) => {
        e.preventDefault();
        setAppliedPage(pageFilter.trim());
        setVisitorPage(1);
    };

    return (
        <div className="space-y-4">
            <div className="rounded-xl border border-white/8 bg-[#17181A] p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Filter size={14} className="text-[#0ECCEE]" />
                    Fest · competition · page activity
                </div>
                <p className="text-xs text-gray-500">
                    See who visited fest/competition pages, and who registered or checked in.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <label className="block text-xs text-gray-500">
                        Fest
                        <select
                            value={festId}
                            disabled={loadingFests}
                            onChange={(e) => setFestId(e.target.value)}
                            className="mt-1 h-9 w-full px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40"
                        >
                            <option value="">Select a fest…</option>
                            {festOptions.map((f) => (
                                <option key={f._id || f.id} value={f._id || f.id}>
                                    {f.festName || 'Untitled fest'}
                                    {f.collegeName ? ` · ${f.collegeName}` : ''}
                                </option>
                            ))}
                        </select>
                    </label>

                    <label className="block text-xs text-gray-500">
                        Competition
                        <select
                            value={competitionId}
                            disabled={!festId}
                            onChange={(e) => setCompetitionId(e.target.value)}
                            className="mt-1 h-9 w-full px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40 disabled:opacity-40"
                        >
                            <option value="">All competitions</option>
                            {competitions.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </label>

                    <form onSubmit={applyPageFilter} className="block text-xs text-gray-500 sm:col-span-2 lg:col-span-1">
                        Page path
                        <div className="mt-1 relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                            <input
                                type="text"
                                value={pageFilter}
                                onChange={(e) => setPageFilter(e.target.value)}
                                placeholder="/competitions-view-details/…"
                                className="h-9 w-full pl-9 pr-3 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                            />
                        </div>
                    </form>

                    <label className="flex items-end gap-2 text-xs text-gray-400 pb-2">
                        <input
                            type="checkbox"
                            checked={loggedInOnly}
                            onChange={(e) => setLoggedInOnly(e.target.checked)}
                            className="rounded border-white/20"
                        />
                        Logged-in visitors only
                    </label>
                </div>

                {(festId || appliedPage) && (
                    <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                        {data?.scope?.festName && (
                            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8 text-gray-300">
                                Fest: {data.scope.festName}
                            </span>
                        )}
                        {data?.scope?.competitionName && (
                            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8 text-gray-300">
                                Competition: {data.scope.competitionName}
                            </span>
                        )}
                        {appliedPage && (
                            <span className="px-2 py-1 rounded-md bg-white/5 border border-white/8 text-gray-300">
                                Page: {appliedPage}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {error && (
                <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    {error}
                </div>
            )}

            {!festId && !appliedPage ? (
                <div className="rounded-xl border border-dashed border-white/10 bg-[#121316] px-6 py-12 text-center">
                    <Trophy size={28} className="mx-auto text-gray-600 mb-3" />
                    <p className="text-sm text-gray-400">Pick a fest to see who visited and who came.</p>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
                    <Loader2 size={16} className="animate-spin text-[#0ECCEE]" />
                    Loading fest activity…
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
                        <StatPill label="Unique visitors" value={(stats.uniqueVisitors || 0).toLocaleString('en-IN')} />
                        <StatPill label="Page views" value={(stats.pageViews || 0).toLocaleString('en-IN')} />
                        <StatPill label="Fest views" value={(stats.festViews || 0).toLocaleString('en-IN')} />
                        <StatPill label="Competition views" value={(stats.competitionViews || 0).toLocaleString('en-IN')} />
                        <StatPill label="Checked in" value={(regStats.checkedIn || 0).toLocaleString('en-IN')} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {[
                            { id: 'visitors', label: 'Visitors', icon: Eye },
                            { id: 'pages', label: 'Pages', icon: MapPin },
                            { id: 'competitions', label: 'By competition', icon: Trophy },
                            { id: 'came', label: 'Who came (check-in)', icon: CheckCircle2 },
                            { id: 'registered', label: 'Registrations', icon: Users },
                        ].map((t) => (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setSubTab(t.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    subTab === t.id
                                        ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30'
                                        : 'bg-[#121316] text-gray-400 border border-white/8 hover:text-white'
                                }`}
                            >
                                <t.icon size={13} />
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {subTab === 'visitors' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Users who visited · {pagination.total?.toLocaleString('en-IN') || 0}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[720px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5">User</th>
                                            <th className="px-4 py-2.5 text-right">Visits</th>
                                            <th className="px-4 py-2.5 text-right">Page views</th>
                                            <th className="px-4 py-2.5">Last page</th>
                                            <th className="px-4 py-2.5 text-right">Last seen</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visitors.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-10 text-center text-gray-600">
                                                    No visitors for this scope yet. Views start tracking when users open fest/competition pages.
                                                </td>
                                            </tr>
                                        ) : visitors.map((v) => (
                                            <tr
                                                key={v.key}
                                                className={`border-b border-white/5 hover:bg-white/2 ${v.email ? 'cursor-pointer' : ''}`}
                                                onClick={() => v.email && openUserHistory?.(v.email)}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{v.name || (v.isGuest ? 'Guest' : '—')}</p>
                                                    <p className="text-[#0ECCEE] text-xs truncate">
                                                        {v.email || v.key}
                                                    </p>
                                                    {v.devices?.length > 0 && (
                                                        <p className="text-gray-600 text-[10px] capitalize">{v.devices.join(', ')}</p>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-300">{v.visits}</td>
                                                <td className="px-4 py-3 text-right text-gray-400">{v.pageViews}</td>
                                                <td className="px-4 py-3 text-gray-500 text-xs truncate max-w-[220px]" title={v.lastPage}>
                                                    {v.lastPage || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500 whitespace-nowrap text-xs">
                                                    {formatDateTime(v.lastVisitedAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {pagination.totalPages > 1 && (
                                <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between text-xs text-gray-500">
                                    <button
                                        type="button"
                                        disabled={visitorPage <= 1}
                                        onClick={() => setVisitorPage((p) => Math.max(1, p - 1))}
                                        className="px-2 py-1 rounded border border-white/8 disabled:opacity-40"
                                    >
                                        Prev
                                    </button>
                                    <span>Page {pagination.page} / {pagination.totalPages}</span>
                                    <button
                                        type="button"
                                        disabled={visitorPage >= pagination.totalPages}
                                        onClick={() => setVisitorPage((p) => p + 1)}
                                        className="px-2 py-1 rounded border border-white/8 disabled:opacity-40"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {subTab === 'pages' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Pages under this scope
                            </div>
                            <div className="divide-y divide-white/5">
                                {topPages.length === 0 ? (
                                    <p className="px-4 py-10 text-center text-sm text-gray-600">No page hits yet</p>
                                ) : topPages.map((p) => (
                                    <button
                                        key={p.page}
                                        type="button"
                                        onClick={() => {
                                            setPageFilter(p.page);
                                            setAppliedPage(p.page);
                                            setSubTab('visitors');
                                        }}
                                        className="w-full px-4 py-3 flex items-start justify-between gap-3 text-left hover:bg-white/2"
                                    >
                                        <span className="text-sm text-gray-300 break-all">{p.page}</span>
                                        <span className="text-xs text-gray-500 shrink-0">
                                            {p.views} hits · {p.uniqueVisitors} visitors
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {subTab === 'competitions' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Competition-wise visitors
                            </div>
                            {competitionId ? (
                                <p className="px-4 py-8 text-center text-sm text-gray-600">
                                    Clear the competition filter to compare all competitions in this fest.
                                </p>
                            ) : competitionBreakdown.length === 0 ? (
                                <p className="px-4 py-10 text-center text-sm text-gray-600">
                                    No competition-tagged views yet. Open competition detail pages to start collecting this.
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm min-w-[560px]">
                                        <thead>
                                            <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                                <th className="px-4 py-2.5">Competition</th>
                                                <th className="px-4 py-2.5 text-right">Views</th>
                                                <th className="px-4 py-2.5 text-right">Unique visitors</th>
                                                <th className="px-4 py-2.5 text-right">Last seen</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {competitionBreakdown.map((row) => (
                                                <tr
                                                    key={row.competitionId}
                                                    className="border-b border-white/5 hover:bg-white/2 cursor-pointer"
                                                    onClick={() => setCompetitionId(String(row.competitionId))}
                                                >
                                                    <td className="px-4 py-3 text-white">
                                                        {row.competitionName || row.competitionId}
                                                    </td>
                                                    <td className="px-4 py-3 text-right text-gray-300">{row.views}</td>
                                                    <td className="px-4 py-3 text-right text-gray-400">{row.uniqueVisitors}</td>
                                                    <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                                                        {formatDateTime(row.lastVisitedAt)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {subTab === 'came' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between gap-2">
                                <span className="text-sm font-bold text-white">
                                    Checked in · {regStats.checkedIn || 0}
                                </span>
                                <span className="text-[10px] text-gray-500">
                                    Pending check-in: {regStats.pendingCheckIn || 0}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[640px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5">User</th>
                                            <th className="px-4 py-2.5">Competition</th>
                                            <th className="px-4 py-2.5 text-right">Checked in at</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {checkedIn.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="px-4 py-10 text-center text-gray-600">
                                                    Nobody checked in for this scope yet
                                                </td>
                                            </tr>
                                        ) : checkedIn.map((r) => (
                                            <tr
                                                key={r.id}
                                                className={`border-b border-white/5 hover:bg-white/2 ${r.user?.email ? 'cursor-pointer' : ''}`}
                                                onClick={() => r.user?.email && openUserHistory?.(r.user.email)}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{r.user?.name || '—'}</p>
                                                    <p className="text-[#0ECCEE] text-xs">{r.user?.email || '—'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {r.competitionName || 'Fest registration'}
                                                </td>
                                                <td className="px-4 py-3 text-right text-emerald-400 text-xs whitespace-nowrap">
                                                    {formatDateTime(r.checkedInAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {subTab === 'registered' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Registrations · {regStats.total || 0}
                                <span className="text-gray-500 font-normal text-xs ml-2">
                                    {regStats.approved || 0} approved
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[720px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5">User</th>
                                            <th className="px-4 py-2.5">Competition</th>
                                            <th className="px-4 py-2.5">Status</th>
                                            <th className="px-4 py-2.5">Check-in</th>
                                            <th className="px-4 py-2.5 text-right">Registered</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {registrations.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-10 text-center text-gray-600">
                                                    No registrations for this scope
                                                </td>
                                            </tr>
                                        ) : registrations.map((r) => (
                                            <tr
                                                key={r.id}
                                                className={`border-b border-white/5 hover:bg-white/2 ${r.user?.email ? 'cursor-pointer' : ''}`}
                                                onClick={() => r.user?.email && openUserHistory?.(r.user.email)}
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{r.user?.name || '—'}</p>
                                                    <p className="text-[#0ECCEE] text-xs">{r.user?.email || '—'}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 text-xs">
                                                    {r.competitionName || 'Fest registration'}
                                                </td>
                                                <td className="px-4 py-3 text-xs capitalize text-gray-300">{r.status}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    {r.checkedIn ? (
                                                        <span className="text-emerald-400">Checked in</span>
                                                    ) : (
                                                        <span className="text-gray-600">Not yet</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500 text-xs whitespace-nowrap">
                                                    {formatDateTime(r.registeredAt)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

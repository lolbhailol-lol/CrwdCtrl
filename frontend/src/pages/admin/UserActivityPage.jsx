import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Activity, AlertCircle, CalendarRange, ChevronLeft, ChevronRight, Clock,
    Eye, Globe, Heart, Loader2, LogIn, Mail, Monitor, MousePointerClick, RefreshCw,
    Search, Smartphone, Tablet, Ticket, TrendingUp, User, Users, Wallet,
} from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const RANGE_OPTIONS = [
    { id: 'all-time', label: 'All time' },
    { id: 'since-dec', label: 'Since 1 Dec' },
    { id: '7', label: 'Last 7 days' },
    { id: '30', label: 'Last 30 days' },
    { id: '90', label: 'Last 90 days' },
    { id: 'custom', label: 'Custom range' },
];

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'daily', label: 'Daily' },
    { id: 'all-users', label: 'All users' },
    { id: 'logins', label: 'Logins' },
    { id: 'activity', label: 'Activity feed' },
    { id: 'user', label: 'User history' },
];

const TIMELINE_CATEGORY_STYLE = {
    account: 'bg-purple-500/15 text-purple-300',
    login: 'bg-[#0ECCEE]/15 text-[#0ECCEE]',
    activity: 'bg-white/8 text-gray-300',
    registration: 'bg-emerald-500/15 text-emerald-400',
    booking: 'bg-amber-500/15 text-amber-400',
    payment: 'bg-green-500/15 text-green-400',
    notification: 'bg-blue-500/15 text-blue-400',
    follow: 'bg-pink-500/15 text-pink-400',
};

const METHOD_BADGE = {
    password: 'bg-white/8 text-gray-300',
    google: 'bg-red-500/15 text-red-400',
    facebook: 'bg-blue-500/15 text-blue-400',
    twitter: 'bg-sky-500/15 text-sky-400',
    firebase: 'bg-amber-500/15 text-amber-400',
};

const CHURN_TONE = {
    success: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    warning: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    danger: 'text-red-400 bg-red-500/15 border-red-500/30',
    neutral: 'text-gray-400 bg-white/5 border-white/10',
};

const STATUS_BADGE = {
    approved: 'text-emerald-400',
    confirmed: 'text-emerald-400',
    paid: 'text-emerald-400',
    PAID: 'text-emerald-400',
    pending: 'text-amber-400',
    PENDING: 'text-amber-400',
    rejected: 'text-red-400',
    cancelled: 'text-red-400',
    FAILED: 'text-red-400',
    EXPIRED: 'text-gray-500',
    free: 'text-gray-400',
};

function formatDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDayLabel(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDuration(seconds) {
    const s = Math.max(0, Math.round(Number(seconds) || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

function StatCard({ icon: Icon, label, value, sub }) {
    return (
        <div className="rounded-xl border border-white/8 bg-[#121316] p-4">
            <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
                <Icon size={14} className="text-[#0ECCEE]" />
                {label}
            </div>
            <div className="text-2xl font-bold text-white">{value}</div>
            {sub && <div className="text-[11px] text-gray-600 mt-1">{sub}</div>}
        </div>
    );
}

function DeviceBreakdown({ devices }) {
    const icons = { desktop: Monitor, mobile: Smartphone, tablet: Tablet };
    const total = Object.values(devices || {}).reduce((a, b) => a + b, 0) || 1;
    return (
        <div className="space-y-2">
            {Object.entries(devices || {}).map(([device, count]) => {
                const Icon = icons[device] || Globe;
                const pct = Math.round((count / total) * 100);
                return (
                    <div key={device} className="flex items-center gap-2 text-sm">
                        <Icon size={14} className="text-gray-500 shrink-0" />
                        <span className="text-gray-400 capitalize w-16">{device}</span>
                        <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full bg-[#0ECCEE] rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-gray-300 text-xs w-10 text-right">{pct}%</span>
                    </div>
                );
            })}
        </div>
    );
}

export default function UserActivityPage() {
    const [range, setRange] = useState('all-time');
    const [startDate, setStartDate] = useState('2025-12-01');
    const [endDate, setEndDate] = useState(todayIsoDate());
    const [tab, setTab] = useState('overview');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [lookupEmail, setLookupEmail] = useState('');
    const [rangeLabel, setRangeLabel] = useState('All time');
    const [backfillNote, setBackfillNote] = useState('');
    const [backfilling, setBackfilling] = useState(false);

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [overview, setOverview] = useState(null);
    const [daily, setDaily] = useState([]);
    const [logins, setLogins] = useState([]);
    const [loginPagination, setLoginPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [activity, setActivity] = useState([]);
    const [activityPagination, setActivityPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [fullHistory, setFullHistory] = useState(null);
    const [allUsers, setAllUsers] = useState([]);
    const [allUsersPagination, setAllUsersPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [allUsersSearch, setAllUsersSearch] = useState('');
    const [debouncedAllUsersSearch, setDebouncedAllUsersSearch] = useState('');
    const [allUsersPage, setAllUsersPage] = useState(1);
    const [allUsersSort, setAllUsersSort] = useState('createdAt');
    const [loginPage, setLoginPage] = useState(1);
    const [activityPage, setActivityPage] = useState(1);
    const backfillOnce = useRef(false);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedAllUsersSearch(allUsersSearch), 350);
        return () => clearTimeout(t);
    }, [allUsersSearch]);

    useEffect(() => { setAllUsersPage(1); }, [debouncedAllUsersSearch, allUsersSort]);

    useEffect(() => { setLoginPage(1); setActivityPage(1); }, [debouncedSearch, range, startDate, endDate, tab]);

    const openUserHistory = useCallback((email) => {
        if (!email) return;
        setUserEmail(email);
        setLookupEmail(email);
        setTab('user');
    }, []);

    const fetchFullHistory = useCallback(async (email) => {
        if (!email.trim()) return;
        const data = await adminFetchJSON(
            `/admin/user-activity/full-history?email=${encodeURIComponent(email.trim())}`,
        );
        setFullHistory(data);
    }, []);

    const fetchAllUsers = useCallback(async () => {
        const params = new URLSearchParams({
            page: String(allUsersPage),
            limit: '50',
            sort: allUsersSort,
        });
        if (debouncedAllUsersSearch.trim()) params.set('search', debouncedAllUsersSearch.trim());
        const data = await adminFetchJSON(`/admin/user-activity/all-users?${params}`);
        setAllUsers(data.users || []);
        setAllUsersPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
    }, [allUsersPage, debouncedAllUsersSearch, allUsersSort]);

    const buildRangeQuery = useCallback(() => {
        if (range === 'custom') {
            return `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
        }
        return `range=${encodeURIComponent(range)}`;
    }, [range, startDate, endDate]);

    const buildRangeParams = useCallback(() => {
        const params = new URLSearchParams();
        if (range === 'custom') {
            params.set('startDate', startDate);
            params.set('endDate', endDate);
        } else {
            params.set('range', range);
        }
        return params;
    }, [range, startDate, endDate]);

    const rangeQuery = buildRangeQuery();

    const handlePresetChange = (next) => {
        setRange(next);
        if (next === 'since-dec') {
            setStartDate('2025-12-01');
            setEndDate(todayIsoDate());
        }
    };

    const isAllTimeRange = range === 'all-time';

    const runBackfill = useCallback(async (force = false) => {
        setBackfilling(true);
        setBackfillNote('');
        try {
            const data = await adminFetchJSON('/admin/user-activity/backfill', {
                method: 'POST',
                body: JSON.stringify({ force }),
            });
            if (data.skipped) {
                setBackfillNote('Historical data already imported.');
            } else {
                setBackfillNote(
                    `Imported ${data.activityInserted || 0} activity events and ${data.loginInserted || 0} login records since ${formatDayLabel(data.since?.slice(0, 10))}.`,
                );
            }
        } catch (err) {
            setBackfillNote(err.message || 'Backfill failed');
        } finally {
            setBackfilling(false);
        }
    }, []);

    const fetchOverview = useCallback(async () => {
        const data = await adminFetchJSON(`/admin/user-activity/overview?${rangeQuery}`);
        setOverview(data);
        if (data.range?.label) setRangeLabel(data.range.label);
    }, [rangeQuery]);

    const fetchDaily = useCallback(async () => {
        const data = await adminFetchJSON(`/admin/user-activity/daily?${rangeQuery}`);
        setDaily(data.daily || []);
        if (data.range?.label) setRangeLabel(data.range.label);
    }, [rangeQuery]);

    const fetchLogins = useCallback(async () => {
        const params = buildRangeParams();
        params.set('page', String(loginPage));
        params.set('limit', '50');
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        const data = await adminFetchJSON(`/admin/user-activity/logins?${params}`);
        setLogins(data.logins || []);
        setLoginPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        if (data.range?.label) setRangeLabel(data.range.label);
    }, [buildRangeParams, loginPage, debouncedSearch]);

    const fetchActivity = useCallback(async () => {
        const params = buildRangeParams();
        params.set('page', String(activityPage));
        params.set('limit', '50');
        if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
        const data = await adminFetchJSON(`/admin/user-activity/feed?${params}`);
        setActivity(data.activity || []);
        setActivityPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        if (data.range?.label) setRangeLabel(data.range.label);
    }, [buildRangeParams, activityPage, debouncedSearch]);

    const loadTab = useCallback(async ({ skipBackfill = false } = {}) => {
        setLoading(true);
        setError('');
        try {
            if (tab === 'overview') await fetchOverview();
            else if (tab === 'daily') await fetchDaily();
            else if (tab === 'all-users') await fetchAllUsers();
            else if (tab === 'logins') await fetchLogins();
            else if (tab === 'activity') await fetchActivity();
            else if (tab === 'user' && lookupEmail) await fetchFullHistory(lookupEmail);
        } catch (err) {
            setError(err.message || 'Failed to load user activity');
        } finally {
            setLoading(false);
        }

        if (!skipBackfill && !backfillOnce.current) {
            backfillOnce.current = true;
            runBackfill(false).then(() => loadTab({ skipBackfill: true }));
        }
    }, [tab, fetchOverview, fetchDaily, fetchAllUsers, fetchLogins, fetchActivity, fetchFullHistory, lookupEmail, runBackfill]);

    useEffect(() => { loadTab(); }, [loadTab]);

    const stats = overview?.stats || {
        totalLogins: 0,
        uniqueUsersLoggedIn: 0,
        totalRegisteredUsers: 0,
        neverLoggedIn: 0,
        loginRate: 0,
        totalPageViews: 0,
        internalPageViews: 0,
        loggedInPageViews: 0,
        uniqueActiveUsers: 0,
        uniqueSessions: 0,
        totalEngagementFormatted: '0s',
        avgEngagementPerPage: '0s',
        avgPagesPerSession: 0,
    };

    const traffic = overview?.traffic || {
        pageViews: stats.totalPageViews,
        sessions: stats.uniqueSessions,
        siteVisitors: stats.uniqueActiveUsers,
        avgSessionDuration: stats.totalEngagementFormatted,
        avgPagesPerSession: stats.avgPagesPerSession,
        bounceRate: stats.bounceRate,
        newVisitors: stats.newUsers,
    };

    const trafficFromGa = overview?.trafficSource === 'google_analytics';

    const headerSummary = useMemo(() => {
        if (!traffic?.pageViews) return '';
        return `${traffic.pageViews?.toLocaleString('en-IN')} page views · ${traffic.siteVisitors?.toLocaleString('en-IN')} visitors · ${traffic.sessions?.toLocaleString('en-IN')} sessions · ${traffic.avgSessionDuration || '—'} avg session`;
    }, [traffic]);

    const handleUserLookup = (e) => {
        e.preventDefault();
        setLookupEmail(userEmail.trim());
    };

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity size={24} className="text-[#0ECCEE]" />
                        User Activity
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {rangeLabel} · Site traffic from Google Analytics
                    </p>
                    {isAllTimeRange && tab === 'overview' && (
                        <p className="text-xs text-gray-600 mt-1">All-time site traffic totals</p>
                    )}
                    {trafficFromGa && (
                        <p className="text-xs text-emerald-400 mt-1">Showing Google Analytics data for this date range</p>
                    )}
                    {overview?.ga?.error && (
                        <p className="text-xs text-amber-400 mt-1">GA error: {overview.ga.error}</p>
                    )}
                    {tab === 'overview' && headerSummary && (
                        <p className="text-xs text-gray-600 mt-1">{headerSummary}</p>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <select
                        value={range}
                        onChange={(e) => handlePresetChange(e.target.value)}
                        className="h-9 px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40"
                    >
                        {RANGE_OPTIONS.map((d) => (
                            <option key={d.id} value={d.id} className="bg-[#0D0E10]">{d.label}</option>
                        ))}
                    </select>
                    <input
                        type="date"
                        value={startDate}
                        disabled={isAllTimeRange}
                        onChange={(e) => { setStartDate(e.target.value); setRange('custom'); }}
                        className="h-9 px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40 disabled:opacity-40"
                    />
                    <span className="text-gray-600 text-sm">→</span>
                    <input
                        type="date"
                        value={endDate}
                        disabled={isAllTimeRange}
                        onChange={(e) => { setEndDate(e.target.value); setRange('custom'); }}
                        className="h-9 px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40 disabled:opacity-40"
                    />
                    <button
                        type="button"
                        onClick={() => loadTab({ skipBackfill: true })}
                        className="h-9 px-3 rounded-lg border border-white/8 text-gray-300 hover:bg-white/5 flex items-center gap-1.5 text-sm"
                    >
                        <RefreshCw size={14} /> Refresh
                    </button>
                    <button
                        type="button"
                        disabled={backfilling}
                        onClick={() => {
                            backfillOnce.current = false;
                            runBackfill(true).then(() => loadTab({ skipBackfill: true }));
                        }}
                        className="h-9 px-3 rounded-lg border border-white/8 text-gray-300 hover:bg-white/5 flex items-center gap-1.5 text-sm disabled:opacity-50"
                    >
                        {backfilling ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Import history
                    </button>
                </div>
            </div>

            {backfillNote && (
                <div className="px-4 py-2.5 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-sm text-[#0ECCEE]">
                    {backfillNote}
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="text-xs underline">Dismiss</button>
                </div>
            )}

            <div className="flex flex-wrap gap-2">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => setTab(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            tab === t.id
                                ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30'
                                : 'bg-[#121316] text-gray-400 border border-white/8 hover:text-white'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {(tab === 'logins' || tab === 'activity' || tab === 'all-users') && (
                <div className="relative max-w-md">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                        type="text"
                        value={tab === 'all-users' ? allUsersSearch : search}
                        onChange={(e) => (tab === 'all-users' ? setAllUsersSearch(e.target.value) : setSearch(e.target.value))}
                        placeholder={tab === 'all-users' ? 'Search all users by name, email, phone…' : 'Filter by email…'}
                        className="h-9 w-full pl-9 pr-3 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                    />
                </div>
            )}

            {loading ? (
                <InlinePageLoader label="Loading user activity…" minHeight={false} />
            ) : (
                <>
                    {tab === 'overview' && (
                        <div className="space-y-5">
                            {!overview && (
                                <p className="text-sm text-gray-500">Could not load overview — check backend is running and Google Analytics is connected.</p>
                            )}

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                                <StatCard icon={Eye} label="Page views" value={traffic.pageViews?.toLocaleString('en-IN')} sub={trafficFromGa ? 'Google Analytics' : 'Internal tracking'} />
                                <StatCard icon={Users} label="Site visitors" value={traffic.siteVisitors?.toLocaleString('en-IN')} sub="Unique visitors" />
                                <StatCard icon={Globe} label="Sessions" value={traffic.sessions?.toLocaleString('en-IN')} />
                                <StatCard icon={TrendingUp} label="New visitors" value={traffic.newVisitors?.toLocaleString('en-IN') ?? '—'} sub="First-time visitors" />
                                <StatCard icon={Clock} label="Avg session" value={traffic.avgSessionDuration || '—'} sub={traffic.bounceRate ? `Bounce ${traffic.bounceRate}` : undefined} />
                                <StatCard icon={MousePointerClick} label="Avg pages / session" value={traffic.avgPagesPerSession ?? '—'} />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                    <h3 className="text-sm font-bold text-white mb-3">Top pages</h3>
                                    {overview?.topPages?.length ? (
                                        <div className="space-y-2">
                                            {overview.topPages.map((p) => (
                                                <div key={p.page} className="flex items-start justify-between gap-2 text-xs">
                                                    <span className="text-gray-300 truncate flex-1" title={p.page}>{p.page}</span>
                                                    <span className="text-gray-500 shrink-0">{p.views} views · {p.engagementFormatted}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-gray-600">No page data for this range</p>
                                    )}
                                </div>

                                <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                    <h3 className="text-sm font-bold text-white mb-3">Devices</h3>
                                    <DeviceBreakdown devices={overview?.devices} />
                                </div>
                            </div>
                        </div>
                    )}

                    {tab === 'daily' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <CalendarRange size={16} className="text-[#0ECCEE]" />
                                    <span className="text-sm font-bold text-white">Date-wise breakdown</span>
                                </div>
                                <span className="text-[10px] text-gray-500">Page views & sessions from Google Analytics · Logins from CrwdCtrl</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[720px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5">Date</th>
                                            <th className="px-4 py-2.5 text-right">Logins</th>
                                            <th className="px-4 py-2.5 text-right">Unique logins</th>
                                            <th className="px-4 py-2.5 text-right">Page views</th>
                                            <th className="px-4 py-2.5 text-right">Active users</th>
                                            <th className="px-4 py-2.5 text-right">Sessions</th>
                                            <th className="px-4 py-2.5 text-right">Engagement</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {daily.length === 0 ? (
                                            <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">No daily data for this range — click Import history to pull legacy analytics</td></tr>
                                        ) : daily.map((d) => (
                                            <tr key={d.date} className="border-b border-white/5 hover:bg-white/2">
                                                <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">{formatDayLabel(d.date)}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-300">{d.logins}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-400">{d.uniqueLogins}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-300">{d.pageViews}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-300">{d.uniqueActiveUsers}</td>
                                                <td className="px-4 py-2.5 text-right text-gray-400">{d.uniqueSessions}</td>
                                                <td className="px-4 py-2.5 text-right text-emerald-400">{d.engagementFormatted}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tab === 'all-users' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="text-sm font-bold text-white">
                                    All users · {allUsersPagination.total?.toLocaleString('en-IN')} accounts
                                </div>
                                <select
                                    value={allUsersSort}
                                    onChange={(e) => setAllUsersSort(e.target.value)}
                                    className="h-8 px-2 text-xs bg-[#0D0E10] border border-white/8 rounded-lg text-white"
                                >
                                    <option value="createdAt">Newest joined</option>
                                    <option value="lastLoginAt">Last login</option>
                                    <option value="email">Email A–Z</option>
                                </select>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[900px]">
                                    <thead>
                                        <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                                            <th className="px-4 py-2.5">User</th>
                                            <th className="px-4 py-2.5 text-right">Registrations</th>
                                            <th className="px-4 py-2.5 text-right">Paid orders</th>
                                            <th className="px-4 py-2.5 text-right">Spent</th>
                                            <th className="px-4 py-2.5 text-right">Logins</th>
                                            <th className="px-4 py-2.5 text-right">Page views</th>
                                            <th className="px-4 py-2.5 text-right">Joined</th>
                                            <th className="px-4 py-2.5 text-right">Last login</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allUsers.length === 0 ? (
                                            <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-600">No users found</td></tr>
                                        ) : allUsers.map((u) => (
                                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 cursor-pointer" onClick={() => openUserHistory(u.email)}>
                                                <td className="px-4 py-3">
                                                    <p className="text-white font-medium">{u.name || '—'}</p>
                                                    <p className="text-[#0ECCEE] text-xs truncate">{u.email}</p>
                                                    {u.phoneNumber && <p className="text-gray-600 text-[10px]">{u.phoneNumber}</p>}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-300">{u.summary.registrations}</td>
                                                <td className="px-4 py-3 text-right text-gray-300">{u.summary.paidOrders}</td>
                                                <td className="px-4 py-3 text-right text-emerald-400">₹{u.summary.totalSpent?.toLocaleString('en-IN') || 0}</td>
                                                <td className="px-4 py-3 text-right text-gray-300">{u.summary.logins || u.lifetimeLoginCount}</td>
                                                <td className="px-4 py-3 text-right text-gray-300">
                                                    {u.displayPageViews ?? u.summary.pageViews ?? u.summary.activityEvents ?? 0}
                                                    {(u.summary.pageViews || 0) === 0 && (u.displayPageViews || 0) > 0 && (
                                                        <span className="block text-[10px] text-gray-600">from logins & bookings</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatDateTime(u.joinedAt)}</td>
                                                <td className="px-4 py-3 text-right text-gray-500 text-xs">{formatDateTime(u.lastLoginAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {allUsersPagination.totalPages > 1 && (
                                <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Page {allUsersPagination.page} of {allUsersPagination.totalPages}</span>
                                    <div className="flex gap-2">
                                        <button type="button" disabled={allUsersPage <= 1} onClick={() => setAllUsersPage((p) => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronLeft size={14} /></button>
                                        <button type="button" disabled={allUsersPage >= allUsersPagination.totalPages} onClick={() => setAllUsersPage((p) => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronRight size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'logins' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Login history · {loginPagination.total} events
                            </div>
                            <div className="divide-y divide-white/5">
                                {logins.length === 0 ? (
                                    <p className="px-4 py-10 text-center text-gray-600 text-sm">No logins in this period</p>
                                ) : logins.map((l) => (
                                    <div key={l.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Mail size={12} className="text-gray-600 shrink-0" />
                                                <button
                                                    type="button"
                                                    onClick={() => openUserHistory(l.email)}
                                                    className="text-[#0ECCEE] text-sm font-medium truncate hover:underline"
                                                >
                                                    {l.email || '—'}
                                                </button>
                                                {l.name && <span className="text-gray-500 text-xs">({l.name})</span>}
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${METHOD_BADGE[l.method] || 'bg-white/5 text-gray-400'}`}>
                                                    {l.method}
                                                </span>
                                                {l.source === 'backfill' && (
                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400">
                                                        imported
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-gray-600 mt-1">{l.ip} · {l.device}</p>
                                        </div>
                                        <span className="text-xs text-gray-400 shrink-0">{formatDateTime(l.loggedInAt)}</span>
                                    </div>
                                ))}
                            </div>
                            {loginPagination.totalPages > 1 && (
                                <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Page {loginPagination.page} of {loginPagination.totalPages}</span>
                                    <div className="flex gap-2">
                                        <button type="button" disabled={loginPage <= 1} onClick={() => setLoginPage((p) => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronLeft size={14} /></button>
                                        <button type="button" disabled={loginPage >= loginPagination.totalPages} onClick={() => setLoginPage((p) => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronRight size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'activity' && (
                        <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                            <div className="px-4 py-3 border-b border-white/6 text-sm font-bold text-white">
                                Activity feed · {activityPagination.total} events
                            </div>
                            <div className="divide-y divide-white/5">
                                {activity.length === 0 ? (
                                    <p className="px-4 py-10 text-center text-gray-600 text-sm">No activity in this period</p>
                                ) : activity.map((a) => (
                                    <div key={a.id} className="px-4 py-3">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap text-xs">
                                                    <span
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() => a.email && openUserHistory(a.email)}
                                                        onKeyDown={(e) => { if (e.key === 'Enter' && a.email) openUserHistory(a.email); }}
                                                        className={`text-[#0ECCEE] ${a.email ? 'cursor-pointer hover:underline' : ''}`}
                                                    >{a.email || 'Guest'}</span>
                                                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-gray-400">{a.eventType}</span>
                                                    {a.durationSeconds > 0 && (
                                                        <span className="text-emerald-400 flex items-center gap-1"><Clock size={10} />{a.durationFormatted}</span>
                                                    )}
                                                </div>
                                                {a.page && (
                                                    <p className="text-sm text-gray-300 mt-1 truncate" title={a.page}>{a.page}</p>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-gray-600 shrink-0">{formatDateTime(a.occurredAt)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {activityPagination.totalPages > 1 && (
                                <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">Page {activityPagination.page} of {activityPagination.totalPages}</span>
                                    <div className="flex gap-2">
                                        <button type="button" disabled={activityPage <= 1} onClick={() => setActivityPage((p) => p - 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronLeft size={14} /></button>
                                        <button type="button" disabled={activityPage >= activityPagination.totalPages} onClick={() => setActivityPage((p) => p + 1)} className="px-3 py-1.5 text-xs rounded-lg border border-white/8 disabled:opacity-40"><ChevronRight size={14} /></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {tab === 'user' && (
                        <div className="space-y-4">
                            <form onSubmit={handleUserLookup} className="flex gap-2 max-w-lg">
                                <div className="relative flex-1">
                                    <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                                    <input
                                        type="email"
                                        value={userEmail}
                                        onChange={(e) => setUserEmail(e.target.value)}
                                        placeholder="Enter user email…"
                                        className="h-10 w-full pl-9 pr-3 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                                    />
                                </div>
                                <button type="submit" className="h-10 px-4 rounded-lg bg-[#0ECCEE] text-black text-sm font-semibold hover:bg-[#0ECCEE]/90">
                                    Look up
                                </button>
                            </form>

                            {!lookupEmail && (
                                <p className="text-sm text-gray-600">Search in All users tab or enter an email to see their complete history — logins, bookings, payments, registrations, and activity.</p>
                            )}

                            {lookupEmail && fullHistory?.user && (
                                <div className="space-y-4">
                                    <div className="rounded-xl border border-white/8 bg-[#121316] p-4">
                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center">
                                                    <User size={18} className="text-[#0ECCEE]" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-white">{fullHistory.user.name || lookupEmail}</p>
                                                    <p className="text-sm text-gray-500">{fullHistory.user.email}</p>
                                                    <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-gray-600">
                                                        {fullHistory.user.phoneNumber && <span>{fullHistory.user.phoneNumber}</span>}
                                                        {fullHistory.user.college && <span>· {fullHistory.user.college}</span>}
                                                        {fullHistory.user.role && <span>· {fullHistory.user.role}</span>}
                                                        {fullHistory.user.isVerified && <span className="text-emerald-400">· Verified</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-gray-500 space-y-0.5 sm:text-right">
                                                <p>Joined {formatDateTime(fullHistory.user.joinedAt)}</p>
                                                <p>Last login {formatDateTime(fullHistory.user.lastLoginAt)} {fullHistory.user.lastLoginMethod && `· ${fullHistory.user.lastLoginMethod}`}</p>
                                                {fullHistory.user.lastActivityAt && <p>Last active {formatDateTime(fullHistory.user.lastActivityAt)}</p>}
                                                {fullHistory.engagement?.accountAgeDays != null && (
                                                    <p>Account age · {fullHistory.engagement.accountAgeDays} days</p>
                                                )}
                                            </div>
                                        </div>
                                        {fullHistory.engagement && (
                                            <div className="mt-4 pt-4 border-t border-white/6 flex flex-col sm:flex-row sm:items-center gap-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-12 h-12 rounded-xl bg-[#0ECCEE]/10 flex flex-col items-center justify-center border border-[#0ECCEE]/25">
                                                        <span className="text-lg font-bold text-[#0ECCEE]">{fullHistory.engagement.score}</span>
                                                        <span className="text-[9px] text-gray-500 uppercase">Score</span>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-semibold text-white">{fullHistory.engagement.label}</p>
                                                        <p className="text-[10px] text-gray-600">
                                                            Login {fullHistory.engagement.breakdown.loginPts} · Reg {fullHistory.engagement.breakdown.regPts} · Pay {fullHistory.engagement.breakdown.payPts} · Spend {fullHistory.engagement.breakdown.spendPts} · Recent {fullHistory.engagement.breakdown.recencyPts}
                                                        </p>
                                                    </div>
                                                </div>
                                                {fullHistory.engagement.flags?.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 sm:ml-auto">
                                                        {fullHistory.engagement.flags.map((f) => (
                                                            <span key={f.id} className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${CHURN_TONE[f.tone] || CHURN_TONE.neutral}`}>
                                                                {f.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {fullHistory.paymentBreakdown && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                            <StatCard icon={Wallet} label="Paid orders" value={fullHistory.paymentBreakdown.paid} sub={`Avg ₹${fullHistory.paymentBreakdown.avgOrderValue?.toLocaleString('en-IN') || 0}`} />
                                            <StatCard icon={Wallet} label="Pending" value={fullHistory.paymentBreakdown.pending} />
                                            <StatCard icon={Wallet} label="Failed" value={fullHistory.paymentBreakdown.failed} />
                                            <StatCard icon={Ticket} label="Check-ins" value={fullHistory.summary.checkIns ?? fullHistory.registrationDetails?.stats?.checkedIn ?? 0} sub={`${fullHistory.registrationDetails?.stats?.approved ?? 0} approved`} />
                                            <StatCard icon={Ticket} label="Reg pending" value={fullHistory.summary.registrationPending ?? 0} />
                                            <StatCard icon={Heart} label="Communities" value={fullHistory.communityFollows?.length ?? 0} sub={`${fullHistory.summary.unreadNotifications ?? 0} unread notifs`} />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                                        <StatCard icon={LogIn} label="Logins" value={fullHistory.summary.logins?.toLocaleString('en-IN')} sub={`Lifetime: ${fullHistory.user.lifetimeLoginCount || 0}`} />
                                        <StatCard icon={Eye} label="Page views" value={fullHistory.summary.pageViews?.toLocaleString('en-IN') || 0} sub={fullHistory.summary.trackedPageViews != null ? `${fullHistory.summary.trackedPageViews} tracked · rest from logins/bookings` : undefined} />
                                        <StatCard icon={Clock} label="Total time" value={fullHistory.summary.totalEngagementFormatted || '0s'} />
                                        <StatCard icon={MousePointerClick} label="Avg time / page" value={fullHistory.summary.avgEngagementPerPageFormatted || '0s'} />
                                        <StatCard icon={TrendingUp} label="Avg time / session" value={fullHistory.summary.avgEngagementPerSessionFormatted || '0s'} />
                                        <StatCard icon={Globe} label="Sessions" value={fullHistory.summary.uniqueSessions || 0} />
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                                        <StatCard icon={Users} label="Registrations" value={fullHistory.summary.registrations} />
                                        <StatCard icon={Users} label="Fest regs" value={fullHistory.summary.festRegistrations || 0} />
                                        <StatCard icon={Users} label="Bookings" value={(fullHistory.summary.categoryRegistrations || 0) + (fullHistory.summary.trekBookings || 0)} />
                                        <StatCard icon={Users} label="Event shows" value={fullHistory.summary.eventShowRegistrations || 0} />
                                        <StatCard icon={Users} label="Payments" value={fullHistory.summary.payments} />
                                        <StatCard icon={TrendingUp} label="Total spent" value={`₹${fullHistory.summary.totalSpent?.toLocaleString('en-IN') || 0}`} />
                                        <StatCard icon={Activity} label="Notifications" value={fullHistory.summary.notifications} />
                                        <StatCard icon={Users} label="Follows" value={fullHistory.summary.follows} />
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {fullHistory.topPages?.length > 0 && (
                                            <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                                <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
                                                    <Eye size={14} className="text-[#0ECCEE]" />
                                                    Pages visited · {fullHistory.topPages.length}
                                                </h3>
                                                <p className="text-[10px] text-gray-600 mb-3">Includes tracked visits + pages inferred from logins, registrations & bookings</p>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {fullHistory.topPages.map((p) => (
                                                        <div key={p.page} className="flex justify-between gap-2 text-xs border-b border-white/5 pb-2">
                                                            <span className="text-gray-300 truncate flex-1" title={p.page}>{p.page}</span>
                                                            <span className="text-gray-500 shrink-0 whitespace-nowrap">
                                                                {p.views}× · {p.engagementFormatted} · avg {p.avgTimeFormatted}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {fullHistory.sessions?.length > 0 && (
                                            <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                    <Globe size={14} className="text-[#0ECCEE]" />
                                                    Sessions · {fullHistory.sessions.length}
                                                </h3>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {fullHistory.sessions.map((s) => (
                                                        <div key={s.sessionId} className="flex justify-between gap-2 text-xs border-b border-white/5 pb-2">
                                                            <div className="min-w-0">
                                                                <p className="text-gray-300">{s.pageViews} pages · {s.engagementFormatted}</p>
                                                                <p className="text-gray-600 capitalize">{s.device}</p>
                                                            </div>
                                                            <span className="text-gray-600 shrink-0 whitespace-nowrap">{formatDateTime(s.lastActiveAt)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {fullHistory.recentLogins?.length > 0 && (
                                            <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                                <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                    <LogIn size={14} className="text-[#0ECCEE]" />
                                                    Recent logins
                                                </h3>
                                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                                    {fullHistory.recentLogins.map((l) => (
                                                        <div key={l.id} className="flex justify-between gap-2 text-xs border-b border-white/5 pb-2">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${METHOD_BADGE[l.method] || 'bg-white/5 text-gray-400'}`}>
                                                                        {l.method}
                                                                    </span>
                                                                    <span className="text-gray-500 capitalize">{l.device}</span>
                                                                    {l.ip && <span className="text-gray-600">{l.ip}</span>}
                                                                </div>
                                                            </div>
                                                            <span className="text-gray-600 shrink-0 whitespace-nowrap">{formatDateTime(l.loggedInAt)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(fullHistory.devices && Object.keys(fullHistory.devices).length > 0) && (
                                            <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                                <h3 className="text-sm font-bold text-white mb-3">Devices & events</h3>
                                                <DeviceBreakdown devices={fullHistory.devices} />
                                                {fullHistory.eventTypes && Object.keys(fullHistory.eventTypes).length > 0 && (
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        {Object.entries(fullHistory.eventTypes).map(([type, count]) => (
                                                            <span key={type} className="px-2 py-1 rounded-full text-[10px] bg-white/5 text-gray-400">
                                                                {type}: {count}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {fullHistory.registrationDetails?.rows?.length > 0 && (
                                        <div className="rounded-xl border border-white/8 bg-[#17181A] p-4 overflow-hidden">
                                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                <Ticket size={14} className="text-[#0ECCEE]" />
                                                Registrations · {fullHistory.registrationDetails.rows.length}
                                                <span className="text-[10px] font-normal text-gray-500 ml-1">
                                                    {fullHistory.registrationDetails.stats.checkedIn} checked in · {fullHistory.registrationDetails.stats.paid} paid
                                                </span>
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs min-w-[720px]">
                                                    <thead>
                                                        <tr className="text-left text-gray-500 border-b border-white/6">
                                                            <th className="pb-2 pr-3">Event</th>
                                                            <th className="pb-2 pr-3">Type</th>
                                                            <th className="pb-2 pr-3">Status</th>
                                                            <th className="pb-2 pr-3">Payment</th>
                                                            <th className="pb-2 pr-3 text-right">Amount</th>
                                                            <th className="pb-2 pr-3">Check-in</th>
                                                            <th className="pb-2 text-right">Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {fullHistory.registrationDetails.rows.map((r) => (
                                                            <tr key={r.id} className="border-b border-white/5">
                                                                <td className="py-2 pr-3 text-gray-200 max-w-[180px] truncate" title={r.name}>{r.name}</td>
                                                                <td className="py-2 pr-3 text-gray-500 capitalize">{r.type.replace('_', ' ')}</td>
                                                                <td className={`py-2 pr-3 capitalize ${STATUS_BADGE[r.status] || 'text-gray-400'}`}>{r.status}</td>
                                                                <td className={`py-2 pr-3 capitalize ${STATUS_BADGE[r.paymentStatus] || 'text-gray-400'}`}>{r.paymentStatus}</td>
                                                                <td className="py-2 pr-3 text-right text-emerald-400">{r.amountPaid > 0 ? `₹${r.amountPaid.toLocaleString('en-IN')}` : '—'}</td>
                                                                <td className="py-2 pr-3">{r.checkedIn ? <span className="text-emerald-400">Yes</span> : <span className="text-gray-600">No</span>}</td>
                                                                <td className="py-2 text-right text-gray-600 whitespace-nowrap">{formatDateTime(r.registeredAt)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {fullHistory.paymentBreakdown?.orders?.length > 0 && (
                                        <div className="rounded-xl border border-white/8 bg-[#17181A] p-4 overflow-hidden">
                                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                <Wallet size={14} className="text-[#0ECCEE]" />
                                                Payments · {fullHistory.paymentBreakdown.totalOrders} orders
                                                <span className="text-[10px] font-normal text-gray-500 ml-1">
                                                    ₹{fullHistory.paymentBreakdown.totalSpent?.toLocaleString('en-IN')} spent
                                                </span>
                                            </h3>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-xs min-w-[680px]">
                                                    <thead>
                                                        <tr className="text-left text-gray-500 border-b border-white/6">
                                                            <th className="pb-2 pr-3">Order</th>
                                                            <th className="pb-2 pr-3">Type</th>
                                                            <th className="pb-2 pr-3">Status</th>
                                                            <th className="pb-2 pr-3 text-right">Amount</th>
                                                            <th className="pb-2 pr-3">Gateway</th>
                                                            <th className="pb-2 pr-3">Coupon</th>
                                                            <th className="pb-2 text-right">Date</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {fullHistory.paymentBreakdown.orders.map((o) => (
                                                            <tr key={o.id} className="border-b border-white/5">
                                                                <td className="py-2 pr-3 text-gray-400 font-mono">{o.orderId?.slice(0, 16) || o.id.slice(-8)}</td>
                                                                <td className="py-2 pr-3 text-gray-300 capitalize">{o.entityType?.replace('_', ' ')}</td>
                                                                <td className={`py-2 pr-3 ${STATUS_BADGE[o.status] || 'text-gray-400'}`}>{o.status}</td>
                                                                <td className="py-2 pr-3 text-right text-emerald-400">₹{o.amount?.toLocaleString('en-IN')}</td>
                                                                <td className="py-2 pr-3 text-gray-500 capitalize">{o.gateway || '—'}</td>
                                                                <td className="py-2 pr-3 text-gray-500">{o.couponCode || '—'}</td>
                                                                <td className="py-2 text-right text-gray-600 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}

                                    {fullHistory.communityFollows?.length > 0 && (
                                        <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                                                <Heart size={14} className="text-[#0ECCEE]" />
                                                Communities followed · {fullHistory.communityFollows.length}
                                            </h3>
                                            <div className="flex flex-wrap gap-2">
                                                {fullHistory.communityFollows.map((c) => (
                                                    <div key={c.id} className="px-3 py-2 rounded-lg bg-white/5 border border-white/8 text-xs">
                                                        <p className="text-white font-medium">{c.name}</p>
                                                        <p className="text-gray-600 capitalize">{c.entityType.replace('_', ' ')} · {formatDateTime(c.followedAt)}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {fullHistory.timeline?.length > 0 && (
                                        <div className="rounded-xl border border-white/8 bg-[#17181A] p-4">
                                            <h3 className="text-sm font-bold text-white mb-3">Complete history · {fullHistory.timeline.length} events</h3>
                                            <div className="space-y-2 max-h-[520px] overflow-y-auto">
                                                {fullHistory.timeline.map((t, idx) => (
                                                    <div key={`${t.sourceId}-${idx}`} className="flex justify-between gap-3 text-xs border-b border-white/5 pb-2">
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold capitalize ${TIMELINE_CATEGORY_STYLE[t.category] || 'bg-white/5 text-gray-400'}`}>
                                                                    {t.category}
                                                                </span>
                                                                {t.amount != null && t.amount > 0 && (
                                                                    <span className="text-emerald-400">₹{Number(t.amount).toLocaleString('en-IN')}</span>
                                                                )}
                                                                {t.meta?.durationSeconds > 0 && (
                                                                    <span className="text-emerald-400 flex items-center gap-1">
                                                                        <Clock size={10} />
                                                                        {formatDuration(t.meta.durationSeconds)}
                                                                    </span>
                                                                )}
                                                                {t.status && <span className="text-gray-500">{t.status}</span>}
                                                            </div>
                                                            <p className="text-gray-200">{t.action}</p>
                                                            {t.entityName && <p className="text-gray-500 truncate">{t.entityName}</p>}
                                                        </div>
                                                        <span className="text-gray-600 shrink-0 whitespace-nowrap">{formatDateTime(t.occurredAt)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

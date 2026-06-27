import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AlertCircle, BadgeCheck, Cake, CalendarClock, ChevronLeft, ChevronRight,
    Fingerprint, GraduationCap, Globe, Loader2, LogIn, Mail, Phone, Search,
    ShieldCheck, User, Users, VenetianMask,
} from 'lucide-react';
import { adminFetchJSON } from '../../utils/adminApi';
import { normalizeImageUrl } from '../../utils/uploadUrls';

const ROLE_FILTERS = [
    { id: 'all', label: 'All roles' },
    { id: 'student', label: 'Students' },
    { id: 'organizer', label: 'Organizers' },
    { id: 'sponsor', label: 'Sponsors' },
];

const SIGNUP_FILTERS = [
    { id: 'all', label: 'All sign-ups' },
    { id: 'password', label: 'Email / Password' },
    { id: 'google', label: 'Google' },
    { id: 'social', label: 'Any social' },
];

const METHOD_BADGE = {
    password: { label: 'Password', cls: 'bg-white/8 text-gray-300' },
    google: { label: 'Google', cls: 'bg-red-500/15 text-red-400' },
    facebook: { label: 'Facebook', cls: 'bg-blue-500/15 text-blue-400' },
    twitter: { label: 'Twitter', cls: 'bg-sky-500/15 text-sky-400' },
    firebase: { label: 'Firebase', cls: 'bg-amber-500/15 text-amber-400' },
};

const SIGNUP_BADGE = {
    password: { label: 'Email / Password', cls: 'bg-white/8 text-gray-300' },
    google: { label: 'Google sign-up', cls: 'bg-red-500/15 text-red-400' },
    facebook: { label: 'Facebook sign-up', cls: 'bg-blue-500/15 text-blue-400' },
    twitter: { label: 'Twitter sign-up', cls: 'bg-sky-500/15 text-sky-400' },
    firebase: { label: 'Firebase sign-up', cls: 'bg-amber-500/15 text-amber-400' },
};

function formatDateTime(d) {
    if (!d) return 'Never';
    return new Date(d).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}

function ageFrom(dob) {
    if (!dob) return null;
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 && age < 130 ? age : null;
}

function DetailItem({ icon: Icon, label, value }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex flex-col gap-0.5">
            <span className="text-gray-600 flex items-center gap-1"><Icon size={11} /> {label}</span>
            <span className="text-gray-300 wrap-break-word">{value}</span>
        </div>
    );
}

function timeAgo(d) {
    if (!d) return '';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

function UserRow({ user }) {
    const method = user.lastLoginMethod || user.socialAuth?.provider;
    const methodInfo = METHOD_BADGE[method] || null;
    const signupInfo = SIGNUP_BADGE[user.signupMethod] || SIGNUP_BADGE.password;
    const avatar = normalizeImageUrl(user.profilePic || user.socialAuth?.photoURL);

    return (
        <div className="rounded-xl border border-white/8 bg-[#121316] p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0 overflow-hidden">
                        {avatar ? (
                            <img src={avatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                            <User size={18} className="text-[#0ECCEE]" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-white truncate">{user.name || 'Unknown'}</p>
                            {user.isVerified && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                                    <BadgeCheck size={12} /> Verified
                                </span>
                            )}
                            {user.isDeleted && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400">
                                    Deleted
                                </span>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-xs text-gray-500">
                            {user.email && (
                                <span className="flex items-center gap-1 truncate">
                                    <Mail size={11} />{user.email}
                                </span>
                            )}
                            {user.phoneNumber && (
                                <span className="flex items-center gap-1">
                                    <Phone size={11} />{user.phoneNumber}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0ECCEE]/10 text-[#0ECCEE] capitalize">
                        {user.role || 'student'}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${signupInfo.cls}`}
                        title="How this account was created">
                        {signupInfo.label}
                    </span>
                    {methodInfo && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 text-gray-400 border border-white/8"
                            title="Most recent login method">
                            Last login: {methodInfo.label}
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <div className="flex flex-col gap-0.5">
                    <span className="text-gray-600 flex items-center gap-1"><CalendarClock size={11} /> Last login</span>
                    <span className="text-gray-300">{formatDateTime(user.lastLoginAt)}</span>
                    {user.lastLoginAt && <span className="text-gray-600">{timeAgo(user.lastLoginAt)}</span>}
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-gray-600 flex items-center gap-1"><Globe size={11} /> Last IP</span>
                    <span className="text-gray-300">{user.lastLoginIp || '—'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-gray-600 flex items-center gap-1"><ShieldCheck size={11} /> Logins</span>
                    <span className="text-gray-300">{user.loginCount ?? 0}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                    <span className="text-gray-600 flex items-center gap-1"><User size={11} /> Joined</span>
                    <span className="text-gray-300">{formatDateTime(user.createdAt)}</span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-white/6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                <DetailItem icon={GraduationCap} label="College" value={user.college} />
                <DetailItem icon={VenetianMask} label="Gender" value={user.gender} />
                <DetailItem
                    icon={Cake}
                    label="Date of birth"
                    value={
                        user.dateOfBirth
                            ? `${formatDate(user.dateOfBirth)}${ageFrom(user.dateOfBirth) != null ? ` (${ageFrom(user.dateOfBirth)}y)` : ''}`
                            : null
                    }
                />
                <DetailItem icon={ShieldCheck} label="Account status" value={user.isDeleted ? 'Deleted' : 'Active'} />
                <DetailItem icon={LogIn} label="Signed up via" value={signupInfo.label} />
                <DetailItem icon={CalendarClock} label="Last updated" value={user.updatedAt ? formatDateTime(user.updatedAt) : null} />
                <DetailItem icon={CalendarClock} label="Deleted on" value={user.deletedAt ? formatDateTime(user.deletedAt) : null} />
                <DetailItem icon={Fingerprint} label="Firebase UID" value={user.firebaseUid} />
                <DetailItem icon={User} label="User ID" value={user._id} />
            </div>

            {user.lastLoginUserAgent && (
                <p className="text-[10px] text-gray-600 mt-2 wrap-break-word" title={user.lastLoginUserAgent}>
                    <span className="text-gray-500">Device: </span>{user.lastLoginUserAgent}
                </p>
            )}
        </div>
    );
}

export default function UserLoginsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [users, setUsers] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [role, setRole] = useState('all');
    const [signup, setSignup] = useState('all');
    const [page, setPage] = useState(1);

    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    useEffect(() => { setPage(1); }, [debouncedSearch, role, signup]);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(page), limit: '50' });
            if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
            if (role !== 'all') params.set('role', role);
            if (signup !== 'all') params.set('signup', signup);
            const data = await adminFetchJSON(`/admin/users?${params.toString()}`);
            setUsers(data.users || []);
            setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        } catch (err) {
            setError(err.message || 'Failed to load users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch, role, signup]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const headerSummary = useMemo(() => {
        if (loading) return 'Loading…';
        return `${pagination.total} user${pagination.total !== 1 ? 's' : ''}`;
    }, [loading, pagination.total]);

    return (
        <div className="max-w-6xl mx-auto space-y-5">
            <div>
                <h1 className="text-2xl font-bold text-white">User Login Details</h1>
                <p className="text-sm text-gray-500 mt-0.5">
                    Registered accounts and their login activity
                </p>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError('')} className="text-xs underline shrink-0">Dismiss</button>
                </div>
            )}

            <div className="rounded-2xl border border-white/8 bg-[#17181A] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-bold text-white">
                        <Users size={16} className="text-[#0ECCEE]" />
                        {headerSummary}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search name, email, phone…"
                                className="h-9 pl-9 pr-3 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/40 w-56"
                            />
                        </div>
                        <select
                            value={signup}
                            onChange={(e) => setSignup(e.target.value)}
                            className="h-9 px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40"
                        >
                            {SIGNUP_FILTERS.map((s) => (
                                <option key={s.id} value={s.id} className="bg-[#0D0E10]">{s.label}</option>
                            ))}
                        </select>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            className="h-9 px-2.5 text-sm bg-[#0D0E10] border border-white/8 rounded-lg text-white focus:outline-none focus:border-[#0ECCEE]/40"
                        >
                            {ROLE_FILTERS.map((r) => (
                                <option key={r.id} value={r.id} className="bg-[#0D0E10]">{r.label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="p-4 space-y-3 min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center gap-2 py-20 text-sm text-gray-500">
                            <Loader2 size={18} className="animate-spin text-[#0ECCEE]" /> Loading users…
                        </div>
                    ) : users.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                            <Users size={36} className="mb-2 opacity-40" />
                            <p className="text-sm">No users found</p>
                        </div>
                    ) : (
                        users.map((u) => <UserRow key={u._id} user={u} />)
                    )}
                </div>

                {!loading && pagination.totalPages > 1 && (
                    <div className="px-4 py-3 border-t border-white/6 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-white/8 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
                            >
                                <ChevronLeft size={14} /> Prev
                            </button>
                            <button
                                type="button"
                                disabled={page >= pagination.totalPages}
                                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border border-white/8 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
                            >
                                Next <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

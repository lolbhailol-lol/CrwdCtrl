import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Loader, Bell, QrCode, ExternalLink, RefreshCw,
    Trophy, Calendar, MapPin, Building2, ArrowRight, AlertCircle, CheckCircle2, Mic2, Radio,
    Pencil,
} from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { isMindSparkFest } from '../../features/fests/mindspark';

function formatWhen(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function ProgressBar({ value, max, tone = 'cyan' }) {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const colors = {
        cyan: 'bg-[#0ECCEE]',
        amber: 'bg-amber-400',
        emerald: 'bg-emerald-400',
    };
    return (
        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div
                className={`h-full rounded-full transition-all duration-500 ${colors[tone] || colors.cyan}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}

export default function FestOrganizerDashboardPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            setData(await fetchFestOrganizerDashboard(festId));
        } catch (e) {
            setError(e.message || 'Failed to load dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    const comps = useMemo(
        () => (data?.competitions || []).filter((c) => c.id),
        [data],
    );

    const needsAttention = useMemo(() => {
        return [...comps]
            .filter((c) => Number(c.pending) > 0)
            .sort((a, b) => (b.pending || 0) - (a.pending || 0))
            .slice(0, 4);
    }, [comps]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading overview…
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="text-center py-16 space-y-3">
                <p className="text-red-400 text-sm">{error || 'Not found'}</p>
                <button type="button" onClick={load} className="text-[#0ECCEE] text-sm inline-flex items-center gap-1">
                    <RefreshCw size={14} /> Retry
                </button>
            </div>
        );
    }

    const { fest, stats, recent = [] } = data;
    const payments = stats.payments || {};
    const hideProShow = isMindSparkFest(festId, fest);
    const unpaidCount = Number(payments.pending || 0);
    const publicUrl = fest.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : `${window.location.origin}/view-details/${fest.id}`;

    const totalPending = Number(stats.pendingRegistrations) || 0;
    const totalApproved = Number(stats.totalRegistrations) || 0;
    const checkedIn = Number(stats.checkedIn) || 0;
    const pendingCheckIn = Number(stats.pendingCheckIn) || 0;
    const checkInRate = Number(stats.checkInRate) || 0;

    const quickOps = [
        { label: 'Live feed', desc: 'Fest day updates', to: 'live', icon: Radio, glow: 'from-red-500/15' },
        { label: 'Competitions', desc: `${stats.competitionCount || comps.length} live`, to: 'competitions', icon: Trophy, glow: 'from-[#0ECCEE]/15' },
        ...(!hideProShow
            ? [{ label: 'Pro Show', desc: 'Sold · passes · gate', to: 'pro-show', icon: Mic2, glow: 'from-fuchsia-500/10' }]
            : []),
        { label: 'Connect', desc: 'WA · call · push', to: 'notifications', icon: Bell, glow: 'from-amber-500/10' },
        { label: 'Edit listing', desc: 'Fest & comps', to: 'edit-listing', icon: Pencil, glow: 'from-[#0ECCEE]/12' },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-5">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121314]">
                {fest.coverImage ? (
                    <img
                        src={getImageUrl(fest.coverImage, { preset: 'card' })}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-35"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : null}
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/20 via-transparent to-[#053780]/30" />
                <div className="relative p-5 sm:p-6 flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold mb-1">
                            Fest overview
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            {fest.festName}
                        </h1>
                        <p className="text-sm text-gray-300/90 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {fest.collegeName ? (
                                <span className="inline-flex items-center gap-1"><Building2 size={12} />{fest.collegeName}</span>
                            ) : null}
                            {fest.city ? (
                                <span className="inline-flex items-center gap-1"><MapPin size={12} />{fest.city}</span>
                            ) : null}
                            {(fest.festDate || fest.venue) ? (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} />
                                    {[fest.festDate, fest.venue].filter(Boolean).join(' · ')}
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/15 text-sm text-white hover:bg-white/15"
                        >
                            <ExternalLink size={14} /> Public
                        </a>
                        <button
                            type="button"
                            onClick={load}
                            className="p-2 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/15"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Pulse stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                    type="button"
                    onClick={() => navigate(
                        hideProShow
                            ? `/fest-organizer/fests/${festId}/participants?paymentStatus=pending`
                            : `/fest-organizer/fests/${festId}/participants?status=pending`,
                    )}
                    className="rounded-2xl border border-amber-400/30 bg-linear-to-br from-amber-500/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <div className="flex items-center justify-between mb-2">
                        <Clock size={16} className="text-amber-300" />
                        {(hideProShow ? unpaidCount : totalPending) > 0 ? (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black">
                                {hideProShow ? 'Unpaid' : 'Action'}
                            </span>
                        ) : null}
                    </div>
                    <p className="text-2xl font-bold tabular-nums text-white">
                        {hideProShow ? unpaidCount : totalPending}
                    </p>
                    <p className="text-xs text-amber-200/80 mt-1">
                        {hideProShow ? 'Unpaid' : 'Need review'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{stats.todayRegistrations || 0} new today</p>
                </button>

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?status=approved`)}
                    className="rounded-2xl border border-[#0ECCEE]/30 bg-linear-to-br from-[#0ECCEE]/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <Users size={16} className="text-[#0ECCEE] mb-2" />
                    <p className="text-2xl font-bold tabular-nums text-white">{totalApproved}</p>
                    <p className="text-xs text-[#0ECCEE]/90 mt-1">
                        {hideProShow ? 'Registered' : 'Participants in'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{stats.allActive || 0} active total</p>
                </button>

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/scan`)}
                    className="rounded-2xl border border-emerald-400/30 bg-linear-to-br from-emerald-500/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <UserCheck size={16} className="text-emerald-300 mb-2" />
                    <p className="text-2xl font-bold tabular-nums text-white">{checkedIn}</p>
                    <p className="text-xs text-emerald-200/80 mt-1">Checked in · {checkInRate}%</p>
                    <div className="mt-2">
                        <ProgressBar value={checkedIn} max={Math.max(totalApproved, 1)} tone="emerald" />
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1.5">{pendingCheckIn} still outside</p>
                </button>

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/revenue`)}
                    className="rounded-2xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/10 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <IndianRupee size={16} className="text-emerald-300 mb-2" />
                    <p className="text-2xl font-bold tabular-nums text-white">
                        ₹{Number(stats.revenue || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Revenue</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {payments.paid || 0} paid · {payments.pending || 0} unpaid
                    </p>
                </button>
            </div>

            {/* Quick ops + small edit shortcut */}
            <div className={`grid grid-cols-2 ${hideProShow ? 'sm:grid-cols-4' : 'sm:grid-cols-5'} gap-2`}>
                {quickOps.map((item) => (
                    <button
                        key={item.to}
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/${item.to}`)}
                        className={`rounded-2xl border border-white/10 bg-linear-to-b ${item.glow} to-[#161718] p-3.5 text-left hover:border-[#0ECCEE]/40 active:scale-[0.98] transition`}
                    >
                        <item.icon className="text-[#0ECCEE] mb-2" size={18} />
                        <p className="text-sm font-semibold text-white">{item.label}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{item.desc}</p>
                    </button>
                ))}
            </div>

            {/* Needs attention — not used for MindSpark (payment gateway confirms) */}
            {!hideProShow ? (
                needsAttention.length > 0 ? (
                <section className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                        <AlertCircle size={16} className="text-amber-300" />
                        <h2 className="text-sm font-semibold text-amber-100">Needs review</h2>
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                        {needsAttention.map((c) => (
                            <button
                                key={String(c.id)}
                                type="button"
                                onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/${c.id}?tab=pending`)}
                                className="flex items-center gap-3 rounded-xl bg-black/25 border border-amber-400/15 px-3 py-2.5 text-left hover:border-amber-400/40 transition"
                            >
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#1a1b1d]">
                                    <img
                                        src={getImageUrl(c.coverImage, { preset: 'cardSm' })}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => handleImageErrorWithFallback(e, 48, 48, '#0ea5e9', c.name || 'C')}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-white truncate font-medium">{c.name}</p>
                                    <p className="text-xs text-amber-200/90 mt-0.5">
                                        {c.pending} waiting · {c.approved} approved
                                    </p>
                                </div>
                                <ArrowRight size={14} className="text-amber-300 shrink-0" />
                            </button>
                        ))}
                    </div>
                </section>
                ) : (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/8 px-4 py-3 flex items-center gap-2 text-sm text-emerald-200">
                    <CheckCircle2 size={16} /> All competitions clear — nothing pending review
                </div>
                )
            ) : null}

            {/* Recent */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-sm font-semibold text-white">Latest participants</h2>
                        <p className="text-[11px] text-gray-500 mt-0.5">Newest across all competitions</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/participants`)}
                        className="text-xs text-[#0ECCEE] inline-flex items-center gap-1"
                    >
                        Full roster <ArrowRight size={12} />
                    </button>
                </div>
                {recent.length ? (
                    <div className="space-y-2">
                        {recent.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?status=${r.status === 'pending' ? 'pending' : 'approved'}`)}
                                className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3 py-2.5 border border-transparent hover:border-white/10 transition text-left"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-white truncate">{r.userName || '—'}</p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        {r.competitionName || 'General'}
                                        {r.teamName ? ` · ${r.teamName}` : ''}
                                        {r.college ? ` · ${r.college}` : ''}
                                        {' · '}
                                        <span className={r.status === 'pending' ? 'text-amber-400' : 'text-gray-400'}>
                                            {r.status}
                                        </span>
                                        {' · '}
                                        {r.paymentStatus}
                                    </p>
                                    {Array.isArray(r.highlights) && r.highlights.length ? (
                                        <p className="text-[10px] text-gray-600 truncate mt-0.5">
                                            {r.highlights.map((h) => `${h.label}: ${h.value}`).join(' · ')}
                                        </p>
                                    ) : null}
                                </div>
                                <p className="text-[10px] text-gray-600 shrink-0">{formatWhen(r.createdAt)}</p>
                            </button>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 py-6 text-center">No registrations yet</p>
                )}
            </section>
        </div>
    );
}

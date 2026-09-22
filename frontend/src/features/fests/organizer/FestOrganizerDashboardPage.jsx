import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Users, UserCheck, Clock, IndianRupee, Bell, QrCode, ExternalLink, RefreshCw,
    Trophy, Calendar, MapPin, Building2, ArrowRight, AlertCircle, CheckCircle2, Mic2, Radio,
    Pencil, Download, ScanLine, Ticket, Loader,
} from 'lucide-react';
import { fetchFestOrganizerDashboard, exportFestOrganizerParticipants } from '../../../services/api/festOrganizer.api';
import { getImageUrl } from '../../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { getFestPlugin } from '../plugins/registry';
import FestOrganizerCompetitionQrModal from './FestOrganizerCompetitionQrModal';
import { InlinePageLoader } from '../../../components/DetailPageLoader';
import { useDialog } from '../../../context/DialogContext';

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

/** Techfest / Kshitij — lean ops home: comps + people + Excel */
function SimpleOrganizerDashboard({ fest, stats, competitions, festId, navigate, reload, pluginId = 'techfest' }) {
    const { toast } = useDialog();
    const [exporting, setExporting] = useState(false);
    const totalParticipants = Number(stats.totalRegistrations || stats.allActive) || 0;
    const publicUrl = fest.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : `${window.location.origin}/view-details/${fest.id || festId}`;
    const brand = pluginId === 'kshitij' ? 'Kshitij' : 'Organizer';
    const festLabel = String(fest.festName || brand);

    const downloadExcel = async (competitionId = '') => {
        setExporting(true);
        try {
            const blob = await exportFestOrganizerParticipants(festId, {
                competitionId: competitionId || undefined,
                format: 'xlsx',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const stamp = new Date().toISOString().slice(0, 10);
            const slug = festLabel.replace(/[^\w]+/g, '_').replace(/^_|_$/g, '') || 'fest';
            a.download = competitionId
                ? `${slug}_competition_${String(competitionId).slice(-6)}_${stamp}.xlsx`
                : `${slug}_participants_${stamp}.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Excel downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-5">
            <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121314]">
                {fest.coverImage ? (
                    <img
                        src={getImageUrl(fest.coverImage, { preset: 'cardLandscape' })}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover opacity-30"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                ) : null}
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/25 via-transparent to-[#053780]/35" />
                <div className="relative p-5 sm:p-7 flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0ECCEE]">
                            {brand} dashboard
                        </p>
                        <h1 className="mt-2 text-2xl sm:text-3xl font-bold text-white tracking-tight">
                            {fest.festName}
                        </h1>
                        <p className="mt-2 text-sm text-gray-300/90 flex flex-wrap items-center gap-x-3 gap-y-1">
                            {fest.collegeName ? (
                                <span className="inline-flex items-center gap-1"><Building2 size={12} />{fest.collegeName}</span>
                            ) : null}
                            {fest.festDate || fest.venue ? (
                                <span className="inline-flex items-center gap-1">
                                    <Calendar size={12} />
                                    {[fest.festDate, fest.venue].filter(Boolean).join(' · ')}
                                </span>
                            ) : null}
                        </p>
                        <p className="mt-2 text-sm text-gray-500">
                            Free competitions · registrations · Excel export
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 backdrop-blur border border-white/15 text-sm text-white hover:bg-white/15"
                        >
                            <ExternalLink size={14} /> Public page
                        </a>
                        <button
                            type="button"
                            onClick={() => downloadExcel()}
                            disabled={exporting}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                            {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                            Export Excel
                        </button>
                        <button
                            type="button"
                            onClick={reload}
                            className="p-2.5 rounded-xl border border-white/15 bg-white/10 text-white"
                            aria-label="Refresh dashboard"
                        >
                            <RefreshCw size={16} />
                        </button>
                    </div>
                </div>
            </section>

            <div className="grid sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                    className="rounded-3xl border border-[#0ECCEE]/30 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718] p-5 sm:p-6 text-left hover:border-[#0ECCEE]/55 transition"
                >
                    <Trophy size={22} className="text-[#0ECCEE]" />
                    <p className="mt-4 text-3xl font-bold tabular-nums text-white">{stats.competitionCount || competitions.length}</p>
                    <p className="mt-1 font-semibold text-white">Competitions</p>
                    <p className="mt-1 text-sm text-gray-500">Open desks and participant lists</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0ECCEE]">
                        Open competitions <ArrowRight size={15} />
                    </span>
                </button>

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/participants`)}
                    className="rounded-3xl border border-white/10 bg-[#161718] p-5 sm:p-6 text-left hover:border-[#0ECCEE]/40 transition"
                >
                    <Users size={22} className="text-[#0ECCEE]" />
                    <p className="mt-4 text-3xl font-bold tabular-nums text-white">{totalParticipants}</p>
                    <p className="mt-1 font-semibold text-white">Participants</p>
                    <p className="mt-1 text-sm text-gray-500">Search, filter, and export Excel</p>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#0ECCEE]">
                        View participants <ArrowRight size={15} />
                    </span>
                </button>
            </div>

            <section className="rounded-3xl border border-white/10 bg-[#161718] overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5 border-b border-white/8">
                    <h2 className="text-base font-semibold text-white">Competitions</h2>
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                        className="text-xs font-semibold text-[#0ECCEE]"
                    >
                        View all
                    </button>
                </div>
                <div className="divide-y divide-white/8">
                    {competitions.slice(0, 8).map((competition) => {
                        const count = Number(competition.total) || Number(competition.participants) || 0;
                        return (
                            <div key={competition.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                                <button
                                    type="button"
                                    onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/${competition.id}`)}
                                    className="min-w-0 flex-1 flex items-center gap-3 text-left hover:opacity-90"
                                >
                                    <div className="size-10 rounded-xl bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                        <Trophy size={16} className="text-[#0ECCEE]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="font-medium text-white truncate">{competition.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                            {count} participant{count === 1 ? '' : 's'}
                                            {competition.module ? ` · ${competition.module}` : ''}
                                        </p>
                                    </div>
                                    <ArrowRight size={15} className="text-gray-600 shrink-0" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => downloadExcel(competition.id)}
                                    disabled={exporting}
                                    className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] font-semibold text-gray-300 hover:border-[#0ECCEE]/40 hover:text-[#0ECCEE] disabled:opacity-50"
                                    title="Export Excel for this competition"
                                >
                                    <Download size={12} />
                                    Excel
                                </button>
                            </div>
                        );
                    })}
                    {!competitions.length ? (
                        <p className="p-8 text-center text-sm text-gray-500">No competitions yet</p>
                    ) : null}
                </div>
            </section>
        </div>
    );
}

export default function FestOrganizerDashboardPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [qrOpen, setQrOpen] = useState(false);

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const dash = await fetchFestOrganizerDashboard(festId);
            setData(dash);
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
        return <InlinePageLoader label="Loading overview…" variant="fest" />;
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
    const plugin = getFestPlugin(festId, fest);
    const hideProShow = plugin.hideProShow;
    const unpaidCount = Number(payments.pending || 0);
    const publicUrl = fest.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : `${window.location.origin}/view-details/${fest.id}`;

    const totalPending = Number(stats.pendingRegistrations) || 0;
    const totalApproved = Number(stats.totalRegistrations) || 0;
    const peopleFromComps = comps.reduce(
        (sum, c) => sum + (Number(c.participants) || 0),
        0,
    );
    const totalParticipants = Math.max(
        Number(stats.totalParticipants) || 0,
        peopleFromComps,
        totalApproved,
    );
    const checkedIn = Number(stats.checkedIn) || 0;
    const pendingCheckIn = Number(stats.pendingCheckIn) || 0;
    const checkInRate = Number(stats.checkInRate) || 0;

    const quickOps = hideProShow
        ? [
            { label: 'Auditorium', desc: 'Seats · invites · gate', to: 'auditorium', icon: Ticket, glow: 'from-violet-500/15' },
            { label: 'Competitions', desc: `${stats.competitionCount || comps.length} desks`, to: 'competitions', icon: Trophy, glow: 'from-[#0ECCEE]/15' },
            { label: 'Fest Day Desk', desc: 'Pay · issue · assist', to: 'fest-day-desk', icon: ScanLine, glow: 'from-sky-500/10' },
            { label: 'Scan', desc: 'Gate check-in', to: 'scan', icon: QrCode, glow: 'from-emerald-500/15' },
            { label: 'Connect', desc: 'WA · call · push', to: 'notifications', icon: Bell, glow: 'from-amber-500/10' },
        ]
        : [
            { label: 'Live feed', desc: 'Fest day updates', to: 'live', icon: Radio, glow: 'from-red-500/15' },
            { label: 'Competitions', desc: `${stats.competitionCount || comps.length} ops desks`, to: 'competitions', icon: Trophy, glow: 'from-[#0ECCEE]/15' },
            { label: 'Pro Show', desc: 'Sold · passes · gate', to: 'pro-show', icon: Mic2, glow: 'from-fuchsia-500/10' },
            { label: 'Scan', desc: 'Gate check-in', to: 'scan', icon: QrCode, glow: 'from-emerald-500/15' },
            { label: 'Connect', desc: 'WA · call · push', to: 'notifications', icon: Bell, glow: 'from-amber-500/10' },
            { label: 'Edit listing', desc: 'Fest & comps', to: 'edit-listing', icon: Pencil, glow: 'from-[#0ECCEE]/12' },
        ];

    const qrComps = comps.filter((c) => c.id);

    if (plugin.simpleOrganizerPortal) {
        return (
            <SimpleOrganizerDashboard
                fest={fest}
                stats={stats}
                competitions={comps}
                festId={festId}
                navigate={navigate}
                reload={load}
                pluginId={plugin.id}
            />
        );
    }

    return (
        <div className={`mx-auto space-y-5 ${hideProShow ? 'max-w-6xl' : 'max-w-5xl'}`}>
            <div>
            <div className="space-y-5 min-w-0">
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
            <div className={`grid grid-cols-2 ${hideProShow ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3`}>
                {hideProShow ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?checkInStatus=not_in`)}
                        className="rounded-2xl border border-amber-400/30 bg-linear-to-br from-amber-500/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Clock size={16} className="text-amber-300" />
                            {pendingCheckIn > 0 ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black">
                                    Outside
                                </span>
                            ) : null}
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-white">{pendingCheckIn}</p>
                        <p className="text-xs text-amber-200/80 mt-1">Outside</p>
                        <p className="text-[11px] text-gray-500 mt-1">{stats.todayRegistrations || 0} new today</p>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?status=pending`)}
                        className="rounded-2xl border border-amber-400/30 bg-linear-to-br from-amber-500/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Clock size={16} className="text-amber-300" />
                            {totalPending > 0 ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-black">
                                    Action
                                </span>
                            ) : null}
                        </div>
                        <p className="text-2xl font-bold tabular-nums text-white">{totalPending}</p>
                        <p className="text-xs text-amber-200/80 mt-1">Need review</p>
                        <p className="text-[11px] text-gray-500 mt-1">{stats.todayRegistrations || 0} new today</p>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?status=approved`)}
                    className="rounded-2xl border border-[#0ECCEE]/30 bg-linear-to-br from-[#0ECCEE]/20 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <Users size={16} className="text-[#0ECCEE] mb-2" />
                    <p className="text-2xl font-bold tabular-nums text-white">{totalApproved}</p>
                    <p className="text-xs text-[#0ECCEE]/90 mt-1">
                        {hideProShow ? 'Registrations' : 'Participants in'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {hideProShow
                            ? `${totalParticipants.toLocaleString('en-IN')} people overall`
                            : `${stats.allActive || 0} active total`}
                    </p>
                </button>

                {hideProShow ? (
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?status=approved`)}
                        className="rounded-2xl border border-sky-400/30 bg-linear-to-br from-sky-500/15 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                        <Users size={16} className="text-sky-300 mb-2" />
                        <p className="text-2xl font-bold tabular-nums text-white">
                            {totalParticipants.toLocaleString('en-IN')}
                        </p>
                        <p className="text-xs text-sky-200/90 mt-1">People</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            All names on paid / approved rosters
                        </p>
                    </button>
                ) : null}

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
                    {!hideProShow && pendingCheckIn > 0 ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/fest-organizer/fests/${festId}/participants?checkInStatus=not_in`);
                            }}
                            className="mt-2 text-[11px] font-medium text-emerald-300 hover:text-emerald-200"
                        >
                            Still outside →
                        </button>
                    ) : null}
                </button>

                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/revenue`)}
                    className="rounded-2xl border border-emerald-400/20 bg-linear-to-br from-emerald-500/10 to-[#161718] p-4 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                >
                    <IndianRupee size={16} className="text-emerald-300 mb-2" />
                    <p className="text-2xl font-bold tabular-nums text-white">
                        ₹{Number(stats.revenue || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                        {hideProShow ? 'After 1.6% gateway' : 'Revenue'}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                        {hideProShow
                            ? (unpaidCount > 0
                                ? `${payments.paid || 0} paid · ${unpaidCount} unpaid`
                                : `${payments.paid || 0} paid`)
                            : `${payments.paid || 0} paid · ${payments.pending || 0} unpaid`}
                    </p>
                </button>
            </div>

            {/* Quick ops */}
            <div className={`grid grid-cols-2 ${hideProShow ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-5'} gap-2`}>
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

            {hideProShow ? (
                <section className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <h2 className="text-sm font-semibold text-white">Competitions</h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Entries · people · slots left
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                            className="text-xs text-[#0ECCEE] inline-flex items-center gap-1"
                        >
                            View all <ArrowRight size={12} />
                        </button>
                    </div>
                    <div className="space-y-2">
                        {[...comps]
                            .sort((a, b) => (Number(b.participants) || Number(b.approved) || 0) - (Number(a.participants) || Number(a.approved) || 0))
                            .slice(0, 12)
                            .map((c) => {
                                const approved = Number(c.approved) || 0;
                                const people = Number(c.participants) || approved;
                                const outside = Math.max(0, approved - (Number(c.checkedIn) || 0));
                                const slotsAllotted = Math.max(0, Number(c.slotsAllotted) || 0);
                                const slotsLeft = slotsAllotted > 0
                                    ? Math.max(0, Number(c.slotsLeft ?? (slotsAllotted - (c.slotsFilled ?? approved))))
                                    : null;
                                return (
                                    <button
                                        key={String(c.id)}
                                        type="button"
                                        onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/${c.id}`)}
                                        className="w-full rounded-2xl border border-white/10 bg-[#161718] p-3 text-left hover:border-[#0ECCEE]/40 transition"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#1a1b1d] ring-1 ring-white/10">
                                                <img
                                                    src={getImageUrl(c.coverImage, { preset: 'cardSm' })}
                                                    alt=""
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                    onError={(e) => handleImageErrorWithFallback(e, 48, 48, '#0ea5e9', c.name || 'C')}
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                                                    {outside > 0 ? (
                                                        <span className="text-[10px] font-medium text-amber-300 shrink-0">
                                                            {outside} outside
                                                        </span>
                                                    ) : null}
                                                </div>
                                                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                                                    <div className="rounded-lg bg-white/4 border border-white/8 px-2 py-1.5 text-center">
                                                        <p className="text-sm font-bold tabular-nums text-white">{approved}</p>
                                                        <p className="text-[9px] uppercase tracking-wide text-gray-500">Entries</p>
                                                    </div>
                                                    <div className="rounded-lg bg-[#0ECCEE]/8 border border-[#0ECCEE]/20 px-2 py-1.5 text-center">
                                                        <p className="text-sm font-bold tabular-nums text-[#0ECCEE]">{people}</p>
                                                        <p className="text-[9px] uppercase tracking-wide text-gray-500">People</p>
                                                    </div>
                                                    <div className={`rounded-lg border px-2 py-1.5 text-center ${
                                                        slotsLeft === 0 && slotsAllotted > 0
                                                            ? 'bg-amber-500/10 border-amber-400/25'
                                                            : 'bg-white/4 border-white/8'
                                                    }`}>
                                                        <p className={`text-sm font-bold tabular-nums ${slotsLeft === 0 && slotsAllotted > 0 ? 'text-amber-200' : 'text-white'}`}>
                                                            {slotsAllotted > 0 ? slotsLeft : '∞'}
                                                        </p>
                                                        <p className="text-[9px] uppercase tracking-wide text-gray-500">Slots left</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight size={14} className="text-gray-600 shrink-0" />
                                        </div>
                                    </button>
                                );
                            })}
                        {!comps.length ? (
                            <p className="text-sm text-gray-500 py-8 text-center">No competitions yet</p>
                        ) : null}
                    </div>
                </section>
            ) : qrComps.length ? (
                <button
                    type="button"
                    onClick={() => setQrOpen(true)}
                    className="w-full rounded-2xl border border-[#0ECCEE]/25 bg-linear-to-r from-[#0ECCEE]/12 to-[#161718] p-4 text-left hover:border-[#0ECCEE]/45 transition flex items-center gap-3"
                >
                    <div className="size-11 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                        <Download size={18} className="text-[#0ECCEE]" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">Competition QR codes</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Download or print QRs for each competition page
                        </p>
                    </div>
                    <ArrowRight size={16} className="text-[#0ECCEE] shrink-0" />
                </button>
            ) : null}

            {hideProShow && unpaidCount > 0 ? (
                <section className="rounded-2xl border border-amber-400/25 bg-amber-500/8 p-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-100">Unpaid to chase</p>
                        <p className="text-xs text-amber-200/70 mt-0.5">
                            {unpaidCount} registration{unpaidCount === 1 ? '' : 's'} still pending payment
                        </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => navigate(`/fest-organizer/fests/${festId}/participants?paymentStatus=pending`)}
                            className="px-3 py-2 rounded-xl border border-amber-400/30 text-xs font-medium text-amber-100"
                        >
                            View roster
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate(`/fest-organizer/fests/${festId}/notifications?audience=unpaid&tab=connect`)}
                            className="px-3 py-2 rounded-xl bg-amber-400 text-black text-xs font-semibold"
                        >
                            Open Connect
                        </button>
                    </div>
                </section>
            ) : null}

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
                        {recent.map((r) => {
                            const pay = String(r.paymentStatus || '').toLowerCase();
                            const payTone = pay === 'paid' || pay === 'free'
                                ? 'text-emerald-400'
                                : pay === 'pending'
                                    ? 'text-amber-400'
                                    : 'text-gray-400';
                            const statusLabel = hideProShow
                                ? (r.status === 'approved' ? 'registered' : r.status)
                                : r.status;
                            return (
                            <button
                                key={r.id}
                                type="button"
                                onClick={() => navigate(
                                    hideProShow && (pay === 'pending' || pay === 'failed')
                                        ? `/fest-organizer/fests/${festId}/participants?paymentStatus=pending`
                                        : `/fest-organizer/fests/${festId}/participants?status=${r.status === 'pending' ? 'pending' : 'approved'}`,
                                )}
                                className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/3 px-3 py-2.5 border border-transparent hover:border-white/10 transition text-left"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm text-white truncate">{r.userName || '—'}</p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                        {r.competitionName || 'General'}
                                        {r.teamName ? ` · ${r.teamName}` : ''}
                                        {r.college ? ` · ${r.college}` : ''}
                                        {' · '}
                                        <span className={payTone}>{r.paymentStatus || '—'}</span>
                                        {!hideProShow ? (
                                            <>
                                                {' · '}
                                                <span className={r.status === 'pending' ? 'text-amber-400' : 'text-gray-400'}>
                                                    {statusLabel}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                {' · '}
                                                <span className="text-gray-500">{statusLabel}</span>
                                            </>
                                        )}
                                    </p>
                                    {Array.isArray(r.highlights) && r.highlights.length ? (
                                        <p className="text-[10px] text-gray-600 truncate mt-0.5">
                                            {r.highlights.map((h) => `${h.label}: ${h.value}`).join(' · ')}
                                        </p>
                                    ) : null}
                                </div>
                                <p className="text-[10px] text-gray-600 shrink-0">{formatWhen(r.createdAt)}</p>
                            </button>
                            );
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 py-6 text-center">No registrations yet</p>
                )}
            </section>

            <FestOrganizerCompetitionQrModal
                open={qrOpen}
                onClose={() => setQrOpen(false)}
                festName={fest?.festName || ''}
                competitions={qrComps}
            />
            </div>

            </div>
        </div>
    );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Bell, Check, ChevronDown, Download, GraduationCap,
    Loader, MapPin, MessageCircle, Phone, Plus, QrCode, RefreshCw,
    Search, Users, X,
} from 'lucide-react';
import {
    fetchFestOrganizerCompetitionOps,
    updateFestOrganizerParticipantStatus,
    bulkUpdateFestOrganizerParticipantStatus,
    exportFestOrganizerParticipants,
    updateFestOrganizerCompetitionSlots,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import FestOrganizerManualAddModal from './FestOrganizerManualAddModal';

const TABS = [
    { id: 'pending', label: 'Review' },
    { id: 'teams', label: 'Teams' },
    { id: 'people', label: 'People' },
];

function waLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCountry}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

function payTone(paymentStatus) {
    if (paymentStatus === 'paid') return 'text-emerald-400';
    if (paymentStatus === 'pending') return 'text-amber-400';
    if (paymentStatus === 'free') return 'text-gray-400';
    return 'text-gray-500';
}

function statusTone(status) {
    if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300';
    if (status === 'pending') return 'bg-amber-500/15 text-amber-400';
    if (status === 'rejected') return 'bg-red-500/15 text-red-300';
    return 'bg-white/5 text-gray-400';
}

function formatWhen(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function ContactIcons({ phone, email }) {
    const wa = waLink(phone);
    const tel = telLink(phone);
    if (!wa && !tel && !email) return null;
    return (
        <div className="flex items-center gap-1.5 shrink-0">
            {wa ? (
                <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"
                    aria-label="WhatsApp"
                >
                    <MessageCircle size={14} />
                </a>
            ) : null}
            {tel ? (
                <a
                    href={tel}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 rounded-lg bg-white/5 text-gray-300"
                    aria-label="Call"
                >
                    <Phone size={14} />
                </a>
            ) : null}
        </div>
    );
}

function MetaLine({ college, city, year, course }) {
    const bits = [college, city, year, course].filter(Boolean);
    if (!bits.length) return null;
    return (
        <p className="text-xs text-gray-500 mt-0.5 truncate flex items-center gap-1">
            {college || city ? <MapPin size={11} className="shrink-0 opacity-60" /> : null}
            {bits.join(' · ')}
        </p>
    );
}

function TeamCard({ team, busyId, onApproveIds, onRejectIds }) {
    const [open, setOpen] = useState(Boolean(team.pendingCount > 0));
    const memberCount = team.memberCount || team.members?.length || team.registrations?.length || 0;
    const pendingIds = (team.registrations || [])
        .filter((r) => r.status === 'pending')
        .map((r) => r.id);

    return (
        <div className={`rounded-2xl border overflow-hidden transition ${
            team.pendingCount
                ? 'border-amber-500/25 bg-[#161718]'
                : 'border-white/8 bg-[#161718]'
        }`}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full text-left p-3.5 flex items-start gap-3"
            >
                <div className="size-11 rounded-xl bg-[#0ECCEE]/12 border border-[#0ECCEE]/20 flex items-center justify-center shrink-0">
                    <Users size={18} className="text-[#0ECCEE]" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                        <p className="text-[15px] font-semibold text-white leading-snug flex-1">
                            {team.teamName}
                        </p>
                        <ChevronDown
                            size={16}
                            className={`text-gray-500 shrink-0 mt-0.5 transition ${open ? 'rotate-180' : ''}`}
                        />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                        {memberCount} member{memberCount === 1 ? '' : 's'}
                        {team.captainName ? ` · Captain ${team.captainName}` : ''}
                    </p>
                    <MetaLine college={team.college} city={team.city} year={team.year} course={team.course} />
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusTone(team.status)}`}>
                            {team.status}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 ${payTone(team.paymentStatus)}`}>
                            {team.paymentStatus} · ₹{Number(team.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        {team.pendingCount > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400 text-black font-semibold">
                                {team.pendingCount} to review
                            </span>
                        ) : null}
                        {team.checkedInCount > 0 ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                                {team.checkedInCount} checked in
                            </span>
                        ) : null}
                        {team.isManual ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">Walk-in</span>
                        ) : null}
                    </div>
                </div>
                <ContactIcons phone={team.captainPhone} email={team.captainEmail} />
            </button>

            {open ? (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/6 pt-3">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-2">Roster</p>
                        <ul className="space-y-1.5">
                            {(team.members || []).map((name) => {
                                const isCaptain = name === team.captainName;
                                return (
                                    <li
                                        key={name}
                                        className="flex items-center gap-2 text-sm text-gray-200"
                                    >
                                        <span className={`size-1.5 rounded-full shrink-0 ${isCaptain ? 'bg-[#0ECCEE]' : 'bg-gray-600'}`} />
                                        <span className="truncate">{name}</span>
                                        {isCaptain ? (
                                            <span className="text-[10px] text-[#0ECCEE]">captain</span>
                                        ) : null}
                                    </li>
                                );
                            })}
                            {!team.members?.length ? (
                                <li className="text-xs text-gray-600">No member names on form</li>
                            ) : null}
                        </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-white/3 px-3 py-2">
                            <p className="text-[10px] text-gray-500">Registered</p>
                            <p className="text-white mt-0.5">{formatWhen(team.submittedAt) || '—'}</p>
                        </div>
                        <div className="rounded-xl bg-white/3 px-3 py-2">
                            <p className="text-[10px] text-gray-500">Check-in</p>
                            <p className="text-white mt-0.5">
                                {team.checkedInCount || 0}/{team.registrations?.length || 1}
                            </p>
                        </div>
                        {team.college ? (
                            <div className="rounded-xl bg-white/3 px-3 py-2 col-span-2">
                                <p className="text-[10px] text-gray-500 flex items-center gap-1">
                                    <GraduationCap size={10} /> College
                                </p>
                                <p className="text-white mt-0.5">{team.college}</p>
                            </div>
                        ) : null}
                    </div>

                    {team.highlights?.length ? (
                        <div className="rounded-xl border border-white/8 overflow-hidden">
                            <p className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-gray-600 bg-white/3">
                                Form details
                            </p>
                            <div className="divide-y divide-white/5">
                                {team.highlights.map((h) => (
                                    <div key={h.key} className="px-3 py-2 flex justify-between gap-3">
                                        <span className="text-[11px] text-gray-500 shrink-0">{h.label}</span>
                                        <span className="text-xs text-white text-right break-words">{h.value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {(team.registrations || []).length > 1 ? (
                        <div>
                            <p className="text-[10px] uppercase tracking-wide text-gray-600 mb-2">Entries</p>
                            <div className="space-y-1.5">
                                {team.registrations.map((r) => (
                                    <div
                                        key={r.id}
                                        className="flex items-center justify-between gap-2 rounded-xl bg-white/3 px-3 py-2"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-xs text-white truncate">{r.userName || 'Entry'}</p>
                                            <p className={`text-[10px] ${payTone(r.paymentStatus)}`}>
                                                {r.status} · {r.paymentStatus}
                                                {r.checkedIn ? ' · in' : ''}
                                            </p>
                                        </div>
                                        <ContactIcons phone={r.userPhone} email={r.userEmail} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    {pendingIds.length ? (
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => onApproveIds(pendingIds)}
                                className="py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                                <Check size={14} /> Approve team
                            </button>
                            <button
                                type="button"
                                disabled={Boolean(busyId)}
                                onClick={() => onRejectIds(pendingIds)}
                                className="py-2.5 rounded-xl bg-white/5 text-gray-300 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1"
                            >
                                <X size={14} /> Reject
                            </button>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}

export default function FestOrganizerCompetitionWorkspacePage() {
    const { festId, competitionId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast } = useDialog();

    const tabParam = searchParams.get('tab');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [listQuery, setListQuery] = useState('');
    const [teamFilter, setTeamFilter] = useState('all'); // all | pending | paid | in
    const [slotsInput, setSlotsInput] = useState('');
    const [slotsBusy, setSlotsBusy] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetchFestOrganizerCompetitionOps(festId, competitionId);
            setData(res);
        } catch (e) {
            setError(e.message || 'Failed to load');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [festId, competitionId]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (!data?.competition) return;
        const n = Number(data.competition.slotsAllotted) || 0;
        setSlotsInput(n > 0 ? String(n) : '');
    }, [data?.competition?.id, data?.competition?.slotsAllotted]);

    const stats = data?.stats;
    const competition = data?.competition;
    const pending = data?.pending || [];
    const teams = data?.teams || [];
    const solo = data?.solo || [];
    const participants = data?.participants || [];

    const tab = tabParam || (pending.length > 0 ? 'pending' : 'teams');

    const setTab = (id) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', id);
        setSearchParams(next, { replace: true });
        setListQuery('');
        setTeamFilter('all');
    };

    const paidPendingIds = useMemo(
        () => pending.filter((p) => p.paymentStatus === 'paid' || p.paymentStatus === 'free').map((p) => p.id),
        [pending],
    );

    const q = listQuery.trim().toLowerCase();

    const filteredPending = useMemo(() => {
        if (!q) return pending;
        return pending.filter((p) => {
            const hay = `${p.userName} ${p.teamName} ${p.college} ${p.city} ${p.userPhone} ${(p.members || []).join(' ')}`.toLowerCase();
            return hay.includes(q);
        });
    }, [pending, q]);

    const filteredTeams = useMemo(() => {
        let list = teams;
        if (teamFilter === 'pending') list = list.filter((t) => t.pendingCount > 0);
        if (teamFilter === 'paid') list = list.filter((t) => t.paymentStatus === 'paid' || t.paymentStatus === 'free');
        if (teamFilter === 'in') list = list.filter((t) => t.checkedInCount > 0);
        if (!q) return list;
        return list.filter((t) => {
            const hay = `${t.teamName} ${t.captainName} ${t.college} ${t.city} ${(t.members || []).join(' ')}`.toLowerCase();
            return hay.includes(q);
        });
    }, [teams, q, teamFilter]);

    const filteredSolo = useMemo(() => {
        if (teamFilter === 'pending') {
            const list = solo.filter((p) => p.status === 'pending');
            if (!q) return list;
            return list.filter((p) => `${p.userName} ${p.college} ${p.userPhone}`.toLowerCase().includes(q));
        }
        if (!q) return solo;
        return solo.filter((p) => {
            const hay = `${p.userName} ${p.college} ${p.city} ${p.userPhone}`.toLowerCase();
            return hay.includes(q);
        });
    }, [solo, q, teamFilter]);

    const filteredPeople = useMemo(() => {
        if (!q) return participants;
        return participants.filter((p) => {
            const hay = `${p.userName} ${p.teamName} ${p.college} ${p.userPhone} ${p.userEmail}`.toLowerCase();
            return hay.includes(q);
        });
    }, [participants, q]);

    const setStatus = async (registrationId, status) => {
        setBusyId(`${registrationId}:${status}`);
        try {
            await updateFestOrganizerParticipantStatus(festId, registrationId, status);
            toast(status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Updated');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const approveIds = async (ids) => {
        if (!ids?.length) return;
        setBusyId('bulk-approve');
        try {
            const res = await bulkUpdateFestOrganizerParticipantStatus(festId, ids, 'approved');
            toast(res.message || 'Approved');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const rejectIds = async (ids) => {
        if (!ids?.length) return;
        setBusyId('bulk-reject');
        try {
            const res = await bulkUpdateFestOrganizerParticipantStatus(festId, ids, 'rejected');
            toast(res.message || 'Rejected');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const bulkApprovePaid = async () => {
        if (!paidPendingIds.length) {
            toast('No paid/free pending entries');
            return;
        }
        setBulkBusy(true);
        try {
            const res = await bulkUpdateFestOrganizerParticipantStatus(festId, paidPendingIds, 'approved');
            toast(res.message || 'Approved');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBulkBusy(false);
        }
    };

    const doExport = async () => {
        setExporting(true);
        try {
            const blob = await exportFestOrganizerParticipants(festId, { competitionId });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(competition?.name || 'competition').replace(/[^\w]+/g, '_')}_roster.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Export downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const saveSlots = async (override) => {
        const raw = override !== undefined ? String(override) : String(slotsInput || '').trim();
        const n = raw === '' ? 0 : Number(raw);
        if (!Number.isFinite(n) || n < 0) {
            toast('Enter 0 or a positive slot count');
            return;
        }
        setSlotsBusy(true);
        try {
            const res = await updateFestOrganizerCompetitionSlots(festId, competitionId, Math.floor(n));
            toast(res.message || 'Slots updated');
            await load();
        } catch (e) {
            toast(e.message || 'Failed to update slots');
        } finally {
            setSlotsBusy(false);
        }
    };

    if (loading && !data) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading…
            </div>
        );
    }

    if (error && !data) {
        return (
            <div className="max-w-2xl mx-auto space-y-3">
                <button
                    type="button"
                    onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                    className="text-sm text-gray-400 inline-flex items-center gap-1"
                >
                    <ArrowLeft size={14} /> Back
                </button>
                <p className="text-sm text-red-400">{error}</p>
                <button type="button" onClick={load} className="text-sm text-[#0ECCEE]">Retry</button>
            </div>
        );
    }

    const checkInRate = stats?.approved
        ? Math.round(((stats.checkedIn || 0) / stats.approved) * 100)
        : (stats?.checkInRate || 0);
    const pendingGate = Math.max(0, (stats?.approved || 0) - (stats?.checkedIn || 0));

    const tabHelp = {
        pending: 'Approve or reject people waiting to join this competition.',
        teams: 'Squads grouped by team name — expand a card for roster & form details.',
        people: 'Flat list of everyone registered for this competition.',
    };

    return (
        <div className="max-w-2xl mx-auto space-y-4 pb-10">
            {/* Header box */}
            <section className="relative overflow-hidden rounded-3xl border border-[#0ECCEE]/25 bg-[#121314]">
                <img
                    src={getImageUrl(competition?.coverImage, { preset: 'card' })}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/25 via-[#121314]/80 to-[#121314]" />
                <div className="relative p-4 sm:p-5 space-y-3">
                    <div className="flex items-start gap-3">
                        <button
                            type="button"
                            onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions`)}
                            className="p-2 rounded-xl bg-black/35 border border-white/15 text-white shrink-0"
                            aria-label="Back"
                        >
                            <ArrowLeft size={18} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">
                                Competition desk
                            </p>
                            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight mt-0.5">
                                {competition?.name || 'Competition'}
                            </h1>
                            <p className="text-xs text-gray-300 mt-1">
                                {data?.fest?.festName || ''}
                                {competition?.feeAmount
                                    ? ` · ₹${Number(competition.feeAmount).toLocaleString('en-IN')}`
                                    : ' · Free'}
                                {competition?.category ? ` · ${competition.category}` : ''}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={load}
                            className="p-2 rounded-xl bg-black/35 border border-white/15 text-white"
                            aria-label="Refresh"
                        >
                            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Stat boxes */}
            {stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="rounded-2xl border border-[#0ECCEE]/35 bg-linear-to-br from-[#0ECCEE]/20 to-[#161718] p-3.5">
                        <p className="text-[10px] uppercase tracking-wide text-[#0ECCEE]/90">Total entries</p>
                        <p className="text-2xl font-bold tabular-nums text-white mt-1">{stats.total}</p>
                        <p className="text-[11px] text-gray-500 mt-1">{stats.approved} approved</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setTab('pending')}
                        className="rounded-2xl border border-amber-400/35 bg-linear-to-br from-amber-500/20 to-[#161718] p-3.5 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                        <p className="text-[10px] uppercase tracking-wide text-amber-200/80">To review</p>
                        <p className="text-2xl font-bold tabular-nums text-white mt-1">{stats.pending}</p>
                        <p className="text-[11px] text-gray-500 mt-1">Tap to open queue</p>
                    </button>
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/scan?competitionId=${competitionId}`)}
                        className="rounded-2xl border border-emerald-400/35 bg-linear-to-br from-emerald-500/20 to-[#161718] p-3.5 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                    >
                        <p className="text-[10px] uppercase tracking-wide text-emerald-200/80">Check-in</p>
                        <p className="text-2xl font-bold tabular-nums text-white mt-1">{stats.checkedIn}</p>
                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${checkInRate}%` }} />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">{checkInRate}% · {pendingGate} outside</p>
                    </button>
                    <div className="rounded-2xl border border-white/15 bg-linear-to-br from-white/8 to-[#161718] p-3.5">
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Slots</p>
                        <p className="text-2xl font-bold tabular-nums text-white mt-1">
                            {stats.slotsAllotted > 0
                                ? `${stats.slotsFilled ?? stats.approved}/${stats.slotsAllotted}`
                                : 'Open'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {stats.slotsAllotted > 0
                                ? `${stats.slotsLeft ?? 0} left`
                                : 'Not allotted yet'}
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Allot slots */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">Allot slots</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        Set how many seats this competition can take. 0 or empty = open / unlimited.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                    <input
                        type="number"
                        min="0"
                        inputMode="numeric"
                        value={slotsInput}
                        onChange={(e) => setSlotsInput(e.target.value)}
                        placeholder="e.g. 32"
                        className="w-28 px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#0ECCEE]/40"
                    />
                    <button
                        type="button"
                        disabled={slotsBusy}
                        onClick={saveSlots}
                        className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50"
                    >
                        {slotsBusy ? 'Saving…' : 'Save slots'}
                    </button>
                    {competition?.slotsAllotted > 0 ? (
                        <button
                            type="button"
                            disabled={slotsBusy}
                            onClick={() => {
                                setSlotsInput('');
                                saveSlots(0);
                            }}
                            className="px-3 py-2.5 rounded-xl border border-white/10 text-xs text-gray-400"
                        >
                            Clear (open)
                        </button>
                    ) : null}
                </div>
                {stats?.slotsAllotted > 0 ? (
                    <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${
                                (stats.slotsLeft ?? 0) === 0 ? 'bg-amber-400' : 'bg-[#0ECCEE]'
                            }`}
                            style={{
                                width: `${Math.min(100, Math.round(((stats.slotsFilled || 0) / stats.slotsAllotted) * 100))}%`,
                            }}
                        />
                    </div>
                ) : null}
            </section>

            {/* Action boxes with clear labels */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">Do something</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">Only for this competition — not the whole fest</p>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                    <Link
                        to={`/fest-organizer/fests/${festId}/scan?competitionId=${competitionId}`}
                        className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-3.5 hover:border-emerald-400/50 transition"
                    >
                        <QrCode size={20} className="text-emerald-300 mb-2" />
                        <p className="text-sm font-semibold text-white">Gate scan</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Check in QRs for this room only</p>
                    </Link>
                    <Link
                        to={`/fest-organizer/fests/${festId}/notifications?competitionId=${competitionId}&tab=connect`}
                        className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3.5 hover:border-amber-400/50 transition"
                    >
                        <Bell size={20} className="text-amber-300 mb-2" />
                        <p className="text-sm font-semibold text-white">Connect</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">WhatsApp / call / in-app for this comp</p>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setManualOpen(true)}
                        className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 p-3.5 text-left hover:border-[#0ECCEE]/50 transition"
                    >
                        <Plus size={20} className="text-[#0ECCEE] mb-2" />
                        <p className="text-sm font-semibold text-white">Add walk-in</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">VIP / guest — issues a QR</p>
                    </button>
                    <button
                        type="button"
                        disabled={exporting}
                        onClick={doExport}
                        className="rounded-2xl border border-white/15 bg-white/5 p-3.5 text-left hover:border-white/30 transition disabled:opacity-50"
                    >
                        {exporting ? <Loader className="animate-spin text-gray-300 mb-2" size={20} /> : <Download size={20} className="text-gray-300 mb-2" />}
                        <p className="text-sm font-semibold text-white">Export CSV</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Roster for judges / college</p>
                    </button>
                </div>
            </section>

            {/* Work area box */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] overflow-hidden">
                <div className="grid grid-cols-3 border-b border-white/10">
                    {TABS.map((t) => {
                        const count = t.id === 'pending'
                            ? pending.length
                            : t.id === 'teams'
                                ? teams.length
                                : participants.length;
                        const active = tab === t.id;
                        return (
                            <button
                                key={t.id}
                                type="button"
                                onClick={() => setTab(t.id)}
                                className={`py-3 px-2 text-center transition ${
                                    active
                                        ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                        : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
                                }`}
                            >
                                <p className="text-sm font-semibold">{t.label}</p>
                                <p className={`text-[11px] tabular-nums mt-0.5 ${active ? 'text-[#0ECCEE]/80' : 'text-gray-600'}`}>
                                    {count}
                                </p>
                            </button>
                        );
                    })}
                </div>

                <div className="p-3.5 space-y-3">
                    <div className="rounded-xl bg-white/4 border border-white/8 px-3 py-2">
                        <p className="text-xs text-gray-400">{tabHelp[tab]}</p>
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={listQuery}
                            onChange={(e) => setListQuery(e.target.value)}
                            placeholder={tab === 'teams' ? 'Search team, college, captain…' : tab === 'pending' ? 'Search pending…' : 'Search people…'}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                        />
                    </div>

                    {tab === 'pending' ? (
                        <div className="space-y-2.5">
                            {paidPendingIds.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={bulkApprovePaid}
                                    disabled={bulkBusy}
                                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50"
                                >
                                    {bulkBusy ? 'Approving…' : `Approve all paid & free (${paidPendingIds.length})`}
                                </button>
                            ) : null}

                            {filteredPending.map((p) => (
                                <div key={p.id} className="rounded-2xl bg-[#121314] border border-amber-400/30 p-3.5 space-y-2.5">
                                    <div className="flex items-start gap-3">
                                        <div className="min-w-0 flex-1">
                                            {p.teamName ? (
                                                <p className="text-[11px] font-semibold text-[#0ECCEE] mb-0.5">{p.teamName}</p>
                                            ) : null}
                                            <p className="text-[15px] font-semibold text-white truncate">{p.userName || 'Unnamed'}</p>
                                            <MetaLine college={p.college} city={p.city} year={p.year} course={p.course} />
                                            <div className="flex flex-wrap gap-1.5 mt-2">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 ${payTone(p.paymentStatus)}`}>
                                                    {p.paymentStatus} · ₹{Number(p.amountPaid || 0).toLocaleString('en-IN')}
                                                </span>
                                                {p.isManual ? (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">Walk-in</span>
                                                ) : null}
                                            </div>
                                            {p.members?.length ? (
                                                <p className="text-[11px] text-gray-500 mt-1.5">Members: {p.members.join(', ')}</p>
                                            ) : null}
                                            {p.highlights?.length ? (
                                                <div className="mt-2 rounded-xl bg-white/3 border border-white/8 divide-y divide-white/5 overflow-hidden">
                                                    {p.highlights.slice(0, 4).map((h) => (
                                                        <div key={h.key} className="px-2.5 py-1.5 flex justify-between gap-2">
                                                            <span className="text-[10px] text-gray-500">{h.label}</span>
                                                            <span className="text-[11px] text-gray-300 text-right truncate max-w-[60%]">{h.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </div>
                                        <ContactIcons phone={p.userPhone} email={p.userEmail} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            disabled={Boolean(busyId)}
                                            onClick={() => setStatus(p.id, 'approved')}
                                            className="py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                        >
                                            {busyId === `${p.id}:approved` ? <Loader className="animate-spin" size={14} /> : <Check size={14} />}
                                            Approve
                                        </button>
                                        <button
                                            type="button"
                                            disabled={Boolean(busyId)}
                                            onClick={() => setStatus(p.id, 'rejected')}
                                            className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1"
                                        >
                                            {busyId === `${p.id}:rejected` ? <Loader className="animate-spin" size={14} /> : <X size={14} />}
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}

                            {!filteredPending.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                                    <p className="text-sm text-gray-500">{q ? 'No matches' : 'Queue empty — nothing to review'}</p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {tab === 'teams' ? (
                        <div className="space-y-3">
                            <div className="flex gap-1.5 overflow-x-auto">
                                {[
                                    { id: 'all', label: 'All' },
                                    { id: 'pending', label: 'Need review' },
                                    { id: 'paid', label: 'Paid' },
                                    { id: 'in', label: 'Checked in' },
                                ].map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setTeamFilter(f.id)}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                                            teamFilter === f.id
                                                ? 'bg-[#0ECCEE] text-black'
                                                : 'bg-white/5 text-gray-400 border border-white/10'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

                            {filteredTeams.map((t) => (
                                <TeamCard
                                    key={t.id || t.teamName}
                                    team={t}
                                    busyId={busyId}
                                    onApproveIds={approveIds}
                                    onRejectIds={rejectIds}
                                />
                            ))}

                            {filteredSolo.length ? (
                                <div className="rounded-2xl border border-white/10 bg-[#121314] p-3 space-y-2">
                                    <p className="text-[11px] font-semibold text-gray-400 px-0.5">
                                        Solo entries · {filteredSolo.length}
                                    </p>
                                    <p className="text-[11px] text-gray-600 px-0.5 -mt-1">
                                        No team name on their form
                                    </p>
                                    {filteredSolo.map((p) => (
                                        <div key={p.id} className="rounded-xl bg-white/3 border border-white/8 px-3 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-sm text-white truncate">{p.userName || 'Unnamed'}</p>
                                                    <MetaLine college={p.college} city={p.city} year={p.year} course={p.course} />
                                                    <p className={`text-[11px] mt-1 ${payTone(p.paymentStatus)}`}>
                                                        {p.status} · {p.paymentStatus}
                                                        {p.checkedIn ? ' · in' : ''}
                                                    </p>
                                                </div>
                                                <ContactIcons phone={p.userPhone} email={p.userEmail} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : null}

                            {!filteredTeams.length && !filteredSolo.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center px-4">
                                    <Users className="mx-auto text-gray-600 mb-2" size={28} />
                                    <p className="text-sm text-gray-500">
                                        {q || teamFilter !== 'all'
                                            ? 'No matches'
                                            : 'Teams show up when registrations include a team name'}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {tab === 'people' ? (
                        <div className="space-y-2">
                            {filteredPeople.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 rounded-2xl bg-[#121314] border border-white/10 px-3.5 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-white truncate">{p.userName || 'Unnamed'}</p>
                                        <p className="text-xs text-gray-500 truncate">
                                            {p.teamName ? `${p.teamName} · ` : ''}
                                            {p.college || p.userPhone || '—'}
                                        </p>
                                        <div className="flex flex-wrap gap-1 mt-1.5">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusTone(p.status)}`}>{p.status}</span>
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 ${payTone(p.paymentStatus)}`}>{p.paymentStatus}</span>
                                            {p.checkedIn ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">checked in</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <ContactIcons phone={p.userPhone} email={p.userEmail} />
                                    {p.status === 'pending' ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(busyId)}
                                            onClick={() => setStatus(p.id, 'approved')}
                                            className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500 text-black font-semibold shrink-0"
                                        >
                                            OK
                                        </button>
                                    ) : null}
                                </div>
                            ))}
                            {!filteredPeople.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
                                    <p className="text-sm text-gray-500">{q ? 'No matches' : 'No people yet'}</p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            </section>

            <FestOrganizerManualAddModal
                open={manualOpen}
                onClose={() => setManualOpen(false)}
                festId={festId}
                competitionId={competitionId}
                competitionName={competition?.name}
                defaultFee={competition?.feeAmount || 0}
                onCreated={() => {
                    toast('Participant added');
                    load();
                    setTab('people');
                }}
            />
        </div>
    );
}

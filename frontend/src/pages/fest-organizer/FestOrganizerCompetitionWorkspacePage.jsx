import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Bell, Check, ChevronDown, Download, GraduationCap,
    Loader, Mail, MapPin, MessageCircle, Phone, Plus, QrCode, RefreshCw,
    Search, Trash2, Users, X,
} from 'lucide-react';
import {
    fetchFestOrganizerCompetitionOps,
    updateFestOrganizerParticipantStatus,
    bulkUpdateFestOrganizerParticipantStatus,
    deleteFestOrganizerParticipant,
    exportFestOrganizerParticipants,
    notifyFestOrganizerParticipant,
    updateFestOrganizerCompetitionSlots,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import FestOrganizerManualAddModal from './FestOrganizerManualAddModal';
import OrganizerTeamRoster, { OrganizerRosterPreview } from './OrganizerTeamRoster';
import { isMindSparkFest } from '../../features/fests/mindspark';

const TABS = [
    { id: 'solo', label: 'Solo entries' },
    { id: 'teams', label: 'Team entries' },
];

const LIST_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Need review' },
    { id: 'paid', label: 'Paid' },
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'in', label: 'Checked in' },
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

function SoloEntryCard({
    p,
    busyId,
    onApprove,
    onReject,
    onNotify,
    onDelete,
    hideReview = false,
}) {
    const pending = !hideReview && p.status === 'pending';
    return (
        <div
            className={`rounded-2xl border p-3.5 space-y-2.5 ${
                pending
                    ? 'bg-[#121314] border-amber-400/30'
                    : 'bg-[#121314] border-white/10'
            }`}
        >
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    {p.teamName ? (
                        <p className="text-[11px] font-semibold text-[#0ECCEE] mb-0.5 truncate">{p.teamName}</p>
                    ) : null}
                    <p className="text-[15px] font-semibold text-white truncate">{p.userName || 'Unnamed'}</p>
                    <MetaLine college={p.college} city={p.city} year={p.year} course={p.course} />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                        {!hideReview ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusTone(p.status)}`}>{p.status}</span>
                        ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">registered</span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 ${payTone(p.paymentStatus)}`}>
                            {p.paymentStatus} · ₹{Number(p.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">1 person</span>
                        {p.checkedIn ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">checked in</span>
                        ) : null}
                        {p.isManual ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-400">Walk-in</span>
                        ) : null}
                    </div>
                </div>
                <ContactIcons phone={p.userPhone} email={p.userEmail} />
                {onNotify ? (
                    <button
                        type="button"
                        onClick={() => onNotify(p)}
                        className="p-2 rounded-xl bg-[#0ECCEE]/10 text-[#0ECCEE] shrink-0"
                        title="Notify participant"
                        aria-label={`Notify ${p.userName || 'participant'}`}
                    >
                        <Bell size={15} />
                    </button>
                ) : null}
                {onDelete ? (
                    <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => onDelete(p)}
                        className="p-2 rounded-xl border border-red-400/25 text-red-300 shrink-0 disabled:opacity-50"
                        title="Delete entry"
                        aria-label={`Delete ${p.userName || 'entry'}`}
                    >
                        {busyId === `${p.id}:delete` ? <Loader className="animate-spin" size={15} /> : <Trash2 size={15} />}
                    </button>
                ) : null}
            </div>
            {Array.isArray(p.teamMembers) && p.teamMembers.length ? (
                <OrganizerTeamRoster
                    compact
                    teamMembers={p.teamMembers}
                    personFields={p.personFields}
                    teamSize={1}
                    title="Participant details"
                />
            ) : null}
            {p.highlights?.length ? (
                <div className="rounded-xl bg-white/3 border border-white/8 divide-y divide-white/5 overflow-hidden">
                    {p.highlights.slice(0, 4).map((h) => (
                        <div key={h.key} className="px-2.5 py-1.5 flex justify-between gap-2">
                            <span className="text-[10px] text-gray-500">{h.label}</span>
                            <span className="text-[11px] text-gray-300 text-right truncate max-w-[60%]">{h.value}</span>
                        </div>
                    ))}
                </div>
            ) : null}
            {pending ? (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => onApprove(p.id)}
                        className="py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                        {busyId === `${p.id}:approved` ? <Loader className="animate-spin" size={14} /> : <Check size={14} />}
                        Approve
                    </button>
                    <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => onReject(p.id)}
                        className="py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1"
                    >
                        {busyId === `${p.id}:rejected` ? <Loader className="animate-spin" size={14} /> : <X size={14} />}
                        Reject
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function TeamCard({ team, busyId, onApproveIds, onRejectIds, onDelete, hideReview = false }) {
    const [open, setOpen] = useState(!hideReview && Boolean(team.pendingCount > 0));
    const memberCount = team.memberCount || team.members?.length || team.registrations?.length || 0;
    const pendingIds = hideReview
        ? []
        : (team.registrations || [])
            .filter((r) => r.status === 'pending')
            .map((r) => r.id);

    return (
        <div className={`rounded-2xl border overflow-hidden transition ${
            !hideReview && team.pendingCount
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
                    {!open && Array.isArray(team.teamMembers) && team.teamMembers.length ? (
                        <OrganizerRosterPreview
                            teamMembers={team.teamMembers}
                            teamSize={team.teamSize || team.memberCount}
                        />
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {hideReview ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
                                registered
                            </span>
                        ) : (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusTone(team.status)}`}>
                                {team.status}
                            </span>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full bg-white/5 ${payTone(team.paymentStatus)}`}>
                            {team.paymentStatus} · ₹{Number(team.amountPaid || 0).toLocaleString('en-IN')}
                        </span>
                        {!hideReview && team.pendingCount > 0 ? (
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

            {onDelete ? (
                <div className="px-3.5 pb-3 -mt-1">
                    <button
                        type="button"
                        disabled={Boolean(busyId)}
                        onClick={() => onDelete(team)}
                        className="w-full py-2 rounded-xl border border-red-400/25 text-red-300 text-xs font-medium disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                    >
                        {busyId === `${team.id}:delete` ? (
                            <Loader className="animate-spin" size={14} />
                        ) : (
                            <Trash2 size={14} />
                        )}
                        Delete entry
                    </button>
                </div>
            ) : null}

            {open ? (
                <div className="px-3.5 pb-3.5 space-y-3 border-t border-white/6 pt-3">
                    {Array.isArray(team.teamMembers) && team.teamMembers.length ? (
                        <OrganizerTeamRoster
                            teamMembers={team.teamMembers}
                            personFields={team.personFields || team.registrations?.[0]?.personFields}
                            teamSize={team.teamSize || team.memberCount}
                        />
                    ) : (
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
                    )}

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
    const { toast, confirm } = useDialog();

    const tabParam = searchParams.get('tab');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busyId, setBusyId] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [manualOpen, setManualOpen] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [listQuery, setListQuery] = useState('');
    const [listFilter, setListFilter] = useState('all'); // all | pending | paid | in
    const [slotsRemainInput, setSlotsRemainInput] = useState('');
    const [maxPeopleInput, setMaxPeopleInput] = useState('1');
    const [capacityBusy, setCapacityBusy] = useState(false);
    const [notifyOpen, setNotifyOpen] = useState(null);
    const [notifyForm, setNotifyForm] = useState({ title: '', message: '', inApp: true, email: true });
    const [notifyBusy, setNotifyBusy] = useState(false);

    const load = useCallback(async ({ quiet = false } = {}) => {
        const requestedId = String(competitionId || '');
        if (!quiet) setLoading(true);
        setError('');
        try {
            const res = await fetchFestOrganizerCompetitionOps(festId, competitionId);
            // Drop stale response if user switched competitions while this request was in flight
            if (String(res?.competition?.id || '') !== requestedId) return;
            setData(res);
        } catch (e) {
            if (String(competitionId || '') !== requestedId) return;
            setError(e.message || 'Failed to load');
            if (!quiet) setData(null);
        } finally {
            if (!quiet && String(competitionId || '') === requestedId) setLoading(false);
        }
    }, [festId, competitionId]);

    // Clear previous competition capacity immediately so slots / max people don't flash
    useEffect(() => {
        setData(null);
        setSlotsRemainInput('');
        setMaxPeopleInput('');
        setListQuery('');
        setListFilter('all');
        setError('');
        setLoading(true);
        load();
    }, [load]);

    useEffect(() => {
        if (!data?.competition) return;
        // Only sync inputs for the competition currently in the URL
        if (String(data.competition.id) !== String(competitionId)) return;
        const allotted = Number(data.competition.slotsAllotted) || 0;
        const leftDirect = data.competition.slotsLeft ?? data.stats?.slotsLeft;
        const filled = Number(data.competition.slotsFilled ?? data.stats?.slotsFilled ?? data.stats?.approved) || 0;
        const left = allotted > 0
            ? (leftDirect != null && Number.isFinite(Number(leftDirect))
                ? Math.max(0, Math.floor(Number(leftDirect)))
                : Math.max(0, allotted - filled))
            : '';
        setSlotsRemainInput(left === '' ? '' : String(left));
        setMaxPeopleInput(String(Math.max(1, Number(data.competition.teamSizeMax) || 1)));
    }, [
        competitionId,
        data?.competition?.id,
        data?.competition?.slotsAllotted,
        data?.competition?.slotsFilled,
        data?.competition?.slotsLeft,
        data?.competition?.teamSizeMax,
        data?.stats?.slotsFilled,
        data?.stats?.slotsLeft,
        data?.stats?.approved,
    ]);

    const stats = data?.stats;
    const competition = data?.competition;
    const pending = data?.pending || [];
    const teams = data?.teams || [];
    const solo = data?.solo || [];
    const festMeta = data?.fest || null;
    const noReview = isMindSparkFest(festId, festMeta);
    const listFilters = useMemo(
        () => (noReview
            ? LIST_FILTERS.filter((f) => f.id !== 'pending')
            : LIST_FILTERS.filter((f) => f.id !== 'unpaid')),
        [noReview],
    );

    const tab = useMemo(() => {
        const raw = tabParam || '';
        if (raw === 'solo' || raw === 'teams') return raw;
        // Legacy URLs
        if (raw === 'people' || raw === 'pending') return 'solo';
        if (solo.length && !teams.length) return 'solo';
        if (teams.length) return 'teams';
        return 'solo';
    }, [tabParam, solo.length, teams.length]);

    useEffect(() => {
        if (noReview && listFilter === 'pending') setListFilter('all');
    }, [noReview, listFilter]);

    useEffect(() => {
        if (tabParam === 'pending') setListFilter(noReview ? 'unpaid' : 'pending');
    }, [tabParam, noReview]);

    const setTab = (id) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', id);
        setSearchParams(next, { replace: true });
        setListQuery('');
        setListFilter('all');
    };

    const paidPendingIds = useMemo(
        () => pending.filter((p) => p.paymentStatus === 'paid' || p.paymentStatus === 'free').map((p) => p.id),
        [pending],
    );

    const q = listQuery.trim().toLowerCase();

    const memberHay = (p) => (Array.isArray(p.teamMembers)
        ? p.teamMembers.map((m) => `${m.name || ''} ${m.email || ''} ${m.phone || ''} ${m.college || ''}`).join(' ')
        : (p.members || []).join(' '));

    const filteredSolo = useMemo(() => {
        let list = solo;
        if (listFilter === 'pending') list = list.filter((p) => p.status === 'pending');
        if (listFilter === 'paid') list = list.filter((p) => p.paymentStatus === 'paid' || p.paymentStatus === 'free');
        if (listFilter === 'unpaid') list = list.filter((p) => p.paymentStatus === 'pending' || p.paymentStatus === 'failed');
        if (listFilter === 'in') list = list.filter((p) => p.checkedIn);
        if (!q) return list;
        return list.filter((p) => {
            const hay = `${p.userName} ${p.teamName} ${p.college} ${p.city} ${p.userPhone} ${p.userEmail} ${memberHay(p)}`.toLowerCase();
            return hay.includes(q);
        });
    }, [solo, q, listFilter]);

    const filteredTeams = useMemo(() => {
        let list = teams;
        if (listFilter === 'pending') list = list.filter((t) => t.pendingCount > 0 || t.status === 'pending');
        if (listFilter === 'paid') list = list.filter((t) => t.paymentStatus === 'paid' || t.paymentStatus === 'free');
        if (listFilter === 'unpaid') list = list.filter((t) => t.paymentStatus === 'pending' || t.paymentStatus === 'failed');
        if (listFilter === 'in') list = list.filter((t) => t.checkedInCount > 0);
        if (!q) return list;
        return list.filter((t) => {
            const hay = `${t.teamName} ${t.captainName} ${t.college} ${t.city} ${memberHay(t)} ${(t.members || []).join(' ')}`.toLowerCase();
            return hay.includes(q);
        });
    }, [teams, q, listFilter]);

    const soloPendingPaidIds = useMemo(
        () => filteredSolo
            .filter((p) => p.status === 'pending' && (p.paymentStatus === 'paid' || p.paymentStatus === 'free'))
            .map((p) => p.id),
        [filteredSolo],
    );

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

    const deleteEntry = async (p) => {
        const label = p.userName || p.teamName || p.userEmail || 'this entry';
        const ok = await confirm({
            title: 'Delete entry?',
            message: `Remove ${label} from the roster permanently? This cannot be undone.`,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        setBusyId(`${p.id}:delete`);
        try {
            await deleteFestOrganizerParticipant(festId, p.id);
            toast('Entry deleted');
            await load();
        } catch (e) {
            toast(e.message || 'Delete failed');
        } finally {
            setBusyId('');
        }
    };

    const deleteTeam = async (team) => {
        const ids = (team.registrationIds || team.registrations?.map((r) => r.id) || []).filter(Boolean);
        if (!ids.length) return;
        const label = team.teamName || 'this team';
        const ok = await confirm({
            title: 'Delete team entry?',
            message: `Remove ${label} (${ids.length} registration${ids.length === 1 ? '' : 's'}) permanently? This cannot be undone.`,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        setBusyId(`${team.id}:delete`);
        try {
            for (const id of ids) {
                await deleteFestOrganizerParticipant(festId, id);
            }
            toast(ids.length > 1 ? 'Team entries deleted' : 'Entry deleted');
            await load();
        } catch (e) {
            toast(e.message || 'Delete failed');
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

    const bulkApprovePaid = async (ids = paidPendingIds) => {
        if (!ids?.length) {
            toast('No paid/free pending entries');
            return;
        }
        setBulkBusy(true);
        try {
            const res = await bulkUpdateFestOrganizerParticipantStatus(festId, ids, 'approved');
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
            const blob = await exportFestOrganizerParticipants(festId, { competitionId, format: 'xlsx' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(competition?.name || 'competition').replace(/[^\w]+/g, '_')}_roster.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Excel export downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const openNotify = (participant) => {
        const compLabel = competition?.name || 'your competition';
        setNotifyForm({
            title: `Update — ${compLabel}`,
            message: `Hi! Quick update about ${compLabel}. Please check the fest page or your QR ticket for details.`,
            inApp: true,
            email: Boolean(participant?.userEmail),
        });
        setNotifyOpen(participant);
    };

    const sendNotify = async () => {
        if (!notifyOpen?.id) return;
        const title = notifyForm.title.trim();
        const message = notifyForm.message.trim();
        if (!title || !message) {
            toast('Title and message required');
            return;
        }
        const channels = [];
        if (notifyForm.inApp) channels.push('inApp');
        if (notifyForm.email) channels.push('email');
        if (!channels.length) {
            toast('Pick at least one channel');
            return;
        }
        setNotifyBusy(true);
        try {
            const res = await notifyFestOrganizerParticipant(festId, notifyOpen.id, {
                title,
                message,
                channels,
            });
            toast(res.message || 'Sent');
            setNotifyOpen(null);
        } catch (e) {
            toast(e.message || 'Failed to send');
        } finally {
            setNotifyBusy(false);
        }
    };

    const saveCapacity = async () => {
        const remainRaw = String(slotsRemainInput || '').trim();
        const maxRaw = String(maxPeopleInput || '').trim();
        const payload = {};

        // Empty slots field = leave current limit unchanged (don't wipe to unlimited)
        if (remainRaw !== '') {
            const remain = Number(remainRaw);
            if (!Number.isFinite(remain) || remain < 0) {
                toast('Slots remaining must be 0 or more');
                return;
            }
            payload.slotsRemaining = Math.floor(remain);
        }

        const maxPeople = Number(maxRaw);
        if (!Number.isFinite(maxPeople) || maxPeople < 1) {
            toast('Max people must be at least 1');
            return;
        }
        payload.maxPeople = Math.min(20, Math.floor(maxPeople));
        payload.teamSizeMin = 1;

        setCapacityBusy(true);
        try {
            const res = await updateFestOrganizerCompetitionSlots(festId, competitionId, payload);
            const next = res?.competition;
            // Paint immediately from PATCH so the remain number / inputs don't wait on reload
            if (next) {
                setData((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        competition: {
                            ...prev.competition,
                            slotsAllotted: next.slotsAllotted,
                            slotsFilled: next.slotsFilled,
                            slotsLeft: next.slotsLeft,
                            teamSizeMin: next.teamSizeMin ?? prev.competition?.teamSizeMin,
                            teamSizeMax: next.teamSizeMax ?? prev.competition?.teamSizeMax,
                            teamSizeLabel: next.teamSizeLabel ?? prev.competition?.teamSizeLabel,
                        },
                        stats: {
                            ...prev.stats,
                            slotsAllotted: next.slotsAllotted,
                            slotsFilled: next.slotsFilled,
                            slotsLeft: next.slotsLeft,
                        },
                    };
                });
                if (next.slotsAllotted > 0 && next.slotsLeft != null) {
                    setSlotsRemainInput(String(next.slotsLeft));
                } else if (next.slotsAllotted === 0) {
                    setSlotsRemainInput('');
                }
                if (next.teamSizeMax != null) {
                    setMaxPeopleInput(String(Math.max(1, Number(next.teamSizeMax) || 1)));
                }
            }
            toast(res.message || 'Capacity updated');
            await load({ quiet: true });
        } catch (e) {
            toast(e.message || 'Failed to update capacity');
        } finally {
            setCapacityBusy(false);
        }
    };

    const unpaidCount = useMemo(() => {
        const fromSolo = solo.filter((p) => p.paymentStatus === 'pending' || p.paymentStatus === 'failed').length;
        const fromTeams = teams.filter((t) => t.paymentStatus === 'pending' || t.paymentStatus === 'failed').length;
        return fromSolo + fromTeams;
    }, [solo, teams]);

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
        solo: noReview
            ? '1-person registrations — payment collected via gateway. Contact them from Connect if needed.'
            : '1-person registrations from the form — name, contact, and details saved as solo.',
        teams: noReview
            ? '2+ people from the form — expand for roster. No approve step; payment shows paid/unpaid.'
            : '2+ people from the form — expand a card for the full roster.',
    };

    const soloPendingCount = noReview ? 0 : solo.filter((p) => p.status === 'pending').length;
    const teamPendingCount = noReview ? 0 : teams.reduce((n, t) => n + (Number(t.pendingCount) || 0), 0);

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
                        <p className="text-[11px] text-gray-500 mt-1">
                            {noReview ? `${stats.approved} registered` : `${stats.approved} approved`}
                        </p>
                    </div>
                    {noReview ? (
                        <button
                            type="button"
                            onClick={() => setListFilter('unpaid')}
                            className="rounded-2xl border border-amber-400/35 bg-linear-to-br from-amber-500/20 to-[#161718] p-3.5 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                        >
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">Unpaid</p>
                            <p className="text-2xl font-bold tabular-nums text-white mt-1">{unpaidCount}</p>
                            <p className="text-[11px] text-gray-500 mt-1">Contact via Connect if needed</p>
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setListFilter('pending')}
                            className="rounded-2xl border border-amber-400/35 bg-linear-to-br from-amber-500/20 to-[#161718] p-3.5 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                        >
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">To review</p>
                            <p className="text-2xl font-bold tabular-nums text-white mt-1">{stats.pending}</p>
                            <p className="text-[11px] text-gray-500 mt-1">Tap to filter queue</p>
                        </button>
                    )}
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
                        <p className="text-[10px] uppercase tracking-wide text-gray-400">Slots remain</p>
                        <p className="text-2xl font-bold tabular-nums text-white mt-1">
                            {stats.slotsAllotted > 0
                                ? (stats.slotsLeft ?? 0)
                                : '—'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-1">
                            {stats.slotsAllotted > 0
                                ? `${stats.slotsFilled ?? stats.approved}/${stats.slotsAllotted} filled`
                                : 'No limit set yet'}
                        </p>
                    </div>
                </div>
            ) : null}

            {/* Capacity: slots remain + max people */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">Capacity</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        Updates this competition on the public website right away.
                    </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="rounded-xl border border-white/10 bg-[#121314] p-3 space-y-1.5 block">
                        <span className="text-[11px] font-semibold text-[#0ECCEE] uppercase tracking-wide">
                            Slots remaining
                        </span>
                        <input
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={slotsRemainInput}
                            onChange={(e) => setSlotsRemainInput(e.target.value)}
                            placeholder="e.g. 20"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#0f1011] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#0ECCEE]/40"
                        />
                        <span className="text-[10px] text-gray-500 block">
                            How many more can register. Leave blank to keep current limit.
                            {stats?.slotsFilled != null || stats?.approved != null
                                ? ` · ${stats.slotsFilled ?? stats.approved} already filled`
                                : ''}
                        </span>
                    </label>
                    <label className="rounded-xl border border-white/10 bg-[#121314] p-3 space-y-1.5 block">
                        <span className="text-[11px] font-semibold text-[#0ECCEE] uppercase tracking-wide">
                            Max people
                        </span>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            inputMode="numeric"
                            value={maxPeopleInput}
                            onChange={(e) => setMaxPeopleInput(e.target.value)}
                            placeholder="e.g. 4"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#0f1011] border border-white/10 text-sm text-white tabular-nums focus:outline-none focus:border-[#0ECCEE]/40"
                        />
                        <span className="text-[10px] text-gray-500 block">
                            1 = solo · 2+ = team size on registration form
                        </span>
                    </label>
                </div>
                <button
                    type="button"
                    disabled={capacityBusy}
                    onClick={saveCapacity}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50"
                >
                    {capacityBusy ? 'Saving…' : 'Save capacity'}
                </button>
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
                        <p className="text-sm font-semibold text-white">Export Excel</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Roster for judges / college</p>
                    </button>
                </div>
            </section>

            {/* Work area box */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] overflow-hidden">
                <div className="grid grid-cols-2 border-b border-white/10">
                    {TABS.map((t) => {
                        const count = t.id === 'solo' ? solo.length : teams.length;
                        const pendingHint = t.id === 'solo' ? soloPendingCount : teamPendingCount;
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
                                    {pendingHint > 0 ? ` · ${pendingHint} review` : ""}
                                </p>
                            </button>
                        );
                    })}
                </div>

                <div className="p-3.5 space-y-3">
                    <div className="rounded-xl bg-white/4 border border-white/8 px-3 py-2">
                        <p className="text-xs text-gray-400">{tabHelp[tab]}</p>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto">
                        {listFilters.map((f) => (
                            <button
                                key={f.id}
                                type="button"
                                onClick={() => setListFilter(f.id)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                                    listFilter === f.id
                                        ? 'bg-[#0ECCEE] text-black'
                                        : 'bg-white/5 text-gray-400 border border-white/10'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={listQuery}
                            onChange={(e) => setListQuery(e.target.value)}
                            placeholder={tab === 'teams' ? 'Search team, college, captain…' : 'Search name, phone, college…'}
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/40"
                        />
                    </div>

                    {tab === 'solo' ? (
                        <div className="space-y-2.5">
                            {!noReview && soloPendingPaidIds.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => bulkApprovePaid(soloPendingPaidIds)}
                                    disabled={bulkBusy}
                                    className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-semibold disabled:opacity-50"
                                >
                                    {bulkBusy ? 'Approving…' : `Approve all paid & free (${soloPendingPaidIds.length})`}
                                </button>
                            ) : null}

                            {filteredSolo.map((p) => (
                                <SoloEntryCard
                                    key={p.id}
                                    p={p}
                                    busyId={busyId}
                                    hideReview={noReview}
                                    onApprove={(id) => setStatus(id, 'approved')}
                                    onReject={(id) => setStatus(id, 'rejected')}
                                    onNotify={openNotify}
                                    onDelete={deleteEntry}
                                />
                            ))}

                            {!filteredSolo.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center px-4">
                                    <Users className="mx-auto text-gray-600 mb-2" size={28} />
                                    <p className="text-sm text-gray-500">
                                        {q || listFilter !== 'all'
                                            ? 'No matches'
                                            : 'Solo entries appear when the form is saved as 1 person'}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {tab === 'teams' ? (
                        <div className="space-y-3">
                            {filteredTeams.map((t) => (
                                <TeamCard
                                    key={t.id || t.teamName}
                                    team={t}
                                    busyId={busyId}
                                    hideReview={noReview}
                                    onApproveIds={approveIds}
                                    onRejectIds={rejectIds}
                                    onDelete={deleteTeam}
                                />
                            ))}

                            {!filteredTeams.length ? (
                                <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center px-4">
                                    <Users className="mx-auto text-gray-600 mb-2" size={28} />
                                    <p className="text-sm text-gray-500">
                                        {q || listFilter !== 'all'
                                            ? 'No matches'
                                            : 'Team entries appear when the form is saved with 2+ people'}
                                    </p>
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
                    setTab('solo');
                }}
            />

            {notifyOpen ? (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70">
                    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <p className="text-[10px] uppercase tracking-wide text-[#0ECCEE]">Notify one</p>
                                <h3 className="text-sm font-semibold text-white">{notifyOpen.userName || 'Participant'}</h3>
                                <p className="text-[11px] text-gray-500 truncate">
                                    {notifyOpen.userEmail || 'No email'}
                                    {notifyOpen.userPhone ? ` · ${notifyOpen.userPhone}` : ''}
                                </p>
                            </div>
                            <button type="button" onClick={() => setNotifyOpen(null)} className="p-1.5 text-gray-500">
                                <X size={18} />
                            </button>
                        </div>
                        <input
                            value={notifyForm.title}
                            onChange={(e) => setNotifyForm((f) => ({ ...f, title: e.target.value }))}
                            placeholder="Title"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <textarea
                            value={notifyForm.message}
                            onChange={(e) => setNotifyForm((f) => ({ ...f, message: e.target.value }))}
                            rows={4}
                            placeholder="Message"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        />
                        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={notifyForm.inApp}
                                    onChange={(e) => setNotifyForm((f) => ({ ...f, inApp: e.target.checked }))}
                                />
                                In-app
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={notifyForm.email}
                                    onChange={(e) => setNotifyForm((f) => ({ ...f, email: e.target.checked }))}
                                    disabled={!notifyOpen.userEmail}
                                />
                                Email
                                {!notifyOpen.userEmail ? <span className="text-gray-600">(no email)</span> : null}
                            </label>
                        </div>
                        <button
                            type="button"
                            disabled={notifyBusy}
                            onClick={sendNotify}
                            className="w-full py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                        >
                            {notifyBusy ? <Loader className="animate-spin" size={16} /> : <Mail size={16} />}
                            Send notification
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

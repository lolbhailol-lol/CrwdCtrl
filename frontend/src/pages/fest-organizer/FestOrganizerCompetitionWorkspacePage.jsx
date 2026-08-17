import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    ArrowLeft, Bell, Check, ChevronDown, Copy, Download, ExternalLink, GraduationCap,
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
    updateFestOrganizerParticipantWhatsappGroup,
    updateFestOrganizerCompetitionDetails,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import FestOrganizerManualAddModal from './FestOrganizerManualAddModal';
import OrganizerTeamRoster, { OrganizerRosterPreview } from './OrganizerTeamRoster';
import WhatsAppGroupToggle from './WhatsAppGroupToggle';
import { isMindSparkFest } from '../../features/fests/mindspark';
import { downloadCompetitionQrPng } from '../../utils/competitionPublicQr';

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
    { id: 'out', label: 'Outside' },
    { id: 'wa_out', label: 'Not in WA' },
    { id: 'wa_in', label: 'In WA' },
];

function waLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const withCountry = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCountry}`;
}

function waInviteLink(phone, text) {
    const base = waLink(phone);
    if (!base) return null;
    if (!text) return base;
    return `${base}?text=${encodeURIComponent(text)}`;
}

function telLink(phone) {
    const digits = String(phone || '').replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

function buildGroupInviteMessage(name, competitionName, groupLink) {
    const first = String(name || '').trim().split(/\s+/)[0] || '';
    const comp = competitionName || 'the competition';
    const hi = first ? `Hi ${first}!` : 'Hi!';
    return `${hi} Please join the ${comp} WhatsApp group for updates:\n${groupLink}`;
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
    onWhatsappToggle,
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
                {onWhatsappToggle ? (
                    <WhatsAppGroupToggle
                        variant="box"
                        joined={Boolean(p.whatsappGroupJoined)}
                        busy={busyId === `${p.id}:wa`}
                        onToggle={(joined) => onWhatsappToggle(p, joined)}
                    />
                ) : null}
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
                <div className="flex items-center gap-1 shrink-0">
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

function TeamCard({ team, busyId, onApproveIds, onRejectIds, onDelete, onNotify, onWhatsappToggle, hideReview = false }) {
    const [open, setOpen] = useState(!hideReview && Boolean(team.pendingCount > 0));
    const memberCount = team.memberCount || team.members?.length || team.registrations?.length || 0;
    const pendingIds = hideReview
        ? []
        : (team.registrations || [])
            .filter((r) => r.status === 'pending')
            .map((r) => r.id);
    const primaryReg = team.registrations?.[0] || null;

    return (
        <div className={`rounded-2xl border overflow-hidden transition ${
            !hideReview && team.pendingCount
                ? 'border-amber-500/25 bg-[#161718]'
                : 'border-white/8 bg-[#161718]'
        }`}
        >
            <div className="p-3.5 flex items-start gap-3">
                {onWhatsappToggle && primaryReg ? (
                    <WhatsAppGroupToggle
                        variant="box"
                        joined={Boolean(primaryReg.whatsappGroupJoined || team.whatsappGroupJoined)}
                        busy={busyId === `${primaryReg.id}:wa`}
                        onToggle={(joined) => onWhatsappToggle(primaryReg, joined)}
                    />
                ) : (
                    <div className="size-11 rounded-xl bg-[#0ECCEE]/12 border border-[#0ECCEE]/20 flex items-center justify-center shrink-0">
                        <Users size={18} className="text-[#0ECCEE]" />
                    </div>
                )}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="min-w-0 flex-1 text-left"
                >
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
                </button>
                <ContactIcons phone={team.captainPhone} email={team.captainEmail} />
            </div>
            {onNotify ? (
                <div className="px-3.5 -mt-1 pb-1 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            const first = team.registrations?.[0] || {
                                id: team.captainId || team.registrationIds?.[0],
                                userName: team.captainName,
                                userPhone: team.captainPhone,
                                userEmail: team.captainEmail,
                            };
                            if (first?.id) onNotify(first);
                        }}
                        className="p-2 rounded-xl bg-[#0ECCEE]/10 text-[#0ECCEE]"
                        title="Notify team"
                        aria-label={`Notify ${team.teamName || 'team'}`}
                    >
                        <Bell size={15} />
                    </button>
                </div>
            ) : null}

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
    const [showSlotsPublic, setShowSlotsPublic] = useState(true);
    const [capacityBusy, setCapacityBusy] = useState(false);
    const [notifyOpen, setNotifyOpen] = useState(null);
    const [notifyForm, setNotifyForm] = useState({ title: '', message: '', inApp: true, email: true });
    const [notifyBusy, setNotifyBusy] = useState(false);
    const [waInvitedIds, setWaInvitedIds] = useState(() => new Set());
    const [waLinkDraft, setWaLinkDraft] = useState('');
    const [waLinkBusy, setWaLinkBusy] = useState(false);
    const [pageQrBusy, setPageQrBusy] = useState(false);
    const waInviteRef = useRef(null);

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
        setWaInvitedIds(new Set());
        setWaLinkDraft('');
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
        setShowSlotsPublic(data.competition.showSlotsPublic !== false);
    }, [
        competitionId,
        data?.competition?.id,
        data?.competition?.slotsAllotted,
        data?.competition?.slotsFilled,
        data?.competition?.slotsLeft,
        data?.competition?.showSlotsPublic,
        data?.competition?.teamSizeMax,
        data?.stats?.slotsFilled,
        data?.stats?.slotsLeft,
        data?.stats?.approved,
    ]);

    // Keep WA invite draft independent of capacity reloads so pasted links / slot edits don't wipe each other.
    useEffect(() => {
        if (!data?.competition) return;
        if (String(data.competition.id) !== String(competitionId)) return;
        setWaLinkDraft(String(data.competition.whatsappGroupLink || '').trim());
    }, [
        competitionId,
        data?.competition?.id,
        data?.competition?.whatsappGroupLink,
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
            ? LIST_FILTERS.filter((f) => f.id !== 'pending' && f.id !== 'unpaid')
            : LIST_FILTERS.filter((f) => f.id !== 'unpaid')),
        [noReview],
    );

    useEffect(() => {
        if (searchParams.get('focus') !== 'wa') return;
        if (!noReview) return;
        const t = window.setTimeout(() => {
            waInviteRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setListFilter('wa_out');
        }, 250);
        return () => window.clearTimeout(t);
    }, [searchParams, competitionId, noReview, data?.competition?.id]);

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
        if (noReview && (listFilter === 'pending' || listFilter === 'unpaid')) setListFilter('all');
    }, [noReview, listFilter]);

    useEffect(() => {
        if (tabParam === 'pending') setListFilter(noReview ? 'out' : 'pending');
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
        if (listFilter === 'out') list = list.filter((p) => !p.checkedIn);
        if (listFilter === 'wa_in') list = list.filter((p) => p.whatsappGroupJoined);
        if (listFilter === 'wa_out') list = list.filter((p) => !p.whatsappGroupJoined);
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
        // Keep teams that still have anyone outside (matches pendingGate headcount), not only fully-out teams.
        if (listFilter === 'out') {
            list = list.filter((t) => {
                const size = (t.registrations || []).length
                    || Number(t.registrationIds?.length)
                    || Number(t.size)
                    || 0;
                const inCount = Number(t.checkedInCount) || 0;
                if (size > 0) return inCount < size;
                return !t.checkedIn;
            });
        }
        if (listFilter === 'wa_in') {
            list = list.filter((t) => t.whatsappGroupJoined
                || (t.whatsappJoinedCount > 0 && t.whatsappJoinedCount >= (t.registrations?.length || 1))
                || ((t.registrations || []).length > 0 && (t.registrations || []).every((r) => r.whatsappGroupJoined)));
        }
        if (listFilter === 'wa_out') {
            list = list.filter((t) => !(
                t.whatsappGroupJoined
                || ((t.registrations || []).length > 0 && (t.registrations || []).every((r) => r.whatsappGroupJoined))
            ));
        }
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
            toast('Deleted');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const toggleWhatsappGroup = async (p, joined) => {
        if (!p?.id) return;
        setBusyId(`${p.id}:wa`);
        try {
            const data = await updateFestOrganizerParticipantWhatsappGroup(festId, p.id, joined);
            toast(joined ? 'In WA' : 'Cleared');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const groupInviteLink = String(
        waLinkDraft || competition?.whatsappGroupLink || '',
    ).trim();

    const inviteQueue = useMemo(() => {
        const rows = Array.isArray(data?.participants) ? data.participants : [];
        return rows.filter((p) => !p.whatsappGroupJoined && p.userPhone);
    }, [data?.participants]);

    const inviteNext = () => {
        if (!groupInviteLink) {
            toast('Add invite link');
            return;
        }
        if (!inviteQueue.length) {
            toast('All in WA');
            return;
        }
        // Prefer next person not yet invited this session so a refresh / joined tick
        // cannot skip ahead via a stale numeric cursor.
        let person = inviteQueue.find((p) => !waInvitedIds.has(String(p.id)));
        let nextInvited = waInvitedIds;
        if (!person) {
            person = inviteQueue[0];
            nextInvited = new Set();
        }
        const text = buildGroupInviteMessage(person.userName, competition?.name, groupInviteLink);
        const link = waInviteLink(person.userPhone, text);
        if (link) window.open(link, '_blank', 'noopener,noreferrer');
        const id = String(person.id);
        setWaInvitedIds(new Set([...nextInvited, id]));
        setListFilter('wa_out');
        toast(person.userName?.split(/\s+/)[0] || 'Opened');
    };

    const copyGroupLink = async () => {
        if (!groupInviteLink) {
            toast('No link');
            return;
        }
        try {
            await navigator.clipboard.writeText(groupInviteLink);
            toast('Copied');
        } catch {
            toast('Copy failed');
        }
    };

    const saveGroupLink = async () => {
        const link = String(waLinkDraft || '').trim();
        if (link && !/^https?:\/\/(chat\.)?whatsapp\.com\//i.test(link) && !/^https?:\/\/wa\.me\//i.test(link)) {
            toast('Use chat.whatsapp.com link');
            return;
        }
        setWaLinkBusy(true);
        try {
            await updateFestOrganizerCompetitionDetails(festId, competitionId, {
                registration: { whatsappGroupLink: link },
            });
            setData((prev) => (prev ? {
                ...prev,
                competition: {
                    ...prev.competition,
                    whatsappGroupLink: link,
                },
            } : prev));
            toast(link ? 'Link saved' : 'Link cleared');
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setWaLinkBusy(false);
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
            toast('Deleted');
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
            toast('Approved');
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
            toast('Rejected');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const bulkApprovePaid = async (ids = paidPendingIds) => {
        if (!ids?.length) {
            toast('Nothing pending');
            return;
        }
        setBulkBusy(true);
        try {
            const res = await bulkUpdateFestOrganizerParticipantStatus(festId, ids, 'approved');
            toast('Approved');
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
            toast('Exported');
        } catch (e) {
            toast(e.message || 'Failed');
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
            toast('Add title & message');
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
            toast(e.message || 'Failed');
        } finally {
            setNotifyBusy(false);
        }
    };

    const saveCapacity = async () => {
        const remainRaw = String(slotsRemainInput || '').trim();
        const maxRaw = String(maxPeopleInput || '').trim();
        const payload = {};

        // Empty slots field = leave current limit unchanged (don't wipe to unlimited)
        // Toggle off = unlimited entries — clear the cap
        if (!showSlotsPublic) {
            payload.slotsAllotted = 0;
        } else if (remainRaw !== '') {
            const remain = Number(remainRaw);
            if (!Number.isFinite(remain) || remain < 0) {
                toast('Invalid slots');
                return;
            }
            payload.slotsRemaining = Math.floor(remain);
        }

        const maxPeople = Number(maxRaw);
        if (!Number.isFinite(maxPeople) || maxPeople < 1) {
            toast('Max people ≥ 1');
            return;
        }
        payload.maxPeople = Math.min(20, Math.floor(maxPeople));
        payload.showSlotsPublic = Boolean(showSlotsPublic);

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
                            showSlotsPublic: next.showSlotsPublic !== false,
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
                if (next.showSlotsPublic !== undefined) {
                    setShowSlotsPublic(next.showSlotsPublic !== false);
                }
                if (next.teamSizeMax != null) {
                    setMaxPeopleInput(String(Math.max(1, Number(next.teamSizeMax) || 1)));
                }
            }
            toast('Saved');
            await load({ quiet: true });
        } catch (e) {
            toast(e.message || 'Failed');
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
            ? '2+ people from the form — expand for roster. No approve step; payment is on Connect if needed.'
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
                            onClick={() => setListFilter('out')}
                            className="rounded-2xl border border-amber-400/35 bg-linear-to-br from-amber-500/20 to-[#161718] p-3.5 text-left hover:scale-[1.01] active:scale-[0.99] transition"
                        >
                            <p className="text-[10px] uppercase tracking-wide text-amber-200/80">Still outside</p>
                            <p className="text-2xl font-bold tabular-nums text-white mt-1">{pendingGate}</p>
                            <p className="text-[11px] text-gray-500 mt-1">Tap to filter roster</p>
                            {unpaidCount > 0 ? (
                                <Link
                                    to={`/fest-organizer/fests/${festId}/notifications?competitionId=${competitionId}&audience=unpaid&tab=connect`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex mt-2 text-[11px] font-semibold text-amber-200 hover:text-amber-100"
                                >
                                    {unpaidCount} unpaid → Connect
                                </Link>
                            ) : null}
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
                            {data?.competition?.showSlotsPublic === false ? ' · unlimited on site' : ''}
                        </p>
                    </div>
                </div>
            ) : null}

            {/* WhatsApp group invite — MindSpark day-of */}
            {noReview ? (
                <section
                    ref={waInviteRef}
                    className="rounded-2xl border border-emerald-400/25 bg-linear-to-br from-emerald-500/10 to-[#161718] p-3.5 space-y-3 scroll-mt-20"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <h2 className="text-sm font-semibold text-white inline-flex items-center gap-1.5">
                                <MessageCircle size={15} className="text-emerald-300" />
                                WhatsApp group
                            </h2>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                Paste the invite link, then Invite next opens chat.whatsapp.com message one by one.
                                Tick In WA on each row when they join.
                            </p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-lg font-bold tabular-nums text-white leading-none">
                                {stats?.waJoined ?? 0}
                                <span className="text-gray-500 text-sm font-medium">/{stats?.total ?? 0}</span>
                            </p>
                            <p className="text-[10px] text-emerald-200/80 mt-1">
                                {(stats?.waNotJoined ?? inviteQueue.length) || 0} not in
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                        <input
                            type="url"
                            value={waLinkDraft}
                            onChange={(e) => setWaLinkDraft(e.target.value)}
                            placeholder="https://chat.whatsapp.com/…"
                            className="flex-1 min-w-0 rounded-xl border border-white/10 bg-[#121314] px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-emerald-400/40"
                        />
                        <button
                            type="button"
                            disabled={waLinkBusy}
                            onClick={saveGroupLink}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 text-xs font-semibold text-emerald-100 disabled:opacity-50"
                        >
                            {waLinkBusy ? <Loader size={14} className="animate-spin" /> : <Check size={14} />}
                            Save link
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <button
                            type="button"
                            onClick={copyGroupLink}
                            disabled={!groupInviteLink}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 bg-[#121314] text-xs font-medium text-gray-200 disabled:opacity-40"
                        >
                            <Copy size={13} /> Copy
                        </button>
                        <a
                            href={groupInviteLink || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-disabled={!groupInviteLink}
                            onClick={(e) => {
                                if (!groupInviteLink) e.preventDefault();
                            }}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 bg-[#121314] text-xs font-medium text-gray-200 ${
                                !groupInviteLink ? 'opacity-40 pointer-events-none' : ''
                            }`}
                        >
                            <ExternalLink size={13} /> Open group
                        </a>
                        <button
                            type="button"
                            onClick={inviteNext}
                            disabled={!inviteQueue.length}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-emerald-400/35 bg-emerald-500/20 text-xs font-semibold text-emerald-100 disabled:opacity-40"
                        >
                            <MessageCircle size={13} />
                            Invite next
                            {inviteQueue.length ? ` · ${inviteQueue.length}` : ''}
                        </button>
                        <button
                            type="button"
                            onClick={() => setListFilter('wa_out')}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium ${
                                listFilter === 'wa_out'
                                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                    : 'border-white/10 bg-[#121314] text-gray-200'
                            }`}
                        >
                            Not in WA
                        </button>
                    </div>
                </section>
            ) : null}

            {/* Capacity: slots remain + max people */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-3.5 space-y-3">
                <div>
                    <h2 className="text-sm font-semibold text-white">Capacity</h2>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                        Updates this competition on the public website right away.
                    </p>
                </div>

                <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-[#121314] px-3 py-3 cursor-pointer">
                    <button
                        type="button"
                        role="switch"
                        aria-checked={showSlotsPublic}
                        onClick={() => setShowSlotsPublic((v) => !v)}
                        className={`mt-0.5 relative inline-flex h-6 w-11 shrink-0 rounded-full border transition ${
                            showSlotsPublic
                                ? 'bg-emerald-500 border-emerald-400/50'
                                : 'bg-white/10 border-white/15'
                        }`}
                    >
                        <span
                            className={`absolute top-0.5 size-5 rounded-full bg-white transition ${
                                showSlotsPublic ? 'left-5' : 'left-0.5'
                            }`}
                        />
                    </button>
                    <span className="min-w-0">
                        <span className="block text-sm font-medium text-white">Show slots on public page</span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                            {showSlotsPublic
                                ? 'Students see how many slots remain (e.g. “12 slots remain”).'
                                : 'Public page shows Unlimited entries. No registration limit.'}
                        </span>
                    </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`rounded-xl border p-3 space-y-1.5 block ${
                        showSlotsPublic
                            ? 'border-white/10 bg-[#121314]'
                            : 'border-white/8 bg-[#121314]/70 opacity-70'
                    }`}
                    >
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
                            {showSlotsPublic
                                ? 'How many more can register — shown on the competition page when enabled.'
                                : 'Ignored while slots are off. Turn the toggle on to set a limit.'}
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
                        disabled={pageQrBusy || !competition}
                        onClick={async () => {
                            setPageQrBusy(true);
                            try {
                                await downloadCompetitionQrPng(
                                    { id: competitionId, name: competition?.name },
                                    data?.fest?.festName || '',
                                );
                                toast('Downloaded');
                            } catch (e) {
                                toast(e.message || 'Failed');
                            } finally {
                                setPageQrBusy(false);
                            }
                        }}
                        className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 p-3.5 text-left hover:border-[#0ECCEE]/50 transition disabled:opacity-50"
                    >
                        {pageQrBusy
                            ? <Loader className="animate-spin text-[#0ECCEE] mb-2" size={20} />
                            : <QrCode size={20} className="text-[#0ECCEE] mb-2" />}
                        <p className="text-sm font-semibold text-white">Page QR</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">Scan → public competition page</p>
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
                                    onWhatsappToggle={noReview ? toggleWhatsappGroup : undefined}
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
                                    onNotify={openNotify}
                                    onWhatsappToggle={noReview ? toggleWhatsappGroup : undefined}
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
                    toast('Added');
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

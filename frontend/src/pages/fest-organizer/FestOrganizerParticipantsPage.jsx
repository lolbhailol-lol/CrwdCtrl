import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Check, Clock, Download, Loader, MapPin, MessageCircle, Phone,
    QrCode, RefreshCw, Search, Trophy, UserCheck, Users, X,
} from 'lucide-react';
import {
    fetchFestOrganizerParticipants,
    exportFestOrganizerParticipants,
    updateFestOrganizerParticipantStatus,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import FestOrganizerParticipantModal from './FestOrganizerParticipantModal';

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

function statusTone(status) {
    if (status === 'approved') return 'bg-emerald-500/15 text-emerald-300';
    if (status === 'pending') return 'bg-amber-500/15 text-amber-300';
    if (status === 'rejected') return 'bg-red-500/15 text-red-300';
    return 'bg-white/5 text-gray-400';
}

function payTone(paymentStatus) {
    if (paymentStatus === 'paid') return 'text-emerald-400';
    if (paymentStatus === 'pending') return 'text-amber-400';
    if (paymentStatus === 'free') return 'text-gray-400';
    return 'text-gray-500';
}

function PulseBox({ label, value, hint, tone, active, onClick, icon: Icon }) {
    const tones = {
        amber: 'border-amber-400/30 bg-linear-to-br from-amber-500/20 to-[#161718]',
        cyan: 'border-[#0ECCEE]/30 bg-linear-to-br from-[#0ECCEE]/15 to-[#161718]',
        emerald: 'border-emerald-400/30 bg-linear-to-br from-emerald-500/15 to-[#161718]',
        rose: 'border-rose-400/25 bg-linear-to-br from-rose-500/10 to-[#161718]',
        muted: 'border-white/10 bg-[#161718]',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border p-3.5 text-left transition ${tones[tone] || tones.muted} ${
                active ? 'ring-1 ring-white/25' : 'hover:scale-[1.01] active:scale-[0.99]'
            }`}
        >
            <div className="flex items-center justify-between mb-1.5">
                {Icon ? <Icon size={14} className="text-gray-400" /> : <span />}
                {active ? (
                    <span className="text-[9px] uppercase tracking-wide text-white/70">Viewing</span>
                ) : null}
            </div>
            <p className="text-2xl font-bold tabular-nums text-white leading-none">{value}</p>
            <p className="text-xs text-gray-300 mt-1.5">{label}</p>
            {hint ? <p className="text-[10px] text-gray-600 mt-0.5">{hint}</p> : null}
        </button>
    );
}

export default function FestOrganizerParticipantsPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm, toast } = useDialog();

    const [rows, setRows] = useState([]);
    const [competitions, setCompetitions] = useState([]);
    const [summary, setSummary] = useState({
        pending: 0, approved: 0, rejected: 0, checkedIn: 0, notCheckedIn: 0, unpaid: 0, active: 0,
    });
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('q') || '');
    const [detailId, setDetailId] = useState(null);
    const [actionBusy, setActionBusy] = useState('');

    const status = searchParams.get('status') || '';
    const competitionId = searchParams.get('competitionId') || '';
    const checkInStatus = searchParams.get('checkInStatus') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';

    const load = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 25 };
            if (search.trim()) params.search = search.trim();
            if (status) params.status = status;
            if (competitionId) params.competitionId = competitionId;
            if (checkInStatus) params.checkInStatus = checkInStatus;
            if (paymentStatus) params.paymentStatus = paymentStatus;
            const data = await fetchFestOrganizerParticipants(festId, params);
            setRows(data.participants || []);
            setCompetitions(data.competitions || []);
            setSummary(data.summary || {
                pending: 0, approved: 0, rejected: 0, checkedIn: 0, notCheckedIn: 0, unpaid: 0, active: 0,
            });
            setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (e) {
            toast(e.message || 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    }, [festId, status, competitionId, checkInStatus, paymentStatus, search, toast]);

    useEffect(() => {
        load(1);
        // Filter URL changes — search is applied on submit / when filters change
        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: don't refetch on every keystroke
    }, [festId, status, competitionId, checkInStatus, paymentStatus]);

    const setParams = (patch, { clearOthers = false } = {}) => {
        const next = clearOthers ? new URLSearchParams() : new URLSearchParams(searchParams);
        Object.entries(patch).forEach(([key, value]) => {
            if (value) next.set(key, value);
            else next.delete(key);
        });
        setSearchParams(next);
    };

    const clearFilters = () => {
        setSearch('');
        setSearchParams(new URLSearchParams());
    };

    const hasFilters = Boolean(status || competitionId || checkInStatus || paymentStatus || search.trim());

    const exportExcel = async () => {
        try {
            const blob = await exportFestOrganizerParticipants(festId, {
                competitionId: competitionId || undefined,
                format: 'xlsx',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fest_${festId}_participants.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            toast(e.message || 'Export failed');
        }
    };

    const setStatus = async (p, nextStatus, label) => {
        const ok = await confirm({
            title: `${label}?`,
            message: `${p.userName || p.userEmail || p.id} will be marked ${nextStatus}.`,
        });
        if (!ok) return;
        setActionBusy(`${p.id}-${nextStatus}`);
        try {
            await updateFestOrganizerParticipantStatus(festId, p.id, nextStatus);
            toast(nextStatus === 'approved' ? 'Approved' : 'Rejected');
            load(pagination.page);
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setActionBusy('');
        }
    };

    const viewingLabel = (() => {
        if (checkInStatus === 'not_in') return 'Approved · still outside';
        if (checkInStatus === 'checked_in') return 'Checked in';
        if (paymentStatus === 'pending') return 'Payment pending';
        if (status === 'pending') return 'Needs review';
        if (status === 'approved') return 'Approved entries';
        if (status === 'rejected') return 'Rejected';
        if (status === 'all') return 'Everyone (incl. rejected)';
        return 'Active guests';
    })();

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Fest-wide roster</p>
                    <h1 className="text-xl font-bold text-white mt-0.5">Participants</h1>
                    <p className="text-xs text-gray-500 mt-1">
                        Cross-competition guest list — approve, contact, export. For team desk work, open a competition.
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => navigate(`/fest-organizer/fests/${festId}/scan`)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 text-sm text-emerald-200"
                    >
                        <QrCode size={14} /> Scan
                    </button>
                    <button
                        type="button"
                        onClick={exportExcel}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/10 text-sm text-gray-300"
                    >
                        <Download size={14} /> Export Excel
                    </button>
                    <button
                        type="button"
                        onClick={() => load(pagination.page)}
                        className="p-2 rounded-xl border border-white/10 text-gray-400"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <PulseBox
                    label="Need review"
                    value={summary.pending}
                    hint="Tap to filter"
                    tone="amber"
                    icon={Clock}
                    active={status === 'pending' && !checkInStatus && !paymentStatus}
                    onClick={() => setParams({ status: 'pending', checkInStatus: '', paymentStatus: '' })}
                />
                <PulseBox
                    label="Approved"
                    value={summary.approved}
                    hint={`${summary.active} active total`}
                    tone="cyan"
                    icon={Users}
                    active={status === 'approved' && !checkInStatus && !paymentStatus}
                    onClick={() => setParams({ status: 'approved', checkInStatus: '', paymentStatus: '' })}
                />
                <PulseBox
                    label="Still outside"
                    value={summary.notCheckedIn}
                    hint={`${summary.checkedIn} already in`}
                    tone="emerald"
                    icon={UserCheck}
                    active={checkInStatus === 'not_in'}
                    onClick={() => setParams({ checkInStatus: 'not_in', status: '', paymentStatus: '' })}
                />
                <PulseBox
                    label="Unpaid"
                    value={summary.unpaid}
                    hint="Payment pending"
                    tone="rose"
                    icon={Clock}
                    active={paymentStatus === 'pending'}
                    onClick={() => setParams({ paymentStatus: 'pending', status: '', checkInStatus: '' })}
                />
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#161718] p-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide mr-1">Showing</p>
                    <span className="text-xs font-medium text-white px-2.5 py-1 rounded-lg bg-white/5 border border-white/10">
                        {viewingLabel}
                    </span>
                    <span className="text-xs text-gray-500 tabular-nums">
                        {pagination.total} result{pagination.total === 1 ? '' : 's'}
                    </span>
                    {hasFilters ? (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="ml-auto text-xs text-gray-400 inline-flex items-center gap-1 hover:text-white"
                        >
                            <X size={12} /> Clear filters
                        </button>
                    ) : null}
                </div>

                <div className="flex flex-wrap gap-1.5">
                    {[
                        { id: '', label: 'Active' },
                        { id: 'pending', label: 'Review' },
                        { id: 'approved', label: 'Approved' },
                        { id: 'rejected', label: 'Rejected' },
                        { id: 'all', label: 'All' },
                    ].map((s) => (
                        <button
                            key={s.id || 'active'}
                            type="button"
                            onClick={() => setParams({ status: s.id, checkInStatus: '', paymentStatus: '' })}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                status === s.id && !checkInStatus && !paymentStatus
                                    ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30'
                                    : 'text-gray-500 border border-transparent hover:text-gray-300'
                            }`}
                        >
                            {s.label}
                        </button>
                    ))}
                    <span className="w-px h-6 bg-white/10 self-center mx-0.5" />
                    <button
                        type="button"
                        onClick={() => setParams({ checkInStatus: checkInStatus === 'checked_in' ? '' : 'checked_in', status: 'approved', paymentStatus: '' })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            checkInStatus === 'checked_in'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                : 'text-gray-500 border border-transparent hover:text-gray-300'
                        }`}
                    >
                        Checked in
                    </button>
                    <button
                        type="button"
                        onClick={() => setParams({ checkInStatus: checkInStatus === 'not_in' ? '' : 'not_in', status: '', paymentStatus: '' })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                            checkInStatus === 'not_in'
                                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                : 'text-gray-500 border border-transparent hover:text-gray-300'
                        }`}
                    >
                        Outside
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {competitions.length ? (
                        <select
                            value={competitionId}
                            onChange={(e) => setParams({ competitionId: e.target.value })}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        >
                            <option value="">All competitions</option>
                            {competitions.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="px-3 py-2.5 rounded-xl border border-dashed border-white/10 text-sm text-gray-600">
                            No competitions linked yet
                        </div>
                    )}
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            load(1);
                        }}
                        className="relative"
                    >
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, phone, email…"
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                    </form>
                </div>
            </div>

            <div className="rounded-xl border border-[#0ECCEE]/15 bg-[#0ECCEE]/5 px-3.5 py-2.5 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                <Trophy size={13} className="text-[#0ECCEE] shrink-0" />
                <span className="min-w-0 flex-1">
                    Need team review or slots? Use the competition desk — this page is the full-fest guest book.
                </span>
                <Link
                    to={`/fest-organizer/fests/${festId}/competitions`}
                    className="text-[#0ECCEE] font-medium shrink-0"
                >
                    Open hub →
                </Link>
            </div>

            {loading && !rows.length ? (
                <div className="flex justify-center py-16 text-gray-400 gap-2">
                    <Loader className="animate-spin" size={18} /> Loading…
                </div>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((p) => {
                        const wa = waLink(p.userPhone);
                        const tel = telLink(p.userPhone);
                        const meta = [p.college, p.city, p.year].filter(Boolean).join(' · ');
                        return (
                            <div
                                key={p.id}
                                className={`rounded-2xl border overflow-hidden ${
                                    p.status === 'pending'
                                        ? 'border-amber-400/25 bg-linear-to-br from-amber-500/8 to-[#161718]'
                                        : p.checkedIn
                                            ? 'border-emerald-400/20 bg-emerald-500/5'
                                            : 'border-white/10 bg-[#161718]'
                                }`}
                            >
                                <div className="px-3.5 py-3 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setDetailId(p.id)}
                                        className="min-w-0 flex-1 text-left space-y-1"
                                    >
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {p.competitionName ? (
                                                <span className="text-[10px] font-semibold uppercase tracking-wide text-[#0ECCEE]/90 truncate max-w-56">
                                                    {p.competitionName}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-600">General</span>
                                            )}
                                            {p.isManual ? (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">manual</span>
                                            ) : null}
                                        </div>
                                        <p className="text-[15px] font-semibold text-white truncate">
                                            {p.userName || '—'}
                                        </p>
                                        {p.teamName ? (
                                            <p className="text-xs text-gray-400 truncate">Team · {p.teamName}</p>
                                        ) : null}
                                        {meta ? (
                                            <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                                                <MapPin size={10} className="shrink-0 opacity-60" />
                                                {meta}
                                            </p>
                                        ) : null}
                                        <p className="text-[11px] text-gray-600 truncate">
                                            {[p.userPhone, p.userEmail].filter(Boolean).join(' · ') || 'No contact'}
                                        </p>
                                        {Array.isArray(p.highlights) && p.highlights.length ? (
                                            <div className="flex flex-wrap gap-1 pt-1">
                                                {p.highlights.slice(0, 3).map((h) => (
                                                    <span
                                                        key={h.key}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 max-w-full truncate"
                                                        title={`${h.label}: ${h.value}`}
                                                    >
                                                        {h.label}: {h.value}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : null}
                                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${statusTone(p.status)}`}>
                                                {p.status}
                                            </span>
                                            <span className={`text-[10px] capitalize ${payTone(p.paymentStatus)}`}>
                                                {p.paymentStatus}
                                                {Number(p.amountPaid) > 0 ? ` · ₹${Number(p.amountPaid).toLocaleString('en-IN')}` : ''}
                                            </span>
                                            {p.checkedIn ? (
                                                <span className="text-[10px] text-emerald-400">checked in</span>
                                            ) : p.status === 'approved' ? (
                                                <span className="text-[10px] text-gray-600">not checked in</span>
                                            ) : null}
                                            <span className="text-[10px] text-gray-600 ml-auto tabular-nums">
                                                {formatWhen(p.submittedAt || p.createdAt)}
                                            </span>
                                        </div>
                                    </button>

                                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                                        <div className="flex items-center gap-1">
                                            {wa ? (
                                                <a
                                                    href={wa}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="p-2 rounded-xl bg-emerald-500/15 text-emerald-300"
                                                    aria-label="WhatsApp"
                                                >
                                                    <MessageCircle size={14} />
                                                </a>
                                            ) : null}
                                            {tel ? (
                                                <a
                                                    href={tel}
                                                    className="p-2 rounded-xl bg-white/5 text-gray-300"
                                                    aria-label="Call"
                                                >
                                                    <Phone size={14} />
                                                </a>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <div className="px-3.5 pb-3 flex flex-wrap gap-2 border-t border-white/5 pt-2.5">
                                    {p.status === 'pending' ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(actionBusy)}
                                            onClick={() => setStatus(p, 'approved', 'Approve registration')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-black text-xs font-semibold disabled:opacity-50"
                                        >
                                            {actionBusy === `${p.id}-approved` ? <Loader className="animate-spin" size={12} /> : <Check size={12} />}
                                            Approve
                                        </button>
                                    ) : null}
                                    {p.status !== 'rejected' ? (
                                        <button
                                            type="button"
                                            disabled={Boolean(actionBusy)}
                                            onClick={() => setStatus(p, 'rejected', 'Reject registration')}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-400/25 text-red-300 text-xs disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        onClick={() => setDetailId(p.id)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 text-gray-300 text-xs"
                                    >
                                        Details
                                    </button>
                                    {p.competitionId ? (
                                        <Link
                                            to={`/fest-organizer/fests/${festId}/competitions/${p.competitionId}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#0ECCEE]/25 text-[#0ECCEE] text-xs ml-auto"
                                        >
                                            Competition desk
                                        </Link>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })}

                    {!rows.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center px-4">
                            <Users className="mx-auto text-gray-600 mb-2" size={28} />
                            <p className="text-sm text-gray-500">No participants match these filters</p>
                            {hasFilters ? (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-3 text-xs text-[#0ECCEE]"
                                >
                                    Clear filters
                                </button>
                            ) : null}
                        </div>
                    ) : null}
                </div>
            )}

            {pagination.pages > 1 ? (
                <div className="flex justify-center items-center gap-3 pt-1">
                    <button
                        type="button"
                        disabled={pagination.page <= 1 || loading}
                        onClick={() => load(pagination.page - 1)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-sm disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-sm text-gray-500 tabular-nums">
                        {pagination.page} / {pagination.pages}
                    </span>
                    <button
                        type="button"
                        disabled={pagination.page >= pagination.pages || loading}
                        onClick={() => load(pagination.page + 1)}
                        className="px-3 py-1.5 rounded-lg border border-white/10 text-sm disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            ) : null}

            {detailId ? (
                <FestOrganizerParticipantModal
                    festId={festId}
                    registrationId={detailId}
                    onClose={() => setDetailId(null)}
                    onUpdated={() => load(pagination.page)}
                />
            ) : null}
        </div>
    );
}

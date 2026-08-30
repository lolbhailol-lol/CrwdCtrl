import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Download, Loader, Search, ChevronLeft, ChevronRight,
    Users, UserCheck, Clock, ChevronsDownUp, X, Hourglass, Bell,
} from 'lucide-react';
import {
    exportRunClubOrganizerParticipants,
    fetchRunClubOrganizerParticipants,
    fetchRunClubOrganizerDashboard,
    resendRunClubOrganizerConfirmation,
    deleteRunClubOrganizerParticipant,
    reviewRunClubOrganizerPayment,
    updateRunClubOrganizerParticipantFormAnswers,
    notifyRunClubOrganizerParticipant,
} from '../../services/api/runClubOrganizer.api';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import { useDialog } from '../../context/DialogContext';
import ParticipantCard, { getGuestOpsAnswers, shortOpsLabel } from '../trek-organizer/ParticipantCard';
import PaymentProofReviewModal from './PaymentProofReviewModal';
import MissingFormAnswersEditor from './MissingFormAnswersEditor';
import { getRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { isEventsListingHub, organizerHubCopy } from '../../utils/listingHubCopy';

function FilterChip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-2 min-h-[36px] rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
            {children}
        </button>
    );
}

function NotifyParticipantModal({ open, participant, onClose, onSend, copy }) {
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!open) {
            setTitle('');
            setMessage('');
            setBusy(false);
        } else if (participant?.participantName) {
            setTitle(`Message for ${participant.participantName.split(' ')[0]}`);
        }
    }, [open, participant?.bookingId, participant?.participantName]);

    if (!open || !participant) return null;

    const submit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) return;
        setBusy(true);
        try {
            await onSend(participant.bookingId, title.trim(), message.trim());
            onClose();
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-0 sm:p-4">
            <form
                onSubmit={submit}
                className="w-full max-w-md rounded-t-2xl sm:rounded-2xl border border-gray-800 bg-[#161718] p-4 sm:p-5 space-y-4 pb-[max(1rem,var(--safe-bottom))]"
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-[#0ECCEE]">Individual message</p>
                        <h2 className="text-lg font-bold">{participant.participantName}</h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-white/5">
                        <X size={18} />
                    </button>
                </div>
                <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={120}
                    placeholder="Title"
                    className="w-full px-3 py-3 min-h-[48px] rounded-xl bg-[#111213] border border-gray-700 text-base focus:outline-none focus:border-[#0ECCEE]/50"
                />
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    maxLength={2000}
                    rows={4}
                    placeholder={copy.guestMessage}
                    className="w-full px-3 py-3 rounded-xl bg-[#111213] border border-gray-700 text-base resize-none focus:outline-none focus:border-[#0ECCEE]/50"
                />
                <button
                    type="submit"
                    disabled={busy || !title.trim() || !message.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 min-h-[52px] rounded-xl bg-[#0ECCEE] text-black text-base font-bold disabled:opacity-60"
                >
                    {busy ? <Loader className="animate-spin" size={18} /> : <Bell size={18} />}
                    {copy.notifyGuest}
                </button>
            </form>
        </div>
    );
}

export default function RunClubOrganizerParticipantsPage() {
    const { eventId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm, toast } = useDialog();
    const isEventHub = isEventsListingHub(getRunClubOrganizerSession()?.runClub);
    const copy = organizerHubCopy(isEventHub);
    const [rows, setRows] = useState([]);
    const [eventTitle, setEventTitle] = useState('');
    const [stats, setStats] = useState(null);
    const [eventFee, setEventFee] = useState(0);
    const [registrationMode, setRegistrationMode] = useState('internal_form');
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [expandAll, setExpandAll] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const initialPayment = searchParams.get('paymentStatus') || '';
    const initialGender = String(searchParams.get('gender') || '').toLowerCase();
    const [paymentFilter, setPaymentFilter] = useState(
        ['paid', 'free', 'pending_review', 'rejected'].includes(initialPayment) ? initialPayment : '',
    );
    const [checkInFilter, setCheckInFilter] = useState(
        ['checked_in', 'pending'].includes(searchParams.get('checkInStatus') || '')
            ? searchParams.get('checkInStatus')
            : '',
    );
    const [genderFilter, setGenderFilter] = useState(
        ['female', 'male'].includes(initialGender) ? initialGender : '',
    );
    const [groupBy, setGroupBy] = useState(''); // '' | 'drink' | 'skill'
    const [page, setPage] = useState(1);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [reviewQueue, setReviewQueue] = useState([]);
    const [notifyTarget, setNotifyTarget] = useState(null);
    const [savingFormId, setSavingFormId] = useState('');

    const isPaidEvent = Number(eventFee) > 0;
    const isOrganizerQr = registrationMode === 'organizer_qr';
    const pendingCount = isPaidEvent ? Number(stats?.pendingPaymentReview ?? 0) : 0;
    const showPaymentReview = isPaidEvent && (isOrganizerQr || pendingCount > 0);

    const hasFilters = search || paymentFilter || checkInFilter || genderFilter;

    const pendingQueue = useMemo(() => {
        if (reviewQueue.length > 0) return reviewQueue;
        return rows.filter((r) => r.paymentStatus === 'Pending review' || r.status === 'pending');
    }, [rows, reviewQueue]);
    const reviewIndex = reviewTarget
        ? pendingQueue.findIndex((r) => r.bookingId === reviewTarget.bookingId)
        : -1;

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const loadReviewQueue = useCallback(async () => {
        if (!eventId) return [];
        try {
            const data = await fetchRunClubOrganizerParticipants(eventId, {
                page: 1,
                limit: 200,
                paymentStatus: 'pending_review',
                sortBy: 'createdAt',
                sortDir: 'asc',
            });
            const list = data.participants || [];
            setReviewQueue(list);
            return list;
        } catch {
            return [];
        }
    }, [eventId]);

    const load = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const params = {
                page,
                limit: isEventHub && groupBy ? 100 : 25,
                sortBy: 'createdAt',
                sortDir: 'desc',
            };
            if (search) params.search = search;
            if (paymentFilter) params.paymentStatus = paymentFilter;
            if (checkInFilter) params.checkInStatus = checkInFilter;
            if (genderFilter) params.gender = genderFilter;

            const [listData, dashData] = await Promise.all([
                fetchRunClubOrganizerParticipants(eventId, params),
                fetchRunClubOrganizerDashboard(eventId).catch(() => null),
            ]);

            setRows(listData.participants || []);
            setEventTitle(listData.eventTitle || listData.trekName || '');
            setPagination(listData.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
            if (dashData?.stats) {
                const quotas = dashData.genderRegistration?.quotas;
                setStats({
                    ...dashData.stats,
                    femaleCount: Number(dashData.stats.femaleCount)
                        || Number(quotas?.female?.filled)
                        || 0,
                    maleCount: Number(dashData.stats.maleCount)
                        || Number(quotas?.male?.filled)
                        || 0,
                });
            }
            if (dashData?.event?.registrationFee != null) {
                setEventFee(Number(dashData.event.registrationFee) || 0);
            }
            if (dashData?.event?.registrationMode) {
                setRegistrationMode(dashData.event.registrationMode);
            } else if (listData.registrationMode) {
                setRegistrationMode(listData.registrationMode);
            }
        } catch (e) {
            toast(e.message || 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    }, [eventId, page, search, paymentFilter, checkInFilter, genderFilter, isEventHub, groupBy, toast]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        const next = String(searchParams.get('gender') || '').toLowerCase();
        const normalized = ['female', 'male'].includes(next) ? next : '';
        setGenderFilter((prev) => (prev === normalized ? prev : normalized));
    }, [searchParams]);

    useEffect(() => {
        if (!isPaidEvent && paymentFilter) {
            setPaymentFilter('');
            setPage(1);
        }
        if (!showPaymentReview && paymentFilter === 'pending_review') {
            setPaymentFilter('');
            setPage(1);
        }
    }, [isPaidEvent, showPaymentReview, paymentFilter]);

    useEffect(() => {
        if (showPaymentReview && paymentFilter === 'pending_review') {
            loadReviewQueue();
        }
    }, [showPaymentReview, paymentFilter, loadReviewQueue]);

    const advanceReviewQueue = useCallback((bookingIdJustHandled) => {
        setReviewQueue((prev) => {
            const source = prev.length > 0
                ? prev
                : rows.filter((r) => r.paymentStatus === 'Pending review' || r.status === 'pending');
            const remaining = source.filter((r) => r.bookingId !== bookingIdJustHandled);
            if (remaining.length === 0) {
                setReviewTarget(null);
                toast('All caught up — no pending payments left');
                return [];
            }
            const idx = source.findIndex((r) => r.bookingId === bookingIdJustHandled);
            const next = remaining[Math.min(Math.max(idx, 0), remaining.length - 1)] || remaining[0];
            setReviewTarget(next);
            return remaining;
        });
    }, [rows, toast]);

    const startReviewQueue = useCallback(async () => {
        const list = await loadReviewQueue();
        if (list.length === 0) {
            toast('No payments need review');
            return;
        }
        setPaymentFilter('pending_review');
        setReviewTarget(list[0]);
    }, [loadReviewQueue, toast]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await exportRunClubOrganizerParticipants(eventId, { format: 'csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(eventTitle || copy.csvFallback).replace(/[^a-z0-9-_]+/gi, '_')}_participants.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast('CSV downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleExportExcel = async () => {
        setExporting(true);
        try {
            const blob = await exportRunClubOrganizerParticipants(eventId, { format: 'xlsx' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(eventTitle || copy.csvFallback).replace(/[^a-z0-9-_]+/gi, '_')}_participants.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Excel downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleSaveFormAnswers = async (bookingId, answers) => {
        setSavingFormId(bookingId);
        try {
            const data = await updateRunClubOrganizerParticipantFormAnswers(eventId, bookingId, answers);
            setRows((prev) => prev.map((row) => (
                row.bookingId === bookingId ? data.participant : row
            )));
            toast('Form answers saved');
        } catch (e) {
            toast(e.message || 'Failed to save answers');
        } finally {
            setSavingFormId('');
        }
    };

    const handleResend = async (bookingId) => {
        const ok = await confirm('Resend confirmation to this participant?');
        if (!ok) return;
        try {
            await resendRunClubOrganizerConfirmation(eventId, bookingId);
            toast('Confirmation sent');
        } catch (e) {
            toast(e.message || 'Failed to send');
        }
    };

    const handleDelete = async (bookingId, participantName) => {
        const ok = await confirm({
            title: 'Delete entry?',
            message: participantName
                ? copy.removeNamed(participantName)
                : copy.removeAnon,
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteRunClubOrganizerParticipant(eventId, bookingId);
            setRows((prev) => prev.filter((row) => row.bookingId !== bookingId));
            setPagination((prev) => ({ ...prev, total: Math.max(0, (prev.total || 1) - 1) }));
            toast('Entry removed');
        } catch (e) {
            toast(e.message || 'Failed to delete');
        }
    };

    const handleApprovePayment = async (bookingId) => {
        try {
            await reviewRunClubOrganizerPayment(eventId, bookingId, 'approve');
            toast(copy.approvedToast);
            advanceReviewQueue(bookingId);
            await load();
        } catch (e) {
            // Toast only — do not rethrow (was flooding Sentry as unhandledrejection)
            toast(e.message || 'Approve failed');
        }
    };

    const handleRejectPayment = async (bookingId, note = '') => {
        try {
            await reviewRunClubOrganizerPayment(eventId, bookingId, 'reject', note);
            toast(copy.rejectedToast);
            advanceReviewQueue(bookingId);
            await load();
        } catch (e) {
            toast(e.message || 'Reject failed');
        }
    };

    const handleNotify = async (bookingId, title, message) => {
        const res = await notifyRunClubOrganizerParticipant(eventId, bookingId, { title, message });
        const d = res.delivery;
        const parts = [];
        if (d?.inApp) parts.push('in-app');
        if (d?.push) parts.push('push');
        if (d?.email) parts.push('email');
        toast(parts.length ? `Sent · ${parts.join(', ')}` : res.message || 'Sent');
    };

    const clearFilters = () => {
        setSearchInput('');
        setSearch('');
        setPaymentFilter('');
        setCheckInFilter('');
        setGenderFilter('');
        setSearchParams({});
        setPage(1);
    };

    const startIndex = (pagination.page - 1) * pagination.limit;

    const hasOpsFields = useMemo(() => {
        if (!isEventHub) return false;
        return rows.some((row) => {
            const ops = getGuestOpsAnswers(row);
            return Boolean(ops.drink || ops.skill);
        });
    }, [rows, isEventHub]);

    const groupedGuestSections = useMemo(() => {
        if (!isEventHub || !groupBy) return null;
        const map = new Map();
        for (const row of rows) {
            const ops = getGuestOpsAnswers(row);
            const raw = groupBy === 'drink' ? ops.drink?.value : ops.skill?.value;
            const key = String(raw || '').trim() || (groupBy === 'drink' ? 'No post game fuel set' : 'No skill set');
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(row);
        }
        return [...map.entries()]
            .sort((a, b) => {
                const aEmpty = a[0].startsWith('No ');
                const bEmpty = b[0].startsWith('No ');
                if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
                return b[1].length - a[1].length || a[0].localeCompare(b[0]);
            })
            .map(([title, items]) => ({ title, items, count: items.length }));
    }, [rows, groupBy, isEventHub]);

    const renderGuestCard = (row, i, indexOverride) => (
        <ParticipantCard
            key={row.bookingId}
            participant={row}
            index={indexOverride ?? (startIndex + i + 1)}
            activityLabelSingular={copy.activitySingular}
            activityLabelPlural={copy.activityPlural}
            summaryMode={isEventHub ? 'contact' : 'full'}
            forceOpen={expandAll || paymentFilter === 'pending_review'}
            onResend={row.status === 'confirmed' ? handleResend : undefined}
            onNotify={row.status === 'confirmed' ? () => setNotifyTarget(row) : undefined}
            onDelete={row.status === 'confirmed' ? handleDelete : undefined}
            onReviewPayment={
                showPaymentReview && (row.paymentStatus === 'Pending review' || row.status === 'pending')
                    ? () => setReviewTarget(row)
                    : undefined
            }
            onCopied={(msg) => toast(msg)}
            extraExpandedContent={(
                <MissingFormAnswersEditor
                    participant={row}
                    busy={savingFormId === row.bookingId}
                    onSave={(answers) => handleSaveFormAnswers(row.bookingId, answers)}
                />
            )}
        />
    );

    return (
        <div className={`mx-auto ${isEventHub ? 'space-y-4 max-w-xl' : 'space-y-5 max-w-4xl'}`}>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                    <h1 className={`${isEventHub ? 'text-xl font-semibold' : 'text-2xl font-bold'}`}>
                        {paymentFilter === 'pending_review'
                            ? 'Payment review'
                            : isEventHub
                                ? 'Guests'
                                : 'Participants'}
                    </h1>
                    <p className="text-sm text-gray-500 mt-0.5">
                        {eventTitle || copy.registrations}
                        {stats?.totalRegistrations != null ? ` · ${stats.totalRegistrations}` : ''}
                    </p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {!isEventHub && rows.length > 0 ? (
                        <button type="button" onClick={() => setExpandAll((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-700 text-xs font-medium text-gray-300 hover:border-[#0ECCEE]/40">
                            <ChevronsDownUp size={14} />
                            {expandAll ? 'Collapse' : 'Expand'}
                        </button>
                    ) : null}
                    <button type="button" onClick={handleExportExcel} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg border border-[#0ECCEE]/40 text-[#0ECCEE] text-xs font-bold hover:bg-[#0ECCEE]/10 disabled:opacity-60">
                        {exporting ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                        {isEventHub ? 'Excel' : 'Export Excel'}
                    </button>
                    {!isEventHub ? (
                        <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] rounded-lg bg-[#0ECCEE] text-black text-xs font-bold hover:opacity-90 disabled:opacity-60">
                            {exporting ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                            Export CSV
                        </button>
                    ) : null}
                </div>
            </div>

            {showPaymentReview && pendingCount > 0 && paymentFilter !== 'pending_review' ? (
                <button
                    type="button"
                    onClick={() => {
                        setPaymentFilter('pending_review');
                        setCheckInFilter('');
                        setPage(1);
                    }}
                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3.5 min-h-[52px] text-left hover:bg-amber-500/15 active:scale-[0.99]"
                >
                    <span className="inline-flex flex-col gap-0.5 min-w-0">
                        <span className="inline-flex items-center gap-2 text-sm text-amber-200 font-medium">
                            <Hourglass size={16} />
                            {pendingCount} payment{pendingCount === 1 ? '' : 's'} need review
                        </span>
                        <span className="text-[11px] text-amber-200/70 pl-6">
                            Match UTR / transaction ID with screenshot
                        </span>
                    </span>
                    <span className="text-xs text-amber-300 font-semibold shrink-0">Review →</span>
                </button>
            ) : null}

            {showPaymentReview && paymentFilter === 'pending_review' && pendingQueue.length > 0 ? (
                <button
                    type="button"
                    onClick={() => startReviewQueue()}
                    className="w-full rounded-xl bg-amber-400 text-black font-bold text-sm py-3.5 min-h-[52px] active:scale-[0.99]"
                >
                    Start review queue ({pendingQueue.length})
                </button>
            ) : null}

            {stats && !isEventHub ? (
                <div className={`grid gap-2 ${isPaidEvent ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-5'}`}>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Users size={11} /> Confirmed</p>
                        <p className="text-xl font-bold mt-0.5">{stats.totalRegistrations}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500">Women</p>
                        <p className="text-xl font-bold mt-0.5">{stats.femaleCount ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500">Men</p>
                        <p className="text-xl font-bold mt-0.5">{stats.maleCount ?? 0}</p>
                    </div>
                    {showPaymentReview ? (
                        <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                            <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Hourglass size={11} /> Needs review</p>
                            <p className="text-xl font-bold mt-0.5 text-amber-400">{pendingCount}</p>
                        </div>
                    ) : isPaidEvent ? (
                        <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                            <p className="text-[10px] uppercase text-gray-500">Payment</p>
                            <p className="text-xs font-semibold mt-1 text-[#0ECCEE]">Auto · Cashfree</p>
                        </div>
                    ) : null}
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><UserCheck size={11} /> Checked in</p>
                        <p className="text-xl font-bold mt-0.5 text-emerald-400">{stats.checkedIn}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Clock size={11} /> Seats left</p>
                        <p className="text-xl font-bold mt-0.5">
                            {stats.seatsRemaining == null ? '—' : stats.seatsRemaining}
                        </p>
                    </div>
                </div>
            ) : null}

            {stats && isEventHub ? (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            const next = genderFilter === 'female' ? '' : 'female';
                            setGenderFilter(next);
                            setPage(1);
                            const params = new URLSearchParams(searchParams);
                            if (next) params.set('gender', next);
                            else params.delete('gender');
                            params.delete('paymentStatus');
                            params.delete('checkInStatus');
                            setPaymentFilter('');
                            setCheckInFilter('');
                            setSearchParams(params);
                        }}
                        className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                            genderFilter === 'female'
                                ? 'border-rose-400/40 bg-rose-500/15'
                                : 'border-white/10 bg-[#161718] hover:border-rose-400/25'
                        }`}
                    >
                        <p className="text-[11px] text-rose-300/80 font-medium">Women</p>
                        <p className="text-xl font-semibold tabular-nums text-rose-100 mt-1 leading-none">
                            {stats.femaleCount ?? 0}
                        </p>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            const next = genderFilter === 'male' ? '' : 'male';
                            setGenderFilter(next);
                            setPage(1);
                            const params = new URLSearchParams(searchParams);
                            if (next) params.set('gender', next);
                            else params.delete('gender');
                            params.delete('paymentStatus');
                            params.delete('checkInStatus');
                            setPaymentFilter('');
                            setCheckInFilter('');
                            setSearchParams(params);
                        }}
                        className={`rounded-xl border px-3.5 py-3 text-left transition-colors ${
                            genderFilter === 'male'
                                ? 'border-sky-400/40 bg-sky-500/15'
                                : 'border-white/10 bg-[#161718] hover:border-sky-400/25'
                        }`}
                    >
                        <p className="text-[11px] text-sky-300/80 font-medium">Men</p>
                        <p className="text-xl font-semibold tabular-nums text-sky-100 mt-1 leading-none">
                            {stats.maleCount ?? 0}
                        </p>
                    </button>
                </div>
            ) : null}

            <div className={`rounded-xl border border-gray-800 bg-[#161718] p-3 ${isEventHub ? 'space-y-2.5' : 'space-y-3'}`}>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder={isEventHub ? 'Search name or phone…' : 'Search name, phone, email…'}
                        className="w-full pl-10 pr-10 py-3 min-h-[48px] rounded-lg bg-[#111213] border border-gray-700 text-base focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                    {searchInput ? (
                        <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1">
                            <X size={16} />
                        </button>
                    ) : null}
                </div>
                {!isEventHub ? (
                <div className="flex flex-wrap items-center gap-2">
                    <FilterChip active={!paymentFilter && !checkInFilter && !genderFilter} onClick={() => { setPaymentFilter(''); setCheckInFilter(''); setGenderFilter(''); setSearchParams({}); setPage(1); }}>All</FilterChip>
                    <FilterChip
                        active={genderFilter === 'female'}
                        onClick={() => {
                            const next = genderFilter === 'female' ? '' : 'female';
                            setGenderFilter(next);
                            setPage(1);
                            const params = new URLSearchParams(searchParams);
                            if (next) params.set('gender', next);
                            else params.delete('gender');
                            setSearchParams(params);
                        }}
                    >
                        Women{stats?.femaleCount != null ? ` · ${stats.femaleCount}` : ''}
                    </FilterChip>
                    <FilterChip
                        active={genderFilter === 'male'}
                        onClick={() => {
                            const next = genderFilter === 'male' ? '' : 'male';
                            setGenderFilter(next);
                            setPage(1);
                            const params = new URLSearchParams(searchParams);
                            if (next) params.set('gender', next);
                            else params.delete('gender');
                            setSearchParams(params);
                        }}
                    >
                        Men{stats?.maleCount != null ? ` · ${stats.maleCount}` : ''}
                    </FilterChip>
                    {isPaidEvent ? (
                        <>
                            {showPaymentReview ? (
                                <FilterChip active={paymentFilter === 'pending_review'} onClick={() => { setPaymentFilter(paymentFilter === 'pending_review' ? '' : 'pending_review'); setPage(1); }}>Needs review</FilterChip>
                            ) : null}
                            <FilterChip active={paymentFilter === 'paid'} onClick={() => { setPaymentFilter(paymentFilter === 'paid' ? '' : 'paid'); setPage(1); }}>Paid</FilterChip>
                            <FilterChip active={paymentFilter === 'free'} onClick={() => { setPaymentFilter(paymentFilter === 'free' ? '' : 'free'); setPage(1); }}>Free</FilterChip>
                            <FilterChip active={paymentFilter === 'rejected'} onClick={() => { setPaymentFilter(paymentFilter === 'rejected' ? '' : 'rejected'); setPage(1); }}>Rejected</FilterChip>
                        </>
                    ) : null}
                    <FilterChip active={checkInFilter === 'checked_in'} onClick={() => { setCheckInFilter(checkInFilter === 'checked_in' ? '' : 'checked_in'); setPage(1); }}>Checked in</FilterChip>
                    <FilterChip active={checkInFilter === 'pending'} onClick={() => { setCheckInFilter(checkInFilter === 'pending' ? '' : 'pending'); setPage(1); }}>Not yet</FilterChip>
                    {hasFilters ? (
                        <button type="button" onClick={clearFilters} className="text-xs text-[#0ECCEE] ml-auto hover:underline py-2">Clear</button>
                    ) : null}
                </div>
                ) : (genderFilter || hasOpsFields) ? (
                <div className="flex flex-wrap items-center gap-2">
                    {genderFilter ? (
                        <button
                            type="button"
                            onClick={() => {
                                setGenderFilter('');
                                const params = new URLSearchParams(searchParams);
                                params.delete('gender');
                                setSearchParams(params);
                                setPage(1);
                            }}
                            className="text-xs text-[#0ECCEE] hover:underline py-1"
                        >
                            Show all
                        </button>
                    ) : null}
                    {hasOpsFields ? (
                        <>
                            <span className="text-[11px] text-gray-500">{genderFilter ? '·' : ''} Group</span>
                            <FilterChip
                                active={!groupBy}
                                onClick={() => { setGroupBy(''); setPage(1); }}
                            >
                                List
                            </FilterChip>
                            <FilterChip
                                active={groupBy === 'drink'}
                                onClick={() => { setGroupBy(groupBy === 'drink' ? '' : 'drink'); setPage(1); }}
                            >
                                Post game fuel
                            </FilterChip>
                            <FilterChip
                                active={groupBy === 'skill'}
                                onClick={() => { setGroupBy(groupBy === 'skill' ? '' : 'skill'); setPage(1); }}
                            >
                                Skill
                            </FilterChip>
                        </>
                    ) : null}
                </div>
                ) : null}
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <DetailLoader3DIcon size="compact" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-dashed border-gray-800">
                    <Users className="mx-auto text-gray-600 mb-3" size={32} />
                    <p className="text-gray-400 font-medium">{isEventHub ? 'No guests found' : 'No participants found'}</p>
                </div>
            ) : groupedGuestSections ? (
                <div className="space-y-5">
                    {groupedGuestSections.map((section) => (
                        <section key={section.title} className="space-y-2">
                            <div className="sticky top-12 z-10 -mx-1 px-1 py-1.5 bg-[#0f1011]/95 backdrop-blur flex items-baseline justify-between gap-2">
                                <h2 className={`text-sm font-semibold truncate ${
                                    groupBy === 'drink' ? 'text-amber-200' : 'text-sky-200'
                                }`}>
                                    {shortOpsLabel(section.title) || section.title}
                                </h2>
                                <span className="text-xs text-gray-500 tabular-nums shrink-0">
                                    {section.count}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {section.items.map((row, i) => renderGuestCard(row, i, i + 1))}
                            </div>
                        </section>
                    ))}
                </div>
            ) : (
                <div className={isEventHub ? 'space-y-2' : 'space-y-3'}>
                    {rows.map((row, i) => renderGuestCard(row, i))}
                </div>
            )}

            {pagination.totalPages > 1 && !groupBy ? (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-700 text-xs disabled:opacity-30">
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 px-3 py-2.5 min-h-[44px] rounded-lg border border-gray-700 text-xs disabled:opacity-30">
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            <PaymentProofReviewModal
                open={!!reviewTarget}
                participant={reviewTarget}
                expectedFee={reviewTarget?.expectedAmount}
                eventTitle={eventTitle}
                queueIndex={Math.max(0, reviewIndex)}
                queueTotal={pendingQueue.length}
                onClose={() => setReviewTarget(null)}
                onApprove={handleApprovePayment}
                onReject={handleRejectPayment}
                onPrev={
                    reviewIndex > 0
                        ? () => setReviewTarget(pendingQueue[reviewIndex - 1])
                        : undefined
                }
                onNext={
                    reviewIndex >= 0 && reviewIndex < pendingQueue.length - 1
                        ? () => setReviewTarget(pendingQueue[reviewIndex + 1])
                        : undefined
                }
                guestNotePlaceholder={copy.guestNote}
                whatsappMessage={copy.whatsappPayment}
            />

            <NotifyParticipantModal
                open={!!notifyTarget}
                participant={notifyTarget}
                onClose={() => setNotifyTarget(null)}
                onSend={handleNotify}
                copy={copy}
            />
        </div>
    );
}
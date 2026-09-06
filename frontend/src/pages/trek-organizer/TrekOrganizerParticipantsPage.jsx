import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
    Download, Loader, Search, ChevronLeft, ChevronRight,
    Users, UserCheck, ChevronsDownUp, X, Mail, Venus, Mars,
    ArrowUpDown, Copy, CheckSquare, Square, Sparkles, Clock,
    IndianRupee, MessageCircle, MapPin, Calendar,
} from 'lucide-react';
import {
    exportTrekOrganizerParticipants,
    fetchTrekOrganizerParticipants,
    fetchTrekOrganizerDashboard,
    resendTrekOrganizerConfirmation,
    deleteTrekOrganizerParticipant,
    sendTrekOrganizerParticipantMessage,
    reviewTrekOrganizerPayment,
} from '../../services/api/trekOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { formatOrganizerTrekDate } from '../../utils/trekDateDisplay';
import ParticipantCard from './ParticipantCard';
import TrekOrganizerMessageModal from './TrekOrganizerMessageModal';
import TrekOrganizerWhatsAppModal from './TrekOrganizerWhatsAppModal';
import TrekOrganizerParticipantModal from './TrekOrganizerParticipantModal';
import PaymentProofReviewModal from '../run-club-organizer/PaymentProofReviewModal';
import { isValidWhatsAppPhone } from '../../utils/whatsappDeepLink';

const SORT_OPTIONS = [
    { value: 'createdAt:desc', label: 'Newest first' },
    { value: 'createdAt:asc', label: 'Oldest first' },
    { value: 'name:asc', label: 'Name A–Z' },
    { value: 'name:desc', label: 'Name Z–A' },
    { value: 'checkIn:desc', label: 'Checked in first' },
    { value: 'payment:desc', label: 'Highest paid' },
];

/** Group "(City) Place ~time" options into optgroups for a compact pickup select. */
function groupLocationOptions(options) {
    const groups = new Map();
    const ungrouped = [];
    for (const raw of options) {
        const opt = String(raw || '').trim();
        if (!opt) continue;
        const m = opt.match(/^\(([^)]+)\)\s*(.+)$/);
        if (m) {
            const city = m[1].trim();
            const label = m[2].trim();
            if (!groups.has(city)) groups.set(city, []);
            groups.get(city).push({ value: opt, label });
        } else {
            ungrouped.push({ value: opt, label: opt });
        }
    }
    return { groups, ungrouped };
}

function shortMeetingLabel(value) {
    const s = String(value || '').trim();
    if (!s) return '';
    const m = s.match(/^\(([^)]+)\)\s*(.+)$/);
    return m ? `${m[1]} · ${m[2]}` : s;
}

function FilterChip({ active, onClick, children, count }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-lg text-xs font-medium border transition-colors ${
                active
                    ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border-[#0ECCEE]/35'
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/10'
            }`}
        >
            {children}
            {typeof count === 'number' ? (
                <span className={`tabular-nums ${active ? 'text-[#0ECCEE]/80' : 'text-gray-600'}`}>{count}</span>
            ) : null}
        </button>
    );
}

function StatPill({ label, value, tone = 'default', active, onClick, icon: Icon }) {
    const tones = {
        default: 'border-white/10 from-[#1a1b1d] to-[#141516]',
        accent: 'border-[#0ECCEE]/25 from-[#0ECCEE]/15 to-[#0ECCEE]/5',
        women: 'border-pink-500/20 from-pink-500/15 to-pink-500/5',
        men: 'border-sky-500/20 from-sky-500/15 to-sky-500/5',
        ok: 'border-emerald-500/20 from-emerald-500/15 to-emerald-500/5',
        warn: 'border-amber-500/20 from-amber-500/15 to-amber-500/5',
        money: 'border-emerald-500/20 from-emerald-500/10 to-[#141516]',
    };
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border bg-linear-to-br ${tones[tone] || tones.default} px-3 py-3 text-left transition-all ${
                active ? 'ring-1 ring-[#0ECCEE]/50 border-[#0ECCEE]/40' : 'hover:border-[#0ECCEE]/35'
            }`}
        >
            <p className="text-[10px] uppercase tracking-widest text-gray-500 flex items-center gap-1">
                {Icon ? <Icon size={11} /> : null}
                {label}
            </p>
            <p className="text-xl font-semibold mt-1 tabular-nums text-white">{value}</p>
        </button>
    );
}

function SkeletonCard() {
    return (
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] p-4 animate-pulse flex gap-3">
            <div className="size-11 rounded-xl bg-white/5 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-white/5 rounded w-2/5" />
                <div className="h-3 bg-white/5 rounded w-3/5" />
                <div className="h-3 bg-white/5 rounded w-1/3" />
            </div>
        </div>
    );
}

export default function TrekOrganizerParticipantsPage() {
    const { trekId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { confirm, toast } = useDialog();
    const session = getTrekOrganizerSession();
    const communityId = session?.community?._id || session?.organizer?.communityId || '';
    const sessionTrek = session?.treks?.find((t) => String(t._id) === String(trekId));
    const trekDateLabel = formatOrganizerTrekDate(sessionTrek || {}) || sessionTrek?.dateLabel || '';
    const sessionMeetingPoint = sessionTrek?.meetingLocation || '';

    const [rows, setRows] = useState([]);
    const [trekName, setTrekName] = useState('');
    const [mapMeetingLocation, setMapMeetingLocation] = useState(sessionMeetingPoint);
    const [locationOptions, setLocationOptions] = useState([]);
    const [dashDateLabel, setDashDateLabel] = useState(trekDateLabel);
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [expandAll, setExpandAll] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [messageModal, setMessageModal] = useState({ open: false, bookingIds: [], label: '' });
    const [waRecipients, setWaRecipients] = useState(null);
    const [reviewTarget, setReviewTarget] = useState(null);
    const [detailBookingId, setDetailBookingId] = useState(() => searchParams.get('bookingId') || '');
    const [sortValue, setSortValue] = useState('createdAt:desc');

    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState(() => {
        const q = searchParams.get('paymentStatus');
        return ['paid', 'free', 'pending_review', 'rejected'].includes(q) ? q : '';
    });
    const [checkInFilter, setCheckInFilter] = useState(() => {
        const q = searchParams.get('checkInStatus');
        return ['pending', 'checked_in'].includes(q) ? q : '';
    });
    const [genderFilter, setGenderFilter] = useState(() => {
        const q = searchParams.get('gender');
        return ['Female', 'Male', 'Others'].includes(q) ? q : '';
    });
    const [meetingFilter, setMeetingFilter] = useState(() => searchParams.get('meetingPoint') || '');
    const [page, setPage] = useState(1);
    const [registrationMode, setRegistrationMode] = useState('internal_form');

    useEffect(() => {
        const id = searchParams.get('bookingId') || '';
        if (id) setDetailBookingId(id);
    }, [searchParams]);

    // Keep shareable filter URLs in sync (MindSpark-style), preserve bookingId.
    useEffect(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            const setOrDel = (key, val) => {
                if (val) next.set(key, val);
                else next.delete(key);
            };
            setOrDel('paymentStatus', paymentFilter);
            setOrDel('checkInStatus', checkInFilter);
            setOrDel('gender', genderFilter);
            setOrDel('meetingPoint', meetingFilter);
            if (next.toString() === prev.toString()) return prev;
            return next;
        }, { replace: true });
    }, [paymentFilter, checkInFilter, genderFilter, meetingFilter, setSearchParams]);

    const hasFilters = Boolean(search || paymentFilter || checkInFilter || genderFilter || meetingFilter);
    const isOrganizerQr = registrationMode === 'organizer_qr';
    const pendingCount = isOrganizerQr ? (stats?.pendingReview ?? 0) : 0;
    const revenue = Number(stats?.organizerRevenue ?? stats?.revenue ?? 0);
    const [sortBy, sortDir] = sortValue.split(':');
    const displayDateLabel = dashDateLabel || trekDateLabel;
    const displayMapMeeting = mapMeetingLocation || sessionMeetingPoint;

    const pickupGroups = useMemo(() => groupLocationOptions(locationOptions), [locationOptions]);

    const viewingLabel = useMemo(() => {
        const parts = [];
        if (paymentFilter === 'pending_review') parts.push('Needs review');
        else if (paymentFilter === 'paid') parts.push('Paid');
        else if (paymentFilter === 'free') parts.push('Free');
        else if (paymentFilter === 'rejected') parts.push('Rejected');
        if (checkInFilter === 'checked_in') parts.push('Checked in');
        else if (checkInFilter === 'pending') parts.push('Not checked in');
        if (genderFilter === 'Female') parts.push('Women');
        else if (genderFilter === 'Male') parts.push('Men');
        else if (genderFilter === 'Others') parts.push('Other gender');
        if (meetingFilter) parts.push(shortMeetingLabel(meetingFilter));
        if (search) parts.push(`“${search}”`);
        return parts.length ? parts.join(' · ') : 'All customers';
    }, [paymentFilter, checkInFilter, genderFilter, meetingFilter, search]);

    const pendingQueue = useMemo(
        () => rows.filter((r) => r.paymentStatus === 'Pending review' || r.status === 'pending'),
        [rows],
    );
    const reviewIndex = reviewTarget
        ? pendingQueue.findIndex((r) => r.bookingId === reviewTarget.bookingId)
        : -1;

    const pageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.bookingId));
    const selectedCount = selectedIds.size;

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        if (!trekId) return;
        setLoading(true);
        try {
            const params = { page, limit: 25, sortBy, sortDir };
            if (search) params.search = search;
            if (paymentFilter) params.paymentStatus = paymentFilter;
            if (checkInFilter) params.checkInStatus = checkInFilter;
            if (genderFilter) params.gender = genderFilter;
            if (meetingFilter) params.meetingPoint = meetingFilter;

            const [listData, dashData] = await Promise.all([
                fetchTrekOrganizerParticipants(trekId, params),
                fetchTrekOrganizerDashboard(trekId).catch(() => null),
            ]);

            setRows(listData.participants || []);
            setTrekName(listData.trekName || '');
            if (listData.meetingLocation) setMapMeetingLocation(listData.meetingLocation);
            const opts = Array.isArray(listData.locationOptions) ? listData.locationOptions.filter(Boolean) : [];
            if (opts.length) setLocationOptions(opts);
            setPagination(listData.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
            if (dashData?.stats) setStats(dashData.stats);
            if (dashData?.trek) {
                const dLabel = formatOrganizerTrekDate(dashData.trek) || dashData.trek.dateLabel || '';
                if (dLabel) setDashDateLabel(dLabel);
                if (dashData.trek.meetingLocation) setMapMeetingLocation(dashData.trek.meetingLocation);
                if (Array.isArray(dashData.trek.locationOptions) && dashData.trek.locationOptions.length) {
                    setLocationOptions(dashData.trek.locationOptions.filter(Boolean));
                }
            }
            if (dashData?.trek?.registrationMode) {
                const mode = dashData.trek.registrationMode || 'internal_form';
                setRegistrationMode(mode);
                if (mode !== 'organizer_qr' && paymentFilter === 'pending_review') {
                    setPaymentFilter('');
                }
            }
        } catch (e) {
            toast(e.message || 'Failed to load customers');
        } finally {
            setLoading(false);
        }
    }, [trekId, page, search, paymentFilter, checkInFilter, genderFilter, meetingFilter, sortBy, sortDir, toast]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        setSelectedIds(new Set());
    }, [page, search, paymentFilter, checkInFilter, genderFilter, meetingFilter, trekId, sortValue]);

    const toggleSelect = (bookingId) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(bookingId)) next.delete(bookingId);
            else next.add(bookingId);
            return next;
        });
    };

    const toggleSelectPage = () => {
        const pageIds = rows.map((r) => r.bookingId);
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (pageSelected) pageIds.forEach((id) => next.delete(id));
            else pageIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const openMessageModal = (bookingIds, label = '') => {
        setMessageModal({ open: true, bookingIds, label });
    };

    const openWhatsAppFor = (participants) => {
        const list = (Array.isArray(participants) ? participants : [participants])
            .filter(Boolean)
            .map((p) => ({
                name: p.participantName || p.name || 'Guest',
                phone: p.phone,
                trekName: trekName || p.trekName || '',
                trekDate: p.trekDate || displayDateLabel,
                meetingPoint: p.meetingPoint || p.trekTime || displayMapMeeting,
            }));
        setWaRecipients(list);
    };

    const closeDetailModal = () => {
        setDetailBookingId('');
        if (searchParams.get('bookingId')) {
            const next = new URLSearchParams(searchParams);
            next.delete('bookingId');
            setSearchParams(next, { replace: true });
        }
    };

    const selectedRows = useMemo(
        () => rows.filter((r) => selectedIds.has(r.bookingId)),
        [rows, selectedIds],
    );

    const handleSendMessage = async (payload) => {
        const res = await sendTrekOrganizerParticipantMessage(trekId, {
            bookingIds: messageModal.bookingIds,
            ...payload,
        });
        const d = res.delivery;
        const parts = [];
        if (d?.email) parts.push(`${d.email} email`);
        if (d?.inApp) parts.push(`${d.inApp} in-app`);
        if (d?.push) parts.push(`${d.push} push`);
        toast(parts.length ? `${res.message} · ${parts.join(', ')}` : res.message || 'Sent');
        setSelectedIds(new Set());
    };

    const pageStats = useMemo(() => {
        const paid = rows.filter((r) => r.paymentStatus === 'Paid').length;
        const checkedIn = rows.filter((r) => r.checkInStatus === 'Checked In').length;
        return { paid, checkedIn, pending: rows.length - checkedIn };
    }, [rows]);

    const copySelectedPhones = async () => {
        const phones = rows
            .filter((r) => selectedIds.has(r.bookingId))
            .map((r) => (r.phone && r.phone !== '—' ? r.phone : ''))
            .filter(Boolean);
        if (!phones.length) {
            toast('No phone numbers in selection');
            return;
        }
        try {
            await navigator.clipboard.writeText(phones.join('\n'));
            toast(`Copied ${phones.length} phone${phones.length === 1 ? '' : 's'}`);
        } catch {
            toast('Copy failed');
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await exportTrekOrganizerParticipants(trekId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(trekName || 'trek').replace(/[^a-z0-9-_]+/gi, '_')}_customers.xlsx`;
            a.click();
            URL.revokeObjectURL(url);
            toast('Excel sheet downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const handleResend = async (bookingId) => {
        const ok = await confirm('Resend confirmation to this customer?');
        if (!ok) return;
        try {
            await resendTrekOrganizerConfirmation(trekId, bookingId);
            toast('Confirmation sent');
        } catch (e) {
            toast(e.message || 'Failed to send');
        }
    };

    const handleDelete = async (bookingId, participantName) => {
        const ok = await confirm({
            title: 'Delete entry?',
            message: participantName
                ? `Remove ${participantName} from this trek? This cannot be undone.`
                : 'Remove this customer from the trek? This cannot be undone.',
            confirmText: 'Delete',
            tone: 'danger',
        });
        if (!ok) return;
        try {
            await deleteTrekOrganizerParticipant(trekId, bookingId);
            setRows((prev) => prev.filter((row) => row.bookingId !== bookingId));
            setPagination((prev) => ({
                ...prev,
                total: Math.max(0, (prev.total || 1) - 1),
            }));
            toast('Entry removed');
        } catch (e) {
            toast(e.message || 'Failed to delete');
        }
    };

    const handleApprovePayment = async () => {
        if (!reviewTarget) return;
        try {
            await reviewTrekOrganizerPayment(trekId, reviewTarget.bookingId, 'approve');
            toast('Payment approved');
            setReviewTarget(null);
            await load();
        } catch (e) {
            toast(e.message || 'Approve failed');
            throw e;
        }
    };

    const handleRejectPayment = async (note) => {
        if (!reviewTarget) return;
        try {
            await reviewTrekOrganizerPayment(trekId, reviewTarget.bookingId, 'reject', note);
            toast('Registration rejected');
            setReviewTarget(null);
            await load();
        } catch (e) {
            toast(e.message || 'Reject failed');
            throw e;
        }
    };

    const clearFilters = () => {
        setSearchInput('');
        setSearch('');
        setPaymentFilter('');
        setCheckInFilter('');
        setGenderFilter('');
        setMeetingFilter('');
        setPage(1);
    };

    const togglePayment = (value) => {
        setPaymentFilter((prev) => (prev === value ? '' : value));
        setPage(1);
    };

    /** Stat pills: focus one dimension and clear the others for a clean jump. */
    const jumpFilter = (type, value) => {
        const nextPayment = type === 'payment' ? value : '';
        const nextCheckIn = type === 'checkIn' ? value : '';
        const nextGender = type === 'gender' ? value : '';
        setPaymentFilter(nextPayment);
        setCheckInFilter(nextCheckIn);
        setGenderFilter(nextGender);
        setMeetingFilter('');
        setPage(1);
    };

    const startIndex = (pagination.page - 1) * pagination.limit;
    const title = paymentFilter === 'pending_review' ? 'Payment review' : 'Customers';

    return (
        <div className="space-y-5 max-w-4xl mx-auto pb-24">
            {/* Hero */}
            <div className="rounded-3xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#121314] overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/12 via-transparent to-[#053780]/15 pointer-events-none" />
                <div className="relative p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="min-w-0 space-y-2">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-widest text-[#0ECCEE]">
                                <Sparkles size={11} /> Customers
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight">{title}</h1>
                                <p className="text-sm text-gray-400 mt-1 truncate">{trekName || 'Trek bookings'}</p>
                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-gray-500">
                                    {displayDateLabel ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Calendar size={12} className="text-[#0ECCEE]" />
                                            {displayDateLabel}
                                        </span>
                                    ) : null}
                                    {displayMapMeeting ? (
                                        <span className="inline-flex items-center gap-1 min-w-0">
                                            <MapPin size={12} className="text-[#0ECCEE] shrink-0" />
                                            <span className="truncate">{displayMapMeeting}</span>
                                        </span>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={() => setExpandAll((v) => !v)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-gray-300 hover:border-[#0ECCEE]/40"
                            >
                                <ChevronsDownUp size={14} />
                                {expandAll ? 'Collapse forms' : 'Expand forms'}
                            </button>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={exporting}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#0ECCEE] text-black text-xs font-bold hover:brightness-110 disabled:opacity-60"
                            >
                                {exporting ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                                Export Excel
                            </button>
                        </div>
                    </div>

                    {stats ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                            <StatPill
                                label="Total"
                                value={stats.totalRegistrations ?? 0}
                                tone="accent"
                                icon={Users}
                                active={!hasFilters}
                                onClick={clearFilters}
                            />
                            <StatPill
                                label="Women"
                                value={stats.femaleCount ?? 0}
                                tone="women"
                                icon={Venus}
                                active={genderFilter === 'Female' && !paymentFilter && !checkInFilter}
                                onClick={() => jumpFilter('gender', genderFilter === 'Female' ? '' : 'Female')}
                            />
                            <StatPill
                                label="Men"
                                value={stats.maleCount ?? 0}
                                tone="men"
                                icon={Mars}
                                active={genderFilter === 'Male' && !paymentFilter && !checkInFilter}
                                onClick={() => jumpFilter('gender', genderFilter === 'Male' ? '' : 'Male')}
                            />
                            <StatPill
                                label="Checked in"
                                value={stats.checkedIn ?? 0}
                                tone="ok"
                                icon={UserCheck}
                                active={checkInFilter === 'checked_in' && !paymentFilter && !genderFilter}
                                onClick={() => jumpFilter('checkIn', checkInFilter === 'checked_in' ? '' : 'checked_in')}
                            />
                            <StatPill
                                label="Awaiting"
                                value={Math.max(0, (stats.totalRegistrations ?? 0) - (stats.checkedIn ?? 0))}
                                tone="warn"
                                icon={Clock}
                                active={checkInFilter === 'pending' && !paymentFilter && !genderFilter}
                                onClick={() => jumpFilter('checkIn', checkInFilter === 'pending' ? '' : 'pending')}
                            />
                            <StatPill
                                label="Collected"
                                value={`₹${revenue.toLocaleString('en-IN')}`}
                                tone="money"
                                icon={IndianRupee}
                                onClick={() => jumpFilter('payment', paymentFilter === 'paid' ? '' : 'paid')}
                                active={paymentFilter === 'paid' && !checkInFilter && !genderFilter}
                            />
                        </div>
                    ) : null}
                </div>
            </div>

            {pendingCount > 0 && paymentFilter !== 'pending_review' ? (
                <button
                    type="button"
                    onClick={() => jumpFilter('payment', 'pending_review')}
                    className="w-full rounded-2xl border border-amber-500/30 bg-linear-to-r from-amber-500/15 to-amber-500/5 px-4 py-3.5 text-left hover:border-amber-400/50 transition-colors"
                >
                    <p className="text-sm font-semibold text-amber-200">
                        Review {pendingCount} payment{pendingCount === 1 ? '' : 's'}
                    </p>
                    <p className="text-xs text-amber-200/70 mt-0.5">
                        Screenshot submissions waiting for approve / reject
                    </p>
                </button>
            ) : null}

            {/* Search + filters + sort */}
            <div className="rounded-2xl border border-white/10 bg-[#161718]/95 p-3.5 sm:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search name, phone, or email…"
                            className="w-full pl-10 pr-10 py-3 min-h-12 rounded-xl bg-black/30 border border-white/10 text-base focus:outline-none focus:border-[#0ECCEE]/50"
                        />
                        {searchInput ? (
                            <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                <X size={16} />
                            </button>
                        ) : null}
                    </div>
                    <label className="relative sm:w-52 shrink-0">
                        <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                        <select
                            value={sortValue}
                            onChange={(e) => {
                                setSortValue(e.target.value);
                                setPage(1);
                            }}
                            className="w-full appearance-none pl-9 pr-8 py-3 min-h-12 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-[#0ECCEE]/50"
                        >
                            {SORT_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wide mr-0.5">Showing</p>
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

                <div className="flex flex-wrap items-center gap-1.5">
                    <FilterChip
                        active={!paymentFilter && !checkInFilter && !genderFilter && !meetingFilter}
                        onClick={clearFilters}
                    >
                        All
                    </FilterChip>
                    {isOrganizerQr ? (
                        <FilterChip
                            active={paymentFilter === 'pending_review'}
                            count={pendingCount || undefined}
                            onClick={() => togglePayment('pending_review')}
                        >
                            Needs review
                        </FilterChip>
                    ) : null}
                    <FilterChip active={paymentFilter === 'paid'} onClick={() => togglePayment('paid')}>Paid</FilterChip>
                    <FilterChip active={paymentFilter === 'free'} onClick={() => togglePayment('free')}>Free</FilterChip>
                    {isOrganizerQr ? (
                        <FilterChip active={paymentFilter === 'rejected'} onClick={() => togglePayment('rejected')}>Rejected</FilterChip>
                    ) : null}

                    {locationOptions.length > 0 ? (
                        <>
                            <span className="w-px h-6 bg-white/10 self-center mx-0.5" />
                            <label className="relative min-w-44 max-w-full sm:max-w-xs flex-1 sm:flex-none">
                                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0ECCEE] pointer-events-none" />
                                <select
                                    value={meetingFilter}
                                    onChange={(e) => {
                                        setMeetingFilter(e.target.value);
                                        setPage(1);
                                    }}
                                    className="w-full appearance-none pl-9 pr-8 py-2.5 min-h-11 rounded-xl bg-[#1a1b1d] border border-white/15 text-sm text-white focus:outline-none focus:border-[#0ECCEE]/60"
                                    aria-label="Pickup point"
                                >
                                    <option value="">All pickups</option>
                                    {[...pickupGroups.groups.entries()].map(([city, opts]) => (
                                        <optgroup key={city} label={city}>
                                            {opts.map((o) => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                    {pickupGroups.ungrouped.map((o) => (
                                        <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                </select>
                            </label>
                        </>
                    ) : null}
                </div>
            </div>

            {/* List controls */}
            {!loading && rows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
                    <p className="text-xs text-gray-500">
                        Showing <span className="text-gray-300">{rows.length}</span> of{' '}
                        <span className="text-gray-300">{pagination.total}</span>
                        {hasFilters ? ' · filtered' : ''}
                        {' · '}
                        <span className="text-emerald-400">{pageStats.checkedIn}</span> checked in on this page
                    </p>
                    <button
                        type="button"
                        onClick={toggleSelectPage}
                        className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-[#0ECCEE] transition-colors"
                    >
                        {pageSelected ? <CheckSquare size={14} className="text-[#0ECCEE]" /> : <Square size={14} />}
                        {pageSelected ? 'Deselect page' : 'Select page'}
                    </button>
                </div>
            ) : null}

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 rounded-3xl border border-dashed border-white/15 bg-white/5">
                    <div className="mx-auto size-12 rounded-2xl bg-[#0ECCEE]/10 text-[#0ECCEE] flex items-center justify-center mb-3">
                        <Users size={22} />
                    </div>
                    <p className="text-gray-200 font-medium">No customers found</p>
                    <p className="text-sm text-gray-500 mt-1">
                        {hasFilters ? 'Try clearing filters or search' : 'Registrations will appear here'}
                    </p>
                    {hasFilters ? (
                        <button type="button" onClick={clearFilters} className="mt-4 text-sm text-[#0ECCEE] hover:underline">
                            Clear filters
                        </button>
                    ) : null}
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map((row, i) => (
                        <ParticipantCard
                            key={row.bookingId}
                            participant={row}
                            index={startIndex + i + 1}
                            forceOpen={expandAll || paymentFilter === 'pending_review'}
                            selected={selectedIds.has(row.bookingId)}
                            onToggleSelect={toggleSelect}
                            onResend={row.status === 'confirmed' ? handleResend : undefined}
                            onNotify={row.status === 'confirmed' ? (p) => openMessageModal([p.bookingId], p.participantName) : undefined}
                            onSendEmail={row.status === 'confirmed' ? (p) => openMessageModal([p.bookingId], p.participantName) : undefined}
                            onWhatsApp={isValidWhatsAppPhone(row.phone) ? (p) => openWhatsAppFor(p) : undefined}
                            onDelete={row.status === 'confirmed' ? handleDelete : undefined}
                            onCopied={(msg) => toast(msg)}
                            onReviewPayment={
                                row.paymentStatus === 'Pending review' || row.status === 'pending'
                                    ? () => setReviewTarget(row)
                                    : undefined
                            }
                        />
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between pt-1 rounded-2xl border border-white/10 bg-[#161718]/90 px-3 py-3">
                    <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs disabled:opacity-30 hover:bg-white/5"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button
                            type="button"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs disabled:opacity-30 hover:bg-white/5"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            {/* Sticky bulk actions */}
            {selectedCount > 0 ? (
                <div className="fixed inset-x-0 bottom-[calc(4.5rem+var(--safe-bottom))] lg:bottom-6 z-40 px-3 sm:px-6 pointer-events-none">
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                        <div className="rounded-2xl border border-[#0ECCEE]/30 bg-[#121314]/95 backdrop-blur shadow-2xl px-3.5 py-3 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white mr-auto px-1">
                                {selectedCount} selected
                            </p>
                            <button
                                type="button"
                                onClick={() => openMessageModal([...selectedIds])}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#0ECCEE] text-black text-xs font-bold"
                            >
                                <Mail size={14} /> Message
                            </button>
                            <button
                                type="button"
                                onClick={() => openWhatsAppFor(selectedRows)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#25D366] text-black text-xs font-bold"
                            >
                                <MessageCircle size={14} /> WhatsApp
                            </button>
                            <button
                                type="button"
                                onClick={copySelectedPhones}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-gray-200"
                            >
                                <Copy size={14} /> Copy phones
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedIds(new Set())}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 text-xs text-gray-400"
                            >
                                <X size={14} /> Clear
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <PaymentProofReviewModal
                open={!!reviewTarget}
                participant={reviewTarget}
                expectedFee={reviewTarget?.expectedAmount ?? reviewTarget?.amountPaid}
                eventTitle={trekName}
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
            />

            <TrekOrganizerMessageModal
                open={messageModal.open}
                onClose={() => setMessageModal({ open: false, bookingIds: [], label: '' })}
                recipientCount={messageModal.bookingIds.length}
                recipientLabel={messageModal.label}
                onSend={handleSendMessage}
            />

            <TrekOrganizerWhatsAppModal
                open={!!waRecipients}
                onClose={() => setWaRecipients(null)}
                recipients={waRecipients || []}
                trekName={trekName}
                trekDate={displayDateLabel}
                meetingPoint={displayMapMeeting}
                communityId={String(communityId || '')}
            />

            {detailBookingId ? (
                <TrekOrganizerParticipantModal
                    trekId={trekId}
                    bookingId={detailBookingId}
                    onClose={closeDetailModal}
                    onUpdated={load}
                />
            ) : null}
        </div>
    );
}

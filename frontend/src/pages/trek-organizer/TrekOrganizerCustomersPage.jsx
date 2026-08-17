import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Search, Loader, Users, Phone, Copy, MessageCircle, X,
    ArrowUpDown, CheckSquare, Square, Sparkles, Mountain,
    ChevronLeft, ChevronRight, Download, ExternalLink,
} from 'lucide-react';
import {
    exportTrekOrganizerCustomers,
    fetchTrekOrganizerCustomers,
} from '../../services/api/trekOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getTrekOrganizerSession } from '../../utils/trekOrganizerSession';
import { isValidWhatsAppPhone } from '../../utils/whatsappDeepLink';
import TrekOrganizerWhatsAppModal from './TrekOrganizerWhatsAppModal';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const COMMUNITY_SORT = [
    { value: 'trekCount:desc', label: 'Most treks' },
    { value: 'trekCount:asc', label: 'Fewest treks' },
    { value: 'name:asc', label: 'Name A–Z' },
    { value: 'name:desc', label: 'Name Z–A' },
    { value: 'lastBookedAt:desc', label: 'Recent booking' },
    { value: 'firstBookedAt:desc', label: 'Newest guests' },
];

const TREK_SORT = [
    { value: 'scopedBookedAt:desc', label: 'Booked recently' },
    { value: 'scopedBookedAt:asc', label: 'Booked earliest' },
    { value: 'trekCount:desc', label: 'Most treks overall' },
    { value: 'name:asc', label: 'Name A–Z' },
    { value: 'name:desc', label: 'Name Z–A' },
];

function initials(name = '') {
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatShortDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function StatPill({ label, value }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] px-3 py-3">
            <p className="text-[10px] uppercase tracking-widest text-gray-500">{label}</p>
            <p className="text-xl font-semibold mt-1 tabular-nums text-white">{value}</p>
        </div>
    );
}

function CustomerDetailSheet({ customer, isTrekScope, trekTitle, onClose, onWhatsApp, onOpenBooking }) {
    if (!customer) return null;
    const canWa = isValidWhatsAppPhone(customer.phone);
    const history = customer.trekHistory || [];

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
            <div className="relative w-full sm:max-w-lg max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#121314] shadow-2xl">
                <div className="sticky top-0 flex items-start justify-between gap-3 px-4 py-3.5 border-b border-white/10 bg-[#121314]/95 backdrop-blur z-10">
                    <div className="min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-[#0ECCEE] font-semibold">Customer</p>
                        <h2 className="font-semibold text-white text-lg truncate">{customer.name}</h2>
                        <p className="text-sm text-gray-400 mt-0.5">{customer.phone || '—'}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2.5 min-h-11 min-w-11 inline-flex items-center justify-center rounded-xl border border-white/10 text-gray-400 hover:bg-white/5"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 space-y-4 pb-[max(1.25rem,var(--safe-bottom))]">
                    <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 text-[#0ECCEE]">
                            <Mountain size={11} />
                            {customer.trekCount} trek{customer.trekCount === 1 ? '' : 's'} overall
                        </span>
                        {customer.trekCount >= 2 ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-amber-500/25 bg-amber-500/10 text-amber-300">
                                Repeat guest
                            </span>
                        ) : null}
                        {!canWa ? (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold border border-red-500/25 bg-red-500/10 text-red-300">
                                No WhatsApp phone
                            </span>
                        ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {customer.phone && customer.phone !== '—' ? (
                            <>
                                <a
                                    href={`tel:${String(customer.phone).replace(/\s/g, '')}`}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                >
                                    <Phone size={13} /> Call
                                </a>
                                <button
                                    type="button"
                                    onClick={() => onWhatsApp(customer)}
                                    disabled={!canWa}
                                    className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl bg-[#25D366]/15 text-[#25D366] text-xs font-semibold border border-[#25D366]/25 disabled:opacity-40"
                                >
                                    <MessageCircle size={13} /> WhatsApp
                                </button>
                            </>
                        ) : null}
                        {isTrekScope && customer.scopedBookingId && onOpenBooking ? (
                            <button
                                type="button"
                                onClick={() => onOpenBooking(customer.scopedBookingId)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 text-xs text-gray-200"
                            >
                                <ExternalLink size={13} /> Open booking
                            </button>
                        ) : null}
                    </div>

                    <div>
                        <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-2 font-medium">
                            Trek history
                        </p>
                        {history.length === 0 ? (
                            <p className="text-sm text-gray-500">No trek history</p>
                        ) : (
                            <ul className="space-y-2">
                                {history.map((h) => (
                                    <li
                                        key={`${h.bookingId}-${h.trekId}`}
                                        className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-3"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm text-white truncate">{h.trekName}</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {h.trekDate || formatShortDate(h.bookedAt)}
                                                    {h.trekDate ? ` · booked ${formatShortDate(h.bookedAt)}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-1 shrink-0">
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/10 text-gray-300">
                                                    {h.paymentStatus}
                                                </span>
                                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                                    h.checkedIn
                                                        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                                                        : 'border-amber-500/25 bg-amber-500/10 text-amber-300'
                                                }`}
                                                >
                                                    {h.checkedIn ? 'Checked in' : 'Not checked in'}
                                                </span>
                                            </div>
                                        </div>
                                        {isTrekScope && h.trekName === trekTitle && h.bookingId && onOpenBooking ? (
                                            <button
                                                type="button"
                                                onClick={() => onOpenBooking(h.bookingId)}
                                                className="mt-2 text-[11px] text-[#0ECCEE] hover:underline"
                                            >
                                                Open this booking
                                            </button>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function TrekOrganizerCustomersPage() {
    const { trekId: routeTrekId } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useDialog();
    const session = getTrekOrganizerSession();
    const trekOptions = session?.treks || [];
    const communityId = session?.community?._id || session?.organizer?.communityId || '';

    const scopedTrekId = routeTrekId || '';
    const isTrekScope = Boolean(scopedTrekId);
    const focusCustomerId = searchParams.get('focus') || '';

    const [rows, setRows] = useState([]);
    const [scopeMeta, setScopeMeta] = useState({ scope: 'community', trek: null });
    const [stats, setStats] = useState({
        totalCustomers: 0, repeatCustomers: 0, totalBookings: 0, missingPhone: 0,
    });
    const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [selectingAll, setSelectingAll] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [sortValue, setSortValue] = useState(isTrekScope ? 'scopedBookedAt:desc' : 'trekCount:desc');
    const [guestFilter, setGuestFilter] = useState('all'); // all | repeat | missingPhone
    const [page, setPage] = useState(1);
    const [selectedMap, setSelectedMap] = useState(() => new Map());
    const [waRecipients, setWaRecipients] = useState(null);
    const [detailCustomer, setDetailCustomer] = useState(null);

    const [sortBy, sortDir] = sortValue.split(':');
    const sortOptions = isTrekScope ? TREK_SORT : COMMUNITY_SORT;
    const repeatOnly = guestFilter === 'repeat';
    const missingPhone = guestFilter === 'missingPhone';

    useEffect(() => {
        setSortValue(isTrekScope ? 'scopedBookedAt:desc' : 'trekCount:desc');
        setPage(1);
        setGuestFilter('all');
        setSearchInput('');
        setSearch('');
        setSelectedMap(new Map());
        setDetailCustomer(null);
    }, [scopedTrekId, isTrekScope]);

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchTrekOrganizerCustomers({
                page,
                limit: 50,
                search,
                sortBy,
                sortDir,
                repeatOnly: repeatOnly ? '1' : '',
                missingPhone: missingPhone ? '1' : '',
                trekId: scopedTrekId || undefined,
            });
            setRows(data.customers || []);
            setPagination(data.pagination || { page: 1, limit: 50, total: 0, totalPages: 1 });
            setStats(data.stats || {
                totalCustomers: 0, repeatCustomers: 0, totalBookings: 0, missingPhone: 0,
            });
            setScopeMeta({
                scope: data.scope || (scopedTrekId ? 'trek' : 'community'),
                trek: data.trek || null,
            });

            if (focusCustomerId) {
                let hit = (data.customers || []).find((c) => c.id === focusCustomerId);
                if (!hit) {
                    const broad = await fetchTrekOrganizerCustomers({
                        trekId: scopedTrekId || undefined,
                        page: 1,
                        limit: 500,
                    });
                    hit = (broad.customers || []).find((c) => c.id === focusCustomerId);
                }
                if (hit) setDetailCustomer(hit);
            }
        } catch (e) {
            toast(e.message || 'Failed to load customers');
        } finally {
            setLoading(false);
        }
    }, [page, search, sortBy, sortDir, repeatOnly, missingPhone, scopedTrekId, focusCustomerId, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const selectedRows = useMemo(() => [...selectedMap.values()], [selectedMap]);
    const pageSelected = rows.length > 0 && rows.every((r) => selectedMap.has(r.id));

    const trekTitle = scopeMeta.trek?.name
        || trekOptions.find((t) => String(t._id) === String(scopedTrekId))?.trekName
        || 'This trek';
    const trekDate = scopeMeta.trek?.dateLabel
        || trekOptions.find((t) => String(t._id) === String(scopedTrekId))?.dateLabel
        || '';
    const meetingPoint = scopeMeta.trek?.meetingLocation
        || trekOptions.find((t) => String(t._id) === String(scopedTrekId))?.meetingLocation
        || '';

    const toggleSelect = (customer) => {
        setSelectedMap((prev) => {
            const next = new Map(prev);
            if (next.has(customer.id)) next.delete(customer.id);
            else next.set(customer.id, customer);
            return next;
        });
    };

    const toggleSelectPage = () => {
        setSelectedMap((prev) => {
            const next = new Map(prev);
            if (pageSelected) {
                rows.forEach((r) => next.delete(r.id));
            } else {
                rows.forEach((r) => next.set(r.id, r));
            }
            return next;
        });
    };

    const selectAllWithPhone = async () => {
        setSelectingAll(true);
        try {
            const data = await fetchTrekOrganizerCustomers({
                search,
                sortBy,
                sortDir,
                repeatOnly: repeatOnly ? '1' : '',
                missingPhone: missingPhone ? '1' : '',
                trekId: scopedTrekId || undefined,
                forSelect: '1',
            });
            const next = new Map();
            (data.customers || []).forEach((c) => {
                if (isValidWhatsAppPhone(c.phone)) next.set(c.id, c);
            });
            setSelectedMap(next);
            toast(next.size ? `Selected ${next.size} with phone` : 'No guests with a valid phone');
        } catch (e) {
            toast(e.message || 'Could not select all');
        } finally {
            setSelectingAll(false);
        }
    };

    const copyPhone = async (phone) => {
        if (!phone || phone === '—') {
            toast('No phone number');
            return;
        }
        try {
            await navigator.clipboard.writeText(phone);
            toast('Phone copied');
        } catch {
            toast('Copy failed');
        }
    };

    const copySelectedPhones = async () => {
        const phones = selectedRows
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

    const openWhatsAppFor = (customerOrList) => {
        const list = Array.isArray(customerOrList) ? customerOrList : [customerOrList];
        setWaRecipients(
            list.map((c) => ({
                name: c.name,
                phone: c.phone,
                trekName: isTrekScope ? trekTitle : (c.lastTrekName || ''),
                trekDate: isTrekScope ? trekDate : '',
                meetingPoint: isTrekScope ? meetingPoint : '',
            })),
        );
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await exportTrekOrganizerCustomers({
                search,
                sortBy,
                sortDir,
                repeatOnly: repeatOnly ? '1' : '',
                missingPhone: missingPhone ? '1' : '',
                trekId: scopedTrekId || undefined,
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(trekTitle || 'customers').replace(/[^a-z0-9-_]+/gi, '_')}_customers.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast('CSV downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
        }
    };

    const goOverall = () => navigate('/trek-organizer/customers');
    const goTrek = (id) => {
        if (!id) {
            goOverall();
            return;
        }
        navigate(`/trek-organizer/treks/${id}/customers`);
    };

    const openBooking = (bookingId) => {
        if (!scopedTrekId || !bookingId) return;
        navigate(`/trek-organizer/treks/${scopedTrekId}/participants?bookingId=${bookingId}`);
    };

    const emptyHint = () => {
        if (search || guestFilter !== 'all') {
            return 'Try clearing search or filters';
        }
        if (isTrekScope) return 'No guests booked on this trek yet';
        return 'Guests will appear here after bookings';
    };

    return (
        <div className={`space-y-5 max-w-4xl mx-auto ${isTrekScope ? 'pb-28' : 'pb-24'}`}>
            <div className="rounded-3xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#121314] overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/12 via-transparent to-[#25D366]/10 pointer-events-none" />
                <div className="relative p-5 sm:p-6 space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#0ECCEE]/20 bg-[#0ECCEE]/10 text-[10px] font-semibold uppercase tracking-widest text-[#0ECCEE]">
                        <Sparkles size={11} /> {isTrekScope ? 'Trek guests' : 'Community CRM'}
                    </div>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h1 className="text-2xl sm:text-[1.75rem] font-semibold tracking-tight">
                                {isTrekScope ? 'Trek customers' : 'All customers'}
                            </h1>
                            <p className="text-sm text-gray-400 mt-1">
                                {isTrekScope
                                    ? `Guests booked on ${trekTitle}. Trek count still shows how many treks they’ve done with you overall.`
                                    : 'Unique guests across all your treks — name, phone, and how many treks they’ve done with you.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={exporting}
                            className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 bg-white/5 text-xs font-medium text-gray-200 disabled:opacity-40"
                        >
                            {exporting ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}
                            Export CSV
                        </button>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2.5">
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={goOverall}
                                className={`px-3 py-2 min-h-10 rounded-xl text-xs font-semibold border ${
                                    !isTrekScope
                                        ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                        : 'border-white/10 text-gray-300 bg-white/5 hover:border-[#0ECCEE]/40'
                                }`}
                            >
                                Overall
                            </button>
                            {scopedTrekId ? (
                                <button
                                    type="button"
                                    onClick={() => goTrek(scopedTrekId)}
                                    className={`px-3 py-2 min-h-10 rounded-xl text-xs font-semibold border ${
                                        isTrekScope
                                            ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                            : 'border-white/10 text-gray-300 bg-white/5'
                                    }`}
                                >
                                    This trek
                                </button>
                            ) : null}
                        </div>
                        {trekOptions.length > 0 ? (
                            <label className="relative flex-1 sm:max-w-xs">
                                <Mountain size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                                <select
                                    value={scopedTrekId}
                                    onChange={(e) => goTrek(e.target.value)}
                                    className="w-full appearance-none pl-9 pr-8 py-2.5 min-h-10 rounded-xl bg-black/30 border border-white/10 text-sm text-gray-200 focus:outline-none focus:border-[#0ECCEE]/50"
                                >
                                    <option value="">All treks (overall)</option>
                                    {trekOptions.map((t) => (
                                        <option key={t._id} value={t._id}>{t.trekName}</option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <StatPill label={isTrekScope ? 'On this trek' : 'Customers'} value={stats.totalCustomers} />
                        <StatPill label="Repeat (2+)" value={stats.repeatCustomers} />
                        <StatPill label="No phone" value={stats.missingPhone ?? 0} />
                        <StatPill label="Bookings" value={stats.totalBookings} />
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[#161718]/95 p-3.5 sm:p-4 space-y-3.5">
                <div className="flex flex-col sm:flex-row gap-2.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="Search name or phone…"
                            className="w-full pl-10 pr-10 py-3 min-h-12 rounded-xl bg-black/30 border border-white/10 text-base focus:outline-none focus:border-[#0ECCEE]/50"
                        />
                        {searchInput ? (
                            <button
                                type="button"
                                onClick={() => setSearchInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                            >
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
                            {sortOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {[
                        { id: 'all', label: 'All guests' },
                        { id: 'repeat', label: 'Repeat only (2+)' },
                        { id: 'missingPhone', label: 'Missing phone' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                                setGuestFilter(f.id);
                                setPage(1);
                            }}
                            className={`px-3 py-2 min-h-9 rounded-full text-xs font-medium border ${
                                guestFilter === f.id
                                    ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]'
                                    : 'border-white/10 text-gray-400 bg-white/5'
                            }`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {!loading && rows.length > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 px-0.5">
                    <p className="text-xs text-gray-500">
                        Showing <span className="text-gray-300">{rows.length}</span> of{' '}
                        <span className="text-gray-300">{pagination.total}</span>
                        {isTrekScope ? ' on this trek' : ' overall'}
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={selectAllWithPhone}
                            disabled={selectingAll}
                            className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-[#25D366] disabled:opacity-40"
                        >
                            {selectingAll ? <Loader size={14} className="animate-spin" /> : <CheckSquare size={14} />}
                            Select all with phone
                        </button>
                        <button
                            type="button"
                            onClick={toggleSelectPage}
                            className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-[#0ECCEE]"
                        >
                            {pageSelected ? <CheckSquare size={14} className="text-[#0ECCEE]" /> : <Square size={14} />}
                            {pageSelected ? 'Deselect page' : 'Select page'}
                        </button>
                    </div>
                </div>
            ) : null}

            {loading ? (
                <InlinePageLoader label="Loading customers…" variant="trek" minHeight={false} />
            ) : rows.length === 0 ? (
                <div className="text-center py-16 rounded-3xl border border-dashed border-white/15 bg-white/5 px-4">
                    <div className="mx-auto size-12 rounded-2xl bg-[#0ECCEE]/10 text-[#0ECCEE] flex items-center justify-center mb-3">
                        <Users size={22} />
                    </div>
                    <p className="text-gray-200 font-medium">No customers found</p>
                    <p className="text-sm text-gray-500 mt-1">{emptyHint()}</p>
                    <div className="flex flex-wrap justify-center gap-2 mt-4">
                        {isTrekScope ? (
                            <button
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${scopedTrekId}/participants`)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0ECCEE]/15 text-[#0ECCEE] text-xs font-semibold"
                            >
                                Open participants
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => navigate('/trek-organizer')}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#0ECCEE]/15 text-[#0ECCEE] text-xs font-semibold"
                            >
                                Back to treks
                            </button>
                        )}
                        {guestFilter === 'missingPhone' && isTrekScope ? (
                            <button
                                type="button"
                                onClick={() => navigate(`/trek-organizer/treks/${scopedTrekId}/participants`)}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-xs text-gray-300"
                            >
                                Fix phones on registrations
                            </button>
                        ) : null}
                        {guestFilter !== 'all' || search ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setGuestFilter('all');
                                    setSearchInput('');
                                    setSearch('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-xs text-gray-300"
                            >
                                Clear filters
                            </button>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div className="space-y-2.5">
                    {rows.map((customer) => {
                        const canWa = isValidWhatsAppPhone(customer.phone);
                        const selected = selectedMap.has(customer.id);
                        return (
                            <article
                                key={customer.id}
                                className={`rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] p-3.5 sm:p-4 ${
                                    selected ? 'ring-1 ring-[#0ECCEE]/50' : ''
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => toggleSelect(customer)}
                                        className="mt-3 rounded border-gray-600 shrink-0"
                                        aria-label={`Select ${customer.name}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setDetailCustomer(customer)}
                                        className="size-11 rounded-2xl bg-linear-to-br from-[#0ECCEE]/20 to-[#053780]/30 text-[#0ECCEE] flex items-center justify-center text-sm font-bold shrink-0"
                                    >
                                        {initials(customer.name)}
                                    </button>
                                    <div className="min-w-0 flex-1">
                                        <button
                                            type="button"
                                            onClick={() => setDetailCustomer(customer)}
                                            className="w-full text-left"
                                        >
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h3 className="font-semibold text-[15px] truncate">{customer.name}</h3>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 text-[#0ECCEE]">
                                                    <Mountain size={10} />
                                                    {customer.trekCount} trek{customer.trekCount === 1 ? '' : 's'} overall
                                                </span>
                                                {customer.trekCount >= 2 ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/25 bg-amber-500/10 text-amber-300">
                                                        Repeat
                                                    </span>
                                                ) : null}
                                                {!canWa ? (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-red-500/25 bg-red-500/10 text-red-300">
                                                        No phone
                                                    </span>
                                                ) : null}
                                            </div>
                                            <p className="text-sm text-gray-300 mt-1 inline-flex items-center gap-1.5">
                                                <Phone size={12} className="text-[#25D366]" />
                                                {customer.phone || '—'}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                                {isTrekScope
                                                    ? `Booked this trek · ${formatShortDate(customer.scopedBookedAt || customer.lastBookedAt)}`
                                                    : customer.lastTrekName
                                                        ? `Last: ${customer.lastTrekName} · ${formatShortDate(customer.lastBookedAt)}`
                                                        : `Joined ${formatShortDate(customer.firstBookedAt)}`}
                                                {customer.bookingCount > customer.trekCount
                                                    ? ` · ${customer.bookingCount} bookings`
                                                    : ''}
                                                {' · tap for history'}
                                            </p>
                                        </button>
                                        <div className="flex flex-wrap gap-2 mt-3">
                                            {customer.phone && customer.phone !== '—' ? (
                                                <>
                                                    <a
                                                        href={`tel:${String(customer.phone).replace(/\s/g, '')}`}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-xl bg-[#0ECCEE]/10 text-[#0ECCEE] text-xs font-medium"
                                                    >
                                                        <Phone size={13} /> Call
                                                    </a>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyPhone(customer.phone)}
                                                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs text-gray-300"
                                                    >
                                                        <Copy size={13} /> Copy
                                                    </button>
                                                </>
                                            ) : null}
                                            <button
                                                type="button"
                                                disabled={!canWa}
                                                onClick={() => openWhatsAppFor(customer)}
                                                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] text-xs font-semibold border border-[#25D366]/25 disabled:opacity-40"
                                            >
                                                <MessageCircle size={13} /> WhatsApp
                                            </button>
                                            {isTrekScope && customer.scopedBookingId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openBooking(customer.scopedBookingId)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs text-gray-300"
                                                >
                                                    <ExternalLink size={13} /> Booking
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}

            {pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#161718]/90 px-3 py-3">
                    <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs disabled:opacity-30"
                        >
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button
                            type="button"
                            disabled={page >= pagination.totalPages}
                            onClick={() => setPage((p) => p + 1)}
                            className="inline-flex items-center gap-1 px-3 py-2 min-h-10 rounded-xl border border-white/10 text-xs disabled:opacity-30"
                        >
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            ) : null}

            {selectedMap.size > 0 ? (
                <div className={`fixed inset-x-0 z-40 px-3 sm:px-6 pointer-events-none ${
                    isTrekScope
                        ? 'bottom-[calc(4.5rem+var(--safe-bottom))] lg:bottom-6'
                        : 'bottom-6'
                }`}
                >
                    <div className="max-w-4xl mx-auto pointer-events-auto">
                        <div className="rounded-2xl border border-[#25D366]/30 bg-[#121314]/95 backdrop-blur shadow-2xl px-3.5 py-3 flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white mr-auto px-1">
                                {selectedMap.size} selected
                            </p>
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
                                onClick={() => setSelectedMap(new Map())}
                                className="inline-flex items-center gap-1.5 px-3 py-2.5 min-h-11 rounded-xl border border-white/10 text-xs text-gray-400"
                            >
                                <X size={14} /> Clear
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}

            <CustomerDetailSheet
                customer={detailCustomer}
                isTrekScope={isTrekScope}
                trekTitle={trekTitle}
                onClose={() => setDetailCustomer(null)}
                onWhatsApp={(c) => {
                    openWhatsAppFor(c);
                }}
                onOpenBooking={openBooking}
            />

            <TrekOrganizerWhatsAppModal
                open={!!waRecipients}
                onClose={() => setWaRecipients(null)}
                recipients={waRecipients || []}
                trekName={isTrekScope ? trekTitle : ''}
                trekDate={isTrekScope ? trekDate : ''}
                meetingPoint={isTrekScope ? meetingPoint : ''}
                communityId={String(communityId || '')}
            />
        </div>
    );
}

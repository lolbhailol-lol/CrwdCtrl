import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
    Download, Loader, Search, ChevronLeft, ChevronRight,
    Users, UserCheck, Clock, ChevronsDownUp, X,
} from 'lucide-react';
import {
    exportRunClubOrganizerParticipants,
    fetchRunClubOrganizerParticipants,
    fetchRunClubOrganizerDashboard,
    resendRunClubOrganizerConfirmation,
    deleteRunClubOrganizerParticipant,
} from '../../services/api/runClubOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import ParticipantCard from '../trek-organizer/ParticipantCard';

function FilterChip({ active, onClick, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active ? 'bg-[#0ECCEE] text-black border-[#0ECCEE]' : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
            {children}
        </button>
    );
}

function SkeletonCard() {
    return (
        <div className="rounded-xl border border-gray-800 bg-[#161718] p-4 animate-pulse flex gap-3">
            <div className="size-11 rounded-xl bg-gray-800 shrink-0" />
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-800 rounded w-2/5" />
                <div className="h-3 bg-gray-800/70 rounded w-3/5" />
            </div>
        </div>
    );
}

export default function RunClubOrganizerParticipantsPage() {
    const { eventId } = useParams();
    const { confirm, toast } = useDialog();
    const [rows, setRows] = useState([]);
    const [eventTitle, setEventTitle] = useState('');
    const [stats, setStats] = useState(null);
    const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [expandAll, setExpandAll] = useState(false);
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('');
    const [checkInFilter, setCheckInFilter] = useState('');
    const [page, setPage] = useState(1);

    const hasFilters = search || paymentFilter || checkInFilter;

    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    const load = useCallback(async () => {
        if (!eventId) return;
        setLoading(true);
        try {
            const params = { page, limit: 25, sortBy: 'createdAt', sortDir: 'desc' };
            if (search) params.search = search;
            if (paymentFilter) params.paymentStatus = paymentFilter;
            if (checkInFilter) params.checkInStatus = checkInFilter;

            const [listData, dashData] = await Promise.all([
                fetchRunClubOrganizerParticipants(eventId, params),
                page === 1 && !hasFilters ? fetchRunClubOrganizerDashboard(eventId).catch(() => null) : Promise.resolve(null),
            ]);

            setRows(listData.participants || []);
            setEventTitle(listData.eventTitle || listData.trekName || '');
            setPagination(listData.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
            if (dashData?.stats) setStats(dashData.stats);
        } catch (e) {
            toast(e.message || 'Failed to load participants');
        } finally {
            setLoading(false);
        }
    }, [eventId, page, search, paymentFilter, checkInFilter, hasFilters, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const pageStats = useMemo(() => {
        const paid = rows.filter((r) => r.paymentStatus === 'Paid').length;
        const checkedIn = rows.filter((r) => r.checkInStatus === 'Checked In').length;
        return { paid, checkedIn, pending: rows.length - checkedIn };
    }, [rows]);

    const handleExport = async () => {
        setExporting(true);
        try {
            const blob = await exportRunClubOrganizerParticipants(eventId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${(eventTitle || 'run').replace(/[^a-z0-9-_]+/gi, '_')}_participants.csv`;
            a.click();
            URL.revokeObjectURL(url);
            toast('CSV downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        } finally {
            setExporting(false);
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
                ? `Remove ${participantName} from this run? This cannot be undone.`
                : 'Remove this participant from the run? This cannot be undone.',
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

    const clearFilters = () => {
        setSearchInput('');
        setSearch('');
        setPaymentFilter('');
        setCheckInFilter('');
        setPage(1);
    };

    const startIndex = (pagination.page - 1) * pagination.limit;

    return (
        <div className="space-y-5 max-w-4xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Participants</h1>
                    <p className="text-sm text-gray-500 mt-0.5">{eventTitle || 'Run registrations'}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    {rows.length > 0 ? (
                        <button type="button" onClick={() => setExpandAll((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-xs font-medium text-gray-300 hover:border-[#0ECCEE]/40">
                            <ChevronsDownUp size={14} />
                            {expandAll ? 'Collapse all' : 'Expand all'}
                        </button>
                    ) : null}
                    <button type="button" onClick={handleExport} disabled={exporting} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#0ECCEE] text-black text-xs font-bold hover:opacity-90 disabled:opacity-60">
                        {exporting ? <Loader className="animate-spin" size={14} /> : <Download size={14} />}
                        Export
                    </button>
                </div>
            </div>

            {stats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Users size={11} /> Total</p>
                        <p className="text-xl font-bold mt-0.5">{stats.totalRegistrations}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><UserCheck size={11} /> Checked in</p>
                        <p className="text-xl font-bold mt-0.5 text-emerald-400">{stats.checkedIn}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500 flex items-center gap-1"><Clock size={11} /> Pending</p>
                        <p className="text-xl font-bold mt-0.5 text-amber-400">{stats.pendingCheckIn}</p>
                    </div>
                    <div className="rounded-xl border border-gray-800 bg-[#161718] px-3 py-3">
                        <p className="text-[10px] uppercase text-gray-500">Revenue</p>
                        <p className="text-xl font-bold mt-0.5">₹{Number(stats.organizerRevenue ?? stats.revenue ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                </div>
            ) : null}

            <div className="rounded-xl border border-gray-800 bg-[#161718] p-3 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <input
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="Search name, phone, email, booking ID…"
                        className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#111213] border border-gray-700 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                    {searchInput ? (
                        <button type="button" onClick={() => setSearchInput('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                            <X size={16} />
                        </button>
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <FilterChip active={!paymentFilter && !checkInFilter} onClick={() => { setPaymentFilter(''); setCheckInFilter(''); setPage(1); }}>All</FilterChip>
                    <FilterChip active={paymentFilter === 'paid'} onClick={() => { setPaymentFilter(paymentFilter === 'paid' ? '' : 'paid'); setPage(1); }}>Paid</FilterChip>
                    <FilterChip active={paymentFilter === 'free'} onClick={() => { setPaymentFilter(paymentFilter === 'free' ? '' : 'free'); setPage(1); }}>Free</FilterChip>
                    <FilterChip active={checkInFilter === 'checked_in'} onClick={() => { setCheckInFilter(checkInFilter === 'checked_in' ? '' : 'checked_in'); setPage(1); }}>Checked in</FilterChip>
                    <FilterChip active={checkInFilter === 'pending'} onClick={() => { setCheckInFilter(checkInFilter === 'pending' ? '' : 'pending'); setPage(1); }}>Not yet</FilterChip>
                    {hasFilters ? (
                        <button type="button" onClick={clearFilters} className="text-xs text-[#0ECCEE] ml-auto hover:underline">Clear filters</button>
                    ) : null}
                </div>
            </div>

            {loading ? (
                <div className="space-y-3">{[1, 2, 3, 4].map((n) => <SkeletonCard key={n} />)}</div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 rounded-xl border border-dashed border-gray-800">
                    <Users className="mx-auto text-gray-600 mb-3" size={32} />
                    <p className="text-gray-400 font-medium">No participants found</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {rows.map((row, i) => (
                        <ParticipantCard
                            key={row.bookingId}
                            participant={row}
                            index={startIndex + i + 1}
                            forceOpen={expandAll}
                            onResend={handleResend}
                            onDelete={handleDelete}
                            onCopied={(msg) => toast(msg)}
                        />
                    ))}
                </div>
            )}

            {pagination.totalPages > 1 ? (
                <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-30">
                            <ChevronLeft size={16} /> Prev
                        </button>
                        <button type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-30">
                            Next <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Download, Loader, Search, Trash2 } from 'lucide-react';
import {
    fetchEventOrganizerParticipants,
    updateEventOrganizerParticipantStatus,
    deleteEventOrganizerParticipant,
    downloadEventOrganizerExport,
} from '../../services/api/eventShowOrganizer.api';
import { useDialog } from '../../context/DialogContext';

export default function EventOrganizerParticipantsPage() {
    const { eventId } = useParams();
    const [searchParams, setSearchParams] = useSearchParams();
    const { toast, confirm } = useDialog();
    const [rows, setRows] = useState([]);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(searchParams.get('search') || '');
    const status = searchParams.get('status') || '';
    const paymentStatus = searchParams.get('paymentStatus') || '';
    const checkInStatus = searchParams.get('checkInStatus') || '';
    const page = Number(searchParams.get('page') || 1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchEventOrganizerParticipants(eventId, {
                page,
                limit: 25,
                search,
                status,
                paymentStatus,
                checkInStatus,
            });
            setRows(data.participants || []);
            setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        } catch (e) {
            toast(e.message || 'Failed to load guests');
        } finally {
            setLoading(false);
        }
    }, [eventId, page, search, status, paymentStatus, checkInStatus, toast]);

    useEffect(() => { load(); }, [load]);

    const setFilter = (key, value) => {
        const next = new URLSearchParams(searchParams);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        setSearchParams(next);
    };

    const onExport = async () => {
        try {
            await downloadEventOrganizerExport(eventId);
            toast('Export downloaded');
        } catch (e) {
            toast(e.message || 'Export failed');
        }
    };

    const onStatus = async (id, nextStatus) => {
        try {
            await updateEventOrganizerParticipantStatus(eventId, id, nextStatus);
            toast(`Marked ${nextStatus}`);
            load();
        } catch (e) {
            toast(e.message || 'Update failed');
        }
    };

    const onDelete = async (id, name) => {
        const ok = await confirm(`Delete registration for ${name || 'this guest'}?`);
        if (!ok) return;
        try {
            await deleteEventOrganizerParticipant(eventId, id);
            toast('Deleted');
            load();
        } catch (e) {
            toast(e.message || 'Delete failed');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold">Guests</h1>
                    <p className="text-sm text-gray-500">{pagination.total} registrations</p>
                </div>
                <button
                    type="button"
                    onClick={onExport}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                >
                    <Download size={14} /> Export CSV
                </button>
            </div>

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    setFilter('search', search.trim());
                }}
                className="flex gap-2"
            >
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search name, email, phone, package…"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161718] border border-gray-800 text-sm focus:outline-none focus:border-[#0ECCEE]/50"
                    />
                </div>
                <button type="submit" className="px-4 py-2.5 rounded-xl border border-gray-700 text-sm">Search</button>
            </form>

            <div className="flex flex-wrap gap-2">
                {[
                    { key: 'status', value: '', label: 'All status' },
                    { key: 'status', value: 'approved', label: 'Approved' },
                    { key: 'status', value: 'pending', label: 'Pending' },
                    { key: 'status', value: 'rejected', label: 'Rejected' },
                    { key: 'paymentStatus', value: 'paid', label: 'Paid' },
                    { key: 'paymentStatus', value: 'pending', label: 'Pay pending' },
                    { key: 'checkInStatus', value: 'checked_in', label: 'Checked in' },
                    { key: 'checkInStatus', value: 'not_checked_in', label: 'Not checked in' },
                ].map((f) => {
                    const active = (searchParams.get(f.key) || '') === f.value;
                    return (
                        <button
                            key={`${f.key}-${f.value || 'all'}`}
                            type="button"
                            onClick={() => setFilter(f.key, f.value)}
                            className={`px-3 py-1.5 rounded-full text-xs border ${
                                active
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                    : 'border-gray-700 text-gray-400'
                            }`}
                        >
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex justify-center py-16"><Loader className="animate-spin text-[#0ECCEE]" /></div>
            ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                    No guests match these filters.
                </div>
            ) : (
                <div className="space-y-2">
                    {rows.map((p) => (
                        <div key={p.id} className="rounded-xl border border-gray-800 bg-[#161718] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="font-semibold truncate">{p.userName || 'Guest'}</p>
                                    <p className="text-xs text-gray-500 truncate">
                                        {[p.userEmail, p.userPhone].filter(Boolean).join(' · ')}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {[p.tierName, p.paymentStatus, p.status, p.checkedIn ? 'checked in' : null]
                                            .filter(Boolean)
                                            .join(' · ')}
                                        {' · '}₹{Number(p.amountPaid || 0).toLocaleString('en-IN')}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {p.status !== 'approved' ? (
                                        <button type="button" onClick={() => onStatus(p.id, 'approved')} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-xs">Approve</button>
                                    ) : null}
                                    {p.status !== 'rejected' ? (
                                        <button type="button" onClick={() => onStatus(p.id, 'rejected')} className="px-2.5 py-1 rounded-lg bg-red-500/15 text-red-300 text-xs">Reject</button>
                                    ) : null}
                                    <button type="button" onClick={() => onDelete(p.id, p.userName)} className="px-2.5 py-1 rounded-lg border border-gray-700 text-gray-400 text-xs inline-flex items-center gap-1">
                                        <Trash2 size={12} /> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pagination.pages > 1 ? (
                <div className="flex items-center justify-center gap-2 pt-2">
                    <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setFilter('page', String(page - 1))}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-40"
                    >
                        Prev
                    </button>
                    <span className="text-xs text-gray-500">{page} / {pagination.pages}</span>
                    <button
                        type="button"
                        disabled={page >= pagination.pages}
                        onClick={() => setFilter('page', String(page + 1))}
                        className="px-3 py-1.5 rounded-lg border border-gray-700 text-xs disabled:opacity-40"
                    >
                        Next
                    </button>
                </div>
            ) : null}
        </div>
    );
}

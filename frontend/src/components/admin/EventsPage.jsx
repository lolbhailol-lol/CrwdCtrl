import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import EventFormModal from './EventFormModal';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const CATEGORY_COLORS = {
    fest: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    trek: 'bg-green-500/20 text-green-300 border-green-500/30',
    sports: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    theatre: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    workshop: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const ALL_CATEGORIES = ['', 'fest', 'trek', 'sports', 'theatre', 'workshop'];

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EventsPage() {
    const [events, setEvents] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [page, setPage] = useState(1);
    const [categoryFilter, setCategoryFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('admin_token');
            const params = new URLSearchParams({ page, limit: 20 });
            if (categoryFilter) params.set('category', categoryFilter);

            const res = await fetch(`${API}/admin/events?${params}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to fetch events');

            setEvents(data.events || []);
            setPagination(data.pagination || null);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [page, categoryFilter]);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    const handleCreate = () => {
        setEditingEvent(null);
        setModalOpen(true);
    };

    const handleEdit = (event) => {
        setEditingEvent(event);
        setModalOpen(true);
    };

    const handleSaved = (saved) => {
        setModalOpen(false);
        fetchEvents();
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        setDeleteLoading(true);
        try {
            const token = localStorage.getItem('admin_token');
            const res = await fetch(`${API}/admin/events/${deleteTarget._id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Delete failed');
            }
            setDeleteTarget(null);
            fetchEvents();
        } catch (err) {
            setError(err.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Events</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Manage all platform events</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-4 py-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-lg font-semibold text-sm transition-colors"
                >
                    <Plus size={16} />
                    Create Event
                </button>
            </div>

            {/* Category filter */}
            <div className="flex items-center gap-2 flex-wrap">
                {ALL_CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => { setCategoryFilter(cat); setPage(1); }}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                            categoryFilter === cat
                                ? 'bg-[#0ECCEE] border-[#0ECCEE] text-black'
                                : 'bg-[#1D1E20] border-gray-600 text-gray-300 hover:border-gray-400'
                        }`}
                    >
                        {cat === '' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3">
                    {error}
                </div>
            )}

            {/* Table */}
            <div className="bg-[#111213] rounded-xl border border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
                        Loading events...
                    </div>
                ) : events.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-2">
                        <span className="text-4xl">📅</span>
                        <p className="text-sm">No events found. Create one to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                                    <th className="text-left px-5 py-3">Title</th>
                                    <th className="text-left px-5 py-3">Category</th>
                                    <th className="text-left px-5 py-3">City</th>
                                    <th className="text-left px-5 py-3">Start Date</th>
                                    <th className="text-left px-5 py-3">Price</th>
                                    <th className="text-left px-5 py-3">Status</th>
                                    <th className="text-right px-5 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {events.map(ev => (
                                    <tr key={ev._id} className="hover:bg-[#1D1E20] transition-colors">
                                        <td className="px-5 py-4">
                                            <div className="font-medium text-white">{ev.title}</div>
                                            {ev.organizer && (
                                                <div className="text-xs text-gray-500 mt-0.5">{ev.organizer}</div>
                                            )}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[ev.category] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                                                {ev.category}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-gray-300">{ev.city || '—'}</td>
                                        <td className="px-5 py-4 text-gray-300">{formatDate(ev.startDate)}</td>
                                        <td className="px-5 py-4 text-gray-300">
                                            {ev.price > 0 ? `₹${ev.price}` : 'Free'}
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                ev.status === 'published'
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {ev.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => handleEdit(ev)}
                                                    className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(ev)}
                                                    className="p-1.5 rounded-lg hover:bg-red-900/40 text-gray-400 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>
                        Page {pagination.currentPage} of {pagination.totalPages} ({pagination.total} events)
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(p => p - 1)}
                            disabled={!pagination.hasPrevPage}
                            className="p-2 rounded-lg bg-[#1D1E20] disabled:opacity-40 hover:bg-gray-700 transition-colors"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={!pagination.hasNextPage}
                            className="p-2 rounded-lg bg-[#1D1E20] disabled:opacity-40 hover:bg-gray-700 transition-colors"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Form Modal */}
            {modalOpen && (
                <EventFormModal
                    event={editingEvent}
                    onClose={() => setModalOpen(false)}
                    onSaved={handleSaved}
                />
            )}

            {/* Delete Confirm Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div className="w-full max-w-sm bg-[#111213] rounded-xl border border-gray-700 p-6 space-y-4">
                        <div className="flex items-center gap-3 text-yellow-400">
                            <AlertTriangle size={20} />
                            <h3 className="font-semibold text-white">Delete Event</h3>
                        </div>
                        <p className="text-sm text-gray-300">
                            Are you sure you want to delete <span className="font-semibold text-white">{deleteTarget.title}</span>? This cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                            >
                                {deleteLoading ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader, Search } from 'lucide-react';
import EventShowFormModal from './EventShowFormModal';
import { adminFetchJSON } from '../../utils/adminApi';
import { EVENT_TYPE_LABELS } from '../../constants/eventsPage';

function nextShowDate(showTimings) {
    if (!showTimings || showTimings.length === 0) return 'N/A';
    const upcoming = showTimings
        .filter(s => s.date)
        .map(s => new Date(s.date))
        .filter(d => !isNaN(d))
        .sort((a, b) => a - b);
    if (!upcoming.length) return 'N/A';
    return upcoming[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminEventsPage() {
    const [shows, setShows] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchShows = () => {
        setError('');
        adminFetchJSON('/admin/events?limit=200')
            .then(d => setShows(d.shows || []))
            .catch(err => setError(err.message || 'Failed to load events'))
            .finally(() => setLoading(false));
    };

    useEffect(fetchShows, []);

    const deleteShow = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
        try {
            await adminFetchJSON(`/admin/events/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete show');
        }
        fetchShows();
    };

    const q = search.trim().toLowerCase();
    const filteredShows = useMemo(() => {
        if (!q) return shows;
        return shows.filter((s) =>
            [s.title, s.organizer, s.venue, s.city, s.language].some((v) => String(v || '').toLowerCase().includes(q)),
        );
    }, [shows, q]);

    const byDate = (a, b) => new Date(b.createdAt) - new Date(a.createdAt);
    const knownStatuses = ['published', 'completed', 'cancelled'];
    const byStatus = {
        published: filteredShows.filter(s => s.status === 'published').sort(byDate),
        // Drafts (and any unknown status) must stay visible so admins can publish them
        draft: filteredShows.filter(s => !knownStatuses.includes(s.status)).sort(byDate),
        completed: filteredShows.filter(s => s.status === 'completed').sort(byDate),
        cancelled: filteredShows.filter(s => s.status === 'cancelled').sort(byDate),
    };

    const ActionButtons = ({ show }) => (
        <div className="flex gap-2 justify-end">
            <button
                onClick={() => { setSelected(show); setShowForm(true); }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
            >
                Edit
            </button>
            <button
                onClick={() => deleteShow(show._id, show.title)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
            >
                Delete
            </button>
        </div>
    );

    const SectionTable = ({ items }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                        <th className="pb-3">Title</th>
                        <th className="pb-3">Organizer</th>
                        <th className="pb-3">Type</th>
                        <th className="pb-3">Venue</th>
                        <th className="pb-3">Language</th>
                        <th className="pb-3">Next Show</th>
                        <th className="pb-3">Ticket Price</th>
                        <th className="pb-3 text-right">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map(s => (
                        <tr key={s._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                            <td className="py-4 font-medium">{s.title}</td>
                            <td className="py-4 text-gray-300">{s.organizer || '—'}</td>
                            <td className="py-4">
                                <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                                    {EVENT_TYPE_LABELS[s.eventType] || s.eventType}
                                </span>
                            </td>
                            <td className="py-4 text-gray-400 text-sm">{[s.venue, s.city].filter(Boolean).join(', ') || '—'}</td>
                            <td className="py-4 text-gray-400 text-sm">{s.language || '—'}</td>
                            <td className="py-4 text-gray-400 text-sm">{nextShowDate(s.showTimings)}</td>
                            <td className="py-4 text-gray-400 text-sm">{s.ticketPrice > 0 ? `₹${s.ticketPrice}` : 'Free'}</td>
                            <td className="py-4"><ActionButtons show={s} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold mb-2">Events Management</h1>
            <p className="text-gray-400">Create and edit events here. Assign them to page sections in Home &amp; Sections.</p>
        </div>
        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">Events</h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/admin/sections?mode=assign&tab=events"
                        className="px-4 py-2 rounded-lg border border-[#0ECCEE]/40 text-[#0ECCEE] text-sm font-semibold hover:bg-[#0ECCEE]/10 transition-colors"
                    >
                        Assign to sections
                    </Link>
                    <button
                        onClick={() => { setSelected(null); setShowForm(true); }}
                        className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
                    >
                        + Create Event
                    </button>
                </div>
            </div>

            <div className="relative max-w-md mb-4">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search shows…"
                    className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ECCEE]"
                />
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button type="button" onClick={fetchShows} className="underline hover:text-red-200 shrink-0">Retry</button>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16 text-gray-400">
                    <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
                </div>
            ) : shows.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    No events found. Create your first event!
                </div>
            ) : filteredShows.length === 0 ? (
                <div className="text-center py-12 text-gray-400">No shows match your search.</div>
            ) : (
                <div className="space-y-8">

                    {byStatus.published.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-green-400 flex items-center">
                                🟢 Active Shows
                                <span className="ml-2 text-sm text-gray-400">({byStatus.published.length} shows)</span>
                            </h3>
                            <SectionTable items={byStatus.published} />
                        </div>
                    )}

                    {byStatus.draft.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-yellow-400 flex items-center">
                                🟡 Drafts
                                <span className="ml-2 text-sm text-gray-400">({byStatus.draft.length} shows)</span>
                            </h3>
                            <SectionTable items={byStatus.draft} />
                        </div>
                    )}

                    {byStatus.completed.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-400 flex items-center">
                                ⚫ Completed Shows
                                <span className="ml-2 text-sm text-gray-500">(Chronological order)</span>
                            </h3>
                            <SectionTable items={byStatus.completed} />
                        </div>
                    )}

                    {byStatus.cancelled.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-red-400 flex items-center">
                                🔴 Cancelled Shows
                            </h3>
                            <SectionTable items={byStatus.cancelled} />
                        </div>
                    )}

                </div>
            )}

            {showForm && (
                <EventShowFormModal
                    show={selected}
                    onClose={() => setShowForm(false)}
                    onSaved={() => {
                setShowForm(false);
                fetchShows();
                try {
                    localStorage.setItem('admin_data_updated', String(Date.now()));
                } catch {
                    /* ignore */
                }
            }}
                />
            )}
        </div>
        </div>
    );
}

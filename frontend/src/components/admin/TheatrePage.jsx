import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import TheatreFormModal from './TheatreFormModal';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const TYPE_LABELS = {
    play: 'Play', musical: 'Musical', standup: 'Stand-up',
    improv: 'Improv', dance_drama: 'Dance Drama', other: 'Other',
};

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

export default function TheatrePage() {
    const [shows, setShows] = useState([]);
    const [search, setSearch] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchShows = () => {
        fetch(`${API}/admin/theatre?limit=200`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        })
            .then(r => r.json())
            .then(d => setShows(d.shows || []))
            .catch(err => console.error('Error fetching theatre events:', err));
    };

    useEffect(fetchShows, []);

    const deleteShow = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
        await fetch(`${API}/admin/theatre/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchShows();
    };

    const q = search.trim().toLowerCase();
    const filteredShows = useMemo(() => {
        if (!q) return shows;
        return shows.filter((s) =>
            [s.title, s.organizer, s.venue, s.city, s.language].some((v) => String(v || '').toLowerCase().includes(q)),
        );
    }, [shows, q]);

    const byStatus = {
        published: filteredShows.filter(s => s.status === 'published').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        completed: filteredShows.filter(s => s.status === 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        cancelled: filteredShows.filter(s => s.status === 'cancelled').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
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
                                    {TYPE_LABELS[s.theatreType] || s.theatreType}
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
        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-xl font-semibold">Theatre</h2>
                <button
                    onClick={() => { setSelected(null); setShowForm(true); }}
                    className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
                >
                    + Create Theatre Event
                </button>
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

            {shows.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    No theatre events found. Create your first show!
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
                <TheatreFormModal
                    show={selected}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); fetchShows(); }}
                />
            )}
        </div>
    );
}

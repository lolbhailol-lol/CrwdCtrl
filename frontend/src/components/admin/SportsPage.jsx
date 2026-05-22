import { useEffect, useState } from 'react';
import SportsFormModal from './SportsFormModal';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SPORT_LABELS = {
    run_club: 'Run Club', football: 'Football', cricket: 'Cricket',
    badminton: 'Badminton', marathon: 'Marathon', gymkhana: 'Gymkhana', other: 'Other',
};

function formatDate(d) {
    if (!d) return 'N/A';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function SportsPage() {
    const [events, setEvents] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);

    const fetchEvents = () => {
        fetch(`${API}/admin/sports?limit=200`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        })
            .then(r => r.json())
            .then(d => setEvents(d.events || []))
            .catch(err => console.error('Error fetching sports events:', err));
    };

    useEffect(fetchEvents, []);

    const deleteEvent = async (id, title) => {
        if (!window.confirm(`Are you sure you want to delete "${title}"?`)) return;
        await fetch(`${API}/admin/sports/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchEvents();
    };

    const byStatus = {
        published: events.filter(e => e.status === 'published').sort((a, b) => new Date(a.eventDate || 0) - new Date(b.eventDate || 0)),
        completed: events.filter(e => e.status === 'completed').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
        cancelled: events.filter(e => e.status === 'cancelled').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    };

    const ActionButtons = ({ ev }) => (
        <div className="flex gap-2 justify-end">
            <button
                onClick={() => { setSelected(ev); setShowForm(true); }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
            >
                Edit
            </button>
            <button
                onClick={() => deleteEvent(ev._id, ev.title)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
            >
                Delete
            </button>
        </div>
    );

    const SectionTable = ({ items, columns }) => (
        <div className="overflow-x-auto">
            <table className="w-full text-left">
                <thead className="text-gray-400 border-b border-gray-700">
                    <tr>
                        {columns.map(c => (
                            <th key={c} className={`pb-3 ${c === 'Actions' ? 'text-right' : ''}`}>{c}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map(ev => (
                        <tr key={ev._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                            <td className="py-4 font-medium">{ev.title}</td>
                            <td className="py-4 text-gray-300">{ev.organizer || '—'}</td>
                            <td className="py-4">
                                <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                                    {SPORT_LABELS[ev.sportType] || ev.sportType}
                                </span>
                            </td>
                            <td className="py-4 text-gray-400 text-sm">{ev.city || '—'}</td>
                            <td className="py-4 text-gray-400 text-sm">{formatDate(ev.eventDate)}</td>
                            <td className="py-4 text-gray-400 text-sm">{ev.registrationFee > 0 ? `₹${ev.registrationFee}` : 'Free'}</td>
                            <td className="py-4"><ActionButtons ev={ev} /></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const cols = ['Title', 'Organizer', 'Sport Type', 'City', 'Date', 'Fee', 'Actions'];

    return (
        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex justify-between mb-4">
                <h2 className="text-xl font-semibold">Sports</h2>
                <button
                    onClick={() => { setSelected(null); setShowForm(true); }}
                    className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
                >
                    + Create Sports Event
                </button>
            </div>

            {events.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                    No sports events found. Create your first one!
                </div>
            ) : (
                <div className="space-y-8">

                    {byStatus.published.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-green-400 flex items-center">
                                🟢 Active Events
                                <span className="ml-2 text-sm text-gray-400">({byStatus.published.length} events)</span>
                            </h3>
                            <SectionTable items={byStatus.published} columns={cols} />
                        </div>
                    )}

                    {byStatus.completed.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-gray-400 flex items-center">
                                ⚫ Completed Events
                                <span className="ml-2 text-sm text-gray-500">(Chronological order)</span>
                            </h3>
                            <SectionTable items={byStatus.completed} columns={cols} />
                        </div>
                    )}

                    {byStatus.cancelled.length > 0 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-4 text-red-400 flex items-center">
                                🔴 Cancelled Events
                            </h3>
                            <SectionTable items={byStatus.cancelled} columns={cols} />
                        </div>
                    )}

                </div>
            )}

            {showForm && (
                <SportsFormModal
                    event={selected}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); fetchEvents(); }}
                />
            )}
        </div>
    );
}

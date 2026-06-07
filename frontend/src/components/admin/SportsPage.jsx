import { useEffect, useMemo, useState } from 'react';
import {
    Dumbbell,
    Calendar,
    MapPin,
    Edit2,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    Users2,
    Activity,
} from 'lucide-react';
import SportsFormModal from './SportsFormModal';
import RunClubFormModal from './RunClubFormModal';
import { getSectionSummary, normalizeSportsSections } from '../../constants/sportsPage';
import { normalizeImageUrl } from '../../utils/uploadUrls';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SPORT_LABELS = {
    run_club: 'Run Club',
    football: 'Football',
    cricket: 'Cricket',
    badminton: 'Badminton',
    marathon: 'Marathon',
    gymkhana: 'Gymkhana',
    other: 'Other',
};

const STATUS_BADGE = {
    published: 'bg-green-900/60 text-green-300 border border-green-700',
    draft: 'bg-gray-700 text-gray-300 border border-gray-600',
    completed: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    cancelled: 'bg-red-900/60 text-red-300 border border-red-700',
};

function formatDate(d) {
    if (!d) return 'TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AdminSportsEventRow({ event, onEdit, onDelete }) {
    const [imgErr, setImgErr] = useState(false);
    const summary = getSectionSummary(event);
    const normalized = normalizeSportsSections(event);
    const thumb = normalizeImageUrl(event.images?.[0]);

    useEffect(() => {
        setImgErr(false);
    }, [thumb]);

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                {thumb && !imgErr ? (
                    <img src={thumb} alt={event.title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-900 to-green-700">
                        <Dumbbell size={20} className="text-white/40" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{event.title}</p>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 bg-gray-700 text-gray-300">
                        {SPORT_LABELS[event.sportType] || event.sportType}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${STATUS_BADGE[event.status] || 'bg-gray-700 text-gray-300'}`}>
                        {event.status}
                    </span>
                    {summary.upcoming && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30">
                            Upcoming
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {(event.city || event.organizer) && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <MapPin size={10} />
                            {event.city || event.organizer}
                        </span>
                    )}
                    {event.eventDate && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(event.eventDate)}
                        </span>
                    )}
                    {normalized.upcomingPriority !== 999 && (
                        <span className="text-[11px] text-gray-600">Pri {normalized.upcomingPriority}</span>
                    )}
                </div>
            </div>

            <span className={`text-sm font-bold shrink-0 ${event.registrationFee > 0 ? 'text-[#0ECCEE]' : 'text-green-400'}`}>
                {event.registrationFee > 0 ? `₹${event.registrationFee}` : 'Free'}
            </span>

            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    type="button"
                    onClick={() => onEdit(event)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                    title="Edit event"
                >
                    <Edit2 size={13} className="text-white" />
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(event._id, event.title)}
                    className="p-2 bg-red-900/60 hover:bg-red-600 rounded-lg transition-colors border border-red-800"
                    title="Delete event"
                >
                    <Trash2 size={13} className="text-red-400" />
                </button>
            </div>
        </div>
    );
}

export default function SportsPage() {
    const [events, setEvents] = useState([]);
    const [clubs, setClubs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clubsLoading, setClubsLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [activeClubId, setActiveClubId] = useState(null);

    const [showClubForm, setShowClubForm] = useState(false);
    const [selectedClub, setSelectedClub] = useState(null);
    const [expandedClub, setExpandedClub] = useState(() => new Set());
    const [upcomingOpen, setUpcomingOpen] = useState(true);

    const fetchEvents = () => {
        setLoading(true);
        fetch(`${API}/admin/sports?limit=200`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        })
            .then((r) => r.json())
            .then((d) => setEvents(d.events || []))
            .catch((err) => console.error('Error fetching sports events:', err))
            .finally(() => setLoading(false));
    };

    const fetchClubs = () => {
        setClubsLoading(true);
        fetch(`${API}/admin/run-clubs?limit=100`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        })
            .then((r) => r.json())
            .then((d) => setClubs(d.clubs || []))
            .catch((err) => console.error('Error fetching run clubs:', err))
            .finally(() => setClubsLoading(false));
    };

    useEffect(() => {
        fetchEvents();
        fetchClubs();
    }, []);

    const q = search.trim().toLowerCase();

    const upcomingEvents = useMemo(() => {
        return events.filter((ev) => {
            if (ev.runClubId) return false;
            if (q && ![ev.title, ev.city, ev.organizer, ev.displayType].some((v) => String(v || '').toLowerCase().includes(q))) {
                return false;
            }
            return true;
        });
    }, [events, q]);

    const deleteEvent = async (id, title) => {
        if (!window.confirm(`Delete "${title}"?`)) return;
        await fetch(`${API}/admin/sports/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchEvents();
    };

    const deleteClub = async (id, name) => {
        if (!window.confirm(`Delete "${name}"? Events inside will need to be reassigned.`)) return;
        await fetch(`${API}/admin/run-clubs/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchClubs();
    };

    const activeClubKey = activeClubId || selected?.runClubId || null;

    return (
        <div className="bg-[#111213] rounded-xl p-6 space-y-8">
            <div>
                <p className="text-xs text-gray-500 mb-6">
                    Mirrors /sports — Upcoming Activities (standalone events) and Run Clubs with nested events
                </p>

                {/* ── Upcoming Activities ── */}
                <div className="mb-10">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Activity size={20} className="text-[#0ECCEE]" />
                            Upcoming Activities
                            <span className="text-sm font-normal text-gray-500">({upcomingEvents.length})</span>
                        </h2>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setUpcomingOpen((o) => !o)}
                                className="p-2 text-gray-500 hover:text-gray-300"
                            >
                                {upcomingOpen ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveClubId(null);
                                    setSelected(null);
                                    setShowForm(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black rounded-xl font-bold text-sm transition-colors"
                            >
                                <Plus size={14} />
                                Add Event
                            </button>
                        </div>
                    </div>

                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search events and run clubs..."
                        className="w-full max-w-md mb-4 bg-[#1D1E20] border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#0ECCEE]"
                    />

                    {upcomingOpen && (
                        loading ? (
                            <div className="space-y-2">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="h-16 bg-[#232425] rounded-xl animate-pulse" />
                                ))}
                            </div>
                        ) : upcomingEvents.length === 0 ? (
                            <div className="text-center py-10 text-gray-500 rounded-2xl border border-dashed border-gray-700">
                                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm">No standalone upcoming events yet</p>
                            </div>
                        ) : (
                            <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
                                {upcomingEvents.map((ev) => (
                                    <AdminSportsEventRow
                                        key={ev._id}
                                        event={ev}
                                        onEdit={(e) => {
                                            setSelected(e);
                                            setActiveClubId(null);
                                            setShowForm(true);
                                        }}
                                        onDelete={deleteEvent}
                                    />
                                ))}
                            </div>
                        )
                    )}
                </div>

                {/* ── Run Clubs ── */}
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Users2 size={20} className="text-[#0ECCEE]" />
                            Run Clubs
                        </h2>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedClub(null);
                                setShowClubForm(true);
                            }}
                            className="flex items-center gap-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                        >
                            <Plus size={16} />
                            Add Run Club
                        </button>
                    </div>

                    {clubsLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map((i) => (
                                <div key={i} className="h-20 bg-[#232425] rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : clubs.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 rounded-2xl border border-dashed border-gray-700">
                            <Users2 size={40} className="mx-auto mb-3 opacity-20" />
                            <p className="text-lg font-medium">No run clubs yet</p>
                            <p className="text-sm text-gray-500 mt-1 mb-4">Add a run club, then add events inside it</p>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedClub(null);
                                    setShowClubForm(true);
                                }}
                                className="inline-flex items-center gap-2 bg-[#0ECCEE] text-black px-4 py-2 rounded-xl font-bold text-sm"
                            >
                                <Plus size={14} />
                                Add Run Club
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {clubs
                                .filter((c) => !q || [c.name, c.basedIn, c.organizer].some((v) => String(v || '').toLowerCase().includes(q)))
                                .map((c) => {
                                    const clubEvents = events.filter(
                                        (ev) => ev.runClubId === c._id || String(ev.runClubId) === String(c._id)
                                    );
                                    const isOpen = expandedClub.has(c._id);
                                    const clubCover = normalizeImageUrl(c.coverImage);

                                    return (
                                        <div key={c._id} className="bg-[#232425] rounded-2xl border border-gray-700/50 overflow-hidden">
                                            <div className="flex items-center gap-3 p-4">
                                                <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                                                    {clubCover ? (
                                                        <img src={clubCover} alt={c.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-900 to-green-700">
                                                            <Users2 size={20} className="text-white/40" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-white font-bold text-sm line-clamp-1">{c.name}</h3>
                                                    {c.basedIn && <p className="text-gray-500 text-xs">📍 {c.basedIn}</p>}
                                                    <p className="text-gray-600 text-[11px] mt-0.5">
                                                        {loading ? '…' : `${clubEvents.length} event${clubEvents.length !== 1 ? 's' : ''}`}
                                                        {c.runClubPriority !== 999 && ` · Pri ${c.runClubPriority}`}
                                                    </p>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedClub(c);
                                                            setShowClubForm(true);
                                                        }}
                                                        className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors"
                                                        title="Edit run club"
                                                    >
                                                        <Edit2 size={13} className="text-gray-300" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => deleteClub(c._id, c.name)}
                                                        className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors"
                                                        title="Delete run club"
                                                    >
                                                        <Trash2 size={13} className="text-gray-300" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setExpandedClub((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(c._id)) next.delete(c._id);
                                                                else next.add(c._id);
                                                                return next;
                                                            })
                                                        }
                                                        className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                                    >
                                                        {isOpen ? (
                                                            <EyeOff size={13} className="text-gray-300" />
                                                        ) : (
                                                            <Eye size={13} className="text-gray-300" />
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            {isOpen && (
                                                <div className="border-t border-gray-700/50 p-4">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <p className="text-xs text-gray-500">Events in this run club</p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveClubId(c._id);
                                                                setSelected(null);
                                                                setShowForm(true);
                                                            }}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0ECCEE]/10 hover:bg-[#0ECCEE]/20 border border-[#0ECCEE]/30 rounded-lg text-xs font-semibold text-[#0ECCEE] transition-colors"
                                                        >
                                                            <Plus size={12} />
                                                            Add Event
                                                        </button>
                                                    </div>
                                                    {clubEvents.length === 0 ? (
                                                        <div className="text-center py-6">
                                                            <Dumbbell size={28} className="mx-auto mb-2 text-gray-700" />
                                                            <p className="text-xs text-gray-500">No events in this run club yet</p>
                                                        </div>
                                                    ) : (
                                                        <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
                                                            {clubEvents.map((ev) => (
                                                                <AdminSportsEventRow
                                                                    key={ev._id}
                                                                    event={ev}
                                                                    onEdit={(e) => {
                                                                        setSelected(e);
                                                                        setActiveClubId(c._id);
                                                                        setShowForm(true);
                                                                    }}
                                                                    onDelete={deleteEvent}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                        </div>
                    )}
                </div>
            </div>

            {showForm && (
                <SportsFormModal
                    event={selected}
                    runClubId={activeClubKey}
                    onClose={() => {
                        setShowForm(false);
                        setActiveClubId(null);
                    }}
                    onSaved={() => {
                        setShowForm(false);
                        setActiveClubId(null);
                        fetchEvents();
                    }}
                />
            )}

            {showClubForm && (
                <RunClubFormModal
                    club={selectedClub}
                    onClose={() => setShowClubForm(false)}
                    onSaved={() => {
                        setShowClubForm(false);
                        fetchClubs();
                    }}
                />
            )}
        </div>
    );
}

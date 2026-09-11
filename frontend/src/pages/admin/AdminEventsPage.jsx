import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users2, Plus, Eye, EyeOff, Edit2, Trash2, ExternalLink, Images, UserCog } from 'lucide-react';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import EventShowFormModal from '../../components/admin/EventShowFormModal';
import EventCommunityEventFormModal from '../../components/admin/EventCommunityEventFormModal';
import EventCommunityFormModal from '../../components/admin/EventCommunityFormModal';
import { AdminRunRow } from './SportsPage';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { EVENT_TYPE_LABELS } from '../../constants/eventsPage';
import { useDialog } from '../../context/DialogContext';
import { normalizeImageUrl } from '../../utils/uploadUrls';
import { runClubPath } from '../../utils/slugRoutes';

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
    const { confirm } = useDialog();

    const [communities, setCommunities] = useState([]);
    const [communityEvents, setCommunityEvents] = useState([]);
    const [communitiesLoading, setCommunitiesLoading] = useState(true);
    const [expandedCommunity, setExpandedCommunity] = useState(() => new Set());
    const [showCommunityForm, setShowCommunityForm] = useState(false);
    const [selectedCommunity, setSelectedCommunity] = useState(null);
    const [showCommunityEventForm, setShowCommunityEventForm] = useState(false);
    const [selectedCommunityEvent, setSelectedCommunityEvent] = useState(null);
    const [activeCommunityId, setActiveCommunityId] = useState(null);

    const fetchShows = () => {
        setError('');
        adminFetchJSON('/admin/events?limit=200')
            .then(d => setShows(d.shows || []))
            .catch(err => setError(err.message || 'Failed to load events'))
            .finally(() => setLoading(false));
    };

    const fetchCommunities = () => {
        setCommunitiesLoading(true);
        Promise.all([
            adminFetchJSON('/admin/run-clubs?limit=200&hub=events'),
            adminFetchJSON('/admin/sports?limit=200'),
        ])
            .then(([clubData, sportData]) => {
                const hubs = clubData.clubs || [];
                setCommunities(hubs);
                setCommunityEvents((sportData.events || []).filter((ev) => ev.runClubId));
                setExpandedCommunity((prev) => {
                    if (prev.size) return prev;
                    return new Set(hubs.map((c) => c._id));
                });
            })
            .catch((err) => setError(err.message || 'Failed to load event communities'))
            .finally(() => setCommunitiesLoading(false));
    };

    useEffect(() => {
        fetchShows();
        fetchCommunities();
    }, []);

    const deleteShow = async (id, title) => {
        if (!(await confirm({ title: 'Delete event?', message: `Are you sure you want to delete "${title}"?`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/events/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete show');
        }
        fetchShows();
    };

    const deleteCommunity = async (id, name) => {
        if (!(await confirm({ title: 'Delete community?', message: `Delete "${name}"? Events inside will be unlinked from this community.`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/run-clubs/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete community');
        }
        fetchCommunities();
    };

    const deleteCommunityEvent = async (id, title) => {
        if (!(await confirm({ title: 'Delete event?', message: `Delete "${title}"?`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/sports/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete event');
        }
        fetchCommunities();
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
            <p className="text-gray-400">
                Communities with events inside (guests pay the ticket only — no extra platform fee), plus standalone shows (~2.5% CrwdCtrl fee at checkout).
            </p>
        </div>

        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    <Users2 size={20} className="text-[#0ECCEE]" />
                    Event communities
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/admin/event-community-organizers"
                        className="flex items-center gap-2 border border-[#0ECCEE]/40 text-[#0ECCEE] hover:bg-[#0ECCEE]/10 px-4 py-2.5 rounded-xl font-bold text-sm"
                    >
                        <UserCog size={16} />
                        Organizers
                    </Link>
                    <button
                        type="button"
                        onClick={() => { setSelectedCommunity(null); setShowCommunityForm(true); }}
                        className="flex items-center gap-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black px-4 py-2.5 rounded-xl font-bold text-sm"
                    >
                        <Plus size={16} />
                        Add community
                    </button>
                </div>
            </div>
            {communitiesLoading ? (
                <div className="space-y-3">
                    {[1, 2].map((i) => <div key={i} className="h-20 bg-[#232425] rounded-2xl animate-pulse" />)}
                </div>
            ) : communities.length === 0 ? (
                <div className="text-center py-10 text-gray-400">
                    <p className="text-sm">No event communities yet. Add one, then add events inside it.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {communities.map((c) => {
                        const events = communityEvents.filter(
                            (r) => String(r.runClubId) === String(c._id),
                        );
                        const isOpen = expandedCommunity.has(c._id);
                        const cover = normalizeImageUrl(c.coverImage);
                        return (
                            <div key={c._id} className="bg-[#232425] rounded-2xl border border-gray-700/50 overflow-hidden">
                                <div className="flex items-center gap-3 p-4">
                                    <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                                        {cover ? (
                                            <img src={cover} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-fuchsia-900 to-purple-700">
                                                <Users2 size={20} className="text-white/40" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold text-sm line-clamp-1">{c.name}</h3>
                                        {c.basedIn ? <p className="text-gray-500 text-xs">📍 {c.basedIn}</p> : null}
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-gray-600 text-[11px]">
                                                {events.length} event{events.length !== 1 ? 's' : ''}
                                            </span>
                                            {(c.galleryImages || []).length > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Images size={10} />
                                                    {c.galleryImages.length} photos
                                                </span>
                                            ) : null}
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/20">
                                                /events
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                            href={runClubPath(c)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-gray-700 hover:bg-[#0ECCEE]/20 rounded-lg"
                                            title="Preview"
                                        >
                                            <ExternalLink size={13} className="text-[#0ECCEE]" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedCommunity(c); setShowCommunityForm(true); }}
                                            className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg"
                                            title="Edit community"
                                        >
                                            <Edit2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteCommunity(c._id, c.name)}
                                            className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-lg"
                                            title="Delete community"
                                        >
                                            <Trash2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedCommunity((prev) => {
                                                const next = new Set(prev);
                                                if (next.has(c._id)) next.delete(c._id);
                                                else next.add(c._id);
                                                return next;
                                            })}
                                            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg"
                                        >
                                            {isOpen ? <EyeOff size={13} className="text-gray-300" /> : <Eye size={13} className="text-gray-300" />}
                                        </button>
                                    </div>
                                </div>
                                {isOpen ? (
                                    <div className="border-t border-gray-700/50 p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveCommunityId(c._id);
                                                    setSelectedCommunityEvent(null);
                                                    setShowCommunityEventForm(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0ECCEE]/10 hover:bg-[#0ECCEE]/20 border border-[#0ECCEE]/30 rounded-lg text-xs font-semibold text-[#0ECCEE]"
                                            >
                                                <Plus size={12} />
                                                Add event
                                            </button>
                                        </div>
                                        {events.length === 0 ? (
                                            <p className="text-xs text-gray-500 text-center py-6">No events in this community yet</p>
                                        ) : (
                                            <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
                                                {events.map((run) => (
                                                    <AdminRunRow
                                                        key={run._id}
                                                        run={run}
                                                        onEdit={(r) => {
                                                            setSelectedCommunityEvent(r);
                                                            setActiveCommunityId(c._id);
                                                            setShowCommunityEventForm(true);
                                                        }}
                                                        onDelete={deleteCommunityEvent}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>

        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-1">
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
            <p className="text-[11px] text-gray-500 mb-4">Standalone shows add a ~2.5% platform fee. Community events above do not.</p>

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
                <InlinePageLoader variant="event" minHeight={false} />
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
            {showCommunityForm && (
                <EventCommunityFormModal
                    club={selectedCommunity}
                    onClose={() => setShowCommunityForm(false)}
                    onSaved={() => {
                        setShowCommunityForm(false);
                        fetchCommunities();
                    }}
                />
            )}
            {showCommunityEventForm && activeCommunityId && (
                <EventCommunityEventFormModal
                    event={selectedCommunityEvent}
                    runClubId={activeCommunityId}
                    clubName={communities.find((c) => String(c._id) === String(activeCommunityId))?.name}
                    onClose={() => {
                        setShowCommunityEventForm(false);
                        setActiveCommunityId(null);
                    }}
                    onSaved={() => {
                        setShowCommunityEventForm(false);
                        setActiveCommunityId(null);
                        fetchCommunities();
            }}
                />
            )}
        </div>
        </div>
    );
}

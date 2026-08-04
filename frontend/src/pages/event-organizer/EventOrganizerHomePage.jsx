import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, Loader } from 'lucide-react';
import { fetchEventOrganizerMe } from '../../services/api/eventShowOrganizer.api';
import { getEventOrganizerSession, setEventOrganizerSession } from '../../utils/eventShowOrganizerSession';

function statusBadge(status) {
    const s = String(status || 'draft').toLowerCase();
    if (s === 'published') return 'bg-emerald-500/15 text-emerald-400';
    if (s === 'cancelled') return 'bg-red-500/15 text-red-400';
    return 'bg-amber-500/15 text-amber-400';
}

export default function EventOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getEventOrganizerSession();
    const [events, setEvents] = useState(session?.events || []);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchEventOrganizerMe();
                const nextEvents = data.events || [];
                setEvents(nextEvents);
                const current = getEventOrganizerSession();
                if (current) {
                    setEventOrganizerSession({
                        ...current,
                        organizer: data.organizer,
                        events: nextEvents,
                    });
                }
            } catch (e) {
                setError(e.message || 'Failed to load events');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader className="animate-spin text-[#0ECCEE]" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 px-4 space-y-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Your events</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Manage registrations, check guests in, and send updates.
                </p>
            </div>

            {events.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                    No events assigned yet. Ask CrwdCtrl admin to assign an event to your account.
                </div>
            ) : (
                <div className="grid gap-3">
                    {events.map((event) => (
                        <button
                            key={event._id || event.id}
                            type="button"
                            onClick={() => navigate(`/event-organizer/events/${event._id || event.id}`)}
                            className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 transition-colors text-left"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="size-10 rounded-lg bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                    <CalendarDays className="text-[#0ECCEE]" size={18} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-semibold truncate">{event.title}</p>
                                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(event.status)}`}>
                                            {event.status || 'draft'}
                                        </span>
                                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border border-white/10 bg-white/5 text-gray-300">
                                            Reg {event.registrationStatus || '—'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                                        {[event.venue, event.city].filter(Boolean).join(' · ') || 'Venue TBA'}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="text-gray-600 shrink-0" size={18} />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

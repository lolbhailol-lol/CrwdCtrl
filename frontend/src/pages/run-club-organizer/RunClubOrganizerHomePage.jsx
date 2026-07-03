import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footprints, ChevronRight, Loader, MapPin, Phone, Instagram } from 'lucide-react';
import { fetchRunClubOrganizerMe } from '../../services/api/runClubOrganizer.api';
import { getRunClubOrganizerSession, setRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';

function formatEventDate(d) {
    if (!d) return 'Date TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function RunClubOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getRunClubOrganizerSession();
    const [events, setEvents] = useState(session?.events || []);
    const [runClub, setRunClub] = useState(session?.runClub || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await fetchRunClubOrganizerMe();
                const nextEvents = data.events || [];
                setEvents(nextEvents);
                setRunClub(data.runClub || null);
                const current = getRunClubOrganizerSession();
                if (current) {
                    setRunClubOrganizerSession({
                        ...current,
                        organizer: data.organizer,
                        runClub: data.runClub,
                        events: nextEvents,
                    });
                }
                if (nextEvents.length === 1 && nextEvents[0]?._id) {
                    navigate(`/run-club-organizer/events/${nextEvents[0]._id}`, { replace: true });
                }
            } catch (e) {
                setError(e.message || 'Failed to load run club');
            } finally {
                setLoading(false);
            }
        })();
    }, [navigate]);

    if (loading) {
        return <div className="flex justify-center py-20"><Loader className="animate-spin text-[#0ECCEE]" /></div>;
    }

    if (error) {
        return <div className="text-center py-16 text-red-400 text-sm">{error}</div>;
    }

    return (
        <div className="space-y-6">
            {runClub ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] overflow-hidden">
                    {runClub.coverImage ? (
                        <div className="h-32 sm:h-40 bg-cover bg-center" style={{ backgroundImage: `url(${runClub.coverImage})` }} />
                    ) : (
                        <div className="h-24 bg-linear-to-r from-emerald-900/40 to-[#0ECCEE]/20" />
                    )}
                    <div className="p-4 sm:p-5 space-y-3">
                        <div>
                            <h1 className="text-2xl font-bold">{runClub.name}</h1>
                            {runClub.basedIn ? (
                                <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
                                    <MapPin size={14} /> {runClub.basedIn}
                                </p>
                            ) : null}
                        </div>
                        {runClub.aboutUs ? (
                            <p className="text-sm text-gray-400 leading-relaxed">{runClub.aboutUs}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                            {runClub.contactPhone ? (
                                <span className="inline-flex items-center gap-1"><Phone size={12} /> {runClub.contactPhone}</span>
                            ) : null}
                            {runClub.contactInstagram ? (
                                <span className="inline-flex items-center gap-1"><Instagram size={12} /> {runClub.contactInstagram}</span>
                            ) : null}
                        </div>
                        {runClub.runCategories?.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {runClub.runCategories.map((cat) => (
                                    <span key={cat} className="px-2 py-0.5 rounded-full bg-[#0ECCEE]/10 text-[#0ECCEE] text-[10px] font-medium">{cat}</span>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-bold mb-1">Your run club</h1>
                    <p className="text-sm text-gray-500">No run club linked yet. Contact CrwdCtrl admin.</p>
                </div>
            )}

            <div>
                <h2 className="text-lg font-semibold mb-1">All runs</h2>
                <p className="text-sm text-gray-500 mb-4">{events.length} run{events.length !== 1 ? 's' : ''} in your club</p>

                {events.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                        No runs found for this club yet.
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {events.map((event) => (
                            <button
                                key={event._id}
                                type="button"
                                onClick={() => navigate(`/run-club-organizer/events/${event._id}`)}
                                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-lg bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                        <Footprints className="text-[#0ECCEE]" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold truncate">{event.title}</p>
                                        <p className="text-xs text-gray-500">
                                            {event.city || '—'} · {formatEventDate(event.eventDate)}
                                            {event.distance ? ` · ${event.distance}` : ''}
                                        </p>
                                        {event.registration?.status ? (
                                            <p className="text-[10px] text-gray-600 mt-0.5 capitalize">Registration: {event.registration.status}</p>
                                        ) : null}
                                    </div>
                                </div>
                                <ChevronRight className="text-gray-600 shrink-0" size={18} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

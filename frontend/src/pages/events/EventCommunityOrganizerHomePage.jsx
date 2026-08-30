import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, MapPin, Phone, Instagram } from 'lucide-react';
import { fetchRunClubOrganizerMe } from '../../services/api/runClubOrganizer.api';
import DetailPageLoader from '../../components/DetailPageLoader';
import { getRunClubOrganizerSession, setRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { organizerEventPath } from '../../utils/organizerPortalPaths';

function formatEventDate(d) {
    if (!d) return 'Date TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EventCommunityOrganizerHomePage() {
    const navigate = useNavigate();
    const session = getRunClubOrganizerSession();
    const [events, setEvents] = useState(session?.events || []);
    const [runClub, setRunClub] = useState(session?.runClub || null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const copy = organizerHubCopy(true);

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
            } catch (e) {
                setError(e.message || 'Failed to load community');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return <DetailPageLoader label={copy.loadingCommunity} />;
    }

    if (error) {
        return (
            <div className="text-center py-16 px-4 space-y-4">
                <p className="text-red-400 text-sm">{error}</p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="px-4 py-2.5 rounded-xl bg-white text-black text-sm font-semibold"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-xl mx-auto">
            {runClub ? (
                <div className="overflow-hidden rounded-xl border border-white/10 bg-[#161718]">
                    {runClub.coverImage ? (
                        <div className="h-28 sm:h-36 bg-cover bg-center" style={{ backgroundImage: `url(${runClub.coverImage})` }} />
                    ) : (
                        <div className="h-16 bg-[#1a1b1d]" />
                    )}
                    <div className="p-4 space-y-2">
                        <h1 className="text-xl font-semibold tracking-tight">{runClub.name}</h1>
                        {runClub.basedIn ? (
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                <MapPin size={13} /> {runClub.basedIn}
                            </p>
                        ) : null}
                        {runClub.aboutUs ? (
                            <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">{runClub.aboutUs}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-3 text-xs text-gray-500 pt-0.5">
                            {runClub.contactPhone ? (
                                <span className="inline-flex items-center gap-1"><Phone size={12} /> {runClub.contactPhone}</span>
                            ) : null}
                            {runClub.contactInstagram ? (
                                <span className="inline-flex items-center gap-1"><Instagram size={12} /> {runClub.contactInstagram}</span>
                            ) : null}
                        </div>
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-xl font-semibold mb-1">{copy.communityEmptyTitle}</h1>
                    <p className="text-sm text-gray-500">{copy.communityEmpty}</p>
                </div>
            )}

            <div>
                <div className="flex items-baseline justify-between gap-3 mb-3">
                    <h2 className="text-base font-semibold">{copy.yourEvents}</h2>
                    <p className="text-xs text-gray-500">{copy.eventsCount(events.length)}</p>
                </div>

                {events.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-gray-500 text-sm">
                        {copy.noEvents}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {events.map((event) => {
                            const isPaid = Number(event.registrationFee) > 0;
                            const pendingReview = isPaid ? Number(event.pendingPaymentReview || 0) : 0;
                            const status = String(event.status || 'draft').toLowerCase();
                            const statusColor =
                                status === 'published' ? 'text-emerald-400'
                                    : status === 'draft' ? 'text-amber-400'
                                        : 'text-gray-400';
                            return (
                                <button
                                    key={event._id}
                                    type="button"
                                    onClick={() => navigate(
                                        pendingReview > 0
                                            ? `${organizerEventPath(event._id, true, 'participants')}?paymentStatus=pending_review`
                                            : organizerEventPath(event._id, true),
                                    )}
                                    className="w-full flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#161718] px-3.5 py-3.5 hover:border-[#0ECCEE]/30 hover:bg-[#0ECCEE]/[0.04] transition-colors text-left"
                                >
                                    <div className="min-w-0">
                                        <p className="font-medium text-white truncate">{event.title}</p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            <span className={`capitalize font-medium ${statusColor}`}>{status}</span>
                                            {' · '}
                                            <span className={isPaid ? 'text-cyan-300/90' : 'text-gray-400'}>
                                                {isPaid
                                                    ? `₹${Number(event.registrationFee).toLocaleString('en-IN')}`
                                                    : 'Free'}
                                            </span>
                                            {' · '}
                                            {event.city || '—'}
                                            {' · '}
                                            {formatEventDate(event.eventDate)}
                                        </p>
                                        {pendingReview > 0 ? (
                                            <p className="text-xs text-amber-400 mt-1">
                                                {pendingReview} to review
                                            </p>
                                        ) : null}
                                    </div>
                                    <ChevronRight className="text-[#0ECCEE]/50 shrink-0" size={18} />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

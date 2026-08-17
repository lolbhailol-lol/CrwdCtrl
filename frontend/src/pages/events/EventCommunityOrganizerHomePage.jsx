import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronRight, MapPin, Phone, Instagram, CreditCard } from 'lucide-react';
import { fetchRunClubOrganizerMe } from '../../services/api/runClubOrganizer.api';
import DetailPageLoader from '../../components/DetailPageLoader';
import { getRunClubOrganizerSession, setRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { organizerEventPath } from '../../utils/organizerPortalPaths';

function formatEventDate(d) {
    if (!d) return 'Date TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
    const s = String(status || 'draft').toLowerCase();
    if (s === 'published') return 'bg-emerald-500/15 text-emerald-400';
    if (s === 'cancelled') return 'bg-red-500/15 text-red-400';
    if (s === 'completed') return 'bg-gray-500/15 text-gray-400';
    return 'bg-amber-500/15 text-amber-400';
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
                    className="px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {runClub ? (
                <div className="rounded-2xl border border-gray-800 bg-[#161718] overflow-hidden">
                    {runClub.coverImage ? (
                        <div className="h-32 sm:h-40 bg-cover bg-center" style={{ backgroundImage: `url(${runClub.coverImage})` }} />
                    ) : (
                        <div className="h-24 bg-linear-to-r from-teal-900/40 to-[#0ECCEE]/20" />
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
                        <p className="text-xs text-gray-500">
                            {copy.homeHint}
                        </p>
                    </div>
                </div>
            ) : (
                <div>
                    <h1 className="text-2xl font-bold mb-1">{copy.communityEmptyTitle}</h1>
                    <p className="text-sm text-gray-500">{copy.communityEmpty}</p>
                </div>
            )}

            <div>
                <h2 className="text-lg font-semibold mb-1">{copy.yourEvents}</h2>
                <p className="text-sm text-gray-500 mb-4">{copy.eventsCount(events.length)}</p>

                {events.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 p-8 text-center text-gray-500 text-sm">
                        {copy.noEvents}
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {events.map((event) => {
                            const isPaid = Number(event.registrationFee) > 0;
                            const pendingReview = isPaid ? Number(event.pendingPaymentReview || 0) : 0;
                            return (
                            <button
                                key={event._id}
                                type="button"
                                onClick={() => navigate(
                                    pendingReview > 0
                                        ? `${organizerEventPath(event._id, true, 'participants')}?paymentStatus=pending_review`
                                        : organizerEventPath(event._id, true),
                                )}
                                className="flex items-center justify-between rounded-xl border border-gray-800 bg-[#161718] p-4 hover:border-[#0ECCEE]/40 transition-colors text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="size-10 rounded-lg bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                                        <CalendarDays className="text-[#0ECCEE]" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                            <p className="font-semibold truncate">{event.title}</p>
                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusBadge(event.status)}`}>
                                                {event.status || 'draft'}
                                            </span>
                                            <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                                isPaid
                                                    ? 'border-teal-400/25 bg-teal-500/12 text-teal-300'
                                                    : 'border-white/10 bg-white/5 text-gray-300'
                                            }`}>
                                                {isPaid
                                                    ? `₹${Number(event.registrationFee).toLocaleString('en-IN')}`
                                                    : 'Free'}
                                            </span>
                                            {isPaid && String(event.registration?.mode || event.registrationMode || '') !== 'organizer_qr' ? (
                                                <span className="shrink-0 inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-teal-500/12 text-teal-300 border border-teal-400/20">
                                                    <CreditCard size={10} /> Cashfree
                                                </span>
                                            ) : null}
                                            {pendingReview > 0 ? (
                                                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-300">
                                                    {pendingReview} to review
                                                </span>
                                            ) : null}
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            {event.city || '—'} · {formatEventDate(event.eventDate)}
                                            {event.distance ? ` · ${event.distance}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="text-gray-600 shrink-0" size={18} />
                            </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

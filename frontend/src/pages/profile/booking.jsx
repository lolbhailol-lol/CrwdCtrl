import { useState, useEffect } from 'react';
import { CalendarPlus } from 'lucide-react';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../utils/imageImports';
import { buildGoogleCalendarUrl } from '../../utils/calendar';
import { openExternalUrl } from '../../utils/externalLink';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookingsPageLoadingSkeleton } from '../../components/HomeEventCardSkeleton';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';

import { fetchMyRegistrations, fetchMySportsRegistrations } from '../../services/api/auth.api';

// Lightweight per-user session cache so returning to the bookings page paints
// instantly (stale-while-revalidate) instead of showing a full skeleton while
// the network round-trips. Data is always refreshed in the background.
const BOOKINGS_CACHE_PREFIX = 'crwdctrl_bookings_cache_';
const bookingsCacheKey = (user) => BOOKINGS_CACHE_PREFIX + (user?.id || user?._id || user?.email || 'me');
const readBookingsCache = (user) => {
    try {
        const raw = sessionStorage.getItem(bookingsCacheKey(user));
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};
const writeBookingsCache = (user, data) => {
    try {
        sessionStorage.setItem(bookingsCacheKey(user), JSON.stringify(data));
    } catch {
        /* storage full / unavailable — non-fatal */
    }
};

const formatEventDate = (date) => {
    if (!date) return 'Date TBA';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isEventCompleted = (item) => {
    // Pending club payment approval always stays in Upcoming until resolved
    if (item.isSports && item.registrationStatus === 'pending') return false;
    if (item.status === 'completed') return true;
    if (!item.date) return false;
    const eventDate = new Date(item.date);
    if (Number.isNaN(eventDate.getTime())) return false;
    eventDate.setHours(23, 59, 59, 999);
    return eventDate < new Date();
};

function mapFestRegistrations(internalRegistrations = []) {
    return internalRegistrations.map((reg) => {
        const isCompetitionRegistration = !!(reg.competitionId && (reg.competitionId._id || reg.competitionId));
        if (isCompetitionRegistration) {
            return {
                id: reg._id,
                name: reg.competitionId?.name || 'Competition',
                image: reg.competitionId?.coverImage || reg.fest?.coverImage,
                date: reg.fest?.festDate,
                venue: reg.fest?.venue,
                type: 'competition',
                festName: reg.fest?.festName,
                collegeName: reg.fest?.collegeName,
                status: reg.fest?.status || 'upcoming',
                registrationStatus: reg.status,
                registrationType: 'internal',
                isCompetition: true,
                isTrek: false,
                isSports: false,
                paymentAmount: reg.competitionId?.registrationFee || reg.fest?.ticketPrice || 'N/A',
                paymentStatus: reg.paymentStatus,
                amountPaid: reg.amountPaid || 0,
                paymentId: reg.payment_id || '',
                paymentOrderId: reg.payment_order_id || '',
                registeredAt: reg.submittedAt,
            };
        }
        return {
            id: reg._id,
            name: reg.fest?.festName,
            image: reg.fest?.coverImage,
            date: reg.fest?.festDate,
            venue: reg.fest?.venue,
            type: 'fest',
            collegeName: reg.fest?.collegeName,
            status: reg.fest?.status || 'upcoming',
            registrationStatus: reg.status,
            registrationType: 'internal',
            isCompetition: false,
            isTrek: false,
            isSports: false,
            paymentAmount: reg.fest?.ticketPrice || 'N/A',
            paymentStatus: reg.paymentStatus,
            amountPaid: reg.amountPaid || 0,
            paymentId: reg.payment_id || '',
            paymentOrderId: reg.payment_order_id || '',
            registeredAt: reg.submittedAt,
        };
    });
}

function mapSportsRegistrations(sportsRegistrations = []) {
    return sportsRegistrations
        .filter((reg) => {
            if (reg.status === 'cancelled') {
                return reg.paymentStatus === 'failed' || !!reg.paymentReviewNote;
            }
            // Keep confirmed + pending (awaiting organizer approval)
            return reg.status === 'pending' || reg.status === 'confirmed';
        })
        .map((reg) => ({
            id: reg._id,
            name: reg.event?.title || 'Sports Event',
            image: reg.event?.coverImage || reg.event?.images?.[0] || null,
            date: reg.bookingDate || reg.event?.eventDate || null,
            venue: reg.event?.venue || reg.event?.city || '',
            type: 'sports',
            collegeName: '',
            status: reg.event?.status === 'completed' ? 'completed' : 'upcoming',
            registrationStatus: reg.status,
            registrationType: 'sports',
            isCompetition: false,
            isTrek: false,
            isSports: true,
            sportType: reg.event?.sportType || '',
            clubName: reg.clubName || '',
            paymentAmount: reg.amountPaid || 0,
            paymentStatus: reg.paymentStatus,
            paymentReviewNote: reg.paymentReviewNote || '',
            amountPaid: reg.amountPaid || 0,
            paymentId: reg.payment_id || '',
            paymentOrderId: reg.payment_order_id || '',
            registeredAt: reg.submittedAt || reg.createdAt,
        }));
}

function mapTrekBookings(trekBookings = []) {
    return trekBookings.map((booking) => ({
        id: booking._id,
        name: booking.trekId?.trekName || 'Trek',
        image: booking.trekId?.coverImage || booking.trekId?.images?.[0] || null,
        date: booking.bookingDetails?.date || booking.trekId?.trekDate,
        venue: booking.trekId?.city || '',
        type: 'trek',
        collegeName: '',
        status: 'upcoming',
        registrationStatus: booking.status || 'confirmed',
        registrationType: 'trek',
        isCompetition: false,
        isTrek: true,
        isSports: false,
        people: booking.bookingDetails?.people || 1,
        amountPaid: booking.bookingDetails?.amountPaid || 0,
        paymentId: booking.bookingDetails?.paymentId || '',
        paymentOrderId:
            booking.payment_order_id ||
            booking.bookingDetails?.payment_order_id ||
            '',
        paymentStatus: booking.bookingDetails?.amountPaid > 0 ? 'paid' : 'free',
        difficulty: booking.trekId?.difficultyLevel || '',
        registeredAt: booking.createdAt,
    }));
}

function mapEventRegistrations(eventRegistrations = []) {
    return eventRegistrations.map((reg) => ({
        id: reg._id,
        name: reg.eventShow?.displayName || reg.eventShow?.title || 'Event',
        image: reg.eventShow?.coverImage || reg.eventShow?.banner || null,
        date: reg.eventShow?.showTimings?.[0]?.date || null,
        venue: reg.eventShow?.venue || reg.eventShow?.city || '',
        type: 'event',
        collegeName: '',
        status: reg.eventShow?.status === 'completed' ? 'completed' : 'upcoming',
        registrationStatus: reg.status,
        registrationType: 'event',
        isCompetition: false,
        isTrek: false,
        isSports: false,
        isEvent: true,
        paymentAmount: reg.eventShow?.ticketPrice || reg.amountPaid || 0,
        paymentStatus: reg.paymentStatus,
        amountPaid: reg.amountPaid || 0,
        paymentId: reg.payment_id || '',
        paymentOrderId: reg.payment_order_id || '',
        registeredAt: reg.submittedAt || reg.createdAt,
    }));
}

async function loadAllBookings(authToken = null) {
    const opts = { cacheBust: true, token: authToken };
    const [festResult, sportsResult] = await Promise.allSettled([
        fetchMyRegistrations(opts),
        fetchMySportsRegistrations(opts),
    ]);

    const festFailed = festResult.status === 'rejected';
    const sportsFailed = sportsResult.status === 'rejected';
    if (festFailed) console.warn('Fest/trek bookings fetch failed:', festResult.reason);
    if (sportsFailed) console.warn('Sports bookings fetch failed:', sportsResult.reason);
    if (festFailed && sportsFailed) {
        throw festResult.reason || sportsResult.reason || new Error('Failed to load bookings');
    }

    const registrationsData = festFailed
        ? { registrations: [], trekBookings: [], eventRegistrations: [] }
        : festResult.value || {};
    const sportsData = sportsFailed
        ? { registrations: [] }
        : sportsResult.value || {};

    const transformedFests = mapFestRegistrations(registrationsData.registrations || []);
    const transformedTreks = mapTrekBookings(registrationsData.trekBookings || []);
    const transformedEvents = mapEventRegistrations(registrationsData.eventRegistrations || []);
    const transformedSports = mapSportsRegistrations(sportsData.registrations || []);

    return {
        bookings: [...transformedFests, ...transformedTreks, ...transformedSports, ...transformedEvents]
            .sort((a, b) => {
                const ap = a.isSports && a.registrationStatus === 'pending' ? 1 : 0;
                const bp = b.isSports && b.registrationStatus === 'pending' ? 1 : 0;
                if (ap !== bp) return bp - ap;
                return new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0);
            }),
        sportsFailed,
        festFailed,
    };
}

function mergeOptimisticPending(list, pending) {
    if (!pending?.id) return list;
    if (list.some((b) => String(b.id) === String(pending.id))) return list;
    return [pending, ...list];
}

function BookingCard({ item, isDark, onViewBooking, onDownloadTicket, onAddToCalendar }) {
    const hasValidDate = item.date && !Number.isNaN(new Date(item.date).getTime());
    const showCalendar = hasValidDate && !isEventCompleted(item);
    const isPendingPayment = item.isSports && item.registrationStatus === 'pending';
    const isRejectedPayment = item.isSports && item.registrationStatus === 'cancelled' && (item.paymentStatus === 'failed' || item.paymentReviewNote);
    const canDownloadTicket = !isPendingPayment && !isRejectedPayment && item.registrationStatus !== 'cancelled';
    const clubLabel = item.clubName || 'The club';

    return (
        <div
            className={`rounded-2xl p-3 sm:p-4 min-h-40 flex flex-col transition-all duration-300 ${
                isDark ? 'card-surface' : 'border border-gray-100 bg-white shadow-lg'
            }`}
        >
            <div className="flex gap-3 sm:gap-4 min-h-0 flex-1">
                <div className="size-20 shrink-0 rounded-2xl overflow-hidden">
                    {item.image ? (
                        <img
                            src={getImageUrl(item.image, { preset: 'cardSm' })}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                handleImageErrorWithFallback(e, 84, 84, '#6366f1', item.name || 'Event');
                            }}
                        />
                    ) : (
                        <div
                            className={`w-full h-full flex items-center justify-center ${
                                isDark ? 'bg-linear-to-br from-gray-800 to-gray-900' : 'bg-linear-to-br from-gray-100 to-gray-200'
                            }`}
                        >
                            <span className="text-2xl">{item.isTrek ? '🏔️' : item.isSports ? '🏃' : '🎉'}</span>
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 pt-2">
                    <h3
                        className={`text-sm font-medium font-inter leading-5 tracking-tight line-clamp-2 ${
                            isDark ? 'text-white' : 'text-gray-900'
                        }`}
                    >
                        {item.name}
                    </h3>
                    <p
                        className={`mt-2 text-xs font-medium font-inter leading-4 tracking-tight ${
                            isDark ? 'text-gray-400' : 'text-gray-900'
                        }`}
                    >
                        {formatEventDate(item.date)}
                    </p>
                    {item.isCompetition && item.festName && (
                        <p className={`mt-1 text-xs line-clamp-1 ${isDark ? 'text-gray-500' : 'text-gray-600'}`}>
                            {item.festName}
                        </p>
                    )}
                    {isPendingPayment ? (
                        <span
                            className={`mt-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                isDark
                                    ? 'bg-amber-500/15 text-amber-300'
                                    : 'bg-amber-50 text-amber-800'
                            }`}
                        >
                            Awaiting {clubLabel} approval
                        </span>
                    ) : null}
                    {isRejectedPayment ? (
                        <p className="mt-1.5 text-[11px] text-red-400 line-clamp-2">
                            Payment not approved{item.paymentReviewNote ? `: ${item.paymentReviewNote}` : ''}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                {showCalendar && canDownloadTicket && (
                    <button
                        type="button"
                        onClick={() => onAddToCalendar(item)}
                        aria-label="Add to calendar"
                        title="Add to calendar"
                        className={`h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center transition-colors ${
                            isDark
                                ? 'bg-[#161718] border border-gray-700 text-[#0ECCEE] hover:bg-gray-800'
                                : 'bg-white border border-gray-200 text-[#0ECCEE] hover:bg-gray-50'
                        }`}
                    >
                        <CalendarPlus className="w-5 h-5" />
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => onViewBooking(item)}
                    className={`flex-1 h-11 rounded-2xl text-base font-medium font-inter leading-6 transition-colors ${
                        isDark
                            ? 'bg-[#161718] border border-[#0ECCEE] text-[#0ECCEE] hover:bg-[#0ECCEE]/10'
                            : 'bg-white border-[0.50px] border-[#0ECCEE] text-[#0ECCEE] hover:bg-[#0ECCEE]/5'
                    }`}
                >
                    View Booking
                </button>
                {canDownloadTicket ? (
                    <button
                        type="button"
                        onClick={() => onDownloadTicket(item)}
                        className="flex-1 h-11 rounded-2xl bg-[#0ECCEE] text-white text-base font-medium font-inter leading-6 hover:bg-[#0ECCEE]/90 transition-colors"
                    >
                        Download ticket
                    </button>
                ) : null}
            </div>
        </div>
    );
}

function Booking() {
    const { isDark } = useDarkMode();
    const { isAuthenticated, user, token } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [sportsRefreshFailed, setSportsRefreshFailed] = useState(false);
    const [activeTab, setActiveTab] = useState('upcoming');
    const [refreshTick, setRefreshTick] = useState(0);
    const [optimisticPending, setOptimisticPending] = useState(null);

    useEffect(() => {
        const pending = location.state?.pendingBooking;
        if (pending) {
            setOptimisticPending(pending);
            if (user) {
                const existing = readBookingsCache(user) || [];
                writeBookingsCache(user, mergeOptimisticPending(existing, pending));
            }
        }
        if (location.state?.refreshBookings || pending) {
            setRefreshTick((n) => n + 1);
            navigate(location.pathname + location.search, { replace: true, state: {} });
        }
    }, [location.state, location.pathname, location.search, navigate, user]);

    // Fetch user's registered events from backend API
    useEffect(() => {
        const fetchBookings = async () => {
            if (!isAuthenticated || !user) {
                setLoading(false);
                return;
            }

            const forceRefresh = refreshTick > 0 && !optimisticPending;
            const cached = forceRefresh ? null : readBookingsCache(user);
            if (cached) {
                setBookings(mergeOptimisticPending(cached, optimisticPending));
                setLoading(false);
            } else if (optimisticPending) {
                setBookings([optimisticPending]);
                setLoading(false);
            }

            try {
                if (!cached && !optimisticPending) setLoading(true);
                setError(null);
                const { bookings: all, sportsFailed } = await loadAllBookings(token);
                setSportsRefreshFailed(!!sportsFailed);
                const merged = mergeOptimisticPending(all, optimisticPending);
                setBookings(merged);
                writeBookingsCache(user, merged);
                if (optimisticPending && all.some((b) => String(b.id) === String(optimisticPending.id))) {
                    setOptimisticPending(null);
                }
            } catch (err) {
                console.warn('Error fetching bookings:', err);
                if (optimisticPending) {
                    setBookings((prev) => mergeOptimisticPending(prev.length ? prev : [], optimisticPending));
                    setError(null);
                } else if (cached?.length) {
                    setBookings(cached);
                    setError(null);
                } else {
                    setError(err.message);
                    setBookings([]);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, [isAuthenticated, user, token, refreshTick, optimisticPending]);

    // Refetch when tab becomes visible — must include sports (pending QR approvals)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden || !isAuthenticated || !user) return;
            loadAllBookings(token)
                .then(({ bookings: all, sportsFailed }) => {
                    setSportsRefreshFailed(!!sportsFailed);
                    const merged = mergeOptimisticPending(all, optimisticPending);
                    setBookings(merged);
                    writeBookingsCache(user, merged);
                })
                .catch((err) => console.warn('Error refetching bookings:', err));
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, user, token, optimisticPending]);

    const allBookings = [...bookings];

    const handleViewDetails = (item) => {
        if (!item.id) return;
        if (item.isTrek) {
            navigate(`/registration-details/${item.id}?type=trek`);
            return;
        }
        if (item.isSports) {
            navigate(`/registration-details/${item.id}?type=sports`, {
                state: item.registrationStatus === 'pending'
                    ? {
                        pendingApproval: {
                            clubName: item.clubName || 'The club',
                            eventName: item.name || 'your run',
                            registrationId: item.id,
                        },
                    }
                    : undefined,
            });
            return;
        }
        if (item.isEvent) {
            navigate(`/registration-details/${item.id}?type=event`);
            return;
        }
        navigate(`/registration-details/${item.id}`);
    };

    const handleDownloadTicket = (item) => {
        if (!item.id) return;
        const typeQuery = item.isTrek ? '?type=trek' : item.isSports ? '?type=sports' : item.isEvent ? '?type=event' : '';
        navigate(`/qr-ticket/${item.id}${typeQuery}`);
    };

    const handleAddToCalendar = (item) => {
        const url = buildGoogleCalendarUrl({
            title: item.name || 'Event',
            start: item.date,
            location: item.venue || '',
            details: `Your CrwdCtrl ${item.isTrek ? 'trek booking' : 'booking'}${
                item.festName ? ` — ${item.festName}` : ''
            }.`,
        });
        if (url) openExternalUrl(url);
    };

    const upcomingBookings = allBookings.filter((item) => !isEventCompleted(item));
    const completedBookings = allBookings.filter((item) => isEventCompleted(item));
    const visibleBookings = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

    const pageShellClass =
        'bookings-page crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 pb-24 lg:pb-8';

    usePageContentLoading(loading);

    if (!isAuthenticated) {
        return (
            <div className={`${pageShellClass} flex items-center justify-center px-4`}>
                <div className="text-center max-w-sm">
                    <h2 className={`text-2xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Log in to see your bookings
                    </h2>
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Your run bookings and tickets appear here after you sign in.
                    </p>
                    <button
                        type="button"
                        onClick={() => navigate('/login', { state: { from: '/booking' } })}
                        className="bg-[#0ECCEE] text-black px-6 py-3 rounded-xl font-semibold hover:opacity-90 transition"
                    >
                        Log in
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className={pageShellClass}>
                <BookingsPageLoadingSkeleton isDark={isDark} />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors duration-300 flex items-center justify-center">
                <div className="text-center">
                    <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>{error}</h2>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={pageShellClass}>
            <main className="px-4 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6 lg:px-8">
                <div
                    className={`mx-auto w-full max-w-md lg:max-w-2xl overflow-hidden rounded-2xl ${
                        isDark ? 'bg-[#161718]' : 'bg-white'
                    }`}
                >
                    <div className="px-4 pt-4">
                        <div className="pb-8">
                            <h1
                                className={`text-2xl font-medium font-inter leading-8 ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}
                            >
                                My Bookings
                            </h1>
                        </div>

                        {sportsRefreshFailed ? (
                            <div
                                className={`mb-4 flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-xs ${
                                    isDark
                                        ? 'bg-amber-500/10 border border-amber-500/25 text-amber-200'
                                        : 'bg-amber-50 border border-amber-200 text-amber-900'
                                }`}
                            >
                                <span>Couldn’t refresh run bookings.</span>
                                <button
                                    type="button"
                                    onClick={() => setRefreshTick((n) => n + 1)}
                                    className="shrink-0 font-semibold underline underline-offset-2"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : null}

                        <div className="flex items-end gap-6 px-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('upcoming')}
                                className={`h-11 min-w-32 rounded-t-2xl px-4 text-lg font-medium font-inter leading-7 tracking-wide transition-colors ${
                                    activeTab === 'upcoming'
                                        ? isDark
                                            ? 'text-[#0ECCEE]'
                                            : 'bg-white text-blue-700'
                                        : isDark
                                          ? 'text-gray-400 hover:text-gray-200'
                                          : 'text-gray-900 hover:text-blue-700'
                                }`}
                            >
                                Upcoming
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('completed')}
                                className={`h-11 min-w-32 rounded-t-2xl px-4 text-lg font-medium font-inter leading-7 tracking-wide transition-colors ${
                                    activeTab === 'completed'
                                        ? isDark
                                            ? 'text-[#0ECCEE]'
                                            : 'bg-white text-blue-700'
                                        : isDark
                                          ? 'text-gray-400 hover:text-gray-200'
                                          : 'text-gray-900 hover:text-blue-700'
                                }`}
                            >
                                Completed
                            </button>
                        </div>
                    </div>

                    <div
                        className={`px-2.5 py-6 sm:px-4 min-h-[420px] ${
                            isDark
                                ? ''
                                : `rounded-tr-2xl rounded-bl-2xl rounded-br-2xl ${
                                      activeTab === 'completed' ? 'rounded-tl-2xl' : ''
                                  } bg-white`
                        }`}
                    >
                        {visibleBookings.length > 0 ? (
                            <div className="space-y-4">
                                {visibleBookings.map((item) => (
                                    <BookingCard
                                        key={item.id}
                                        item={item}
                                        isDark={isDark}
                                        onViewBooking={handleViewDetails}
                                        onDownloadTicket={handleDownloadTicket}
                                        onAddToCalendar={handleAddToCalendar}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center">
                                <div className={`text-5xl mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'}`}>
                                    📅
                                </div>
                                <h3
                                    className={`text-lg font-medium font-inter mb-2 ${
                                        isDark ? 'text-gray-300' : 'text-gray-700'
                                    }`}
                                >
                                    {allBookings.length === 0
                                        ? 'No bookings yet'
                                        : activeTab === 'upcoming'
                                          ? 'No upcoming bookings'
                                          : 'No completed bookings'}
                                </h3>
                                <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                    {allBookings.length === 0
                                        ? 'Register for events to see them here'
                                        : activeTab === 'upcoming'
                                          ? 'Your past events will appear under Completed'
                                          : 'Completed events will show up here after the event date'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default Booking;
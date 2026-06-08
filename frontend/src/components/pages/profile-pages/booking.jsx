import { useState, useEffect } from 'react';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../../utils/imageImports';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CrwdCtrlLogin from '../login';
import CrwdCtrlRegister from '../register';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const formatEventDate = (date) => {
    if (!date) return 'Date TBA';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return String(date);
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isEventCompleted = (item) => {
    if (item.status === 'completed') return true;
    if (!item.date) return false;
    const eventDate = new Date(item.date);
    if (Number.isNaN(eventDate.getTime())) return false;
    eventDate.setHours(23, 59, 59, 999);
    return eventDate < new Date();
};

function BookingCard({ item, isDark, onViewBooking, onDownloadTicket, showDownload = true }) {
    return (
        <div
            className={`rounded-2xl border-[0.20px] p-3 sm:p-4 h-40 flex flex-col ${
                isDark ? 'border-gray-700 bg-[#111213]' : 'border-black/20 bg-white'
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
                            <span className="text-2xl">{item.isTrek ? '🏔️' : '🎉'}</span>
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
                </div>
            </div>

            <div className="flex gap-2 mt-3">
                <button
                    type="button"
                    onClick={() => onViewBooking(item)}
                    className={`flex-1 h-11 rounded-2xl text-base font-medium font-inter leading-6 transition-colors ${
                        isDark
                            ? 'bg-[#111213] border border-[#0ECCEE] text-[#0ECCEE] hover:bg-[#0ECCEE]/10'
                            : 'bg-white border-[0.50px] border-[#0ECCEE] text-[#0ECCEE] hover:bg-[#0ECCEE]/5'
                    }`}
                >
                    View Booking
                </button>
                {showDownload ? (
                    <button
                        type="button"
                        onClick={() => onDownloadTicket(item)}
                        className="flex-1 h-11 rounded-2xl bg-[#0ECCEE] text-black text-base font-medium font-inter leading-6 hover:bg-[#0ECCEE]/90 transition-colors"
                    >
                        Download ticket
                    </button>
                ) : (
                    <span
                        className={`flex-1 h-11 rounded-2xl flex items-center justify-center text-sm font-medium ${
                            isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'
                        }`}
                    >
                        Confirmed
                    </span>
                )}
            </div>
        </div>
    );
}

function Booking() {
    const { isDark } = useDarkMode();
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('upcoming');

    // Fetch user's registered events from backend API
    useEffect(() => {
        const fetchBookings = async () => {
            if (!isAuthenticated || !user) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);
                
                const token = localStorage.getItem('crwdctrl_token');
                
                // Fetch internal form registrations with cache-busting
                const registrationsResponse = await fetch(`${API_BASE_URL}/registrations/my-registrations?t=${Date.now()}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (!registrationsResponse.ok) {
                    if (registrationsResponse.status === 401) {
                        throw new Error('Authentication failed. Please log in again.');
                    }
                    throw new Error(`Failed to fetch registrations (${registrationsResponse.status})`);
                }
                
                const registrationsData = await registrationsResponse.json();
                const internalRegistrations = registrationsData.registrations || [];
                const trekBookings = registrationsData.trekBookings || [];

                // Transform fest/competition registrations
                const transformedFests = internalRegistrations.map(reg => {
                    const isCompetitionRegistration = !!(reg.competitionId && reg.competitionId._id);
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
                            paymentAmount: reg.competitionId?.registrationFee || reg.fest?.ticketPrice || 'N/A',
                            registeredAt: reg.submittedAt
                        };
                    } else {
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
                            paymentAmount: reg.fest?.ticketPrice || 'N/A',
                            registeredAt: reg.submittedAt
                        };
                    }
                });

                // Transform trek bookings
                const transformedTreks = trekBookings.map(booking => ({
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
                    people: booking.bookingDetails?.people || 1,
                    amountPaid: booking.bookingDetails?.amountPaid || 0,
                    paymentId: booking.bookingDetails?.paymentId || '',
                    difficulty: booking.trekId?.difficultyLevel || '',
                    registeredAt: booking.createdAt
                }));

                const all = [...transformedFests, ...transformedTreks]
                    .sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
                setBookings(all);
            } catch (err) {
                console.error('Error fetching bookings:', err);
                setError(err.message);
                setBookings([]);
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, [isAuthenticated, user]);

    // Refetch data when component becomes visible (user navigates back)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (!document.hidden && isAuthenticated && user) {
                // Refetch data when page becomes visible
                const fetchData = async () => {
                    try {
                        const registrationsResponse = await fetch(`${API_BASE_URL}/registrations/my-registrations`, {
                            headers: {
                                'Authorization': `Bearer ${localStorage.getItem('crwdctrl_token')}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        
                        if (registrationsResponse.ok) {
                            const registrationsData = await registrationsResponse.json();
                            const internalRegistrations = registrationsData.registrations || [];
                            
                            const transformedFests = internalRegistrations.map(reg => {
                                // Check if this is a competition registration
                                const isCompetitionRegistration = !!reg.competitionId;
                                
                                if (isCompetitionRegistration) {
                                    // Show competition card
                                    return {
                                        id: reg._id, // Use registration ID for details
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
                                        isCompetition: true
                                    };
                                } else {
                                    // Show fest card
                                    return {
                                        id: reg._id, // Use registration ID for details
                                        name: reg.fest?.festName,
                                        image: reg.fest?.coverImage,
                                        date: reg.fest?.festDate,
                                        venue: reg.fest?.venue,
                                        type: 'fest',
                                        collegeName: reg.fest?.collegeName,
                                        status: reg.fest?.status || 'upcoming',
                                        registrationStatus: reg.status,
                                        registrationType: 'internal',
                                        isCompetition: false
                                    };
                                }
                            });
                            
                            const trekBookings = registrationsData.trekBookings || [];
                            const transformedTreks = trekBookings.map(booking => ({
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
                                people: booking.bookingDetails?.people || 1,
                                amountPaid: booking.bookingDetails?.amountPaid || 0,
                            }));
                            const all = [...transformedFests, ...transformedTreks]
                                .sort((a, b) => new Date(b.registeredAt || 0) - new Date(a.registeredAt || 0));
                            setBookings(all);
                        }
                    } catch (err) {
                        console.warn('Error refetching bookings:', err);
                    }
                };
                
                fetchData();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isAuthenticated, user]);

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // ✅ CRITICAL FIX: Auto-close login modal when user becomes authenticated
    useEffect(() => {
        if (isAuthenticated && showLogin) {
            console.log('✅ User authenticated, closing login modal in booking');
            setShowLogin(false);
        }
        if (isAuthenticated && showRegister) {
            console.log('✅ User authenticated, closing register modal in booking');
            setShowRegister(false);
        }
    }, [isAuthenticated, showLogin, showRegister]);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({}); // Clear URL parameters
    };

    // Handle register modal close
    const handleCloseRegister = () => {
        setShowRegister(false);
    };

    // Switch from login to register
    const handleSwitchToRegister = () => {
        setShowLogin(false);
        setShowRegister(true);
    };

    // Switch from register to login
    const handleSwitchToLogin = () => {
        setShowRegister(false);
        setShowLogin(true);
    };

    // Use backend data if available, otherwise fall back to context data
    const allBookings = [...bookings];

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleViewDetails = (item) => {
        if (item.id) {
            navigate(`/registration-details/${item.id}`);
        }
    };

    const handleDownloadTicket = (item) => {
        if (item.id) {
            navigate(`/qr-ticket/${item.id}`);
        }
    };

    const upcomingBookings = allBookings.filter((item) => !isEventCompleted(item));
    const completedBookings = allBookings.filter((item) => isEventCompleted(item));
    const visibleBookings = activeTab === 'upcoming' ? upcomingBookings : completedBookings;

    // Loading state
    if (loading) {
        return (
            <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading bookings...</h2>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} flex items-center justify-center`}>
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
        <div
            className={`min-h-screen transition-colors duration-300 pb-24 lg:pb-8 ${
                isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'
            }`}
        >
            <main className="px-4 pt-4 sm:px-6 lg:px-8">
                <div className="mx-auto w-full max-w-md lg:max-w-2xl overflow-hidden rounded-2xl">
                    {/* Header + tabs — Figma: slate-100 shell */}
                    <div
                        className={`px-4 pt-4 ${
                            isDark ? 'bg-[#111213]' : 'bg-slate-100'
                        }`}
                    >
                        <div className="flex items-center gap-4 pb-8">
                            <button
                                type="button"
                                onClick={handleGoBack}
                                className={`size-8 rounded-full flex items-center justify-center transition-colors ${
                                    isDark ? 'bg-[#161718] hover:bg-gray-800' : 'bg-white hover:bg-gray-50'
                                }`}
                                title="Go back"
                            >
                                <ArrowLeft className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                            </button>
                            <h1
                                className={`text-2xl font-medium font-inter leading-8 ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}
                            >
                                My Bookings
                            </h1>
                        </div>

                        <div className="flex items-end gap-6 px-2">
                            <button
                                type="button"
                                onClick={() => setActiveTab('upcoming')}
                                className={`h-11 min-w-32 rounded-t-2xl px-4 text-lg font-medium font-inter leading-7 tracking-wide transition-colors ${
                                    activeTab === 'upcoming'
                                        ? isDark
                                            ? 'bg-[#161718] text-blue-400'
                                            : 'bg-[#F5F6FA] text-blue-700'
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
                                            ? 'bg-[#161718] text-blue-400'
                                            : 'bg-[#F5F6FA] text-blue-700'
                                        : isDark
                                          ? 'text-gray-400 hover:text-gray-200'
                                          : 'text-gray-900 hover:text-blue-700'
                                }`}
                            >
                                Completed
                            </button>
                        </div>
                    </div>

                    {/* Content panel — Figma: card-bg with connected corners */}
                    <div
                        className={`px-2.5 py-6 sm:px-4 min-h-[420px] rounded-tr-2xl rounded-bl-2xl rounded-br-2xl ${
                            activeTab === 'completed' ? 'rounded-tl-2xl' : ''
                        } ${isDark ? 'bg-[#161718]' : 'bg-[#F5F6FA]'}`}
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
                                        showDownload={!item.isTrek}
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

            {/* Login Modal */}
            {showLogin && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                </div>
            )}

            {/* Register Modal */}
            {showRegister && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}
        </div>
    );
}

export default Booking;
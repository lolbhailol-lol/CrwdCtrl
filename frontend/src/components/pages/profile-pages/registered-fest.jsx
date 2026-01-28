import { useState, useEffect } from 'react';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../../utils/imageImports';
import Footer from '../../Footer';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CrwdCtrlLogin from '../login';
import CrwdCtrlRegister from '../register';

// Configure API base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

function RegisteredFest() {
    const { isDark } = useDarkMode();
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [registeredFests, setRegisteredFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch user's registered events from backend API
    useEffect(() => {
        const fetchRegisteredEvents = async () => {
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
                
                console.log('🔍 Raw registrations received:', internalRegistrations.length);
                internalRegistrations.forEach((reg, i) => {
                    console.log(`Registration ${i + 1}:`, {
                        id: reg._id,
                        hasCompetitionId: !!reg.competitionId,
                        competitionName: reg.competitionId?.name,
                        festName: reg.fest?.festName
                    });
                });
                
                // Transform internal registrations to match structure
                const transformedFests = internalRegistrations.map(reg => {
                    // Check if this is a competition registration
                    const isCompetitionRegistration = !!(reg.competitionId && reg.competitionId._id);
                    
                    console.log(`🔄 Processing registration ${reg._id}:`, {
                        isCompetitionRegistration,
                        competitionId: reg.competitionId?._id,
                        competitionName: reg.competitionId?.name,
                        festName: reg.fest?.festName,
                        hasCompetitionData: !!reg.competitionId
                    });
                    
                    if (isCompetitionRegistration) {
                        // Show competition card
                        const competitionName = reg.competitionId?.name || `Competition ID: ${reg.competitionId?._id || 'Unknown'}`;
                        const competitionCard = {
                            id: reg._id, // Use registration ID for details
                            name: competitionName,
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
                        console.log('🏆 Competition registration found:', competitionName, 'ID:', reg._id);
                        return competitionCard;
                    } else {
                        // Show fest card
                        const festCard = {
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
                        console.log('🎪 Fest registration found:', festCard.name, 'ID:', reg._id);
                        return festCard;
                    }
                });
                
                console.log(`✅ Transformed ${transformedFests.length} registrations:`, 
                    transformedFests.filter(card => card.isCompetition).length + ' competitions, ' +
                    transformedFests.filter(card => !card.isCompetition).length + ' fests'
                );
                
                setRegisteredFests(transformedFests);
            } catch (err) {
                console.error('Error fetching registered events:', err);
                setError(err.message);
                setRegisteredFests([]);
            } finally {
                setLoading(false);
            }
        };

        fetchRegisteredEvents();
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
                            
                            setRegisteredFests(transformedFests);
                        }
                    } catch (err) {
                        console.warn('Error refetching registered events:', err);
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
            console.log('✅ User authenticated, closing login modal in registered-fest');
            setShowLogin(false);
        }
        if (isAuthenticated && showRegister) {
            console.log('✅ User authenticated, closing register modal in registered-fest');
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
    const allFests = [...registeredFests];

    const handleGoBack = () => {
        navigate(-1);
    };

    const handleViewDetails = (item) => {
        // Navigate to registration details page
        console.log('🔍 Navigating to registration details for item:', item);
        if (item.id) {
            console.log('🔗 Navigation URL:', `/registration-details/${item.id}`);
            navigate(`/registration-details/${item.id}`);
        } else {
            console.error('❌ No ID found for item:', item);
        }
    };

    // Loading state
    if (loading) {
        return (
            <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading registered events...</h2>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} flex items-center justify-center`}>
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
        <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'
            }`}>
            <div className={`transition-all duration-300`}>

                <main className="p-6 lg:p-8 pb-32 md:pb-8">
                    {/* Header with Back Button */}
                    <div className="flex items-center mb-6 md:mb-8">
                        <h1 className={`text-2xl md:text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                            Events
                        </h1>
                    </div>

                    {/* Registered Events */}
                    <div className={`max-w-6xl mx-auto ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#F5F6FA]'
                        } rounded-lg p-4 md:p-8`}>
                        <div className={`flex gap-4 md:gap-8 mb-6 md:mb-8 border-b ${isDark ? 'border-[#0E0E0F]' : 'border-gray-200'
                            }`}>
                            <div className="pb-3 px-2 font-semibold text-base md:text-lg text-blue-600 border-b-2 border-blue-600">
                                <span>Registered Events</span>
                                <span className="ml-1">({allFests.length})</span>
                            </div>
                        </div>

                        {/* Events List */}
                        {allFests.length > 0 ? (
                            <div className="space-y-4">
                                {allFests.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`flex items-center p-4 rounded-lg border transition-all duration-300 hover:shadow-md ${
                                            isDark 
                                                ? 'bg-[#1B1C1E] border-gray-700 hover:border-gray-600' 
                                                : 'bg-white border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        {/* Event Image */}
                                        <div className="flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-lg overflow-hidden mr-4">
                                            {item.image ? (
                                                <img
                                                    src={getImageUrl(item.image)}
                                                    alt={item.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        handleImageErrorWithFallback(e, 80, 80, '#6366f1', item.name || 'Event');
                                                    }}
                                                />
                                            ) : (
                                                <div className={`w-full h-full ${isDark ? 'bg-gradient-to-br from-gray-800 to-gray-900' : 'bg-gradient-to-br from-gray-100 to-gray-200'} flex items-center justify-center`}>
                                                    <span className={`text-2xl ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>🎉</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Event Details */}
                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-grow min-w-0 mr-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <h3 className={`text-lg font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {item.name}
                                                        </h3>
                                                        {item.isCompetition && (
                                                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                                                                isDark 
                                                                    ? 'bg-purple-900 text-purple-300' 
                                                                    : 'bg-purple-100 text-purple-800'
                                                            }`}>
                                                                Competition
                                                            </span>
                                                        )}
                                                    </div>
                                                    {item.isCompetition && item.festName && (
                                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                                                            🏆 Part of {item.festName}
                                                        </p>
                                                    )}
                                                    <div className="flex flex-wrap items-center gap-2 text-sm">
                                                        {item.date && (
                                                            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                📅 {item.date}
                                                            </span>
                                                        )}
                                                        {item.venue && (
                                                            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                📍 {item.venue}
                                                            </span>
                                                        )}
                                                        {item.collegeName && (
                                                            <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                🏫 {item.collegeName}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex-shrink-0 flex items-center gap-2 ml-4">
                               
                                            {/* View Details Button */}
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleViewDetails(item);
                                                }}
                                                className="bg-cyan-500 hover:bg-cyan-600 text-white font-medium text-sm px-4 py-2 rounded-lg transition"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 md:py-16">
                                <div className={`text-6xl mb-4 ${isDark ? 'text-gray-600' : 'text-gray-300'
                                    }`}>
                                    📅
                                </div>
                                <h3 className={`text-xl font-semibold mb-2 ${isDark ? 'text-gray-300' : 'text-gray-600'
                                    }`}>
                                    No Events Registered
                                </h3>
                                <p className={`${isDark ? 'text-gray-500' : 'text-gray-500'
                                    }`}>
                                    Register for events to see them here
                                </p>
                            </div>
                        )}
                    </div>
                </main>
            </div>

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

export default RegisteredFest;
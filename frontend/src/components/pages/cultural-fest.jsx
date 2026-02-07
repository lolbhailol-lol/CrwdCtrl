import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Share2, ArrowLeft, Search } from 'lucide-react';
import ShareIcon from '../../assets/share.svg';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import Footer from '../Footer';
import ProfileSidebar from '../ProfileSidebar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import FestCard from '../FestCard';
import CrwdCtrlLogin from './login';
import CrwdCtrlRegister from './register';
import axios from 'axios';

// Configure axios base URL - Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.baseURL = API_BASE_URL;

// ✅ FIX FOR iOS/SAFARI: Configure axios defaults for cross-origin requests
axios.defaults.withCredentials = false;
axios.defaults.headers.common['Accept'] = 'application/json';

console.log('🔧 cultural-fest - API_BASE_URL:', API_BASE_URL);

function CulturalFestPage() {
    const { toggleFavorite, isFavorite } = useFavorites();
    const { isAuthenticated } = useAuth();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const [fests, setFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Function to fetch cultural fests
    const fetchCulturalFests = async () => {
        try {
            setLoading(true);
            setError(null);
            
            // ✅ iOS/Safari compatibility - longer timeout
            const userAgent = navigator.userAgent || '';
            const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
            const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
            const timeout = (isIOS || isSafari) ? 20000 : 10000;
            
            // Add cache busting parameter to ensure fresh data
            const response = await axios.get(`/fests/all?t=${Date.now()}`, {
                timeout: timeout,
                withCredentials: false,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            const data = response.data;
            const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
            
            // Filter for cultural fests only and exclude last year hits
            const culturalFests = festsList.filter(fest => 
                fest.festType === 'cultural' && fest.status !== 'lastyearhit'
            );
            
            // Transform data to match expected structure
            const transformedFests = culturalFests.map(fest => ({
                id: fest._id || fest.id,
                title: fest.festName,
                subtitle: `${fest.festDate} • ${fest.collegeName}`,
                image: fest.coverImage,
                type: 'Cultural Fest',
                venue: fest.venue,
                dateTime: fest.festDate,
                description: fest.description,
                status: fest.status,
                trending: false
            }));
            
            setFests(transformedFests);
        } catch (err) {
            console.error('Error fetching cultural fests:', err);
            setError('Failed to load cultural fests');
            setFests([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch cultural fests on component mount
    useEffect(() => {
        fetchCulturalFests();
    }, []);

    // 🔄 Listen for admin updates and refetch data
    useEffect(() => {
        const handleAdminUpdate = () => {
            console.log('🔄 Admin update detected - refetching cultural fests');
            fetchCulturalFests();
        };

        // Listen for custom event from admin
        window.addEventListener('admin_fest_updated', handleAdminUpdate);

        // Also listen for localStorage changes (cross-tab updates)
        const handleStorageChange = (e) => {
            if (e.key === 'admin_data_updated') {
                console.log('🔄 Admin update detected (cross-tab) - refetching cultural fests');
                fetchCulturalFests();
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('admin_fest_updated', handleAdminUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

    // ✅ CRITICAL FIX: Auto-close login/register modal when user becomes authenticated
    // This is essential for phone login which uses redirect-based authentication
    useEffect(() => {
        if (isAuthenticated && showLogin) {
            console.log('✅ User authenticated, closing login modal in cultural-fest');
            setShowLogin(false);
            setSearchParams({});
        }
        if (isAuthenticated && showRegister) {
            console.log('✅ User authenticated, closing register modal in cultural-fest');
            setShowRegister(false);
        }
    }, [isAuthenticated, showLogin, showRegister, setSearchParams]);

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

    const handleToggleFavorite = (fest) => {
        // Splitting subtitle to get date and venue information
        const subtitleParts = fest.subtitle?.split('•').map(s => s.trim()) || [];
        const dateTime = subtitleParts[0] || 'Date TBA';
        const venue = subtitleParts[1] || 'Venue TBA';

        const eventData = {
            id: fest.id,
            title: fest.title,
            subtitle: fest.subtitle,
            image: fest.image,
            type: 'Cultural Fest',
            venue: venue,
            dateTime: dateTime,
            trending: false
        };
        toggleFavorite(fest.id, eventData);
    };

    const handleViewDetails = (fest) => {
        // Navigate to the view-details page with the specific event ID
        navigate(`/view-details/${fest.id}`);
    };

    // Loading state
    if (loading) {
        return (
            <div className={`min-h-screen flex transition-colors ${isDark ? 'bg-dark-950' : 'bg-white'}`}>
                <div className="flex flex-1 flex-col items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mb-4"></div>
                    <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading cultural fests...</h2>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className={`min-h-screen flex transition-colors ${isDark ? 'bg-dark-950' : 'bg-white'}`}>
                <div className="flex flex-1 flex-col items-center justify-center">
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
        <div className={`min-h-screen flex transition-colors ${isDark ? 'bg-dark-950' : 'bg-white'}`}>
            <div className={`flex flex-1 flex-col transition-all duration-300 ${isProfileOpen ? 'blur-sm' : ''}`}>

                {/* Mobile Header with Back Button and Title - Only visible on mobile */}
                <div className="md:hidden flex items-center justify-between p-4 pb-2">
                    <div className="flex items-center">
                        <button
                            onClick={() => navigate(-1)}
                            className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors mr-3 ${isDark
                                ? 'bg-gray-800 hover:bg-gray-700 text-white'
                                : 'bg-white hover:bg-gray-50 text-gray-900  border-gray-200'
                                }`}
                            aria-label="Go back"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Cultural Fests</h1>
                    </div>
                    <button
                        className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${isDark
                            ? 'bg-gray-800 hover:bg-gray-700 text-white'
                            : 'bg-white hover:bg-gray-50 text-gray-900  border-gray-200'
                            }`}
                        aria-label="Search"
                    >
                        <Search className="w-5 h-5" />
                    </button>
                </div>

                <main className="flex-1 p-4 sm:p-6 md:pt-6 pt-2">
                    {/* Desktop Title - Hidden on mobile */}
                    <h1 className={`hidden md:block text-xl sm:text-2xl font-semibold mb-6 sm:mb-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>Cultural Fests</h1>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 pt-8">
                        {fests.length > 0 ? (
                            fests.map(fest => {
                                const subtitleParts = fest.subtitle?.split('•').map(s => s.trim()) || [];
                                const dateTime = subtitleParts[0] || 'Date TBA';
                                const venue = subtitleParts[1] || 'Venue TBA';

                                return (
                                    <FestCard
                                        key={fest.id}
                                        image={fest.image}
                                        title={fest.title}
                                        subtitle={dateTime}
                                        venue={venue}
                                        emoji={fest.emoji}
                                        eventId={fest.id}
                                        status={fest.status}
                                        isFavorite={isFavorite(fest.id)}
                                        onToggleFavorite={() => handleToggleFavorite(fest)}
                                        onViewDetails={() => handleViewDetails(fest)}
                                        isDark={isDark}
                                    />
                                );
                            })
                        ) : (
                            <div className={`col-span-full text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                <div className="text-4xl mb-2">📅</div>
                                <p className="text-lg">No upcoming events available</p>
                            </div>
                        )}
                    </div>
                </main>

                {/* Footer - Hidden on mobile */}
                <div className={`hidden md:block mt-16 transition-all duration-300  ${isProfileOpen ? 'blur-sm' : ''}`}>
                    <Footer />
                </div>
            </div>

            {/* Profile Sidebar */}
            <ProfileSidebar
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                onShowLogin={() => setShowLogin(true)}
                onShowRegister={() => setShowRegister(true)}
            />

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

export default CulturalFestPage;
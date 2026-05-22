import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, ChevronRight, ChevronLeft, Bell, User, Search, Calendar, MapPin, Instagram, Navigation, X, Loader2, Zap, Clock } from 'lucide-react';
import ShareIcon from '../../assets/share.svg';
import Logo from '../../assets/logo01_.svg';
import CulturalFestImage from '../../assets/mobile-icons/cultural-events-icon-02.svg';
import TechFestImage from '../../assets/mobile-icons/tech-icon.svg';
import SportsFestImage from '../../assets/mobile-icons/sports-icon.svg';
import SportsIconNew from '../../assets/mobile-icons/sports-icon-new.svg';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { handleImageError, generateFallbackImage } from '../../utils/imageUtils';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../utils/imageImports';
import { searchFests, searchAll } from '../../services/searchService';
import CrwdCtrlLogin from './login';
import { useAuth } from '../../context/AuthContext';
import CrwdCtrlRegister from './register';
import LoadingSkeleton from '../LoadingSkeleton';
import HeroBanner from '../HeroBanner';
import HomeCategoryBar from '../HomeCategoryBar';
import TrendingCard from '../TrendingCard';
import HappeningCard from '../HappeningCard';
// âœ… FIX: Use native fetch instead of axios (axios XMLHttpRequest causes ERR_NETWORK on mobile)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

console.log('ðŸ”§ Dashboard API Configuration:', {
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    API_BASE_URL: API_BASE_URL,
    MODE: import.meta.env.MODE
});

// âœ… Fetch helper that works reliably on all mobile browsers
const fetchJSON = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const timeout = options.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            method: 'GET',
            credentials: 'omit',
            mode: 'cors',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            signal: controller.signal,
            ...options,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { data, headers: Object.fromEntries(response.headers.entries()) };
    } catch (err) {
        clearTimeout(timeoutId);
        if (err.name === 'AbortError') {
            const error = new Error('Request timeout');
            error.code = 'ECONNABORTED';
            throw error;
        }
        if (err.message === 'Failed to fetch' || err.name === 'TypeError') {
            const error = new Error('Network Error');
            error.code = 'ERR_NETWORK';
            throw error;
        }
        throw err;
    }
};

// âœ… Auto-retry error component â€” automatically retries after 5 seconds
const AutoRetryError = React.memo(({ isDark, onRetry }) => {
    const [countdown, setCountdown] = useState(5);
    const [isRetrying, setIsRetrying] = useState(false);

    useEffect(() => {
        if (isRetrying) return;
        if (countdown <= 0) {
            setIsRetrying(true);
            onRetry();
            return;
        }
        const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown, isRetrying, onRetry]);

    return (
        <div className={`text-center py-8 px-4 rounded-xl ${isDark ? 'bg-[#111213]' : 'bg-gray-100'}`}>
            <div className="text-4xl mb-3">{isRetrying ? 'â³' : 'ðŸ“¡'}</div>
            <p className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {isRetrying ? 'Loading events...' : 'Connecting to server...'}
            </p>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {isRetrying
                    ? 'Please wait while we connect to the server'
                    : `Retrying automatically in ${countdown}s...`}
            </p>
            {isRetrying ? (
                <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
                </div>
            ) : (
                <button
                    onClick={() => { setIsRetrying(true); onRetry(); }}
                    className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-sm font-medium"
                >
                    Try Now
                </button>
            )}
        </div>
    );
});

// âœ… Frontend caching system for better Cloud Run performance
const CACHE_KEYS = {
    FESTS_LIST: 'crwdctrl_fests_cache',
    FESTS_TIMESTAMP: 'crwdctrl_fests_timestamp'
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes — admin changes reflect quickly

// Helper functions for localStorage caching
const getCachedData = (key) => {
    try {
        const cached = localStorage.getItem(key);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Error reading cache:', error);
        return null;
    }
};

const setCachedData = (key, data) => {
    try {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem(CACHE_KEYS.FESTS_TIMESTAMP, Date.now().toString());
        console.log('ðŸ’¾ Cached fests data to localStorage');
    } catch (error) {
        console.error('Error setting cache:', error);
    }
};

const isCacheValid = () => {
    try {
        const timestamp = localStorage.getItem(CACHE_KEYS.FESTS_TIMESTAMP);
        if (!timestamp) return false;
        
        const age = Date.now() - parseInt(timestamp);
        return age < CACHE_DURATION;
    } catch (error) {
        console.error('Error checking cache validity:', error);
        return false;
    }
};

const clearCache = () => {
    try {
        localStorage.removeItem(CACHE_KEYS.FESTS_LIST);
        localStorage.removeItem(CACHE_KEYS.FESTS_TIMESTAMP);
        console.log('ðŸ—‘ï¸ Cleared fests cache');
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
};

// Status badge styling function - Same as FestCard
const getStatusBadgeStyle = (status) => {
    switch (status) {
        case 'ongoing':
            return {
                gradient: 'bg-gradient-to-r from-green-500 to-emerald-600',
                glow: 'shadow-green-500/30',
                icon: Zap
            };
        case 'upcoming':
            return {
                gradient: 'bg-gradient-to-r from-orange-500 to-amber-600',
                glow: 'shadow-orange-500/30',
                icon: Clock
            };
        case 'completed':
            return {
                gradient: 'bg-gradient-to-r from-gray-500 to-slate-600',
                glow: 'shadow-gray-500/20',
                icon: Clock
            };
        case 'beyondcampus':
            return {
                gradient: 'bg-gradient-to-r from-green-500 to-emerald-600',
                glow: 'shadow-green-500/30',
                icon: Zap
            };
        case 'lastyearhit':
            return {
                gradient: 'bg-gradient-to-r from-purple-500 to-violet-600',
                glow: 'shadow-purple-500/30',
                icon: Zap
            };
        default:
            return {
                gradient: 'bg-gradient-to-r from-orange-500 to-amber-600',
                glow: 'shadow-orange-500/30',
                icon: Clock
            };
    }
};
const ArtistCard = React.memo(({ eventId, image, artistName, genre, collegeName, venue, dateTime, ticketPrice, isDark, onRegister, onToggleFavorite, isFavorite }) => {
    const navigate = useNavigate();
    const [imageError, setImageError] = useState(false);
    const [imageLoading, setImageLoading] = useState(true);

    const handleImageError = (e) => {
        handleImageErrorWithFallback(e, 240, 170, '#6366f1', artistName || 'Event');
        setImageError(true);
        setImageLoading(false);
    };

    const handleImageLoad = () => {
        setImageLoading(false);
    };

    const handleCardClick = () => {
        navigate(`/view-details/${eventId}`);
    };

    return (
        <div
            onClick={handleCardClick}
            className={`min-w-[280px] sm:min-w-[300px] w-[280px] sm:w-[300px] flex-shrink-0 rounded-xl overflow-hidden duration-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer
    ${isDark
                    ? 'bg-[#111213]'
                    : 'bg-[#EDEDF2]'
                }`}
            style={{
                // iOS Safari specific fixes
                WebkitTransform: 'translateZ(0)',
                transform: 'translateZ(0)',
                WebkitBackfaceVisibility: 'hidden',
                backfaceVisibility: 'hidden',
                WebkitPerspective: '1000px',
                perspective: '1000px'
            }}
        >

            <div
                className="relative h-[180px] sm:h-[200px] overflow-hidden rounded-t-xl"
                style={{
                    // iOS Safari image container fixes
                    WebkitTransform: 'translateZ(0)',
                    transform: 'translateZ(0)',
                    WebkitBackfaceVisibility: 'hidden',
                    backfaceVisibility: 'hidden',
                    aspectRatio: '16/9',
                    WebkitAspectRatio: '16/9'
                }}
            >
                {/* Loading placeholder */}
                {imageLoading && (
                    <div className={`absolute inset-0 flex items-center justify-center ${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-200'}`}>
                        <div className="animate-pulse text-center">
                            <div className={`w-8 h-8 rounded-full mx-auto mb-2 ${isDark ? 'bg-gray-800' : 'bg-gray-300'}`}></div>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Loading...</p>
                        </div>
                    </div>
                )}

                {/* Error fallback */}
                {imageError ? (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-200'}`}>
                        <div className="text-center">
                            <div className={`text-4xl mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>ðŸŽ­</div>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Image unavailable</p>
                        </div>
                    </div>
                ) : (
                    <img
                        src={getImageUrl(image)}
                        alt={artistName || 'Event image'}
                        className="w-full h-full object-cover transition-transform duration-300"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        style={{
                            display: imageLoading ? 'none' : 'block',
                            // iOS Safari image fixes
                            WebkitTransform: 'translateZ(0)',
                            transform: 'translateZ(0)',
                            WebkitBackfaceVisibility: 'hidden',
                            backfaceVisibility: 'hidden',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            WebkitTouchCallout: 'none',
                            touchAction: 'manipulation',
                            objectPosition: 'center center',
                            maxWidth: '100%',
                            height: '100%'
                        }}
                    />
                )}

                {/* Heart Button with Premium Glass Effect - Same as FestCard */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite();
                    }}
                    className={`absolute top-2 sm:top-3 right-2 sm:right-3 w-7 sm:w-9 h-7 sm:h-9 rounded-full z-20
                               transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                               hover:scale-110 active:scale-95
                               ${isDark 
                                   ? 'bg-black/30 hover:bg-black/40 backdrop-blur-2xl border-2 border-white/30' 
                                   : 'bg-white/50 hover:bg-white/70 backdrop-blur-2xl border-2 border-white/60'
                               }
                               shadow-xl hover:shadow-2xl
                               ${isFavorite 
                                   ? 'shadow-red-500/40 border-red-500/60 bg-red-500/20' 
                                   : ''
                               }`}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart
                        className={`w-3.5 sm:w-4 h-3.5 sm:h-4 mx-auto transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]
                                   ${isFavorite
                                       ? 'text-red-500 fill-red-500 scale-110 animate-pulse' 
                                       : isDark 
                                           ? 'text-white hover:text-red-400 hover:scale-110' 
                                           : 'text-gray-800 hover:text-red-500 hover:scale-110'
                                   }`}
                    />
                </button>

            </div>

            <div className={`p-3 sm:p-4 ${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'}`}>
                {/* Artist Name */}
                <div className="mb-2">
                    <h3 className={`text-base sm:text-lg font-bold mb-1 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {artistName}
                    </h3>
                    <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {genre}
                    </p>
                </div>

                {/* Event Details */}
                <div className="space-y-1.5 mb-3">
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <p className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {collegeName}
                            </p>
                            <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-900'}`}>
                                {dateTime}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
});

const Dashboard = () => {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();
    const { isAuthenticated, isAuthProcessing, isLoading, isRedirectProcessing } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [error, setError] = useState(null);
    const [fests, setFests] = useState([]);
    const [isFestsLoading, setIsFestsLoading] = useState(true);
    const [homeCommunities, setHomeCommunities] = useState([]);
    const [homeTreks, setHomeTreks] = useState([]);
    const [festError, setFestError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const [currentLocation, setCurrentLocation] = useState({
        city: 'Pune', // Default fallback
        state: 'Maharashtra',
        country: 'India',
        isDetecting: false,
        hasPermission: false,
        coordinates: null
    });
    const ongoingScrollRef = useRef(null);
    const beyondCampusScrollRef = useRef(null);
    const upcomingScrollRef = useRef(null);
    const lastYearScrollRef = useRef(null);
    const searchRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    
    // State for arrow visibility
    const [ongoingShowLeftArrow, setOngoingShowLeftArrow] = useState(false);
    const [ongoingShowRightArrow, setOngoingShowRightArrow] = useState(true);
    const [beyondCampusShowLeftArrow, setBeyondCampusShowLeftArrow] = useState(false);
    const [beyondCampusShowRightArrow, setBeyondCampusShowRightArrow] = useState(true);
    const [upcomingShowLeftArrow, setUpcomingShowLeftArrow] = useState(false);
    const [upcomingShowRightArrow, setUpcomingShowRightArrow] = useState(true);
    const [lastYearShowLeftArrow, setLastYearShowLeftArrow] = useState(false);
    const [lastYearShowRightArrow, setLastYearShowRightArrow] = useState(true);

    // Refetch treks and communities without cache
    const refreshTreksAndComms = useCallback(() => {
        const cb = Date.now();
        fetchJSON(`/trek-communities?_cb=${cb}`).then(res => {
            const list = Array.isArray(res?.data?.communities) ? res.data.communities : [];
            setHomeCommunities(list);
        }).catch(() => {});
        fetchJSON(`/treks?_cb=${cb}`).then(res => {
            const list = Array.isArray(res?.data?.treks) ? res.data.treks : [];
            setHomeTreks(list);
        }).catch(() => {});
    }, []);

    // Function to force refresh data (clear cache and fetch fresh) — retries for cold starts
    const forceRefreshData = useCallback(() => {
        console.log('ðŸ”„ Force refreshing dashboard data...');
        clearCache();
        setIsFestsLoading(true);
        setFestError(null);
        refreshTreksAndComms();

        const fetchFreshData = async (attempt = 0) => {
            const maxAttempts = 8;
            try {
                const cacheBuster = Date.now();
                const response = await fetchJSON(`/fests/all?_cb=${cacheBuster}&force_refresh=1`, {
                    timeout: 15000
                });
                
                const data = response.data;
                const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                
                setFests(festsList);
                setFestError(null);
                
                if (festsList.length > 0) {
                    setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                }
                
                setIsFestsLoading(false);
                console.log('âœ… Dashboard data refreshed successfully');
            } catch (error) {
                console.error(`âŒ Refresh attempt ${attempt + 1}/${maxAttempts} failed:`, error.message);
                if (attempt < maxAttempts - 1) {
                    const delay = Math.min(2000 + attempt * 1500, 8000);
                    console.log(`ðŸ”„ Retrying in ${delay}ms...`);
                    setTimeout(() => fetchFreshData(attempt + 1), delay);
                } else {
                    setFestError('Unable to load events. Please check your connection and try again.');
                    setIsFestsLoading(false);
                }
            }
        };
        
        fetchFreshData();
    }, [refreshTreksAndComms]);
    // Check for admin changes by listening to custom event AND localStorage
    useEffect(() => {
        // Handler for custom event (same-tab admin updates)
        const handleAdminFestUpdate = (e) => {
            console.log('ðŸ“¢ Custom admin_fest_updated event received:', e.detail);
            console.log('ðŸ”„ Admin fest updated, refreshing dashboard...');
            forceRefreshData();
        };

        // Handler for storage event (cross-tab admin updates)
        const handleAdminChanges = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) {
                console.log('ðŸ”„ Admin data change detected via storage event, refreshing dashboard...');
                forceRefreshData();
                // Clear the flag
                localStorage.removeItem('admin_data_updated');
            }
        };

        // Listen for both custom event and storage changes
        window.addEventListener('admin_fest_updated', handleAdminFestUpdate);
        window.addEventListener('storage', handleAdminChanges);
        
        return () => {
            window.removeEventListener('admin_fest_updated', handleAdminFestUpdate);
            window.removeEventListener('storage', handleAdminChanges);
        };
    }, [forceRefreshData]);

    // Check for login modal parameter (but only show if not authenticated)
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true' && !isAuthenticated) {
            setShowLogin(true);
        } else if (isAuthenticated && showLogin) {
            // Close login modal if user becomes authenticated
            setShowLogin(false);
            // Clear URL parameters
            setSearchParams({});
        }
    }, [searchParams, isAuthenticated, showLogin, setSearchParams]);

    // Get user's location on component mount (same as Navbar)
    useEffect(() => {
        const getStoredLocation = () => {
            try {
                const stored = localStorage.getItem('crwdctrl_user_location');
                
                if (stored) {
                    const parsedLocation = JSON.parse(stored);
                    
                    setCurrentLocation(prev => ({
                        ...prev,
                        ...parsedLocation,
                        hasPermission: true
                    }));
                    return true;
                }
            } catch (error) {
                console.error('âŒ Dashboard - Error reading stored location:', error);
            }
            return false;
        };

        // Only try to get stored location, don't auto-detect
        if (!getStoredLocation()) {
            // Use default location instead of auto-detecting
            setCurrentLocation(prev => ({
                ...prev,
                city: 'Pune',
                state: 'Maharashtra',
                country: 'India',
                hasPermission: false,
                isDetecting: false
            }));
        }
    }, []);

    // Listen for location updates from localStorage (when Navbar updates location)
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'crwdctrl_user_location' && e.newValue) {
                try {
                    const newLocation = JSON.parse(e.newValue);
                    setCurrentLocation(prev => ({
                        ...prev,
                        ...newLocation,
                        hasPermission: true
                    }));
                } catch (error) {
                    console.error('âŒ Dashboard - Error parsing updated location:', error);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // Handle login modal close
    const handleCloseLogin = () => {
        setShowLogin(false);
        setSearchParams({}); // Clear URL parameters
    };

    // Handle register modal close
    const handleCloseRegister = () => {
        setShowRegister(false);
    };

    // Fetch fests from backend API â€” starts immediately, retries aggressively for Railway cold starts
    useEffect(() => {
        let cancelled = false;

        const fetchFests = async () => {
            const maxRetries = 10; // Enough retries to cover a full Railway cold start (~60s)
            
            // âœ… Show cached data immediately while fetching fresh
            const cachedFests = getCachedData(CACHE_KEYS.FESTS_LIST);
            if (cachedFests && Array.isArray(cachedFests) && cachedFests.length > 0) {
                console.log('âš¡ Showing cached fests while fetching fresh data');
                setFests(cachedFests);
                setIsFestsLoading(false);
                // If cache is still fresh, skip the network fetch entirely
                if (isCacheValid()) {
                    console.log('âš¡ Cache is fresh, skipping network fetch');
                    setFestError(null);
                    return;
                }
            }

            // Determine timeout based on device
            const userAgent = navigator.userAgent || '';
            const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
            const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
            const timeout = import.meta.env.VITE_API_TIMEOUT
                ? parseInt(import.meta.env.VITE_API_TIMEOUT)
                : (isIOS || isSafari) ? 20000 : 15000;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                if (cancelled) return;
                try {
                    console.log(`ðŸ”„ Fetching fests (attempt ${attempt + 1}/${maxRetries})`);
                    const cacheBuster = Date.now();
                    const response = await fetchJSON(`/fests/all?_cb=${cacheBuster}&priority_check=1`, { timeout });
                    
                    if (cancelled) return;
                    const data = response.data;
                    const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                    
                    if (festsList.length > 0) {
                        setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                    }
                    
                    setFests(festsList);
                    setFestError(null);
                    setIsFestsLoading(false);
                    console.log(`âœ… Fests loaded successfully (${festsList.length} fests)`);
                    return; // Success â€” exit
                } catch (err) {
                    console.warn(`â³ Fetch attempt ${attempt + 1} failed: ${err.message}`);
                    if (attempt < maxRetries - 1) {
                        // Wait longer between each retry: 3s, 4s, 5s, 6s... capped at 8s
                        const delay = Math.min(3000 + attempt * 1000, 8000);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }

            // All retries exhausted
            if (cancelled) return;
            if (!cachedFests || cachedFests.length === 0) {
                setFestError('Unable to load events. Please check your connection and try again.');
                setFests([]);
            } else {
                // We already showed cached data above, just note it's stale
                setFestError(null);
            }
            setIsFestsLoading(false);
        };

        fetchFests();

        // Fetch trek communities for home sections (cache-busted)
        fetchJSON(`/trek-communities?_cb=${Date.now()}`).then(res => {
            const list = Array.isArray(res?.data?.communities) ? res.data.communities : [];
            setHomeCommunities(list);
        }).catch(() => {});

        // Fetch treks for home sections (cache-busted)
        fetchJSON(`/treks?_cb=${Date.now()}`).then(res => {
            const list = Array.isArray(res?.data?.treks) ? res.data.treks : [];
            setHomeTreks(list);
        }).catch(() => {});

        return () => { cancelled = true; };
    }, []);

    // âœ… Cache cleanup and management
    useEffect(() => {
        // Clear cache on page unload if it's getting old
        const handleBeforeUnload = () => {
            const timestamp = localStorage.getItem(CACHE_KEYS.FESTS_TIMESTAMP);
            if (timestamp) {
                const age = Date.now() - parseInt(timestamp);
                // Clear cache if it's older than 10 minutes
                if (age > 10 * 60 * 1000) {
                    clearCache();
                }
            }
        };

        // âœ… Cache warming - prefetch fresh data when cache is about to expire
        const warmCache = () => {
            const timestamp = localStorage.getItem(CACHE_KEYS.FESTS_TIMESTAMP);
            if (timestamp) {
                const age = Date.now() - parseInt(timestamp);
                // Prefetch when cache is 80% expired (4 minutes old)
                if (age > CACHE_DURATION * 0.8 && age < CACHE_DURATION) {
                    console.log('ðŸ”¥ Warming cache with fresh data');
                    // Silently fetch fresh data in background
                    fetchJSON('/fests/all', { timeout: 5000 })
                        .then(response => {
                            const data = response.data;
                            const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                            if (festsList.length > 0) {
                                setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                                console.log('âœ… Cache warmed successfully');
                            }
                        })
                        .catch(err => {
                            console.log('âš ï¸ Cache warming failed:', err.message);
                        });
                }
            }
        };

        // Check for cache warming every 30 seconds
        const warmingInterval = setInterval(warmCache, 30000);

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            clearInterval(warmingInterval);
        };
    }, []);

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

    const handleLike = useCallback((eventId, eventData) => {
        toggleFavorite(eventId, eventData);
    }, [toggleFavorite]);

    // Check scroll position and update arrow visibility
    const checkScrollPosition = useCallback((ref, setShowLeft, setShowRight) => {
        if (ref && ref.current) {
            const { scrollLeft, scrollWidth, clientWidth } = ref.current;
            // Show left arrow if scrolled more than 10px from start
            setShowLeft(scrollLeft > 10);
            // Show right arrow if more than 10px of content remains to scroll
            setShowRight(scrollLeft < scrollWidth - clientWidth - 10);
        }
    }, []);

    const scrollLeft = useCallback((ref) => {
        if (ref && ref.current) {
            ref.current.scrollBy({
                left: -340, // Card width for better UX
                behavior: 'smooth'
            });
            // Manually trigger check after scroll animation
            setTimeout(() => {
                if (ref === ongoingScrollRef) {
                    checkScrollPosition(ongoingScrollRef, setOngoingShowLeftArrow, setOngoingShowRightArrow);
                } else if (ref === beyondCampusScrollRef) {
                    checkScrollPosition(beyondCampusScrollRef, setBeyondCampusShowLeftArrow, setBeyondCampusShowRightArrow);
                } else if (ref === upcomingScrollRef) {
                    checkScrollPosition(upcomingScrollRef, setUpcomingShowLeftArrow, setUpcomingShowRightArrow);
                } else if (ref === lastYearScrollRef) {
                    checkScrollPosition(lastYearScrollRef, setLastYearShowLeftArrow, setLastYearShowRightArrow);
                }
            }, 400);
        }
    }, [checkScrollPosition]);

    const scrollRight = useCallback((ref) => {
        if (ref && ref.current) {
            ref.current.scrollBy({
                left: 340, // Card width for better UX
                behavior: 'smooth'
            });
            // Manually trigger check after scroll animation
            setTimeout(() => {
                if (ref === ongoingScrollRef) {
                    checkScrollPosition(ongoingScrollRef, setOngoingShowLeftArrow, setOngoingShowRightArrow);
                } else if (ref === beyondCampusScrollRef) {
                    checkScrollPosition(beyondCampusScrollRef, setBeyondCampusShowLeftArrow, setBeyondCampusShowRightArrow);
                } else if (ref === upcomingScrollRef) {
                    checkScrollPosition(upcomingScrollRef, setUpcomingShowLeftArrow, setUpcomingShowRightArrow);
                } else if (ref === lastYearScrollRef) {
                    checkScrollPosition(lastYearScrollRef, setLastYearShowLeftArrow, setLastYearShowRightArrow);
                }
            }, 400);
        }
    }, [checkScrollPosition]);

    // Add scroll event listeners
    useEffect(() => {
        const ongoingRef = ongoingScrollRef.current;
        const beyondCampusRef = beyondCampusScrollRef.current;
        const upcomingRef = upcomingScrollRef.current;
        const lastYearRef = lastYearScrollRef.current;

        const handleOngoingScroll = () => checkScrollPosition(ongoingScrollRef, setOngoingShowLeftArrow, setOngoingShowRightArrow);
        const handleBeyondCampusScroll = () => checkScrollPosition(beyondCampusScrollRef, setBeyondCampusShowLeftArrow, setBeyondCampusShowRightArrow);
        const handleUpcomingScroll = () => checkScrollPosition(upcomingScrollRef, setUpcomingShowLeftArrow, setUpcomingShowRightArrow);
        const handleLastYearScroll = () => checkScrollPosition(lastYearScrollRef, setLastYearShowLeftArrow, setLastYearShowRightArrow);

        if (ongoingRef) {
            ongoingRef.addEventListener('scroll', handleOngoingScroll);
            handleOngoingScroll(); // Initial check
        }
        if (beyondCampusRef) {
            beyondCampusRef.addEventListener('scroll', handleBeyondCampusScroll);
            handleBeyondCampusScroll(); // Initial check
        }
        if (upcomingRef) {
            upcomingRef.addEventListener('scroll', handleUpcomingScroll);
            handleUpcomingScroll(); // Initial check
        }
        if (lastYearRef) {
            lastYearRef.addEventListener('scroll', handleLastYearScroll);
            handleLastYearScroll(); // Initial check
        }

        return () => {
            if (ongoingRef) ongoingRef.removeEventListener('scroll', handleOngoingScroll);
            if (beyondCampusRef) beyondCampusRef.removeEventListener('scroll', handleBeyondCampusScroll);
            if (upcomingRef) upcomingRef.removeEventListener('scroll', handleUpcomingScroll);
            if (lastYearRef) lastYearRef.removeEventListener('scroll', handleLastYearScroll);
        };
    }, [checkScrollPosition]);

    // Handle keyboard navigation for scroll buttons
    const handleScrollKeyDown = (event, direction) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            direction === 'left' ? scrollLeft() : scrollRight();
        }
    };

    // Get status badge color based on status
    const getStatusBadgeColor = (status) => {
        switch (status) {
            case 'ongoing':
                return 'bg-green-500';
            case 'upcoming':
                return 'bg-orange-500';
            case 'completed':
                return 'bg-gray-500';
            case 'lastyearhit':
                return 'bg-purple-500';
            default:
                return 'bg-orange-500';
        }
    };

    // Transform backend fests for display
    const transformedFests = useMemo(() => {
        if (!Array.isArray(fests)) return [];
        return fests.map(fest => {
            const type = fest?.festType || 'cultural';
            const categoryColor =
                type === 'cultural' ? 'bg-pink-500/80' :
                type === 'technical' ? 'bg-indigo-500/80' :
                type === 'sports' ? 'bg-emerald-500/80' :
                'bg-cyan-500/80';

            return {
                id: fest?._id || fest?.id,
                title: fest?.festName || 'Fest',
                type,
                image: fest?.coverImage || fest?.images?.[0] || fest?.festImages?.[0] || '/placeholder-image.jpg',
                subtitle: fest?.collegeName || '',
                description: fest?.description || '',
                status: fest?.status || 'upcoming',
                date: fest?.festDate || 'Date TBA',
                location: fest?.venue || 'Venue TBA',
                category: type === 'cultural' ? 'Cultural Fest' :
                          type === 'technical' ? 'Tech Fest' :
                          type === 'sports' ? 'Sports Fest' :
                          'Fest',
                categoryColor,
                participants: fest?.estimatedParticipants || '',
                duration: fest?.duration || '',
                venue: fest?.venue || 'Venue TBA',
                dateTime: fest?.festDate || 'Date TBA',
                ticketPrice: fest?.ticketPrice || 'Free',
                priority: fest?.priority || 999,
                homePriority: fest?.homePriority || 999,
                homeSection: fest?.homeSection || null,
                showOnHomeSlide: fest?.showOnHomeSlide || false,
                createdAt: fest?.createdAt
            };
        }).filter(f => f.id);
    }, [fests]);

    // Filter events by status and sort by priority within each section
    // âœ… FIX: If no fests have status 'ongoing', fall back to showing 'upcoming' fests
    //    so the Ongoing section isn't empty (status is set manually by admin)
    const ongoingEvents = useMemo(() => {
        const sortByPriority = (a, b) => {
            const priorityA = a.priority || 999;
            const priorityB = b.priority || 999;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
        };
        const strictly = transformedFests.filter(f => f.status === 'ongoing');
        if (strictly.length > 0) return strictly.sort(sortByPriority);
        // Fallback: show upcoming fests in the Ongoing section so it's not empty
        return transformedFests
            .filter(f => f.status === 'upcoming' || f.status === 'ongoing')
            .sort(sortByPriority);
    }, [transformedFests]);

    const heroEvents = useMemo(() => {
        const selectedSlides = transformedFests
            .filter(f => f.showOnHomeSlide)
            .sort((a, b) => {
                const priorityA = a.homePriority || 999;
                const priorityB = b.homePriority || 999;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });

        return selectedSlides.length > 0 ? selectedSlides : ongoingEvents;
    }, [ongoingEvents, transformedFests]);
    
    const beyondCampusEvents = useMemo(() => 
        transformedFests
            .filter(f => f.status === 'beyondcampus')
            .sort((a, b) => {
                // Sort by priority first (1 = highest priority), then by creation date
                const priorityA = a.priority || 999;
                const priorityB = b.priority || 999;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                // If same priority, sort by date (newest first)
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }), 
        [transformedFests]
    );
    
    const upcomingEvents = useMemo(() => 
        transformedFests
            .filter(f => f.status === 'upcoming')
            .sort((a, b) => {
                // Sort by priority first (1 = highest priority), then by creation date
                const priorityA = a.priority || 999;
                const priorityB = b.priority || 999;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                // If same priority, sort by date (newest first)
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            }), 
        [transformedFests]
    );
    
    const lastYearEvents = useMemo(() => 
        transformedFests.filter(f => f.status === 'lastyearhit'), 
        [transformedFests]
    );

    // Check scroll position after events are loaded
    useEffect(() => {
        if (!isFestsLoading && ongoingEvents.length > 0) {
            setTimeout(() => {
                checkScrollPosition(ongoingScrollRef, setOngoingShowLeftArrow, setOngoingShowRightArrow);
            }, 100);
        }
        if (!isFestsLoading && beyondCampusEvents.length > 0) {
            setTimeout(() => {
                checkScrollPosition(beyondCampusScrollRef, setBeyondCampusShowLeftArrow, setBeyondCampusShowRightArrow);
            }, 100);
        }
        if (!isFestsLoading && upcomingEvents.length > 0) {
            setTimeout(() => {
                checkScrollPosition(upcomingScrollRef, setUpcomingShowLeftArrow, setUpcomingShowRightArrow);
            }, 100);
        }
        if (!isFestsLoading && lastYearEvents.length > 0) {
            setTimeout(() => {
                checkScrollPosition(lastYearScrollRef, setLastYearShowLeftArrow, setLastYearShowRightArrow);
            }, 100);
        }
    }, [isFestsLoading, ongoingEvents.length, beyondCampusEvents.length, upcomingEvents.length, lastYearEvents.length, checkScrollPosition]);

    const handleRegister = useCallback((eventId) => {
        navigate(`/view-details/${eventId}`);
    }, [navigate]);

    // âœ… Manual refresh function to bypass cache (for development/debugging only)
    const refreshFests = useCallback(async () => {
        clearCache();
        setIsFestsLoading(true);
        
        // Force a fresh fetch by clearing cache and reloading
        window.location.reload();
    }, []);

    // Handle search functionality
    const handleSearch = () => {
        if (searchQuery.trim()) {
            // Navigate to search results or filter current results
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    // Search functionality (same as desktop Navbar)
    useEffect(() => {
        const performSearch = async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearching(true);
                try {
                    console.log('ðŸ” Dashboard mobile search for:', searchQuery);
                    const results = await searchAll(searchQuery);
                    console.log('ðŸ” Dashboard search results received:', {
                        fests: results.fests.length,
                        competitions: results.competitions.length,
                        total: results.total
                    });
                    
                    // Combine fests and competitions, limit to 6 total results
                    const combinedResults = [
                        ...results.fests.map(fest => ({ ...fest, resultType: 'fest' })),
                        ...results.competitions.map(comp => ({ ...comp, resultType: 'competition' }))
                    ].slice(0, 6);
                    
                    console.log('ðŸ” Dashboard final combined results:', combinedResults.length, 'types:', combinedResults.map(r => r.resultType));
                    
                    setSearchResults(combinedResults);
                    setIsSearchDropdownOpen(true);
                } catch (error) {
                    console.error('Dashboard search error:', error);
                    setSearchResults([]);
                    setIsSearchDropdownOpen(false);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
                setIsSearchDropdownOpen(false);
                setIsSearching(false);
            }
        };

        // Debounce search to avoid too many API calls
        const timeoutId = setTimeout(performSearch, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

    // Close search dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchDropdownOpen(false);
            }
        };

        if (isSearchDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isSearchDropdownOpen]);

    // Handle search result click
    const handleSearchResultClick = (event) => {
        console.log('ðŸ” Dashboard search result clicked:', event.resultType, event.id);
        setSearchQuery('');
        setIsSearchDropdownOpen(false);
        
        // Navigate based on result type
        if (event.resultType === 'competition') {
            // Navigate to competition details page
            console.log('ðŸ” Navigating to competition:', `/competitions-view-details/${event.id}`);
            navigate(`/competitions-view-details/${event.id}`);
        } else {
            // Navigate to fest details page
            console.log('ðŸ” Navigating to fest:', `/view-details/${event.id}`);
            navigate(`/view-details/${event.id}`);
        }
    };

    // Helper function to get city name from coordinates (for major Indian cities)
    const getCityFromCoordinates = (lat, lon) => {
        const cities = [
            { name: 'Bangalore', state: 'Karnataka', lat: 12.9716, lon: 77.5946, tolerance: 0.5 },
            { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lon: 72.8777, tolerance: 0.5 },
            { name: 'Delhi', state: 'Delhi', lat: 28.7041, lon: 77.1025, tolerance: 0.5 },
            { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lon: 78.4867, tolerance: 0.5 },
            { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lon: 80.2707, tolerance: 0.5 },
            { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lon: 88.3639, tolerance: 0.5 },
            { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lon: 73.8567, tolerance: 0.5 },
            { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lon: 72.5714, tolerance: 0.5 },
            { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lon: 75.7873, tolerance: 0.5 },
            { name: 'Surat', state: 'Gujarat', lat: 21.1702, lon: 72.8311, tolerance: 0.5 }
        ];

        for (const city of cities) {
            const latDiff = Math.abs(lat - city.lat);
            const lonDiff = Math.abs(lon - city.lon);
            if (latDiff <= city.tolerance && lonDiff <= city.tolerance) {
                return { city: city.name, state: city.state, country: 'India' };
            }
        }
        return null;
    };

    // Function to detect user's location (same as Navbar)
    const detectUserLocation = async () => {
        if (!navigator.geolocation) {
            return;
        }

        // Ask for explicit consent before attempting geolocation access.
        if (!currentLocation.hasPermission) {
            const shouldRequestLocation = window.confirm(
                'Allow CrwdCtrl to access your location to show nearby events?'
            );

            if (!shouldRequestLocation) {
                setCurrentLocation(prev => ({
                    ...prev,
                    isDetecting: false,
                    hasPermission: false
                }));
                return;
            }

            if (navigator.permissions?.query) {
                try {
                    const permissionState = await navigator.permissions.query({ name: 'geolocation' });
                    if (permissionState.state === 'denied') {
                        setCurrentLocation(prev => ({
                            ...prev,
                            isDetecting: false,
                            hasPermission: false
                        }));
                        return;
                    }
                } catch (permissionError) {
                    console.log('âš ï¸ Dashboard - Could not verify geolocation permission state:', permissionError);
                }
            }
        }

        setCurrentLocation(prev => ({ ...prev, isDetecting: true }));

        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // 15 seconds timeout
            maximumAge: 300000 // 5 minutes cache
        };

        try {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;

                    // First try to match with known cities
                    const knownCity = getCityFromCoordinates(latitude, longitude);
                    if (knownCity) {
                        const locationData = {
                            ...knownCity,
                            coordinates: { latitude, longitude },
                            hasPermission: true,
                            isDetecting: false
                        };
                        setCurrentLocation(locationData);

                        try {
                            localStorage.setItem('crwdctrl_user_location', JSON.stringify(locationData));
                        } catch (error) {
                            console.error('âŒ Dashboard - Error storing location:', error);
                        }
                        return;
                    }

                    try {
                        let locationData = null;

                        // Try Nominatim (OpenStreetMap)
                        try {
                            const nominatimResponse = await fetch(
                                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
                                {
                                    headers: {
                                        'User-Agent': 'CrwdCtrl/1.0 (contact@crwdctrl.com)'
                                    }
                                }
                            );

                            if (nominatimResponse.ok) {
                                const nominatimData = await nominatimResponse.json();
                                if (nominatimData.address) {
                                    const addr = nominatimData.address;
                                    const cityName = addr.city || addr.town || addr.village || addr.suburb || addr.hamlet || addr.municipality || addr.county;
                                    const stateName = addr.state || addr.region || addr.province || addr['ISO3166-2-lvl4'];
                                    const countryName = addr.country || addr.country_code?.toUpperCase();

                                    if (cityName && !cityName.match(/^\d+\.?\d*[Â°,]\s*\d+\.?\d*$/)) {
                                        locationData = {
                                            city: cityName,
                                            state: stateName || 'Unknown State',
                                            country: countryName || 'Unknown Country',
                                            coordinates: { latitude, longitude },
                                            hasPermission: true,
                                            isDetecting: false
                                        };
                                    }
                                }
                            }
                        } catch (nominatimError) {
                            // Silent fail, try BigDataCloud
                        }

                        // Try BigDataCloud if Nominatim failed
                        if (!locationData) {
                            try {
                                const bigDataResponse = await fetch(
                                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
                                );

                                if (bigDataResponse.ok) {
                                    const bigDataResult = await bigDataResponse.json();
                                    const cityName = bigDataResult.city || bigDataResult.locality || bigDataResult.localityInfo?.administrative?.[3]?.name;
                                    const stateName = bigDataResult.principalSubdivision || bigDataResult.localityInfo?.administrative?.[1]?.name;
                                    const countryName = bigDataResult.countryName;

                                    if (cityName && !cityName.match(/^\d+\.?\d*[Â°,]\s*\d+\.?\d*$/)) {
                                        locationData = {
                                            city: cityName,
                                            state: stateName || 'Unknown State',
                                            country: countryName || 'Unknown Country',
                                            coordinates: { latitude, longitude },
                                            hasPermission: true,
                                            isDetecting: false
                                        };
                                    }
                                }
                            } catch (bigDataError) {
                                // Silent fail
                            }
                        }

                        if (locationData) {
                            setCurrentLocation(locationData);
                            try {
                                localStorage.setItem('crwdctrl_user_location', JSON.stringify(locationData));
                            } catch (error) {
                                console.error('âŒ Dashboard - Error storing location:', error);
                            }
                        } else {
                            // Fallback to coordinates-based location
                            const fallbackData = {
                                city: 'Your Location',
                                state: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
                                country: 'Coordinates',
                                coordinates: { latitude, longitude },
                                hasPermission: true,
                                isDetecting: false
                            };
                            setCurrentLocation(fallbackData);
                        }
                    } catch (error) {
                        console.error('âŒ Dashboard - Reverse geocoding failed:', error);
                        const errorFallbackData = {
                            city: 'Location Found',
                            state: 'Unknown Area',
                            country: 'Unknown',
                            coordinates: { latitude, longitude },
                            hasPermission: true,
                            isDetecting: false
                        };
                        setCurrentLocation(errorFallbackData);
                    }
                },
                (error) => {
                    console.error('âŒ Dashboard - GEOLOCATION ERROR:', error);
                    console.error('âŒ Dashboard - Error code:', error.code);
                    console.error('âŒ Dashboard - Error message:', error.message);
                    
                    setCurrentLocation(prev => {
                        const newState = {
                            ...prev,
                            isDetecting: false,
                            hasPermission: false
                        };
                        return newState;
                    });
                },
                options
            );
        } catch (error) {
            console.error('âŒ Dashboard - CRITICAL ERROR in detectUserLocation:', error);
        }
    };

    // All events combined for "Happening Near You"
    const happeningEvents = [...beyondCampusEvents, ...upcomingEvents];

    // Unified section arrays — all content types merged and sorted by a single priority number
    const byPriority = (a, b) => (a._priority || 999) - (b._priority || 999);
    // festHomeSection: explicit homeSection wins; fallback to status-based routing for existing fests
    const festHomeSection = (f) => {
        if (f.homeSection) return f.homeSection;
        if (f.showOnHomeSlide) return null;
        return f.status === 'ongoing' ? 'trending'
            : (f.status === 'upcoming' || f.status === 'beyondcampus') ? 'happening'
            : null;
    };

    const tag = (type, items, priorityField = 'priority') =>
        items.map(i => ({ ...i, _type: type, _priority: i[priorityField] || i.priority || 999 }));

    // Use transformedFests so items have the right shape (id, title, image) for card rendering
    const trendingItems = [
        ...tag('fest', transformedFests.filter(f => festHomeSection(f) === 'trending'), 'homePriority'),
        ...tag('trek', homeTreks.filter(t => t.homeSection === 'trending')),
        ...tag('community', homeCommunities.filter(c => c.homeSection === 'trending')),
    ].sort(byPriority);

    const happeningItems = [
        ...tag('fest', transformedFests.filter(f => festHomeSection(f) === 'happening'), 'homePriority'),
        ...tag('trek', homeTreks.filter(t => t.homeSection === 'happening')),
        ...tag('community', homeCommunities.filter(c => c.homeSection === 'happening')),
    ].sort(byPriority);


    // Error state
    if (error) {
        return (
            <div className={`min-h-screen transition-colors flex items-center justify-center ${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-50'}`}>
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-6xl mb-4">âš ï¸</div>
                    <h2 className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>Something went wrong</h2>
                    <p className={`text-lg mb-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-cyan-400 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                    >
                        Reload Page
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
          <div className="flex flex-col flex-1">

            {/* Mobile top section — unified sticky block */}
            <header className={`lg:hidden sticky top-0 z-40 backdrop-blur-md transition-all duration-300 rounded-b-[40px] overflow-hidden
                ${isDark ? 'bg-[#0D0E10]/95' : 'bg-white/95'}`}>
                {/* unified card box — covers full width, safe-area absorbed inside */}
                <div className={`rounded-b-[40px] px-4 pb-4 shadow-[0_8px_24px_rgba(0,0,0,0.08)]
                    ${isDark ? 'bg-[#0D0E10]' : 'bg-white'}`}
                    style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
                <div className="flex items-center justify-between mb-2">
                    {/* Logo */}
                    <img src={Logo} alt="CrwdCtrl" className="h-20 sm:h-24 w-auto" />

                    {/* Right icons */}
                    <div className="flex items-center gap-1">
                        {/* Location */}
                        <div className="relative">
                            <button
                                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                className={`flex items-center gap-1 p-2 rounded-xl bg-transparent transition-colors
                                    ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                                aria-label="Location"
                            >
                                {currentLocation.isDetecting ? (
                                    <div className="w-6 h-6 border-2 border-[#0ECCEE] border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <MapPin className="w-6 h-6" />
                                )}
                                {currentLocation.hasPermission && !currentLocation.isDetecting && (
                                    <span className="text-xs font-medium text-[#0ECCEE] max-w-[64px] truncate hidden xs:block">
                                        {currentLocation.city}
                                    </span>
                                )}
                            </button>

                            {/* Location dropdown â€” keep existing */}
                            {isLocationDropdownOpen && (
                                <div className={`absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border backdrop-blur-md z-50
                                    ${isDark ? 'bg-black/95 border-gray-700/50' : 'bg-white/95 border-gray-200/50'}`}>
                                    <div className={`px-4 py-3 border-b flex items-center justify-between
                                        ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Current Location
                                        </h3>
                                        <button onClick={() => setIsLocationDropdownOpen(false)}
                                            className={`p-1 rounded-lg transition-colors ${isDark ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex items-start gap-3 mb-4">
                                            <div className={`p-2 rounded-lg ${currentLocation.hasPermission ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {currentLocation.city}
                                                </p>
                                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                    {currentLocation.state}, {currentLocation.country}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setIsLocationDropdownOpen(false); detectUserLocation(); }}
                                            disabled={currentLocation.isDetecting}
                                            className="w-full py-2 px-3 rounded-lg text-sm font-medium bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 text-black transition-colors disabled:opacity-50"
                                        >
                                            {currentLocation.isDetecting ? 'Detectingâ€¦' : 'Detect My Location'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bell */}
                        <button
                            onClick={() => navigate('/notifications')}
                            className={`relative p-2 rounded-xl bg-transparent transition-colors
                                ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                            aria-label="Notifications"
                        >
                            <Bell className="w-6 h-6" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                        </button>
                    </div>
                </div>

                {/* Row 2: Search bar */}
                <div className="relative mb-3.5" ref={searchRef}>
                    <div className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-4
                        ${isDark ? 'bg-[#161718] border border-white/5' : 'bg-[#EDEDF2] border border-gray-200'}`}>
                        <Search size={16} className="text-gray-400 flex-shrink-0" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                            placeholder="search college, fest"
                            className={`flex-1 bg-transparent text-sm outline-none
                                ${isDark ? 'text-gray-200 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'}`}
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(''); setIsSearchDropdownOpen(false); }}>
                                <X size={16} className="text-gray-400" />
                            </button>
                        )}
                    </div>

                        {/* Search dropdown */}
                        {isSearchDropdownOpen && searchResults.length > 0 && (
                            <div className={`absolute left-4 right-4 top-full mt-1 rounded-2xl shadow-2xl border z-50 overflow-hidden
                                ${isDark ? 'bg-[#111213] border-gray-700' : 'bg-white border-gray-200'}`}>
                                {isSearching && (
                                    <div className="flex items-center gap-2 px-4 py-3">
                                        <Loader2 size={14} className="animate-spin text-gray-400" />
                                        <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Searchingâ€¦</span>
                                    </div>
                                )}
                                {searchResults.map((result) => (
                                    <button
                                        key={result.id}
                                        onClick={() => handleSearchResultClick(result)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                                            ${isDark ? 'hover:bg-gray-800 border-b border-gray-700/50' : 'hover:bg-gray-50 border-b border-gray-100'}`}
                                    >
                                        {result.coverImage || result.image ? (
                                            <img
                                                src={getImageUrl(result.coverImage || result.image)}
                                                alt={result.festName || result.name}
                                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                                onError={(e) => { e.target.style.display = 'none'; }}
                                            />
                                        ) : (
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                                                ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                                                <Search size={14} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {result.festName || result.name}
                                            </p>
                                            <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {result.resultType === 'competition' ? 'ðŸ† Competition' : 'ðŸŽ‰ Fest'} Â· {result.collegeName || result.fest?.festName || ''}
                                            </p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                </div>

                {/* Row 3: Category icons */}
                <HomeCategoryBar isDark={isDark} noPadding />

                </div>{/* end card box */}
            </header>

            {/* Main content - shared mobile + desktop */}
            <main className="flex-1 pb-4">
                <div className="max-w-2xl lg:max-w-7xl mx-auto pt-6 lg:pt-0">

                    {/* Desktop-only category bar */}
                    <div className="hidden lg:block pt-3">
                        <HomeCategoryBar isDark={isDark} />
                    </div>

                    {/* Hero Banner */}
                    {!isFestsLoading && heroEvents.length > 0 && (
                        <HeroBanner
                            events={heroEvents}
                            onEventClick={(id) => navigate(`/view-details/${id}`)}
                            isDark={isDark}
                        />
                    )}
                    {isFestsLoading && (
                        <div className="px-4 mb-6">
                            <div className={`h-52 rounded-2xl animate-pulse ${isDark ? 'bg-[#111213]' : 'bg-gray-200'}`} />
                        </div>
                    )}

                    {/* Trending Now */}
                    <section className="mb-8">
                        <h2 className={`text-xl font-bold px-4 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Trending Now
                        </h2>
                        {isFestsLoading ? (
                            <div className="px-4">
                                <LoadingSkeleton count={2} />
                            </div>
                        ) : festError && ongoingEvents.length === 0 ? (
                            <div className="px-4">
                                <AutoRetryError isDark={isDark} onRetry={forceRefreshData} />
                            </div>
                        ) : trendingItems.length > 0 ? (
                            <div
                                className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-3 pb-2 snap-x snap-mandatory">
                                    {trendingItems.map((item) => {
                                        if (item._type === 'fest') return (
                                            <div key={item.id} className="snap-start">
                                                <TrendingCard event={item} isDark={isDark} isFavorite={isFavorite(item.id)} onToggleFavorite={() => handleLike(item.id, item)} onViewDetails={() => navigate(`/view-details/${item.id}`)} />
                                            </div>
                                        );
                                        if (item._type === 'trek') return (
                                            <div key={item._id} className={`snap-start flex-shrink-0 w-[200px] sm:w-[220px] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-95 ${isDark ? 'bg-[#111213] shadow-lg shadow-black/30' : 'bg-white shadow-md'}`} onClick={() => navigate(`/trek/${item._id}`, { state: { trek: item } })}>
                                                <div className="relative h-[160px] overflow-hidden">
                                                    {(item.coverImage || item.images?.[0] || item.image) ? <img src={item.coverImage || item.images?.[0] || item.image} alt={item.trekName} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-green-900 via-emerald-800 to-teal-700 flex items-center justify-center"><span className="text-4xl">⛰️</span></div>}
                                                    {item.difficultyLevel && <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${item.difficultyLevel === 'easy' ? 'bg-green-500 text-white' : item.difficultyLevel === 'moderate' ? 'bg-yellow-500 text-black' : 'bg-orange-500 text-white'}`}>{item.difficultyLevel}</div>}
                                                </div>
                                                <div className="p-3">
                                                    <h3 className={`text-sm font-bold leading-tight mb-1 line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.trekName}</h3>
                                                    {item.city && <p className={`text-[11px] mb-3 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.city}</p>}
                                                    <button className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${isDark ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30 hover:bg-[#0ECCEE]/20' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'}`}>Details</button>
                                                </div>
                                            </div>
                                        );
                                        if (item._type === 'community') return (
                                            <div key={item._id} className={`snap-start flex-shrink-0 w-[200px] sm:w-[220px] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 active:scale-95 ${isDark ? 'bg-[#111213] shadow-lg shadow-black/30' : 'bg-white shadow-md'}`} onClick={() => navigate(`/treks/community/${item._id}`, { state: { community: { id: item._id, title: item.name, subtitle: item.basedIn, image: item.coverImage, trekCategories: item.trekCategories || [] } } })}>
                                                <div className="relative h-[160px] overflow-hidden">
                                                    {item.coverImage ? <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-green-800 to-emerald-600 flex items-center justify-center"><span className="text-4xl">🏔️</span></div>}
                                                    <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white">Community</div>
                                                </div>
                                                <div className="p-3">
                                                    <h3 className={`text-sm font-bold leading-tight mb-1 line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.name}</h3>
                                                    {item.basedIn && <p className={`text-[11px] mb-3 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.basedIn}</p>}
                                                    <button className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${isDark ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30 hover:bg-[#0ECCEE]/20' : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'}`}>Details</button>
                                                </div>
                                            </div>
                                        );
                                        return null;
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className={`mx-4 text-center py-10 rounded-2xl ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-white text-gray-500'}`}>
                                <div className="text-3xl mb-2">ðŸ“…</div>
                                <p className="text-sm">No trending events right now</p>
                            </div>
                        )}
                    </section>

                    {/* Happening Near You */}
                    {(isFestsLoading || happeningItems.length > 0) && (
                        <section className="mb-8">
                            <h2 className={`text-xl font-bold px-4 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Happening near you
                            </h2>
                            {isFestsLoading ? (
                                <div className="px-4">
                                    <LoadingSkeleton count={2} />
                                </div>
                            ) : (
                                <div
                                    className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                >
                                    <div className="flex gap-3 pb-2 snap-x snap-mandatory">
                                        {happeningItems.map((item) => {
                                            if (item._type === 'fest') return (
                                                <div key={item.id} className="snap-start">
                                                    <HappeningCard event={item} isDark={isDark} onViewDetails={() => navigate(`/view-details/${item.id}`)} />
                                                </div>
                                            );
                                            if (item._type === 'trek') return (
                                                <div key={item._id} className="snap-start flex-shrink-0 w-[260px] sm:w-[280px] cursor-pointer active:scale-95 transition-all duration-200" onClick={() => navigate(`/trek/${item._id}`, { state: { trek: item } })}>
                                                    <div className="relative h-[180px] sm:h-[190px] rounded-2xl overflow-hidden mb-2">
                                                        {(item.coverImage || item.images?.[0] || item.image) ? <img src={item.coverImage || item.images?.[0] || item.image} alt={item.trekName} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-green-900 via-emerald-800 to-teal-700 flex items-center justify-center"><span className="text-4xl">⛰️</span></div>}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                        <div className="absolute bottom-0 left-0 right-0 p-3"><p className="text-white font-bold text-sm leading-tight line-clamp-1">{item.trekName}</p></div>
                                                    </div>
                                                    <div className="flex items-center justify-between px-1">
                                                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.city || item.difficultyLevel || 'Trek'}</p>
                                                        <span className={`text-xs font-bold ${isDark ? 'text-[#0ECCEE]' : 'text-blue-600'}`}>Details →</span>
                                                    </div>
                                                </div>
                                            );
                                            if (item._type === 'community') return (
                                                <div key={item._id} className="snap-start flex-shrink-0 w-[260px] sm:w-[280px] cursor-pointer active:scale-95 transition-all duration-200" onClick={() => navigate(`/treks/community/${item._id}`, { state: { community: { id: item._id, title: item.name, subtitle: item.basedIn, image: item.coverImage, trekCategories: item.trekCategories || [] } } })}>
                                                    <div className="relative h-[180px] sm:h-[190px] rounded-2xl overflow-hidden mb-2">
                                                        {item.coverImage ? <img src={item.coverImage} alt={item.name} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-green-800 to-emerald-600 flex items-center justify-center"><span className="text-4xl">🏔️</span></div>}
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                                        <div className="absolute bottom-0 left-0 right-0 p-3"><p className="text-white font-bold text-sm leading-tight line-clamp-1">{item.name}</p></div>
                                                    </div>
                                                    <div className="flex items-center justify-between px-1">
                                                        <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{item.basedIn || 'Trek Community'}</p>
                                                        <span className={`text-xs font-bold ${isDark ? 'text-[#0ECCEE]' : 'text-blue-600'}`}>Details →</span>
                                                    </div>
                                                </div>
                                            );
                                            return null;
                                        })}
                                    </div>
                                </div>
                            )}
                        </section>
                    )}

                    {/* Desktop-only: beyond campus grid */}
                    {beyondCampusEvents.length > 0 && (
                        <section className="hidden lg:block mb-8 px-4">
                            <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Beyond Campus
                            </h2>
                            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
                                {beyondCampusEvents.slice(0, 6).map((ev) => (
                                    <TrendingCard
                                        key={ev.id}
                                        event={ev}
                                        isDark={isDark}
                                        isFavorite={isFavorite(ev.id)}
                                        onToggleFavorite={() => handleLike(ev.id, ev)}
                                        onViewDetails={() => navigate(`/view-details/${ev.id}`)}
                                    />
                                ))}
                            </div>
                        </section>
                    )}




                </div>
            </main>

            <Footer />

            <div className="pb-20 md:pb-0">

            </div>
            </div>


            {/* Login Modal */}
            {showLogin && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                </div>
            )}

            {/* Register Modal */}
            {showRegister && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
                <div className="fixed inset-0 z-50">
                    <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                </div>
            )}

        </div>
    );
};

export default Dashboard;


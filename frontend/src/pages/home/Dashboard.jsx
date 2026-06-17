import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, ChevronRight, ChevronLeft, Bell, User, Search, Calendar, MapPin, Instagram, Navigation, X, Loader2, Zap, Clock } from 'lucide-react';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import ShareIcon from '../../assets/share.svg';
import AppLogo from '../../components/AppLogo';
import CulturalFestImage from '../../assets/mobile-icons/cultural-events-icon-02.svg';
import TechFestImage from '../../assets/mobile-icons/tech-icon.svg';
import SportsFestImage from '../../assets/mobile-icons/sports-icon.svg';
import SportsIconNew from '../../assets/mobile-icons/sports-icon-new.svg';
import Sidebar from '../../components/Sidebar';
import Navbar from '../../components/Navbar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import ContentImage from '../../components/ContentImage';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import { clearSearchKeywordsCache } from '../../services/searchService';
import CrwdCtrlLogin from '../auth/login';
import { useAuth } from '../../context/AuthContext';
import CrwdCtrlRegister from '../auth/register';
import { HeroBannerSkeleton } from '../../components/HomeEventCardSkeleton';
import { TRENDING_CARD_GAP } from '../../hooks/useHomeCarousel';
import HeroBanner from '../../components/HeroBanner';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import HomeCarouselSection from '../../components/HomeCarouselSection';
import HomeEventCard from '../../components/HomeEventCard';
import { buildHomeCarouselItems } from '../../utils/homeCarouselItems';
import { mapHomeCarouselDisplayItems } from '../../utils/mapHomeCarouselDisplayItems';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import { API_BASE_URL, publicFetchJSONRetry as fetchJSON } from '../../services/api/client';

if (import.meta.env.DEV) {
    console.log('Dashboard API Configuration:', {
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
        API_BASE_URL,
        MODE: import.meta.env.MODE,
    });
}

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

function readInitialFestsFromCache() {
    const cached = getCachedData(CACHE_KEYS.FESTS_LIST);
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
}

const ArtistCard = React.memo(({ eventId, image, artistName, genre, collegeName, venue: _venue, dateTime, ticketPrice: _ticketPrice, isDark, onRegister: _onRegister, onToggleFavorite, isFavorite }) => {
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
            className="card-surface card-carousel rounded-xl overflow-hidden duration-300 transition-shadow cursor-pointer"
        >
            <div className="relative aspect-7/5 overflow-hidden rounded-t-xl">
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
                    <ContentImage
                        src={image}
                        alt={artistName || 'Event image'}
                        preset="cardLg"
                        className="w-full h-full object-cover"
                        onError={handleImageError}
                        onLoad={handleImageLoad}
                        style={{
                            display: imageLoading ? 'none' : 'block',
                            WebkitUserSelect: 'none',
                            userSelect: 'none',
                            WebkitTouchCallout: 'none',
                            touchAction: 'manipulation',
                            objectPosition: 'center center',
                        }}
                    />
                )}

                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} className="z-20" />

            </div>

            <div className={`p-3 sm:p-4 ${isDark ? 'bg-[#0a0a0a]' : 'bg-[#EDEDF2]'}`}>
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
    const [error] = useState(null);
    const [fests, setFests] = useState(readInitialFestsFromCache);
    const [isFestsLoading, setIsFestsLoading] = useState(() => readInitialFestsFromCache().length === 0);
    usePageContentLoading(isFestsLoading);

    // Never leave home on a blank screen if the API is slow or cold-starting
    useEffect(() => {
        if (!isFestsLoading) return undefined;
        const timer = window.setTimeout(() => setIsFestsLoading(false), 6000);
        return () => window.clearTimeout(timer);
    }, [isFestsLoading]);

    const [homeCommunities, setHomeCommunities] = useState([]);
    const [homeTreks, setHomeTreks] = useState([]);
    const [homeSports, setHomeSports] = useState([]);
    const [homeRunClubs, setHomeRunClubs] = useState([]);
    const [festError, setFestError] = useState(null);
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
    const [searchParams, setSearchParams] = useSearchParams();
    
    // State for arrow visibility
    const [_ongoingShowLeftArrow, setOngoingShowLeftArrow] = useState(false);
    const [_ongoingShowRightArrow, setOngoingShowRightArrow] = useState(true);
    const [_beyondCampusShowLeftArrow, setBeyondCampusShowLeftArrow] = useState(false);
    const [_beyondCampusShowRightArrow, setBeyondCampusShowRightArrow] = useState(true);
    const [_upcomingShowLeftArrow, setUpcomingShowLeftArrow] = useState(false);
    const [_upcomingShowRightArrow, setUpcomingShowRightArrow] = useState(true);
    const [_lastYearShowLeftArrow, setLastYearShowLeftArrow] = useState(false);
    const [_lastYearShowRightArrow, setLastYearShowRightArrow] = useState(true);

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
        fetchJSON(`/sports?_cb=${cb}`).then(res => {
            const list = Array.isArray(res?.data?.events) ? res.data.events : [];
            setHomeSports(list);
        }).catch(() => {});
        fetchJSON(`/run-clubs?_cb=${cb}`).then(res => {
            const list = Array.isArray(res?.data?.clubs) ? res.data.clubs : [];
            setHomeRunClubs(list);
        }).catch(() => {});
    }, []);

    // Function to force refresh data (clear cache and fetch fresh) — retries for cold starts
    const forceRefreshData = useCallback(() => {
        console.log('ðŸ”„ Force refreshing dashboard data...');
        clearCache();
        clearSearchKeywordsCache();
        setFestError(null);
        refreshTreksAndComms();

        // Keep showing current cards while refreshing — avoid loading flash (log evidence: hypothesis B)
        setFests((current) => {
            if (current.length === 0) setIsFestsLoading(true);
            return current;
        });

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

        fetchJSON(`/sports?_cb=${Date.now()}`).then(res => {
            const list = Array.isArray(res?.data?.events) ? res.data.events : [];
            setHomeSports(list);
        }).catch(() => {});

        fetchJSON(`/run-clubs?_cb=${Date.now()}`).then(res => {
            const list = Array.isArray(res?.data?.clubs) ? res.data.clubs : [];
            setHomeRunClubs(list);
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

    const heroEvents = useMemo(() => {
        return transformedFests
            .filter(f => f.showOnHomeSlide)
            .sort((a, b) => {
                const priorityA = a.homePriority || 999;
                const priorityB = b.homePriority || 999;
                if (priorityA !== priorityB) return priorityA - priorityB;
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
    }, [transformedFests]);

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

    const buildSectionItems = useCallback((section) => {
        const raw = buildHomeCarouselItems(fests, homeTreks, homeCommunities, section, homeSports, homeRunClubs);
        return mapHomeCarouselDisplayItems(raw, transformedFests);
    }, [fests, homeTreks, homeCommunities, homeSports, homeRunClubs, transformedFests]);

    const trendingItems = useMemo(() => buildSectionItems('trending'), [buildSectionItems]);
    const happeningItems = useMemo(() => buildSectionItems('happening'), [buildSectionItems]);

    const navigateToHomeItem = useCallback((item) => {
        if (item._type === 'fest') {
            navigate(`/view-details/${item.id}`);
        } else if (item._type === 'trek') {
            navigate(`/trek/${item._id}`, { state: { trek: item } });
        } else if (item._type === 'community') {
            navigate(`/treks/community/${item._id}`, {
                state: {
                    community: {
                        id: item._id,
                        title: item.name,
                        subtitle: item.basedIn,
                        image: item.coverImage,
                        trekCategories: item.trekCategories || [],
                    },
                },
            });
        } else if (item._type === 'runclub') {
            navigate(`/sports/run-club/${item._id}`, {
                state: {
                    club: {
                        _id: item._id,
                        name: item.name,
                        basedIn: item.basedIn,
                        coverImage: item.coverImage,
                    },
                },
            });
        } else if (item._type === 'sport') {
            navigate(`/sports/run/${item.id || item._id}`);
        }
    }, [navigate]);

    const getHomeItemShareUrl = useCallback((item) => {
        const origin = window.location.origin;
        if (item._type === 'fest') return `${origin}/view-details/${item.id}`;
        if (item._type === 'trek') return `${origin}/trek/${item._id}`;
        if (item._type === 'community') return `${origin}/treks/community/${item._id}`;
        if (item._type === 'runclub') return `${origin}/sports/run-club/${item._id}`;
        if (item._type === 'sport') return `${origin}/sports/run/${item.id || item._id}`;
        return `${origin}/view-details/${item.id || item._id}`;
    }, []);

    const getHomeItemId = (item) => item.id || item._id;

    const searchQuickPicks = useMemo(
        () => trendingItems.slice(0, 6).map((item) => ({
            ...item,
            id: item._id || item.id,
            title: item._title,
            subtitle: item._subtitle,
            image: item._image,
            resultType: item._type,
        })),
        [trendingItems],
    );

    const handleSearchNavigate = useCallback((result) => {
        const type = result.resultType || result._type;
        const id = result.id || result._id;
        if (type === 'competition') {
            navigate(`/competitions-view-details/${id}`);
        } else if (type === 'fest') {
            navigate(`/view-details/${id}`);
        } else if (type === 'trek' || type === 'community' || type === 'sport') {
            navigateToHomeItem(result);
        } else {
            navigate(`/view-details/${id}`);
        }
    }, [navigate, navigateToHomeItem]);

    const searchKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({
            fests,
            treks: homeTreks,
            communities: homeCommunities,
            sports: homeSports,
        }),
        [fests, homeTreks, homeCommunities, homeSports],
    );

    // Error state
    if (error) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content min-h-screen transition-colors flex items-center justify-center">
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="text-6xl mb-4">⚠️</div>
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
        <div className="crwdctrl-page crwdctrl-page--hub flex flex-col min-h-screen transition-colors">
          <div className="flex flex-col flex-1">

            <MobileStickyHeader
                isDark={isDark}
                onCollapsedChange={(collapsed) => {
                    if (collapsed) setIsLocationDropdownOpen(false);
                }}
                brandingRow={
                    <>
                    <AppLogo />

                    {/* Right icons */}
                    <div className="mobile-header-actions">
                        {/* Location */}
                        <div className="relative">
                            <button
                                onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                className={`touch-target flex items-center gap-1 rounded-xl bg-transparent transition-colors
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
                            className={`touch-target relative rounded-xl bg-transparent transition-colors
                                ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                            aria-label="Notifications"
                        >
                            <Bell className="w-6 h-6" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                            )}
                        </button>
                    </div>
                    </>
                }
                searchRow={
                    <MobileHeroSearchField
                        isDark={isDark}
                        placeholder="search college, fest"
                        quickPickItems={searchQuickPicks}
                        keywordCatalog={searchKeywordCatalog}
                        onResultNavigate={handleSearchNavigate}
                    />
                }
                categoryBar={<HomeCategoryBar isDark={isDark} noPadding />}
            />

            {/* Main content - shared mobile + desktop */}
            <main className="flex-1 pb-4">
                {/* Hero — full chrome width on desktop (aligns with navbar Pune → profile) */}
                {!isFestsLoading && heroEvents.length > 0 && (
                    <HeroBanner
                        events={heroEvents}
                        onEventClick={(id) => navigate(`/view-details/${id}`)}
                        isDark={isDark}
                    />
                )}
                {isFestsLoading && <HeroBannerSkeleton />}

                <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 crwdctrl-hub-body">
                    {/* Ongoing Events */}
                    <HomeCarouselSection
                        title="Ongoing Events"
                        items={trendingItems}
                        isDark={isDark}
                        tallCard
                        cardGap={TRENDING_CARD_GAP}
                        loading={isFestsLoading}
                        emptyFallback={
                            festError && trendingItems.length === 0 ? (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Ongoing Events
                                    </h2>
                                    <div className="px-4"><AutoRetryError isDark={isDark} onRetry={forceRefreshData} /></div>
                                </section>
                            ) : (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Ongoing Events
                                    </h2>
                                    <div className={`mx-4 text-center py-10 rounded-3xl ${isDark ? 'bg-black text-gray-400' : 'bg-[#F2F4F7] text-gray-500'}`}>
                                        <p className="text-sm">No ongoing events right now</p>
                                    </div>
                                </section>
                            )
                        }
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) => handleLike(getHomeItemId(item), item)}
                        onItemClick={navigateToHomeItem}
                        getShareUrl={getHomeItemShareUrl}
                    />

                    {/* Happening Near You */}
                    <HomeCarouselSection
                        title="Happening near you"
                        items={happeningItems}
                        isDark={isDark}
                        wideCard
                        loading={isFestsLoading}
                        emptyFallback={
                            <section className="home-section-block">
                                <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Happening near you
                                </h2>
                                <div className={`mx-4 text-center py-10 rounded-3xl ${isDark ? 'bg-black text-gray-400' : 'bg-[#F2F4F7] text-gray-500'}`}>
                                    <p className="text-sm">No events happening near you right now</p>
                                </div>
                            </section>
                        }
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) => handleLike(getHomeItemId(item), item)}
                        onItemClick={navigateToHomeItem}
                        getShareUrl={getHomeItemShareUrl}
                    />

                    <CustomPageSectionsRenderer
                        targetPage="home"
                        fests={fests}
                        treks={homeTreks}
                        communities={homeCommunities}
                        sports={homeSports}
                        runClubs={homeRunClubs}
                        transformedFests={transformedFests}
                        isDark={isDark}
                        loading={isFestsLoading}
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) => handleLike(getHomeItemId(item), item)}
                        onItemClick={navigateToHomeItem}
                        getShareUrl={getHomeItemShareUrl}
                    />

                </div>
            </main>

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


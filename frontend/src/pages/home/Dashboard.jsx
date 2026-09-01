import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, ChevronRight, ChevronLeft, Bell, User, Search, Calendar, MapPin, Instagram, Navigation, X, Zap, Clock, Wifi, ImageOff } from 'lucide-react';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import ShareIcon from '../../assets/share.svg';
import AppLogo from '../../components/AppLogo';
import CulturalFestImage from '../../assets/mobile-icons/cultural-events-icon-02.svg';
import TechFestImage from '../../assets/mobile-icons/tech-icon.svg';
import SportsFestImage from '../../assets/mobile-icons/sports-icon.svg';
import SportsIconNew from '../../assets/mobile-icons/sports-icon-new.svg';
import Sidebar from '../../components/layout/Sidebar';
import Navbar from '../../components/layout/Navbar';
import { useDarkMode } from '../../context/DarkModeContext';
import { useDialog } from '../../context/DialogContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import ContentImage from '../../components/ContentImage';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { setHomeShellReady } from '../../utils/homeShellReady';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import { clearSearchKeywordsCache } from '../../services/searchService';
import { useAuth } from '../../context/AuthContext';
import { TRENDING_CARD_GAP } from '../../hooks/useHomeCarousel';
import HeroBanner from '../../components/HeroBanner';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import HomeCarouselSection from '../../components/HomeCarouselSection';
import HomeEventCard from '../../components/HomeEventCard';
import { buildHomeCarouselItems } from '../../utils/homeCarouselItems';
import { mapHomeCarouselDisplayItems } from '../../utils/mapHomeCarouselDisplayItems';
import { isOnHomeHero } from '../../utils/pageSections';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { faqSchema, itemListSchema, webPageSchema } from '../../utils/seo';
import { HOME_FAQ } from '../../constants/faqs';
import { mapEventShow } from '../../constants/eventsPage';
import { getCoverImageUrl } from '../../utils/coverImages';
import { API_BASE_URL, publicFetchJSONRetry as fetchJSON } from '../../services/api/client';
import { fetchCatalogJSON, invalidateCatalogCache } from '../../services/api/catalogCache';
import { seedPublicConfigCache } from '../../services/api/config.api';
import { usePublicConfig } from '../../hooks/usePublicConfig';
import { communityPath, competitionPath, eventShowPath, festPath, runClubPath, sportRunPath, trekPath } from '../../utils/slugRoutes';
import { buildFestDetailNavState } from '../../utils/detailPageCache';
import { prefetchFestDetail } from '../../services/api/fests.api';

const CrwdCtrlLogin = lazy(() => import('../auth/login'));
const CrwdCtrlRegister = lazy(() => import('../auth/register'));

const HOME_JSON_LD = [
    webPageSchema({
        name: 'CrwdCtrl — Discover fests, clubs & events',
        description:
            'Find and register for college fests, tech and sports events, running clubs, gym communities, treks, and meetups near you.',
        url: '/',
    }),
    itemListSchema({
        name: 'Browse on CrwdCtrl',
        description: 'Categories of events and communities you can discover on CrwdCtrl.',
        url: '/',
        items: [
            { name: 'College Fests', url: '/fests' },
            { name: 'Treks & Adventure', url: '/treks' },
            { name: 'Sports & Running Clubs', url: '/sports' },
            { name: 'Events & Meetups', url: '/events' },
        ],
    }),
    faqSchema(HOME_FAQ),
];

if (import.meta.env.DEV) {
    console.log('Dashboard API Configuration:', {
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
        API_BASE_URL,
        MODE: import.meta.env.MODE,
    });
}

// Auto-retry error component  automatically retries after 5 seconds
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
            <div className="flex justify-center mb-3">
                {isRetrying
                    ? <DetailLoader3DIcon size="compact" />
                    : <Wifi className="w-9 h-9 text-gray-400" />}
            </div>
            <p className={`text-lg font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {isRetrying ? 'Loading events...' : "Couldn't load events"}
            </p>
            <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {isRetrying
                    ? 'Please wait while we connect to the server'
                    : `Retrying automatically in ${countdown}s...`}
            </p>
            {isRetrying ? null : (
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

// Frontend caching system for better Cloud Run performance
const CACHE_KEYS = {
    FESTS_LIST: 'crwdctrl_fests_cache',
    FESTS_TIMESTAMP: 'crwdctrl_fests_timestamp',
    HOME_AUX: 'crwdctrl_home_aux_cache'
};

const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes  admin changes reflect quickly

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
        console.log('Cached fests data to localStorage');
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
        localStorage.removeItem(CACHE_KEYS.HOME_AUX);
        invalidateCatalogCache();
        console.log('Cleared fests cache');
    } catch (error) {
        console.error('Error clearing cache:', error);
    }
};

function hasPendingAdminUpdate() {
    try {
        return !!localStorage.getItem('admin_data_updated');
    } catch (_) {
        return false;
    }
}

function readInitialFestsFromCache() {
    // Only seed from cache when it is still fresh AND no admin change is pending.
    // Painting an expired/stale cache shows an old card order that then visibly
    // "jumps" to the current order once fresh data loads.
    if (!isCacheValid() || hasPendingAdminUpdate()) return [];
    const cached = getCachedData(CACHE_KEYS.FESTS_LIST);
    return Array.isArray(cached) && cached.length > 0 ? cached : [];
}

const ArtistCard = React.memo(({ eventId, image, artistName, genre, collegeName, venue: _venue, dateTime, ticketPrice: _ticketPrice, isDark, onRegister: _onRegister, onToggleFavorite, isFavorite }) => {
    const navigate = useNavigate();
    const [imageError, setImageError] = useState(false);

    const handleImageError = (e) => {
        handleImageErrorWithFallback(e, 240, 170, '#2A2B2E', artistName || 'Event');
        setImageError(true);
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
                {imageError ? (
                    <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1A1B1D]' : 'bg-[#E8EAED]'}`}>
                        <div className="text-center">
                            <ImageOff className={`w-9 h-9 mx-auto mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Image unavailable</p>
                        </div>
                    </div>
                ) : (
                    <ContentImage
                        src={image}
                        alt={artistName || 'Event image'}
                        preset="cardPanel"
                        showPlaceholderUntilLoad
                        placeholderClassName={isDark ? 'bg-[#1A1B1D]' : 'bg-[#E8EAED]'}
                        className="w-full h-full object-cover absolute inset-0"
                        onError={handleImageError}
                        style={{
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
    const { confirm } = useDialog();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();
    const { isAuthenticated, isAuthProcessing, isLoading, isRedirectProcessing } = useAuth();
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [fests, setFests] = useState(readInitialFestsFromCache);
    const [isFestsLoading, setIsFestsLoading] = useState(() => readInitialFestsFromCache().length === 0);
    // Aux feeds hydrate in place; flag kept for settle markers in fetch effects.
    const [, setHomeAuxLoaded] = useState(false);
    usePageContentLoading(isFestsLoading);

    // Soft safety only — do not end loading before cold-start fetches can finish (iOS)
    useEffect(() => {
        if (!isFestsLoading) return undefined;
        const timer = window.setTimeout(() => setIsFestsLoading(false), 45000);
        return () => window.clearTimeout(timer);
    }, [isFestsLoading]);

    const [homeCommunities, setHomeCommunities] = useState([]);
    const [homeTreks, setHomeTreks] = useState([]);
    const [homeSports, setHomeSports] = useState([]);
    const [homeRunClubs, setHomeRunClubs] = useState([]);
    const [homeEventShows, setHomeEventShows] = useState([]);
    const [homePageSections, setHomePageSections] = useState(null);
    // Admin-customisable headings for the fixed home carousels (fallback to defaults).
    const [sectionLabels, setSectionLabels] = useState({ ongoing: 'Ongoing Events', happening: 'Happening near you' });
    const publicConfig = usePublicConfig();
    const [festError, setFestError] = useState(null);
    /** Set when home feed fetch failed (aggregate + fallback) — show Retry, not fake empty catalog */
    const [homeFeedError, setHomeFeedError] = useState(null);
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const [currentLocation, setCurrentLocation] = useState({
        city: 'Pune', // Default fallback
        state: 'Maharashtra',
        country: 'India',
        isDetecting: false,
        hasPermission: false,
        coordinates: null
    });
    const [searchParams, setSearchParams] = useSearchParams();

    // Function to force refresh data (clear cache and fetch fresh)  retries for cold starts
    const forceRefreshData = useCallback(() => {
        console.log('Force refreshing dashboard data...');
        clearCache();
        clearSearchKeywordsCache();
        setFestError(null);
        setHomeFeedError(null);
        setHomeAuxLoaded(false);

        // Keep showing current cards while refreshing  avoid loading flash (log evidence: hypothesis B)
        setFests((current) => {
            if (current.length === 0) setIsFestsLoading(true);
            return current;
        });

        const fetchFreshData = async (attempt = 0) => {
            // User/admin-initiated refresh — keep it resilient across Railway cold starts.
            const maxAttempts = 8;
            try {
                const response = await fetchCatalogJSON('/home', { force: true, retries: 1, timeout: 15000 });
                const data = response.data;
                const festsList = Array.isArray(data?.fests) ? data.fests : [];

                setFests(festsList);
                setFestError(null);
                setHomeFeedError(null);

                if (festsList.length > 0) {
                    setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                }

                if (data && typeof data === 'object') {
                    setHomeCommunities(Array.isArray(data.communities) ? data.communities : []);
                    setHomeTreks(Array.isArray(data.treks) ? data.treks : []);
                    setHomeSports(Array.isArray(data.sports) ? data.sports : []);
                    setHomeRunClubs(Array.isArray(data.runClubs) ? data.runClubs : []);
                    setHomeEventShows(Array.isArray(data.eventShows) ? data.eventShows : []);
                    if (data.sectionLabels && typeof data.sectionLabels === 'object') {
                        setSectionLabels((prev) => ({ ...prev, ...data.sectionLabels }));
                    }
                    if (Array.isArray(data.homepageSections)) {
                        setHomePageSections(data.homepageSections);
                    }
                    if (data.config && typeof data.config === 'object') {
                        seedPublicConfigCache(data.config);
                    }
                }

                setIsFestsLoading(false);
                setHomeAuxLoaded(true);
                console.log('Dashboard data refreshed successfully');
            } catch (error) {
                console.error(` Refresh attempt ${attempt + 1}/${maxAttempts} failed:`, error.message);
                if (attempt < maxAttempts - 1) {
                    const delay = Math.min(2000 + attempt * 1500, 8000);
                    setTimeout(() => fetchFreshData(attempt + 1), delay);
                } else {
                    const msg = 'Unable to load events. Please check your connection and try again.';
                    setFestError(msg);
                    setHomeFeedError(msg);
                    setIsFestsLoading(false);
                    setHomeAuxLoaded(true);
                }
            }
        };

        fetchFreshData();
    }, []);
    // Check for admin changes by listening to custom event AND localStorage
    useEffect(() => {
        // Handler for custom event (same-tab admin updates)
        const handleAdminFestUpdate = (e) => {
            console.log('Custom admin_fest_updated event received:', e.detail);
            console.log('Admin fest updated, refreshing dashboard...');
            forceRefreshData();
        };

        // Handler for storage event (cross-tab admin updates)
        const handleAdminChanges = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) {
                console.log('Admin data change detected via storage event, refreshing dashboard...');
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
                console.error('Dashboard - Error reading stored location:', error);
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
                    console.error('Dashboard - Error parsing updated location:', error);
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

    // Load the homepage feed. Primary path is a single aggregated /home request;
    // it falls back to the resilient per-source fetches (with cold-start retries)
    // if the aggregate is unavailable, so the home page can never be worse off.
    useEffect(() => {
        let cancelled = false;

        // If an admin change is pending, drop the stale cache so we never paint
        // an old card order on this fresh load.
        if (hasPendingAdminUpdate()) {
            clearCache();
            try { localStorage.removeItem('admin_data_updated'); } catch (_) { /* ignore */ }
        }

        // Show cached fests immediately for a fast paint ONLY if still fresh.
        const cachedFests = getCachedData(CACHE_KEYS.FESTS_LIST);
        const hadFreshCache = Array.isArray(cachedFests) && cachedFests.length > 0 && isCacheValid();
        if (hadFreshCache) {
            setFests(cachedFests);
            setIsFestsLoading(false);
        }

        // Device-aware timeout for the resilient fallback fetches.
        const userAgent = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
        const baseTimeout = import.meta.env.VITE_API_TIMEOUT
            ? parseInt(import.meta.env.VITE_API_TIMEOUT)
            : (isIOS || isSafari) ? 20000 : 15000;

        const applyAux = (d) => {
            setHomeCommunities(Array.isArray(d.communities) ? d.communities : []);
            setHomeTreks(Array.isArray(d.treks) ? d.treks : []);
            setHomeSports(Array.isArray(d.sports) ? d.sports : []);
            setHomeRunClubs(Array.isArray(d.runClubs) ? d.runClubs : []);
            setHomeEventShows(Array.isArray(d.eventShows) ? d.eventShows : []);
            if (d.sectionLabels && typeof d.sectionLabels === 'object') {
                setSectionLabels((prev) => ({ ...prev, ...d.sectionLabels }));
            }
            if (Array.isArray(d.homepageSections)) {
                setHomePageSections(d.homepageSections);
            }
            if (d.config && typeof d.config === 'object') {
                seedPublicConfigCache(d.config);
            }
        };

        // Paint the secondary sections (treks/communities/sports/run clubs/events)
        // instantly from cache too, so repeat opens don't show skeletons while the
        // network refreshes them in the background.
        if (hadFreshCache) {
            const cachedAux = getCachedData(CACHE_KEYS.HOME_AUX);
            if (cachedAux && typeof cachedAux === 'object') {
                applyAux(cachedAux);
                setHomeAuxLoaded(true);
            }
        }

        // Primary: aggregated /home. Reject empty success so cold-start empty 200s
        // fall through to the resilient multi-endpoint path (iPhone fix).
        const countHomeItems = (d) => {
            const lens = [
                d.fests, d.treks, d.communities, d.sports, d.runClubs, d.eventShows,
            ].map((a) => (Array.isArray(a) ? a.length : 0));
            return lens.reduce((s, n) => s + n, 0);
        };

        const tryAggregate = async () => {
            try {
                const res = await fetchCatalogJSON('/home', {
                    timeout: baseTimeout,
                    retries: 2,
                });
                const d = res?.data;
                if (!d || d.success !== true || !Array.isArray(d.fests)) return false;
                // Empty aggregate or failed core fest fetch — fall through so
                // per-endpoint fetches can recover after a cold start.
                if (countHomeItems(d) === 0 || d.partial === true) {
                    try { localStorage.removeItem(CACHE_KEYS.HOME_AUX); } catch (_) { /* ignore */ }
                    return false;
                }
                if (cancelled) return true;
                if (d.fests.length > 0) setCachedData(CACHE_KEYS.FESTS_LIST, d.fests);
                setFests(d.fests);
                setFestError(null);
                setHomeFeedError(null);
                setIsFestsLoading(false);
                applyAux(d);
                setHomeAuxLoaded(true);
                const auxPayload = {
                    communities: Array.isArray(d.communities) ? d.communities : [],
                    treks: Array.isArray(d.treks) ? d.treks : [],
                    sports: Array.isArray(d.sports) ? d.sports : [],
                    runClubs: Array.isArray(d.runClubs) ? d.runClubs : [],
                    eventShows: Array.isArray(d.eventShows) ? d.eventShows : [],
                    sectionLabels: d.sectionLabels && typeof d.sectionLabels === 'object' ? d.sectionLabels : undefined,
                    homepageSections: Array.isArray(d.homepageSections) ? d.homepageSections : undefined,
                    config: d.config && typeof d.config === 'object' ? d.config : undefined,
                };
                const auxCount =
                    auxPayload.communities.length +
                    auxPayload.treks.length +
                    auxPayload.sports.length +
                    auxPayload.runClubs.length +
                    auxPayload.eventShows.length;
                if (auxCount > 0) {
                    setCachedData(CACHE_KEYS.HOME_AUX, auxPayload);
                } else {
                    try { localStorage.removeItem(CACHE_KEYS.HOME_AUX); } catch (_) { /* ignore */ }
                }
                return true;
            } catch (_) {
                return false;
            }
        };

        // Fallback: original fests fetch with aggressive cold-start retries.
        const fetchFests = async () => {
            const maxRetries = 4;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                if (cancelled) return;
                try {
                    console.log(`Fetching fests (attempt ${attempt + 1}/${maxRetries})`);
                    const response = await fetchCatalogJSON('/fests/all?priority_check=1', { timeout: baseTimeout, retries: 1 });
                    if (cancelled) return;
                    const data = response.data;
                    const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                    if (festsList.length > 0) {
                        setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                    }
                    setFests(festsList);
                    setFestError(null);
                    setHomeFeedError(null);
                    setIsFestsLoading(false);
                    console.log(`Fests loaded successfully (${festsList.length} fests)`);
                    return;
                } catch (err) {
                    console.warn(`Fetch attempt ${attempt + 1} failed: ${err.message}`);
                    if (attempt < maxRetries - 1) {
                        // Wait longer between each retry: 3s, 4s, 5s, 6s... capped at 8s
                        const delay = Math.min(3000 + attempt * 1000, 8000);
                        await new Promise(r => setTimeout(r, delay));
                    }
                }
            }
            if (cancelled) return;
            if (!hadFreshCache) {
                const msg = 'Unable to load events. Please check your connection and try again.';
                setFestError(msg);
                setHomeFeedError(msg);
                setFests([]);
            } else {
                setFestError(null);
                setHomeFeedError(null);
            }
            setIsFestsLoading(false);
        };

        // Fallback: original per-source secondary fetches.
        const runAuxFetches = () => {
            const auxFetches = [
                fetchCatalogJSON('/trek-communities').then(res => {
                    if (!cancelled) setHomeCommunities(Array.isArray(res?.data?.communities) ? res.data.communities : []);
                }).catch(() => {}),
                fetchCatalogJSON('/treks').then(res => {
                    if (!cancelled) setHomeTreks(Array.isArray(res?.data?.treks) ? res.data.treks : []);
                }).catch(() => {}),
                fetchCatalogJSON('/sports').then(res => {
                    const sports = Array.isArray(res?.data?.events) ? res.data.events : [];
                    if (!cancelled) setHomeSports((prev) => {
                        const map = new Map(prev.map((s) => [String(s._id || s.id), s]));
                        sports.forEach((s) => map.set(String(s._id || s.id), s));
                        return [...map.values()];
                    });
                }).catch(() => {}),
                fetchCatalogJSON('/sports?hub=events').then(res => {
                    const sports = (Array.isArray(res?.data?.events) ? res.data.events : [])
                        .map((s) => ({ ...s, listingHub: 'events' }));
                    if (!cancelled) setHomeSports((prev) => {
                        const map = new Map(prev.map((s) => [String(s._id || s.id), s]));
                        sports.forEach((s) => map.set(String(s._id || s.id), s));
                        return [...map.values()];
                    });
                }).catch(() => {}),
                fetchCatalogJSON('/run-clubs').then(res => {
                    const clubs = Array.isArray(res?.data?.clubs) ? res.data.clubs : [];
                    if (!cancelled) setHomeRunClubs((prev) => {
                        const map = new Map(prev.map((c) => [String(c._id || c.id), c]));
                        clubs.forEach((c) => map.set(String(c._id || c.id), c));
                        return [...map.values()];
                    });
                }).catch(() => {}),
                fetchCatalogJSON('/run-clubs?hub=events').then(res => {
                    const clubs = Array.isArray(res?.data?.clubs) ? res.data.clubs : [];
                    if (!cancelled) setHomeRunClubs((prev) => {
                        const map = new Map(prev.map((c) => [String(c._id || c.id), c]));
                        clubs.forEach((c) => map.set(String(c._id || c.id), c));
                        return [...map.values()];
                    });
                }).catch(() => {}),
                fetchCatalogJSON('/events').then(res => {
                    if (!cancelled) setHomeEventShows(Array.isArray(res?.data?.shows) ? res.data.shows : []);
                }).catch(() => {}),
            ];
            Promise.allSettled(auxFetches).then(() => {
                if (!cancelled) setHomeAuxLoaded(true);
            });
        };

        (async () => {
            const ok = await tryAggregate();
            if (cancelled || ok) return;
            // Aggregate unavailable / empty — use the resilient per-source path.
            fetchFests();
            runAuxFetches();
            // Aggregate carried section labels; fetch them separately on the fallback path.
            fetchCatalogJSON('/home/section-labels').then(res => {
                const l = res?.data?.labels;
                if (!cancelled && l && typeof l === 'object') setSectionLabels(prev => ({ ...prev, ...l }));
            }).catch(() => {});
        })();

        // Safety: never keep the skeleton forever if something hangs (allow cold starts).
        const auxSafety = window.setTimeout(() => {
            if (!cancelled) setHomeAuxLoaded(true);
        }, 45000);

        return () => { cancelled = true; window.clearTimeout(auxSafety); };
    }, []);

    // Cache cleanup and management
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

        // Cache warming - prefetch fresh data when cache is about to expire
        const warmCache = () => {
            if (document.visibilityState !== 'visible') return;
            const timestamp = localStorage.getItem(CACHE_KEYS.FESTS_TIMESTAMP);
            if (timestamp) {
                const age = Date.now() - parseInt(timestamp);
                if (age > CACHE_DURATION * 0.8 && age < CACHE_DURATION) {
                    fetchCatalogJSON('/fests/all', { timeout: 5000, retries: 0 })
                        .then(response => {
                            const data = response.data;
                            const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                            if (festsList.length > 0) {
                                setCachedData(CACHE_KEYS.FESTS_LIST, festsList);
                            }
                        })
                        .catch(() => {});
                }
            }
        };

        // Periodic check keeps a continuously-open dashboard fresh, but warmCache
        // only actually fetches when the cache is 80-100% expired AND the tab is
        // visible — far lighter than the old unconditional 30s fetch loop.
        const warmingInterval = setInterval(warmCache, 60000);
        document.addEventListener('visibilitychange', warmCache);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('visibilitychange', warmCache);
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
        const festSlides = transformedFests
            .filter((f) => f.showOnHomeSlide)
            .map((f) => ({
                id: f.id,
                image: f.image,
                title: f.title,
                subtitle: f.subtitle,
                dateTime: f.dateTime,
                status: f.status,
                homePriority: f.homePriority || 999,
                _type: 'fest',
            }));

        const eventSlides = (homeEventShows || [])
            .filter((e) => isOnHomeHero(e))
            .map((raw) => {
                const show = mapEventShow(raw);
                return {
                    id: show.id,
                    image: getCoverImageUrl(show, 'hero') || show.image,
                    title: show.title,
                    subtitle: show.basedIn,
                    dateTime: show.date,
                    homePriority: raw.homePriority ?? 999,
                    _type: 'events',
                };
            });

        const runClubSlides = (homeRunClubs || [])
            .filter((club) => isOnHomeHero(club))
            .map((club) => ({
                id: club._id,
                image: getCoverImageUrl(club, 'hero') || club.coverImage,
                title: club.name,
                subtitle: club.basedIn || club.organizer || '',
                dateTime: 'Join now',
                homePriority: club.priority ?? 999,
                _type: 'runclub',
                listingHub: club.listingHub,
                slug: club.slug,
                name: club.name,
            }));

        const trekSlides = (homeTreks || [])
            .filter((t) => isOnHomeHero(t))
            .map((t) => {
                const communityName = (
                    (typeof t.communityId === 'object' && (t.communityId?.name || t.communityId?.title))
                    || t.communityName
                    || ''
                );
                return {
                    id: t._id,
                    image: getCoverImageUrl(t, 'hero') || t.coverImage || t.images?.[0],
                    title: t.trekName,
                    subtitle: communityName || t.city || t.difficultyLevel || '',
                    dateTime: t.dateLabel || t.trekDate || 'Trek',
                    homePriority: t.priority ?? 999,
                    _type: 'trek',
                };
            });

        const communitySlides = (homeCommunities || [])
            .filter((c) => isOnHomeHero(c))
            .map((c) => ({
                id: c._id,
                image: getCoverImageUrl(c, 'hero') || c.coverImage,
                title: c.name,
                subtitle: c.basedIn || '',
                dateTime: 'Community',
                homePriority: c.priority ?? 999,
                _type: 'community',
            }));

        const sportSlides = (homeSports || [])
            .filter((s) => isOnHomeHero(s))
            .map((s) => ({
                id: s._id,
                image: getCoverImageUrl(s, 'hero') || s.images?.[0] || s.coverImage,
                title: s.title,
                subtitle: s.city || s.runCategory || '',
                dateTime: s.date || 'Run',
                homePriority: s.homePriority ?? s.priority ?? 999,
                _type: 'sport',
                listingHub: s.listingHub,
                slug: s.slug,
            }));

        return [
            ...festSlides,
            ...eventSlides,
            ...runClubSlides,
            ...trekSlides,
            ...communitySlides,
            ...sportSlides,
        ].sort((a, b) => {
            const priorityA = a.homePriority || 999;
            const priorityB = b.homePriority || 999;
            if (priorityA !== priorityB) return priorityA - priorityB;
            return 0;
        });
    }, [transformedFests, homeEventShows, homeRunClubs, homeTreks, homeCommunities, homeSports]);

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
            const shouldRequestLocation = await confirm({
                title: 'Allow location access?',
                message: 'Allow CrwdCtrl to access your location to show nearby events?',
                confirmText: 'Allow',
                cancelText: 'Not now',
            });

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
                    console.log('Dashboard - Could not verify geolocation permission state:', permissionError);
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
                            console.error('Dashboard - Error storing location:', error);
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

                                    if (cityName && !cityName.match(/^\d+\.?\d*[°,]\s*\d+\.?\d*$/)) {
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

                                    if (cityName && !cityName.match(/^\d+\.?\d*[°,]\s*\d+\.?\d*$/)) {
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
                                console.error('Dashboard - Error storing location:', error);
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
                        console.error('Dashboard - Reverse geocoding failed:', error);
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
                    console.error('Dashboard - GEOLOCATION ERROR:', error);
                    console.error('Dashboard - Error code:', error.code);
                    console.error('Dashboard - Error message:', error.message);
                    
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
            console.error('Dashboard - CRITICAL ERROR in detectUserLocation:', error);
        }
    };

    const buildSectionItems = useCallback((section) => {
        const raw = buildHomeCarouselItems(fests, homeTreks, homeCommunities, section, homeSports, homeRunClubs, homeEventShows);
        return mapHomeCarouselDisplayItems(raw, transformedFests);
    }, [fests, homeTreks, homeCommunities, homeSports, homeRunClubs, homeEventShows, transformedFests]);

    const trendingItems = useMemo(() => buildSectionItems('trending'), [buildSectionItems]);
    const happeningItems = useMemo(() => buildSectionItems('happening'), [buildSectionItems]);

    const navigateToFestDetail = useCallback((item) => {
        const id = item._id || item.id;
        const rawFest = fests.find((f) => String(f._id || f.id) === String(id));
        if (rawFest) prefetchFestDetail(rawFest);
        const eventData = rawFest ? buildFestDetailNavState(rawFest) : null;
        navigate(festPath(item), { state: eventData ? { eventData } : undefined });
    }, [fests, navigate]);

    const navigateToHomeItem = useCallback((item) => {
        if (item._type === 'fest') {
            navigateToFestDetail(item);
        } else if (item._type === 'trek') {
            navigate(trekPath(item), { state: { trek: item } });
        } else if (item._type === 'community') {
            navigate(communityPath(item), {
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
            navigate(runClubPath(item), {
                state: {
                    club: {
                        _id: item._id,
                        name: item.name,
                        basedIn: item.basedIn,
                        coverImage: item.coverImage,
                        listingHub: item.listingHub,
                    },
                },
            });
        } else if (item._type === 'sport') {
            navigate(sportRunPath(item));
        } else if (item._type === 'events') {
            navigate(eventShowPath(item));
        }
    }, [navigate, navigateToFestDetail]);

    const getHomeItemShareUrl = useCallback((item) => {
        const origin = window.location.origin;
        if (item._type === 'fest') return `${origin}${festPath(item)}`;
        if (item._type === 'trek') return `${origin}${trekPath(item)}`;
        if (item._type === 'community') return `${origin}${communityPath(item)}`;
        if (item._type === 'runclub') return `${origin}${runClubPath(item)}`;
        if (item._type === 'sport') return `${origin}${sportRunPath(item)}`;
        if (item._type === 'events') return `${origin}${eventShowPath(item)}`;
        return `${origin}${festPath(item)}`;
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
            navigate(competitionPath({ _id: id, id, name: result.title, title: result.title }));
        } else if (type === 'fest') {
            navigateToFestDetail({ id, _id: id, festName: result.title, title: result.title });
        } else if (type === 'trek' || type === 'community' || type === 'sport') {
            navigateToHomeItem(result);
        } else {
            navigate(`/view-details/${id}`);
        }
    }, [navigate, navigateToHomeItem, navigateToFestDetail]);

    const searchKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({
            fests,
            treks: homeTreks,
            communities: homeCommunities,
            sports: homeSports,
        }),
        [fests, homeTreks, homeCommunities, homeSports],
    );

    // Paint as soon as fests exist (cache or network). Aux feeds hydrate in place.
    const homeBooting = isFestsLoading && fests.length === 0;
    const [homeLoadTimedOut, setHomeLoadTimedOut] = useState(false);

    useEffect(() => {
        if (!homeBooting) {
            setHomeLoadTimedOut(false);
            return undefined;
        }
        const timeoutMs = /iPhone|iPad|iPod|Safari/i.test(navigator.userAgent || '') ? 12000 : 8000;
        const timer = window.setTimeout(() => setHomeLoadTimedOut(true), timeoutMs);
        return () => window.clearTimeout(timer);
    }, [homeBooting]);

    const showHomeContent = !homeBooting || homeLoadTimedOut;

    useLayoutEffect(() => {
        setHomeShellReady(showHomeContent);
    }, [showHomeContent]);

    if (!showHomeContent) {
        return null;
    }

    return (
        <div className="crwdctrl-page crwdctrl-page--hub flex flex-col min-h-screen transition-colors">
          <Seo
            title="CrwdCtrl — Discover fests, clubs & events"
            description="Find and register for college fests, tech and sports events, running clubs, gym communities, treks, and meetups near you."
            canonical="/"
            keywords="college fests, tech fest, sports events, running clubs, gym communities, treks, meetups, student events, event discovery"
            jsonLd={HOME_JSON_LD}
            withBrand={false}
          />
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

                            {/* Location dropdown  keep existing */}
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
                                            {currentLocation.isDetecting ? 'Detecting…' : 'Detect My Location'}
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
                {/* Hero  full chrome width on desktop (aligns with navbar Pune  profile) */}
                {heroEvents.length > 0 && (
                    <HeroBanner
                        events={heroEvents}
                        onEventClick={(id) => {
                            const slide = heroEvents.find((e) => e.id === id);
                            if (!slide) return;
                            if (slide._type === 'events') navigate(eventShowPath(slide));
                            else if (slide._type === 'runclub') {
                                navigate(runClubPath(slide), {
                                    state: {
                                        club: {
                                            _id: slide.id,
                                            name: slide.name || slide.title,
                                            basedIn: slide.subtitle,
                                            coverImage: slide.image,
                                            listingHub: slide.listingHub,
                                            slug: slide.slug,
                                        },
                                    },
                                });
                            } else if (slide._type === 'trek') navigate(trekPath(slide), { state: { trek: slide } });
                            else if (slide._type === 'community') navigate(communityPath(slide));
                            else if (slide._type === 'sport') navigate(sportRunPath(slide));
                            else navigateToFestDetail(slide);
                        }}
                        isDark={isDark}
                    />
                )}

                <AnnouncementBanner announcement={publicConfig.announcement} />

                <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 crwdctrl-hub-body">
                    {/* Ongoing Events */}
                    <HomeCarouselSection
                        title={publicConfig.labels.home.ongoing || sectionLabels.ongoing}
                        items={trendingItems}
                        isDark={isDark}
                        tallCard
                        cardGap={TRENDING_CARD_GAP}
                        emptyFallback={
                            (homeFeedError || festError) && trendingItems.length === 0 ? (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {publicConfig.labels.home.ongoing || sectionLabels.ongoing}
                                    </h2>
                                    <div className="px-4"><AutoRetryError isDark={isDark} onRetry={forceRefreshData} /></div>
                                </section>
                            ) : (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {publicConfig.labels.home.ongoing || sectionLabels.ongoing}
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
                        title={publicConfig.labels.home.happening || sectionLabels.happening}
                        items={happeningItems}
                        isDark={isDark}
                        wideCard
                        emptyFallback={
                            (homeFeedError || festError) && happeningItems.length === 0 ? (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {publicConfig.labels.home.happening || sectionLabels.happening}
                                    </h2>
                                    <div className="px-4"><AutoRetryError isDark={isDark} onRetry={forceRefreshData} /></div>
                                </section>
                            ) : (
                                <section className="home-section-block">
                                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {publicConfig.labels.home.happening || sectionLabels.happening}
                                    </h2>
                                    <div className={`mx-4 text-center py-10 rounded-3xl ${isDark ? 'bg-black text-gray-400' : 'bg-[#F2F4F7] text-gray-500'}`}>
                                        <p className="text-sm">{publicConfig.emptyStates.home.happening}</p>
                                    </div>
                                </section>
                            )
                        }
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) => handleLike(getHomeItemId(item), item)}
                        onItemClick={navigateToHomeItem}
                        getShareUrl={getHomeItemShareUrl}
                    />

                    <CustomPageSectionsRenderer
                        targetPage="home"
                        sections={homePageSections ?? undefined}
                        fests={fests}
                        treks={homeTreks}
                        communities={homeCommunities}
                        sports={homeSports}
                        runClubs={homeRunClubs}
                        eventShows={homeEventShows}
                        transformedFests={transformedFests}
                        isDark={isDark}
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) => handleLike(getHomeItemId(item), item)}
                        onItemClick={navigateToHomeItem}
                        getShareUrl={getHomeItemShareUrl}
                    />

                </div>
            </main>

            <FaqSection items={HOME_FAQ} />

            <div className="pb-20 md:pb-0">

            </div>
            </div>


            {/* Login Modal */}
            {showLogin && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
                <div className="fixed inset-0 z-50">
                    <Suspense fallback={null}>
                        <CrwdCtrlLogin onClose={handleCloseLogin} onSwitchToRegister={handleSwitchToRegister} />
                    </Suspense>
                </div>
            )}

            {/* Register Modal */}
            {showRegister && !isAuthProcessing && !isLoading && !isRedirectProcessing && (
                <div className="fixed inset-0 z-50">
                    <Suspense fallback={null}>
                        <CrwdCtrlRegister onClose={handleCloseRegister} onSwitchToLogin={handleSwitchToLogin} />
                    </Suspense>
                </div>
            )}

        </div>
    );
};

export default Dashboard;


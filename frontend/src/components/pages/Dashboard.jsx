import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Heart, ChevronRight, ChevronLeft, Bell, User, Search, Calendar, MapPin, Instagram, Navigation, X, Loader2 } from 'lucide-react';
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
import { searchFests } from '../../services/searchService';
import CrwdCtrlLogin from './login';
import CrwdCtrlRegister from './register';
import LoadingSkeleton from '../LoadingSkeleton';
import axios from 'axios';

// Configure axios base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.baseURL = API_BASE_URL;
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
                    ? 'bg-[#1B1C1E]'
                    : 'bg-[#F5F6FA]'
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
                            <div className={`text-4xl mb-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>🎭</div>
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

                {/* Favorite Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite();
                    }}
                    className="absolute top-2 sm:top-3 right-2 sm:right-3 w-7 sm:w-9 h-7 sm:h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center hover:bg-white/30 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart className={`w-3.5 sm:w-4 h-3.5 sm:h-4 transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`} />
                </button>

            </div>

            <div className={`p-3 sm:p-4 ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
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
    const [showLogin, setShowLogin] = useState(false);
    const [showRegister, setShowRegister] = useState(false);
    const [error, setError] = useState(null);
    const [fests, setFests] = useState([]);
    const [isFestsLoading, setIsFestsLoading] = useState(true);
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
    const upcomingScrollRef = useRef(null);
    const lastYearScrollRef = useRef(null);
    const searchRef = useRef(null);
    const [searchParams, setSearchParams] = useSearchParams();
    
    // State for arrow visibility
    const [ongoingShowLeftArrow, setOngoingShowLeftArrow] = useState(false);
    const [ongoingShowRightArrow, setOngoingShowRightArrow] = useState(true);
    const [upcomingShowLeftArrow, setUpcomingShowLeftArrow] = useState(false);
    const [upcomingShowRightArrow, setUpcomingShowRightArrow] = useState(true);
    const [lastYearShowLeftArrow, setLastYearShowLeftArrow] = useState(false);
    const [lastYearShowRightArrow, setLastYearShowRightArrow] = useState(true);

    // Check for login modal parameter
    useEffect(() => {
        if (searchParams.get('showLogin') === 'true') {
            setShowLogin(true);
        }
    }, [searchParams]);

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
                console.error('❌ Dashboard - Error reading stored location:', error);
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
                    console.error('❌ Dashboard - Error parsing updated location:', error);
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

    // Fetch fests from backend API with retry logic
    useEffect(() => {
        const fetchFests = async (retryCount = 0) => {
            const maxRetries = 3;
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
            
            try {
                setIsFestsLoading(true);
                
                // Use environment-specific timeout
                const timeout = import.meta.env.VITE_API_TIMEOUT ? 
                    parseInt(import.meta.env.VITE_API_TIMEOUT) : 25000;
                
                const response = await axios.get('/fests/all', {
                    timeout: timeout
                });
                
                const data = response.data;
                const festsList = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                setFests(festsList);
                setFestError(null);
            } catch (err) {
                console.error('Dashboard - Error fetching fests:', err);
                
                // More aggressive retry for Cloud Run cold starts and CORS issues
                const shouldRetry = retryCount < maxRetries && (
                    err.code === 'ECONNABORTED' || // Timeout
                    err.code === 'ERR_NETWORK' || // Network error
                    err.code === 'NETWORK_ERROR' || // Network error variant
                    err.code === 'ERR_FAILED' || // Failed request
                    !err.response || // No response from server
                    (err.response?.status >= 500 && err.response?.status < 600) || // Server errors
                    err.response?.status === 502 || // Bad Gateway
                    err.response?.status === 503 || // Service Unavailable
                    err.response?.status === 504 || // Gateway Timeout
                    err.message?.includes('CORS') // CORS errors
                );
                
                if (shouldRetry) {
                    setTimeout(() => {
                        fetchFests(retryCount + 1);
                    }, retryDelay);
                } else {
                    const isProduction = import.meta.env.VITE_APP_ENVIRONMENT === 'production';
                    const errorMessage = err.message?.includes('CORS') 
                        ? 'Connection issue detected. Please try refreshing the page.'
                        : isProduction 
                            ? 'Unable to load events. Please try refreshing the page.'
                            : 'Unable to load events. Please check your connection and try again.';
                    setFestError(errorMessage);
                    setFests([]);
                    setIsFestsLoading(false);
                }
            } finally {
                if (retryCount === 0 || retryCount >= maxRetries) {
                    setIsFestsLoading(false);
                }
            }
        };

        // Delay initial request to allow page to settle
        const timer = setTimeout(() => {
            fetchFests();
        }, 300);

        return () => clearTimeout(timer);
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
        const upcomingRef = upcomingScrollRef.current;
        const lastYearRef = lastYearScrollRef.current;

        const handleOngoingScroll = () => checkScrollPosition(ongoingScrollRef, setOngoingShowLeftArrow, setOngoingShowRightArrow);
        const handleUpcomingScroll = () => checkScrollPosition(upcomingScrollRef, setUpcomingShowLeftArrow, setUpcomingShowRightArrow);
        const handleLastYearScroll = () => checkScrollPosition(lastYearScrollRef, setLastYearShowLeftArrow, setLastYearShowRightArrow);

        if (ongoingRef) {
            ongoingRef.addEventListener('scroll', handleOngoingScroll);
            handleOngoingScroll(); // Initial check
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
                ticketPrice: fest?.ticketPrice || 'Free'
            };
        }).filter(f => f.id);
    }, [fests]);

    // Filter events by status
    const ongoingEvents = useMemo(() => 
        transformedFests.filter(f => f.status === 'ongoing'), 
        [transformedFests]
    );
    
    const upcomingEvents = useMemo(() => 
        transformedFests.filter(f => f.status === 'upcoming'), 
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
    }, [isFestsLoading, ongoingEvents.length, upcomingEvents.length, lastYearEvents.length, checkScrollPosition]);

    const handleRegister = useCallback((eventId) => {
        navigate(`/view-details/${eventId}`);
    }, [navigate]);

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
                    const results = await searchFests(searchQuery);
                    setSearchResults(results.slice(0, 6)); // Limit to 6 results for better UX
                    setIsSearchDropdownOpen(true);
                } catch (error) {
                    console.error('Search error:', error);
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
        setSearchQuery('');
        setIsSearchDropdownOpen(false);
        navigate(`/view-details/${event.id}`);
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
                            console.error('❌ Dashboard - Error storing location:', error);
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
                                console.error('❌ Dashboard - Error storing location:', error);
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
                        console.error('❌ Dashboard - Reverse geocoding failed:', error);
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
                    console.error('❌ Dashboard - GEOLOCATION ERROR:', error);
                    console.error('❌ Dashboard - Error code:', error.code);
                    console.error('❌ Dashboard - Error message:', error.message);
                    
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
            console.error('❌ Dashboard - CRITICAL ERROR in detectUserLocation:', error);
        }
    };

    // Error state
    if (error) {
        return (
            <div className={`min-h-screen transition-colors flex items-center justify-center ${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-50'}`}>
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
        <div className={`flex flex-col min-h-screen transition-colors ${isDark ? 'bg-[#0E0E0F]' : 'bg-white'}`}>
            <div className={`transition-all duration-300 flex flex-col flex-1`}>

                {/* Mobile Header */}
                <div className={`lg:hidden sticky top-0 z-40 backdrop-blur-md border-b transition-all duration-300 rounded-b-2xl ${isDark
                    ? 'bg-[#0a0a0a] border-[#1B1C1E]'
                    : 'bg-[#F5F6FA] border-[#F5F6FA]'
                    }`}>
                    {/* Top Header Row */}
                    <div className="flex items-center justify-between px-4 py-3 ">
                        {/* App Logo */}
                        <div className="flex items-center">
                            <img src={Logo} alt="CrwdCtrl" className="h-18 w-auto" />
                        </div>

                        {/* Right Icons */}
                        <div className="flex items-center space-x-3">

                            {/* Location Icon */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsLocationDropdownOpen(!isLocationDropdownOpen)}
                                    className={`flex items-center space-x-2 p-2 rounded-xl transition-colors ${isDark
                                        ? 'text-gray-300 hover:bg-gray-800 hover:text-cyan-400'
                                        : 'text-gray-600 hover:bg-gray-100 hover:text-cyan-600'
                                        }`}
                                    aria-label="Location options"
                                >
                                    {currentLocation.isDetecting ? (
                                        <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <MapPin className={`w-5 h-5 ${currentLocation.hasPermission ? 'text-cyan-500' : ''}`} />
                                    )}
                                    {/* Show location text on mobile when detected */}
                                    {currentLocation.hasPermission && !currentLocation.isDetecting && (
                                        <span className="text-xs font-medium text-cyan-500 max-w-[80px] truncate">
                                            {currentLocation.city}
                                        </span>
                                    )}
                                </button>

                                {/* Location Dropdown for Dashboard */}
                                {isLocationDropdownOpen && (
                                    <div className={`absolute right-0 mt-2 w-80 rounded-2xl shadow-2xl border backdrop-blur-md z-50 ${isDark
                                        ? 'bg-black/95 border-gray-700/50'
                                        : 'bg-white/95 border-gray-200/50'
                                        }`}>
                                        {/* Header */}
                                        <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <div className="flex items-center justify-between">
                                                <h3 className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    Current Location
                                                </h3>
                                                <button
                                                    onClick={() => setIsLocationDropdownOpen(false)}
                                                    className={`p-1 rounded-lg transition-colors ${isDark
                                                        ? 'hover:bg-gray-700 text-gray-400'
                                                        : 'hover:bg-gray-100 text-gray-500'
                                                        }`}
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Location Info */}
                                        <div className="p-4">
                                            <div className="flex items-start space-x-3 mb-4">
                                                <div className={`p-2 rounded-lg ${currentLocation.hasPermission
                                                    ? 'bg-green-100 text-green-600'
                                                    : 'bg-orange-100 text-orange-600'
                                                    }`}>
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {currentLocation.city}
                                                    </p>
                                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {currentLocation.state}, {currentLocation.country}
                                                    </p>
                                                    <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        {currentLocation.hasPermission ? 'Location detected automatically' : 'Using default location'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex flex-col space-y-2">
                                                <button
                                                    onClick={() => {
                                                        setIsLocationDropdownOpen(false);
                                                        detectUserLocation();
                                                    }}
                                                    disabled={currentLocation.isDetecting}
                                                    className={`flex items-center justify-center space-x-2 w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${isDark
                                                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-700 disabled:text-gray-400'
                                                        : 'bg-cyan-600 hover:bg-cyan-700 text-white disabled:bg-gray-200 disabled:text-gray-500'
                                                        } ${currentLocation.isDetecting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                                >
                                                    {currentLocation.isDetecting ? (
                                                        <>
                                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                            <span>Detecting Location...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Navigation className="w-4 h-4" />
                                                            <span>Detect My Location</span>
                                                        </>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setIsLocationDropdownOpen(false);
                                                        if (currentLocation.coordinates) {
                                                            const { latitude, longitude } = currentLocation.coordinates;
                                                            window.open(`https://www.google.com/maps/@${latitude},${longitude},15z`, '_blank');
                                                        } else {
                                                            // Fallback to search by city name
                                                            const searchQuery = encodeURIComponent(`${currentLocation.city}, ${currentLocation.state}, ${currentLocation.country}`);
                                                            window.open(`https://www.google.com/maps/search/${searchQuery}`, '_blank');
                                                        }
                                                    }}
                                                    className={`flex items-center justify-center space-x-2 w-full py-2 px-3 rounded-lg text-sm font-medium border transition-all ${isDark
                                                        ? 'border-gray-600 text-gray-300 hover:bg-gray-800/60'
                                                        : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <MapPin className="w-4 h-4" />
                                                    <span>Open in Maps</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Footer Note */}
                                        <div className={`px-4 py-3 border-t text-center ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                Location is used to show nearby events
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Notification Bell */}
                            <button
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl transition-colors ${isDark
                                    ? 'text-gray-300 hover:bg-gray-800 hover:text-cyan-400'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-cyan-600'
                                    }`}
                                aria-label="View notifications"
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                )}
                            </button>

                        </div>
                    </div>

                    {/* Search Bar Row */}
                    <div className="px-4 pb-3  mb-1">
                        <div className="flex items-center">
                            {/* Search Bar */}
                            <div className="flex-1 relative" ref={searchRef}>
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search events, colleges..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-400/30 ${isDark
                                        ? 'bg-[#0E0E0F] text-white placeholder-gray-400 focus:border-cyan-400'
                                        : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-cyan-400'
                                        }`}
                                />
                                
                                {/* Search Results Dropdown */}
                                {isSearchDropdownOpen && (
                                    <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl shadow-lg border z-50 max-h-80 overflow-y-auto ${isDark ? 'bg-[#1B1C1E] border-gray-700' : 'bg-white border-gray-200'}`}>
                                        {isSearching ? (
                                            <div className="p-4 text-center">
                                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500 mx-auto"></div>
                                                <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Searching...</p>
                                            </div>
                                        ) : searchResults.length > 0 ? (
                                            <div className="py-2">
                                                {searchResults.map((event, index) => (
                                                    <button
                                                        key={event.id}
                                                        onClick={() => handleSearchResultClick(event)}
                                                        className={`w-full px-4 py-3 text-left hover:bg-opacity-50 transition-colors ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <img
                                                                src={getImageUrl(event.image)}
                                                                alt={event.title}
                                                                className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                                                                onError={(e) => {
                                                                    handleImageErrorWithFallback(e, 40, 40, '#6366f1', event.title);
                                                                }}
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                    {event.title}
                                                                </h4>
                                                                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                                    {event.organizing_body}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center">
                                                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>No events found</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <main className="flex-1 overflow-y-auto">
                    <div className="px-4 py-5 sm:p-6 md:p-8 lg:px-12 lg:py-12 max-w-[1440px] mx-auto">
                        {/* Categories Section - Hidden on laptop/desktop, visible on mobile */}
                        <section className="mb-6 sm:mb-8 lg:hidden">
                            <h2 className={`text-2xl sm:text-3xl lg:text-2xl font-bold mb-4 sm:mb-6 tracking-tight ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                Categories
                            </h2>

                            <div className="flex gap-1 sm:gap-3 overflow-x-auto scrollbar-hide pb-3">
                                {[
                                    { name: 'CULTURAL', icon: CulturalFestImage, path: '/cultural-fest' },
                                    { name: 'TECH', icon: TechFestImage, path: '/tech-fest' },
                                    { name: 'SPORTS', icon: SportsIconNew, path: '/sports-fest' }
                                ].map((category, index) => (
                                    <div
                                        key={index}
                                        onClick={() => navigate(category.path)}
                                        className="flex flex-col items-center cursor-pointer transition-all duration-200 hover:scale-105 min-w-[80px] flex-shrink-0"
                                    >
                                        {/* Icon Block */}
                                        <div className={`w-16 h-16 rounded-xl mb-2 flex items-center justify-center ${isDark ? 'bg-[#0A0A0A]' : 'bg-gray-100'}`}>
                                            <img src={category.icon} alt={category.name} className={`w-8 h-8 ${isDark ? 'filter brightness-0 invert' : ''}`} />
                                        </div>

                                        {/* Label */}
                                        <span
                                            className={`text-xs font-medium text-center ${isDark ? 'text-gray-300' : 'text-gray-700'
                                                }`}
                                        >
                                            {category.name}
                                        </span>
                                    </div>
                                ))}
                            </div>

                        </section>

                        {/* Ongoing section now prefers live fests with status=ongoing, falls back to legacy events */}
                        <section className="mb-6 sm:mb-12 md:mb-17 md:pt-6">
                            <h2 className={`text-xl sm:text-2xl lg:text-2xl font-bold mb-4 sm:mb-6 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Ongoing Events
                            </h2>

                            {/* Unified Mobile and Desktop: Horizontal scrollable cards */}
                            <div className="relative">
                                {isFestsLoading ? (
                                    <LoadingSkeleton count={3} />
                                ) : festError ? (
                                    <div className="text-center py-12 text-red-500">{festError}</div>
                                ) : ongoingEvents.length > 0 ? (
                                    <>
                                        {/* Left Scroll Button - Only show if scrolled and more than 3 items */}
                                        {ongoingEvents.length > 3 && ongoingShowLeftArrow && (
                                            <button
                                                onClick={() => scrollLeft(ongoingScrollRef)}
                                                className={`hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                    isDark 
                                                        ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                        : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                                }`}
                                                aria-label="Scroll left"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        )}

                                        {/* Right Scroll Button - Only show if not at end and more than 3 items */}
                                        {ongoingEvents.length > 3 && ongoingShowRightArrow && (
                                            <button
                                                onClick={() => scrollRight(ongoingScrollRef)}
                                                className={`hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                    isDark 
                                                        ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                        : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                                }`}
                                                aria-label="Scroll right"
                                            >
                                                <ChevronRight className="w-6 h-6" />
                                            </button>
                                        )}

                                        <div 
                                            ref={ongoingScrollRef}
                                            className="overflow-x-auto overflow-y-visible scrollbar-hide" 
                                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                        >
                                            <div 
                                                className="flex gap-4 sm:gap-6 pb-4 snap-x snap-mandatory" 
                                                style={{ 
                                                    WebkitOverflowScrolling: 'touch',
                                                    scrollBehavior: 'smooth'
                                                }}
                                            >
                                        {ongoingEvents.slice(0, 6).map((event) => (
                                            <div
                                                key={event.id}
                                                onClick={() => navigate(`/view-details/${event.id}`)}
                                                className={`min-w-[290px] w-[290px]
                                                            sm:min-w-[300px] sm:w-[300px]
                                                            lg:min-w-[340px] lg:w-[340px]
                                                            rounded-xl shadow-sm hover:shadow-xl transition-all duration-300
                                                            overflow-hidden cursor-pointer group flex-shrink-0 snap-start
                                                            ${isDark ? 'bg-[#1B1C1E]' : 'bg-white'}`}
                                            >
                                                {/* Image */}
                                                <div className="relative h-[200px] overflow-hidden">
                                                    <img
                                                        src={getImageUrl(event.image)}
                                                        alt={event.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            handleImageErrorWithFallback(
                                                                e,
                                                                300,
                                                                200,
                                                                '#8b5cf6',
                                                                event.title || 'Event'
                                                            );
                                                        }}
                                                    />

                                                    {/* Dark overlay */}
                                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-all duration-300" />

                                                    {/* Status */}
                                                    <div className="absolute top-3 right-3">
                                                        <span className={`${getStatusBadgeColor(event.status)} text-white text-xs px-3 py-1 rounded-full font-medium capitalize`}>
                                                            {event.status}
                                                        </span>
                                                    </div>

                                                    {/* Like Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLike(event.id, event);
                                                        }}
                                                        className={`absolute top-3 left-3 w-9 h-9 rounded-full
                                                        ${isDark ? 'bg-gray-800/80 hover:bg-gray-700/90' : 'bg-white/90 hover:bg-white'}
                                                        shadow-lg flex items-center justify-center transition-all duration-200
                                                        border-2 ${isFavorite(event.id) ? 'border-red-500' : isDark ? 'border-white/20' : 'border-gray-900'}
                                                        backdrop-blur-sm`}
                                                        title={isFavorite(event.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                    >
                                                        <Heart
                                                            className={`w-5 h-5 transition-all duration-200 ${
                                                                isFavorite(event.id)
                                                                    ? 'text-red-500 fill-red-500 scale-110'
                                                                    : isDark ? 'text-white hover:text-red-400' : 'text-gray-900 hover:text-red-400'
                                                            }`}
                                                        />
                                                    </button>

                                                    {/* Bottom gradient */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                        <p className="text-white/90 text-sm">{event.date}</p>
                                                    </div>
                                                </div>

                                                {/* Content - Simplified for Ongoing Events */}
                                                <div className="p-3 sm:p-4">
                                                    {/* Title with Share Button */}
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h3 className={`text-lg font-bold flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {event.title}
                                                        </h3>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (navigator.share) {
                                                                    navigator.share({
                                                                        title: event.title,
                                                                        text: `Check out ${event.title}`,
                                                                        url: `${window.location.origin}/view-details/${event.id}`,
                                                                    }).catch(() => {});
                                                                }
                                                            }}
                                                            className={`ml-2 p-2 rounded-full transition-colors ${
                                                                isDark 
                                                                    ? 'bg-gray-800 hover:bg-gray-700' 
                                                                    : 'bg-gray-100 hover:bg-gray-200'
                                                            }`}
                                                            aria-label="Share event"
                                                        >
                                                            <img
                                                                src={ShareIcon}
                                                                alt="Share"
                                                                className={`w-5 h-5 ${isDark ? 'filter brightness-0 invert' : ''}`}
                                                            />
                                                        </button>
                                                    </div>

                                                    {/* College Name with minimal spacing */}
                                                    <p className={`text-sm mb-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        {event.subtitle}
                                                    </p>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/view-details/${event.id}`);
                                                        }}
                                                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        View details
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <div className="text-4xl mb-4">📅</div>
                                        <p className="text-lg">No Ongoing events available</p>
                                    </div>
                                )}
                            </div>

                        </section>

                        {/* Featured Lineup Section - Always Visible */}
                        {/*<section className="mb-4 sm:mb-12 md:mb-15 md:pt-6">*/}
                        {/*    <div className="flex items-center justify-between mb-4 sm:mb-6 md:mb-8">*/}
                        {/*        <h2 className={`text-xl sm:text-2xl lg:text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>*/}
                        {/*            Featured Lineup*/}
                        {/*        </h2>*/}
                        {/*    </div>*/}

                        {/*    <div className="relative -mx-4 sm:mx-0">*/}
                        {/*        /!* Horizontal scrollable container for all screen sizes *!/*/}
                        {/*        <div*/}
                        {/*            ref={scrollContainerRef}*/}
                        {/*            className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 sm:pb-8 scrollbar-hide pt-2 sm:pt-4 px-4 sm:px-1"*/}
                        {/*            style={{*/}
                        {/*                // iOS Safari scrolling container fixes*/}
                        {/*                WebkitOverflowScrolling: 'touch',*/}
                        {/*                scrollBehavior: 'smooth',*/}
                        {/*                WebkitTransform: 'translateZ(0)',*/}
                        {/*                transform: 'translateZ(0)',*/}
                        {/*                WebkitBackfaceVisibility: 'hidden',*/}
                        {/*                backfaceVisibility: 'hidden',*/}
                        {/*                touchAction: 'pan-x',*/}
                        {/*                willChange: 'scroll-position'*/}
                        {/*            }}*/}
                        {/*        >*/}
                        {/*            {featuredArtists.length > 0 ? (*/}
                        {/*                featuredArtists.map((artist) => (*/}
                        {/*                    <ArtistCard*/}
                        {/*                        key={`featured-${artist.eventId}`}*/}
                        {/*                        {...artist}*/}
                        {/*                        isDark={isDark}*/}
                        {/*                        onRegister={handleRegister}*/}
                        {/*                        onToggleFavorite={() => handleLike(artist.eventId, artist.eventData)}*/}
                        {/*                        isFavorite={isFavorite(artist.eventId)}*/}
                        {/*                    />*/}
                        {/*                ))*/}
                        {/*            ) : (*/}
                        {/*                <div className={`flex-1 text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>*/}
                        {/*                    <div className="text-4xl mb-4">🎭</div>*/}
                        {/*                    <p className="text-lg font-medium">No featured events available</p>*/}
                        {/*                </div>*/}
                        {/*            )}*/}
                        {/*        </div>*/}
                        {/*    </div>*/}
                        {/*</section>*/}

                        {/* Coming Soon Section */}
                        {/* Upcoming section uses status=upcoming fests, falls back to static comingSoonEvents */}
                        <section className="mb-6 sm:mb-6 md:mb-9 ">
                            <h2 className={`text-xl sm:text-2xl lg:text-2xl font-bold mb-6 sm:mb-6 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Upcoming Events
                            </h2>

                            {/* Coming Soon Events – Horizontal scroll (same format) */}
                            <div className="relative">
                                {isFestsLoading ? (
                                    <LoadingSkeleton count={4} />
                                ) : festError ? (
                                    <div className="text-center py-12 text-red-500">{festError}</div>
                                ) : upcomingEvents.length > 0 ? (
                                    <>
                                        {/* Left Scroll Button - Only show if scrolled and more than 3 items */}
                                        {upcomingEvents.length > 3 && upcomingShowLeftArrow && (
                                            <button
                                                onClick={() => scrollLeft(upcomingScrollRef)}
                                                className={`hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                    isDark 
                                                        ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                        : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                                }`}
                                                aria-label="Scroll left"
                                            >
                                                <ChevronLeft className="w-6 h-6" />
                                            </button>
                                        )}

                                        {/* Right Scroll Button - Only show if not at end and more than 3 items */}
                                        {upcomingEvents.length > 3 && upcomingShowRightArrow && (
                                            <button
                                                onClick={() => scrollRight(upcomingScrollRef)}
                                                className={`hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                    isDark 
                                                        ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                        : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                                }`}
                                                aria-label="Scroll right"
                                            >
                                                <ChevronRight className="w-6 h-6" />
                                            </button>
                                        )}

                                        <div 
                                            ref={upcomingScrollRef}
                                            className="overflow-x-auto overflow-y-visible scrollbar-hide" 
                                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                        >
                                            <div 
                                                className="flex gap-4 sm:gap-6 pb-4 snap-x snap-mandatory" 
                                                style={{ 
                                                    WebkitOverflowScrolling: 'touch',
                                                    scrollBehavior: 'smooth'
                                                }}
                                            >
                                        {upcomingEvents.slice(0, 6).map((event) => (
                                            <div
                                                key={event.id}
                                                onClick={() => navigate(`/view-details/${event.id}`)}
                                                className={`min-w-[290px] w-[290px]
                                                            sm:min-w-[300px] sm:w-[300px]
                                                            lg:min-w-[340px] lg:w-[340px]
                                                            rounded-xl shadow-sm hover:shadow-xl transition-all duration-300
                                                            overflow-hidden cursor-pointer group flex-shrink-0 snap-start
                                                            ${isDark ? 'bg-[#1B1C1E]' : 'bg-white'}`}
                                            >
                                                {/* Image */}
                                                <div className="relative h-[200px] overflow-hidden">
                                                    <img
                                                        src={getImageUrl(event.image)}
                                                        alt={event.title}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                        loading="lazy"
                                                        onError={(e) => {
                                                            handleImageErrorWithFallback(
                                                                e,
                                                                300,
                                                                200,
                                                                '#8b5cf6',
                                                                event.title || 'Event'
                                                            );
                                                        }}
                                                    />

                                                    {/* Dark overlay */}
                                                    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-all duration-300" />

                                                    {/* Status */}
                                                    <div className="absolute top-3 right-3">
                                                        <span className={`${getStatusBadgeColor(event.status)} text-white text-xs px-3 py-1 rounded-full font-medium capitalize`}>
                                                            {event.status}
                                                        </span>
                                                    </div>

                                                    {/* Like Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleLike(event.id, event);
                                                        }}
                                                        className={`absolute top-3 left-3 w-9 h-9 rounded-full
                                                        ${isDark ? 'bg-gray-800/80 hover:bg-gray-700/90' : 'bg-white/90 hover:bg-white'}
                                                        shadow-lg flex items-center justify-center transition-all duration-200
                                                        border-2 ${isFavorite(event.id) ? 'border-red-500' : isDark ? 'border-white/20' : 'border-gray-900'}
                                                        backdrop-blur-sm`}
                                                        title={isFavorite(event.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                    >
                                                        <Heart
                                                            className={`w-5 h-5 transition-all duration-200 ${
                                                                isFavorite(event.id)
                                                                    ? 'text-red-500 fill-red-500 scale-110'
                                                                    : isDark ? 'text-white hover:text-red-400' : 'text-gray-900 hover:text-red-400'
                                                            }`}
                                                        />
                                                    </button>

                                                    {/* Bottom gradient */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                        <h3 className="text-white font-bold text-lg mb-1">
                                                            {event.title}
                                                        </h3>
                                                        <p className="text-white/90 text-sm">{event.date}</p>
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="p-3 sm:p-4">
                                                    <p
                                                        className={`text-sm mb-3 line-clamp-5 ${
                                                            isDark ? 'text-gray-400' : 'text-gray-600'
                                                        }`}
                                                    >
                                                        {event.description}
                                                    </p>

                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(`/view-details/${event.id}`);
                                                        }}
                                                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-colors"
                                                    >
                                                        View Details
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        <div className="text-4xl mb-4">⏳</div>
                                        <p className="text-lg">No coming soon events</p>
                                    </div>
                                )}
                            </div>

                        </section>

                        {/* Last Year's Hits Section */}
                        {/* Last Year's Hits section uses status=lastyearhit fests, falls back to static lastYearHitsEvents */}
                        <section className="mb-4 sm:mb-6 md:mb-8 pt-2 sm:pt-6 md:pt-12">
                            <h2
                                className={`text-xl sm:text-2xl lg:text-2xl font-bold mb-4 sm:mb-6 tracking-tight ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}
                            >
                                Last Year's Hits
                            </h2>

                            <div className="relative">
                            {isFestsLoading ? (
                                <LoadingSkeleton count={3} />
                            ) : festError ? (
                                <div className="text-center py-12 text-red-500">{festError}</div>
                            ) : lastYearEvents.length > 0 ? (
                                <>
                                    {/* Left Scroll Button - Only show if scrolled and more than 3 items */}
                                    {lastYearEvents.length > 3 && lastYearShowLeftArrow && (
                                        <button
                                            onClick={() => scrollLeft(lastYearScrollRef)}
                                            className={`hidden lg:flex absolute -left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                isDark 
                                                    ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                    : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                            }`}
                                            aria-label="Scroll left"
                                        >
                                            <ChevronLeft className="w-6 h-6" />
                                        </button>
                                    )}

                                    {/* Right Scroll Button - Only show if not at end and more than 3 items */}
                                    {lastYearEvents.length > 3 && lastYearShowRightArrow && (
                                        <button
                                            onClick={() => scrollRight(lastYearScrollRef)}
                                            className={`hidden lg:flex absolute -right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 backdrop-blur-md ${
                                                isDark 
                                                    ? 'bg-gray-900/40 hover:bg-gray-900/60 text-white' 
                                                    : 'bg-white/40 hover:bg-white/60 text-gray-900'
                                            }`}
                                            aria-label="Scroll right"
                                        >
                                            <ChevronRight className="w-6 h-6" />
                                        </button>
                                    )}

                                    <div 
                                        ref={lastYearScrollRef}
                                        className="overflow-x-auto overflow-y-visible scrollbar-hide" 
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                    >
                                        <div 
                                            className="flex gap-4 sm:gap-6 pb-4 snap-x snap-mandatory" 
                                            style={{ 
                                                WebkitOverflowScrolling: 'touch',
                                                scrollBehavior: 'smooth'
                                            }}
                                        >
                                    {lastYearEvents.slice(0, 6).map((event) => (
                                        <div
                                            key={event.id}
                                            onClick={() => navigate(`/view-details/${event.id}`)}
                                            className={`min-w-[290px] w-[290px]
                                                        sm:min-w-[300px] sm:w-[300px]
                                                        lg:min-w-[340px] lg:w-[340px]
                                                        rounded-xl shadow-sm hover:shadow-xl transition-all duration-300
                                                        overflow-hidden cursor-pointer group flex-shrink-0 snap-start
                                                        ${isDark ? 'bg-[#1B1C1E]' : 'bg-white'}`}
                                        >
                                            {/* Image */}
                                            <div className="relative h-[200px] overflow-hidden">
                                                <img
                                                    src={getImageUrl(event.image)}
                                                    alt={event.title}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        handleImageErrorWithFallback(
                                                            e,
                                                            300,
                                                            200,
                                                            '#6366f1',
                                                            event.title || 'Event'
                                                        );
                                                    }}
                                                />

                                                {/* Overlay */}
                                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-all duration-300" />

                                                {/* Status Badge */}
                                                <div className="absolute top-3 left-3">
                                                    <span className={`${getStatusBadgeColor(event.status)} text-white text-xs px-3 py-1 rounded-full font-medium capitalize`}>
                                                        {event.status}
                                                    </span>
                                                </div>

                                                {/* Like Button */}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleLike(event.id, event);
                                                    }}
                                                    className={`absolute top-3 right-3 w-9 h-9 rounded-full
                                                    ${isDark ? 'bg-gray-800/80 hover:bg-gray-700/90' : 'bg-white/90 hover:bg-white'}
                                                    shadow-lg flex items-center justify-center transition-all duration-200
                                                    border-2 ${isFavorite(event.id) ? 'border-red-500' : isDark ? 'border-white/20' : 'border-gray-900'}
                                                    backdrop-blur-sm`}
                                                    title={isFavorite(event.id) ? 'Remove from favorites' : 'Add to favorites'}
                                                >
                                                    <Heart
                                                        className={`w-5 h-5 transition-all duration-200 ${
                                                            isFavorite(event.id)
                                                                ? 'text-red-500 fill-red-500 scale-110'
                                                                : isDark ? 'text-white hover:text-red-400' : 'text-gray-900 hover:text-red-400'
                                                        }`}
                                                    />
                                                </button>

                                                {/* Bottom gradient */}
                                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                                                    <h3 className="text-white font-bold text-lg mb-1">
                                                        {event.title}
                                                    </h3>
                                                    <p className="text-white/90 text-sm">
                                                        {event.subtitle}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Content */}
                                            <div className="p-3 sm:p-4 line-clamp-5">
                                                <p
                                                    className={`text-sm mb-3 ${
                                                        isDark ? 'text-gray-400' : 'text-gray-600'
                                                    }`}
                                                >
                                                    {event.description}
                                                </p>

                                                <div className="flex items-center justify-between text-sm">
                                                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                                        {event.participants}
                                                    </span>
                                                    <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>
                                                        {event.duration}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className={`text-center py-12 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    <div className="text-4xl mb-4">📆</div>
                                    <p className="text-lg">No past events available</p>
                                </div>
                            )}
                            </div>

                        </section>

                    </div>
                </main>

                <footer className={`w-full py-6 sm:py-8 md:py-12 mt-8 sm:mt-12 md:mt-24 lg:mt-28 ${isDark
                    ? 'bg-[#0a0a0a] border-gray-700'
                    : 'bg-[#F5F6FA] border-gray-200'
                    }`}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6">
                        {/* Mobile Layout */}
                        <div className="md:hidden">
                            {/* Brand Section - Mobile */}
                            <div className="text-center mb-6">
                                <h2 className="text-xl font-bold text-blue-600 mb-4">CrwdCtrl
                                </h2>

                                <div className="mb-6">
                                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium mb-3 text-sm`}>Follow us on</p>
                                    <a
                                        href="https://www.instagram.com/crwdctrl.in?igsh=MTBpNm9ta2ptMmc2dA=="
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-2 ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'} transition-colors`}
                                    >
                                        <Instagram className="w-4 h-4 text-pink-600" />
                                        <span className="text-sm">@crwdctrl.in</span>
                                    </a>
                                </div>
                            </div>

                            {/* Footer Links - Mobile (Stacked) */}
                            <div className="flex flex-col items-center gap-4 mb-6">
                                <Link
                                    to="/terms-and-conditions"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
                                >
                                    Terms and conditions
                                </Link>
                                <Link
                                    to="/privacy-policy"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
                                >
                                    Privacy policy
                                </Link>
                                <Link
                                    to="/contact-us"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors text-sm`}
                                >
                                    Contact us
                                </Link>
                            </div>
                        </div>

                        {/* Desktop/Laptop Layout */}
                        <div className="hidden md:flex flex-wrap items-start justify-between gap-8 mb-8">
                            {/* Brand Section */}
                            <div className="flex flex-col">
                                <div className="flex items-center gap-4 mb-6">
                                    <h2 className="text-2xl font-bold text-blue-600">CrwdCtrl
                                    </h2>
                                </div>

                                <div>
                                    <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} font-medium mb-2`}>Follow us on</p>
                                    <a
                                        href="https://www.instagram.com/crwdctrl.in?igsh=MTBpNm9ta2ptMmc2dA=="
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-2 ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-700 hover:text-blue-600'} transition-colors`}
                                    >
                                        <Instagram className="w-5 h-5 text-pink-600" />
                                        <span>@crwdctrl</span>
                                    </a>
                                </div>
                            </div>

                            {/* Footer Links */}
                            <div className="flex flex-wrap gap-8 md:gap-16">
                                <Link
                                    to="/terms-and-conditions"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
                                >
                                    Terms and conditions
                                </Link>
                                <Link
                                    to="/privacy-policy"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
                                >
                                    Privacy policy
                                </Link>
                                <Link
                                    to="/contact-us"
                                    className={`${isDark ? 'text-white' : 'text-gray-900'} font-medium hover:text-blue-600 cursor-pointer transition-colors`}
                                >
                                    Contact us
                                </Link>
                            </div>
                        </div>

                        {/* Bottom Text */}
                        <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} pt-6`}>
                            <p className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} leading-relaxed text-center md:text-left`}>
                                By accessing this page, you confirm that you have read, understood, and agreed to CrwdCtrl's Terms of Service, Privacy Policy, Cookie Policy, and Content Guidelines. © 2024 CrwdCtrl. All rights reserved.
                            </p>
                        </div>
                    </div>
                </footer>
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
};

export default Dashboard;
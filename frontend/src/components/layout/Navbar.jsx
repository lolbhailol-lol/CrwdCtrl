import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, MapPin, Sun, Moon, Clock, Calendar, X, User, Navigation, Loader2, ChevronDown, Heart, LogOut, HelpCircle, Sparkles, LayoutDashboard, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import ProfileAvatarUpload from '../ProfileAvatarUpload';
import { useDialog } from '../../context/DialogContext';
import { useNotifications } from '../../context/NotificationsContext';
import { useSidebar } from '../../context/SidebarContext';
import { searchAll } from '../../services/searchService';
import { CATEGORY_NAV_ICONS } from '../../constants/categoryNavIcons';
import { DetailLoader3DIcon } from '../DetailPageLoader';
import { openExternalUrl } from '../../utils/externalLink';
import { isNativeApp } from '../../utils/capacitorPlatform';
import { canOfferBrowserNotifications } from '../../utils/notificationPrompt';
import AppLogo from '../AppLogo';
import {
    getRecentSearches,
    clearRecentSearches,
    saveRecentSearch,
    FALLBACK_SEARCH_TERMS,
} from '../../utils/heroSearchSuggestions';
import { navigateToSearchResult } from '../../utils/searchNavigation';

const NAV_ITEMS = [
    { id: 'fests',   label: 'Fests',   path: '/fests' },
    { id: 'games',   label: 'Games',   path: '/games' },
    { id: 'rankings', label: 'Rankings', path: '/rankings' },
    { id: 'events', label: 'Events', path: '/events' },
];

const FEST_SECTION_PATH = /^\/(fests|view-details|competitions-view-details|competition\/|fest\/)/;

function isNavItemActive(item, pathname) {
    return pathname === item.path
        || (item.path !== '/' && pathname.startsWith(`${item.path}/`))
        || (item.id === 'fests' && FEST_SECTION_PATH.test(pathname));
}

const NavItem = ({ item, isActive, isDark, layout = 'stacked', onClick, className = '' }) => {
    const isStacked = layout === 'stacked';
    const iconClass = layout === 'icon-only'
        ? 'w-11 h-11'
        : isStacked
            ? 'w-8 h-8'
            : 'w-6 h-6';
    const iconSet = isDark ? CATEGORY_NAV_ICONS.dark : CATEGORY_NAV_ICONS.light;
    const iconSrc = iconSet[item.id];
    return (
        <button
            onClick={onClick}
            className={`group flex ${isStacked ? 'flex-col' : 'flex-row'} items-center ${isStacked ? 'gap-2' : 'gap-3'}
                ${isStacked ? 'py-1' : 'py-2'} ${layout === 'icon-only' ? 'px-2' : ''} ${className}`}
            aria-label={item.label}
        >
            <img
                src={iconSrc}
                alt={`${item.label} icon`}
                draggable={false}
                decoding="async"
                loading="eager"
                className={`crisp-icon object-contain ${iconClass}`}
            />
            {(layout !== 'icon-only') && (
                <span className={`text-xs font-semibold tracking-wide ${isActive ? 'text-[#007BFF]' : isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {item.label}
                </span>
            )}
            {isActive && isStacked && layout !== 'icon-only' && (
                <div className="mt-1 h-0.5 w-5 rounded-full bg-[#007BFF]" />
            )}
        </button>
    );
};

function GoogleIcon({ className = 'w-5 h-5' }) {
    return (
        <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

const Navbar = ({ setIsProfileOpen = () => { }, onOpenProfile }) => {
    const { isDark } = useDarkMode();
    const { isCollapsed, toggleCollapse } = useSidebar();
    const { user, isAuthenticated, logout } = useAuth();
    const { confirm } = useDialog();
    const { notifications, unreadCount, markAsRead, refreshNotifications, enableBrowserNotifications } = useNotifications();
    const [enablingPush, setEnablingPush] = useState(false);
    const showEnablePush = !isNativeApp() && canOfferBrowserNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const [_searchParams, _setSearchParams] = useSearchParams();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const notificationRef = useRef(null);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
    const profileDropdownRef = useRef(null);

    // Location states
    const [currentLocation, setCurrentLocation] = useState({
        city: 'Pune', // Default fallback
        state: 'Maharashtra',
        country: 'India',
        isDetecting: false,
        hasPermission: false,
        coordinates: null
    });
    const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
    const locationRef = useRef(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [recentSearches, setRecentSearches] = useState([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const searchRef = useRef(null);

    // Get user's location on component mount

    useEffect(() => {
        console.log('🚀 Navbar component mounted, checking for stored location...');

        const getStoredLocation = () => {
            try {
                const stored = localStorage.getItem('crwdctrl_user_location');
                console.log('💾 Stored location data:', stored);

                if (stored) {
                    const parsedLocation = JSON.parse(stored);
                    console.log('📍 Parsed stored location:', parsedLocation);

                    setCurrentLocation(prev => ({
                        ...prev,
                        ...parsedLocation,
                        hasPermission: true
                    }));
                    return true;
                }
            } catch (error) {
                console.error('❌ Error reading stored location:', error);
            }
            return false;
        };

        // Only try to get stored location, don't auto-detect
        if (!getStoredLocation()) {
            console.log('🌍 No stored location found, using default location (Pune)');
            // Use default location instead of auto-detecting
            setCurrentLocation(prev => ({
                ...prev,
                city: 'Pune',
                state: 'Maharashtra',
                country: 'India',
                hasPermission: false,
                isDetecting: false
            }));
        } else {
            console.log('✅ Using stored location');
        }

    }, []);

    // Search functionality
    useEffect(() => {
        const performSearch = async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearching(true);
                try {
                    const results = await searchAll(searchQuery);

                    setSearchResults((results.results || []).slice(0, 8));
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

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setIsProfileDropdownOpen(false);
            }
            if (locationRef.current && !locationRef.current.contains(event.target)) {
                setIsLocationDropdownOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchDropdownOpen(false);
                setIsSearchFocused(false);
            }
        };

        if (isNotificationOpen || isLocationDropdownOpen || isSearchDropdownOpen || isSearchFocused || isProfileDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isNotificationOpen, isLocationDropdownOpen, isSearchDropdownOpen, isSearchFocused, isProfileDropdownOpen]);

    // Listen for location detection trigger from Dashboard
    useEffect(() => {
        const handleLocationDetectionTrigger = () => {
            console.log('📍 Dashboard triggered location detection');
            detectUserLocation();
        };

        window.addEventListener('triggerLocationDetection', handleLocationDetectionTrigger);

        return () => {
            window.removeEventListener('triggerLocationDetection', handleLocationDetectionTrigger);
        };
    }, []);

    const handleNavigation = (path) => {
        if (location.pathname === path) return;
        navigate(path);
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

    // Function to detect user's location
    const detectUserLocation = async () => {
        console.log('🌍 Starting location detection...');

        if (!navigator.geolocation) {
            console.log('❌ Geolocation is not supported by this browser');
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
                console.log('🚫 User cancelled location request before browser prompt');
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
                        console.log('🚫 Location permission is blocked at browser level');
                        setCurrentLocation(prev => ({
                            ...prev,
                            isDetecting: false,
                            hasPermission: false
                        }));
                        return;
                    }
                } catch (permissionError) {
                    console.log('⚠️ Could not verify geolocation permission state:', permissionError);
                }
            }
        }

        console.log('🌍 Geolocation API is available');
        setCurrentLocation(prev => ({ ...prev, isDetecting: true }));

        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // 15 seconds timeout
            maximumAge: 300000 // 5 minutes cache
        };

        console.log('🌍 Requesting location permission...');

        try {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    console.log('✅ SUCCESS: Location obtained!', position.coords);
                    const { latitude, longitude } = position.coords;

                    // First try to match with known cities
                    const knownCity = getCityFromCoordinates(latitude, longitude);
                    if (knownCity) {
                        console.log('🏙️ Found known city:', knownCity);
                        const locationData = {
                            ...knownCity,
                            coordinates: { latitude, longitude },
                            hasPermission: true,
                            isDetecting: false
                        };
                        setCurrentLocation(locationData);

                        try {
                            localStorage.setItem('crwdctrl_user_location', JSON.stringify(locationData));
                            console.log('💾 Stored known city location');
                        } catch (error) {
                            console.error('❌ Error storing location:', error);
                        }
                        return;
                    }

                    console.log('� Try️ing reverse geocoding...');

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
                                        console.log('✅ Location found via Nominatim:', locationData.city);
                                    }
                                }
                            }
                        } catch (nominatimError) {
                            console.log('❌ Nominatim failed, trying BigDataCloud');
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
                                        console.log('✅ Location found via BigDataCloud:', locationData.city);
                                    }
                                }
                            } catch (bigDataError) {
                                console.log('❌ BigDataCloud failed');
                            }
                        }

                        if (locationData) {
                            setCurrentLocation(locationData);
                            try {
                                localStorage.setItem('crwdctrl_user_location', JSON.stringify(locationData));
                                console.log('💾 Location saved successfully');
                            } catch (error) {
                                console.error('❌ Error storing location:', error);
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
                            console.log('🌍 Using coordinate-based location');
                        }
                    } catch (error) {
                        console.error('❌ Reverse geocoding failed:', error);
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
                    console.error('❌ GEOLOCATION ERROR:', error);
                    console.error('❌ Error code:', error.code);
                    console.error('❌ Error message:', error.message);

                    setCurrentLocation(prev => {
                        const newState = {
                            ...prev,
                            isDetecting: false,
                            hasPermission: false
                        };
                        console.log('❌ Setting error state:', newState);
                        return newState;
                    });

                    // Log appropriate error message based on error type
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            console.log('🚫 User denied location permission');
                            break;
                        case error.POSITION_UNAVAILABLE:
                            console.log('📍 Location information unavailable');
                            break;
                        case error.TIMEOUT:
                            console.log('⏰ Location request timed out');
                            break;
                        default:
                            console.log('❓ Unknown location error');
                    }
                },
                options
            );
        } catch (error) {
            console.error('❌ CRITICAL ERROR in detectUserLocation:', error);
        }
    };

    // Handle location click - show options dropdown
    const handleLocationClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsLocationDropdownOpen(!isLocationDropdownOpen);
    };

    // Handle manual location refresh
    const handleRefreshLocation = () => {
        console.log('🔄 handleRefreshLocation called');
        setIsLocationDropdownOpen(false);
        detectUserLocation();
    };

    // Handle open in maps
    const handleOpenInMaps = () => {
        setIsLocationDropdownOpen(false);
        if (currentLocation.coordinates) {
            const { latitude, longitude } = currentLocation.coordinates;
            openExternalUrl(`https://www.google.com/maps/@${latitude},${longitude},15z`);
        } else {
            // Fallback to search by city name
            const searchQuery = encodeURIComponent(`${currentLocation.city}, ${currentLocation.state}, ${currentLocation.country}`);
            openExternalUrl(`https://www.google.com/maps/search/${searchQuery}`);
        }
    };

    // Handle search input change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    const handleSearchFocus = () => {
        setRecentSearches(getRecentSearches());
        setIsSearchFocused(true);
    };

    const applySearchTerm = (term) => {
        setSearchQuery(term);
        setIsSearchFocused(false);
    };

    const handleClearRecent = () => {
        clearRecentSearches();
        setRecentSearches([]);
    };

    // Handle search result click
    const handleSearchResultClick = (event) => {
        const title = event.title || event.festival_name || event.festName;
        if (title) saveRecentSearch(title);
        setSearchQuery('');
        setIsSearchDropdownOpen(false);
        setIsSearchFocused(false);

        navigateToSearchResult(navigate, event);
    };

    // Handle search form submit (Enter key)
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim() && searchResults.length > 0) {
            handleSearchResultClick(searchResults[0]);
        }
    };

    return (
        <header className={`hidden lg:flex fixed top-0 right-4 ${isCollapsed ? 'lg:left-[6rem]' : 'lg:left-[15.5rem]'} left-4 z-[100] px-5 h-14 items-center rounded-b-[2rem] border-b border-x backdrop-blur-3xl backdrop-saturate-180 backdrop-brightness-105 transition-all duration-300 ease-in-out shadow-md ${isDark
            ? 'bg-[#070a13]/65 border-white/15 text-white shadow-black/30'
            : 'bg-[#F3F4F9]/90 border-gray-200/90 text-gray-900 shadow-gray-200/40'
            }`} style={{ fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
            <div className="w-full flex items-center justify-between">

                {/* Left Section: Location and Navigation */}
                <div className="flex items-center space-x-2 lg:space-x-4">
                    {/* Location Selector */}
                    <div className="relative" ref={locationRef}>
                        <button
                            type="button"
                            onClick={handleLocationClick}
                            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-full border transition-all duration-200 shadow-xs hover:shadow-md touch-manipulation cursor-pointer active:scale-95 ${isDark
                                ? 'bg-white/5 border-[#007BFF]/40 hover:border-[#007BFF] text-gray-200 hover:bg-white/10'
                                : 'bg-white/90 border-[#007BFF]/30 hover:border-[#007BFF] text-gray-700 hover:bg-white'
                                } ${isLocationDropdownOpen ? 'ring-2 ring-[#007BFF]/30 border-[#007BFF]' : ''}`}
                        >
                            {currentLocation.isDetecting ? (
                                <Loader2 className="w-4 h-4 text-[#007BFF] animate-spin" />
                            ) : (
                                <MapPin className="w-4 h-4 text-[#007BFF]" />
                            )}
                            <span className={`text-sm font-semibold hidden sm:inline ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                                {currentLocation.isDetecting ? 'Detecting...' : currentLocation.city}
                            </span>
                            <div className={`transition-transform duration-200 ${isLocationDropdownOpen ? 'rotate-180' : ''}`}>
                                <ChevronDown className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400 group-hover:text-[#007BFF]' : 'text-gray-600 group-hover:text-[#007BFF]'}`} />
                            </div>
                        </button>

                        {/* Location Dropdown */}
                        {isLocationDropdownOpen && (
                            <div className={`absolute left-0 sm:left-0 mt-2 w-80 sm:w-72 max-w-[95vw] rounded-2xl shadow-2xl border backdrop-blur-md z-60 ${isDark
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
                                            type="button"
                                            aria-label="Close location menu"
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
                                            onClick={handleRefreshLocation}
                                            disabled={currentLocation.isDetecting}
                                            className={`flex items-center justify-center space-x-2 w-full py-2 px-3 rounded-lg text-sm font-medium transition-all ${isDark
                                                ? 'bg-[#119999] hover:bg-[#119999]/80 text-white disabled:bg-gray-700 disabled:text-gray-400'
                                                : 'bg-[#119999] hover:bg-[#119999]/90 text-white disabled:bg-gray-200 disabled:text-gray-500'
                                                } ${currentLocation.isDetecting ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                        >
                                            {currentLocation.isDetecting ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
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
                                            onClick={handleOpenInMaps}
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

                    {/* Desktop Navigation Links */}
                    <nav className="hidden lg:flex items-center space-x-2 ml-4">
                        {NAV_ITEMS.map((item) => {
                            const isActive = isNavItemActive(item, location.pathname);
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleNavigation(item.path)}
                                    className={`relative px-3.5 py-1.5 text-sm font-semibold rounded-xl transition-colors duration-200 cursor-pointer active:scale-95 ${isActive
                                        ? isDark
                                            ? 'text-white font-bold'
                                            : 'text-[#007BFF] font-bold'
                                        : isDark
                                            ? 'text-gray-300 hover:text-white hover:bg-white/5'
                                            : 'text-gray-900 font-bold hover:text-[#007BFF] hover:bg-black/5'
                                        }`}
                                >
                                    {isActive && (
                                        <>
                                            <motion.div
                                                layoutId="navbar-active-pill"
                                                className={`absolute inset-0 rounded-xl pointer-events-none ${isDark ? 'bg-white/10' : 'bg-[#007BFF]/10 shadow-xs'}`}
                                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                            />
                                            <motion.div
                                                layoutId="navbar-active-line"
                                                className={`absolute -bottom-1 left-2 right-2 h-0.5 rounded-full pointer-events-none ${isDark ? 'bg-white' : 'bg-[#007BFF]'}`}
                                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                                            />
                                        </>
                                    )}
                                    <span className="relative z-10">{item.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Spacer */}
                <div className="flex-1"></div>

                {/* Right Section: Search Bar, Notifications and Profile */}
                <div className="flex items-center space-x-3 lg:space-x-6 pr-2 lg:pr-4">
                    {/* Search Bar - Now visible on both mobile and desktop */}
                    <div className="block" ref={searchRef}>
                        <form onSubmit={handleSearchSubmit} className="relative group mt-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />

                            <input
                                id="navbar-search"
                                name="q"
                                type="search"
                                autoComplete="off"
                                placeholder="Search events, communities..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                onFocus={handleSearchFocus}
                                className={`w-32 sm:w-56 lg:w-64 pl-10 pr-10 py-2 rounded-full text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 ${isDark
                                    ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:bg-white/10'
                                    : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder-gray-500 focus:bg-white'
                                    }`}
                            />

                            {/* Right side icons container */}
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                {searchQuery && !isSearching && (
                                    <X
                                        onClick={() => setSearchQuery("")}
                                        className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors"
                                    />
                                )}
                                {isSearching && (
                                    <DetailLoader3DIcon size="mini" />
                                )}
                            </div>

                            {/* Recent + Popular suggestions (shown on focus, empty query) */}
                            {isSearchFocused && !searchQuery.trim() && !isSearchDropdownOpen && (
                                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border backdrop-blur-md z-50 p-3 ${isDark
                                    ? 'bg-black/95 border-gray-700/50'
                                    : 'bg-white/95 border-gray-200/50'
                                    }`}>
                                    {recentSearches.length > 0 && (
                                        <div className="mb-3">
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <span className={`text-xs font-semibold uppercase tracking-wide ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    Recent
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={handleClearRecent}
                                                    className={`text-xs font-medium ${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-800'}`}
                                                >
                                                    Clear
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {recentSearches.map((term) => (
                                                    <button
                                                        type="button"
                                                        key={`recent-${term}`}
                                                        onClick={() => applySearchTerm(term)}
                                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDark
                                                            ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                            }`}
                                                    >
                                                        <Clock className="w-3 h-3" />
                                                        {term}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <span className={`block text-xs font-semibold uppercase tracking-wide mb-2 px-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                            Popular
                                        </span>
                                        <div className="flex flex-wrap gap-2">
                                            {FALLBACK_SEARCH_TERMS.slice(0, 6).map((term) => (
                                                <button
                                                    type="button"
                                                    key={`popular-${term}`}
                                                    onClick={() => applySearchTerm(term)}
                                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${isDark
                                                        ? 'bg-gray-800 text-gray-200 hover:bg-gray-700'
                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Search Results Dropdown */}
                            {isSearchDropdownOpen && (searchResults.length > 0 || isSearching) && (
                                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border backdrop-blur-md z-50 max-h-96 overflow-y-auto ${isDark
                                    ? 'bg-black/95 border-gray-700/50'
                                    : 'bg-white/95 border-gray-200/50'
                                    }`}>
                                    {isSearching ? (
                                        <div className="p-4 text-center">
                                            <DetailLoader3DIcon size="compact" className="mx-auto mb-2" />
                                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                Searching all events...
                                            </p>
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        <>
                                            {searchResults.map((event, _index) => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => handleSearchResultClick(event)}
                                                    className={`flex items-center p-3 cursor-pointer transition-colors border-b last:border-b-0 ${isDark
                                                        ? 'border-gray-700 hover:bg-gray-800/60'
                                                        : 'border-gray-100 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg shrink-0 mr-3 flex items-center justify-center text-xs font-bold ${event.resultType === 'competition'
                                                        ? 'bg-orange-100 text-orange-600'
                                                        : event.category === 'cultural'
                                                            ? 'bg-purple-100 text-purple-600'
                                                            : event.category === 'tech' || event.type === 'technical'
                                                                ? 'bg-blue-100 text-blue-600'
                                                                : event.category === 'sports'
                                                                    ? 'bg-green-100 text-green-600'
                                                                    : 'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {event.resultType === 'competition' ? 'C' : (event.title ? event.title.charAt(0) : 'F')}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center space-x-2">
                                                            <h4 className={`font-medium text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                {event.title || event.festival_name}
                                                            </h4>
                                                            {event.resultType === 'competition' && (
                                                                <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-600 rounded-full shrink-0">
                                                                    Competition
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            {event.organizing_body || event.subtitle}
                                                        </p>
                                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                            {event.location}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}

                                            {/* Show more results hint */}
                                            {searchQuery.trim() && (
                                                <div className={`p-3 text-center border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                        Showing {searchResults.length} results for "{searchQuery}"
                                                    </p>
                                                </div>
                                            )}
                                        </>
                                    ) : null}
                                </div>
                            )}

                            {/* No results message */}
                            {isSearchDropdownOpen && !isSearching && searchResults.length === 0 && searchQuery.trim().length >= 2 && (
                                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border backdrop-blur-md z-50 ${isDark
                                    ? 'bg-black/95 border-gray-700/50'
                                    : 'bg-white/95 border-gray-200/50'
                                    }`}>
                                    <div className="p-4 text-center">
                                        <Search className={`w-8 h-8 mx-auto mb-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            No fests or competitions found for "{searchQuery}"
                                        </p>
                                    </div>
                                </div>
                            )}
                        </form>
                    </div>
                    {/* Notification Bell */}
                    <div className="relative" ref={notificationRef}>
                        <button
                            type="button"
                            aria-label="Notifications"
                            onClick={() => {
                                const opening = !isNotificationOpen;
                                if (opening) refreshNotifications();
                                setIsNotificationOpen(opening);
                            }}
                            className={`relative p-2 lg:p-2.5 rounded-full transition-all duration-200 cursor-pointer active:scale-95 ${location.pathname === '/notifications' || location.pathname === '/notification-panel'
                                ? 'text-[#007BFF] bg-[#007BFF]/10 shadow-md'
                                : isDark
                                    ? 'text-gray-300 hover:text-[#007BFF] hover:bg-white/10'
                                    : 'text-gray-800 hover:text-[#007BFF] hover:bg-black/5'
                                } ${isNotificationOpen ? (isDark ? 'bg-white/10 text-[#007BFF]' : 'bg-[#007BFF]/10 text-[#007BFF]') : ''}`}>
                            <Bell className="w-4 lg:w-5 h-4 lg:h-5" />
                            {unreadCount > 0 && (
                                <div
                                    className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-[#090a0e] flex items-center justify-center shadow-xs"
                                >
                                    <span className="text-[9px] font-bold text-white">
                                        {unreadCount > 9 ? '9+' : unreadCount}
                                    </span>
                                </div>
                            )}
                        </button>

                        {/* Notification Dropdown */}
                        {isNotificationOpen && (
                            <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border backdrop-blur-md z-50 ${isDark
                                ? 'bg-black/95 border-gray-700/50'
                                : 'bg-white/95 border-gray-200/50'
                                }`}>
                                {/* Header */}
                                <div className={`px-6 py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className={`font-semibold text-xl ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Notifications
                                        </h3>
                                        <button
                                            onClick={() => setIsNotificationOpen(false)}
                                            className={`p-2 rounded-lg transition-colors ${isDark
                                                ? 'hover:bg-gray-700 text-gray-400'
                                                : 'hover:bg-gray-100 text-gray-500'
                                                }`}
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {showEnablePush ? (
                                    <div className={`px-4 py-3 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                        <p className={`text-xs mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                            Enable browser notifications to get trek updates instantly.
                                        </p>
                                        <button
                                            type="button"
                                            disabled={enablingPush}
                                            onClick={async () => {
                                                setEnablingPush(true);
                                                try {
                                                    await enableBrowserNotifications();
                                                } finally {
                                                    setEnablingPush(false);
                                                }
                                            }}
                                            className="w-full py-2 rounded-lg bg-[#007BFF] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60"
                                        >
                                            {enablingPush ? 'Enabling…' : 'Enable notifications'}
                                        </button>
                                    </div>
                                ) : null}

                                {/* Notifications List */}
                                <div className="max-h-96 overflow-y-auto">
                                    {notifications.length > 0 ? (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                className={`px-4 py-3 border-b last:border-b-0 transition-colors hover:bg-opacity-50 cursor-pointer ${isDark
                                                    ? 'border-gray-700 hover:bg-gray-700'
                                                    : 'border-gray-100 hover:bg-gray-50'
                                                    } ${notification.unread ? (isDark ? 'bg-gray-700/30' : 'bg-blue-50/50') : ''}`}
                                                onClick={() => {
                                                    // Handle notification click — mark as read and navigate
                                                    markAsRead(notification.id);
                                                    if (notification.link) {
                                                        navigate(notification.link);
                                                    }
                                                    setIsNotificationOpen(false);
                                                }}
                                            >
                                                <div className="flex items-start space-x-3">
                                                    <div className={`p-2 rounded-lg shrink-0 ${notification.type === 'event'
                                                        ? 'bg-blue-100 text-blue-600'
                                                        : notification.type === 'reminder'
                                                            ? 'bg-orange-100 text-orange-600'
                                                            : 'bg-green-100 text-green-600'
                                                        }`}>
                                                        {notification.type === 'event' ? (
                                                            <Calendar className="w-4 h-4" />
                                                        ) : notification.type === 'reminder' ? (
                                                            <Clock className="w-4 h-4" />
                                                        ) : (
                                                            <Bell className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <h4 className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                {notification.title}
                                                            </h4>
                                                            {notification.unread && (
                                                                <div className="w-2 h-2 bg-[#007BFF] rounded-full shrink-0 ml-2 mt-1"></div>
                                                            )}
                                                        </div>
                                                        <p className={`text-sm mt-1 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                            {notification.message}
                                                        </p>
                                                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {notification.time}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="px-4 py-8 text-center">
                                            <Bell className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-gray-600' : 'text-gray-400'}`} />
                                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                No notifications yet
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className={`px-4 py-3 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                                    <button
                                        onClick={() => {
                                            navigate('/notifications');
                                            setIsNotificationOpen(false);
                                        }}
                                        className={`w-full text-center py-2 rounded-xl font-medium text-sm transition-all duration-200 ${isDark
                                            ? 'text-[#007BFF] hover:bg-[#007BFF]/10'
                                            : 'text-[#007BFF] hover:bg-[#007BFF]/5'
                                            }`}
                                    >
                                        View All Notifications
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* User Profile Avatar & Dropdown */}
                    <div className="relative" ref={profileDropdownRef}>
                        <button
                            type="button"
                            aria-label="Open profile menu"
                            onClick={() => setIsProfileDropdownOpen(prev => !prev)}
                            className="w-9 h-9 lg:w-10 lg:h-10 rounded-full bg-[#4169E1] text-white flex items-center justify-center shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer active:scale-95"
                        >
                            {isAuthenticated && user?.name ? (
                                <span className="text-white font-bold text-xs lg:text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            ) : (
                                <User className="w-4 lg:w-5 h-4 lg:h-5 text-white" />
                            )}
                        </button>

                        {/* Profile Dropdown Card - anchored floating card under Avatar */}
                        {isProfileDropdownOpen && (
                            <div className={`absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl shadow-2xl border backdrop-blur-md z-50 overflow-hidden ${isDark
                                ? 'bg-[#161718] border-gray-800 text-white'
                                : 'bg-white border-gray-200 text-gray-900'
                                }`}>
                                {/* Header with Profile title & Close button */}
                                <div className="flex items-center justify-between px-5 pt-4 pb-2">
                                    <h2 className={`text-xl font-medium font-inter ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Profile
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setIsProfileDropdownOpen(false)}
                                        className={`p-1 rounded-lg transition-colors cursor-pointer ${isDark ? 'hover:bg-gray-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                                        aria-label="Close profile"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {/* User Profile Section */}
                                <div className="px-5 py-3">
                                    <div className="flex items-center gap-3.5">
                                        <ProfileAvatarUpload
                                            isDark={isDark}
                                            sizeClass="w-14 h-14"
                                            initialClass="text-2xl"
                                            guestIconClass="w-7 h-7"
                                            cameraBtnClass="w-5 h-5"
                                            className="items-start!"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <h3 className={`text-base font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {isAuthenticated && user?.name ? user.name : 'guest'}
                                            </h3>
                                            <p className={`text-xs font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {isAuthenticated && user?.email ? user.email : 'student'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Menu Items matching original Profile Sidebar style */}
                                <div className="px-5 py-2 space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/edit-profile');
                                            setIsProfileDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl shadow-sm transition-all duration-200 group cursor-pointer ${isDark
                                            ? 'border border-gray-800/80 bg-[#111213] hover:bg-gray-800'
                                            : 'border border-gray-100 bg-gray-50/80 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'}`}>
                                                <User className="w-4 h-4 text-[#0ECCEE]" />
                                            </div>
                                            <span className={`font-medium text-sm block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                Edit profile
                                            </span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/help-center');
                                            setIsProfileDropdownOpen(false);
                                        }}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl shadow-sm transition-all duration-200 group cursor-pointer ${isDark
                                            ? 'border border-gray-800/80 bg-[#111213] hover:bg-gray-800'
                                            : 'border border-gray-100 bg-gray-50/80 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'}`}>
                                                <HelpCircle className="w-4 h-4 text-[#0ECCEE]" />
                                            </div>
                                            <span className={`font-medium text-sm block ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                Help Center
                                            </span>
                                        </div>
                                        <ChevronRight className={`w-4 h-4 shrink-0 transition-colors ${isDark ? 'text-gray-500 group-hover:text-gray-300' : 'text-gray-400 group-hover:text-gray-600'}`} />
                                    </button>
                                </div>

                                {/* Bottom Auth Action */}
                                <div className="px-5 pt-2 pb-4">
                                    {isAuthenticated ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (logout) logout();
                                                setIsProfileDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl shadow-sm transition-all duration-200 cursor-pointer group ${isDark
                                                ? 'border border-gray-800/80 bg-[#111213] hover:bg-gray-800'
                                                : 'border border-gray-100 bg-gray-50/80 hover:bg-gray-100'
                                                }`}
                                        >
                                            <span className={`font-medium text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                Log Out
                                            </span>
                                            <LogOut className={`w-4 h-4 ${isDark ? 'text-gray-300' : 'text-gray-600'}`} />
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (onOpenProfile) onOpenProfile();
                                                setIsProfileDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center justify-center gap-2 p-3.5 rounded-xl transition-all duration-200 cursor-pointer bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 active:scale-[0.98]"
                                        >
                                            <GoogleIcon className="w-5 h-5" />
                                            <span className="font-medium text-sm text-black font-medium">
                                                Continue with Google
                                            </span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};


export default Navbar;

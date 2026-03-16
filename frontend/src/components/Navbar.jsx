import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, MapPin, Sun, Moon, Menu, Clock, Calendar, X, User, Navigation, Loader2 } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { searchFests, searchAll } from '../services/searchService';

const Navbar = ({ setIsProfileOpen = () => { } }) => {
    const { isDark } = useDarkMode();
    const { user, isAuthenticated } = useAuth();
    const { notifications, unreadCount, markAsRead } = useNotifications();
    const navigate = useNavigate();
    const location = useLocation();
    const [_searchParams, _setSearchParams] = useSearchParams();
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const notificationRef = useRef(null);

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

    const eventCategories = [

        { label: 'CULTURAL FEST', path: '/cultural-fest' },
        { label: 'TECH FEST', path: '/tech-fest' },
        { label: 'SPORTS FEST', path: '/sports-fest' }
    ];
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Search functionality
    useEffect(() => {
        const performSearch = async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearching(true);
                try {
                    console.log('🔍 Starting search for:', searchQuery);
                    const results = await searchAll(searchQuery);
                    console.log('🔍 Search results received:', {
                        fests: results.fests.length,
                        competitions: results.competitions.length,
                        total: results.total
                    });
                    
                    // Combine fests and competitions, limit to 6 total results
                    const combinedResults = [
                        ...results.fests.map(fest => ({ ...fest, resultType: 'fest' })),
                        ...results.competitions.map(comp => ({ ...comp, resultType: 'competition' }))
                    ].slice(0, 6);
                    
                    console.log('🔍 Final combined results:', combinedResults.length, 'types:', combinedResults.map(r => r.resultType));
                    
                    setSearchResults(combinedResults);
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
            if (locationRef.current && !locationRef.current.contains(event.target)) {
                setIsLocationDropdownOpen(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsSearchDropdownOpen(false);
            }
        };

        if (isNotificationOpen || isLocationDropdownOpen || isSearchDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isNotificationOpen, isLocationDropdownOpen, isSearchDropdownOpen]);

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
            const shouldRequestLocation = window.confirm(
                'Allow CrwdCtrl to access your location to show nearby events?'
            );

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
        console.log('🔍 Location button clicked, current dropdown state:', isLocationDropdownOpen);
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
            window.open(`https://www.google.com/maps/@${latitude},${longitude},15z`, '_blank');
        } else {
            // Fallback to search by city name
            const searchQuery = encodeURIComponent(`${currentLocation.city}, ${currentLocation.state}, ${currentLocation.country}`);
            window.open(`https://www.google.com/maps/search/${searchQuery}`, '_blank');
        }
    };

    // Handle search input change
    const handleSearchChange = (e) => {
        setSearchQuery(e.target.value);
    };

    // Handle search result click
    const handleSearchResultClick = (event) => {
        setSearchQuery('');
        setIsSearchDropdownOpen(false);
        
        // Navigate based on result type
        if (event.resultType === 'competition') {
            // Navigate to competition details page
            navigate(`/competitions-view-details/${event.id}`);
        } else {
            // Navigate to fest details page
            navigate(`/view-details/${event.id}`);
        }
    };

    // Handle search form submit (Enter key)
    const handleSearchSubmit = (e) => {
        e.preventDefault();
        if (searchQuery.trim() && searchResults.length > 0) {
            handleSearchResultClick(searchResults[0]);
        }
    };

    return (
        <header className={`fixed top-0 left-20 right-0 z-50 mx-2 lg:mx-4 pt-4 px-4 lg:px-6 py-4 rounded-b-2xl backdrop-blur-md transition-all duration-300 ${isDark
            ? 'bg-[#0a0a0a] '
            : 'bg-[#F5F6FA]'
            }`} style={{ fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>
            <div className="flex items-center justify-between">
                {/* Left Section: Location and Navigation */}
                <div className="flex items-center space-x-2 lg:space-x-6">
                    {/* Location Selector */}
                    <div className="relative" ref={locationRef}>
                        <button
                            onClick={handleLocationClick}
                            className={`flex items-center space-x-2 px-3 lg:px-4 py-2 rounded-full border border-[#119999] transition-all duration-200 hover:shadow-md touch-manipulation ${isDark
                                ? 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80'
                                : 'bg-gray-50/80 text-gray-700 hover:bg-gray-100/80'
                                } ${isLocationDropdownOpen ? 'ring-2 ring-[#119999]/30' : ''}`}
                        >
                            {currentLocation.isDetecting ? (
                                <Loader2 className="w-4 h-4 text-[#119999] animate-spin" />
                            ) : currentLocation.hasPermission ? (
                                <MapPin className="w-4 h-4 text-[#119999] fill-[#119999]/20" />
                            ) : (
                                <MapPin className="w-4 h-4 text-[#119999]" />
                            )}
                            <span className="text-sm font-medium hidden text-[#119999] sm:inline">
                                {currentLocation.isDetecting ? 'Detecting...' : currentLocation.city}
                            </span>
                        </button>

                        {/* Location Dropdown */}
                        {isLocationDropdownOpen && (
                            <div className={`absolute left-0 sm:left-0 mt-2 w-80 sm:w-72 max-w-[95vw] rounded-2xl shadow-2xl border backdrop-blur-md z-[60] ${isDark
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

                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        className={`lg:hidden p-2 rounded-xl transition-all duration-200 ${isDark
                            ? 'text-gray-300 hover:text-[#007BFF] hover:bg-gray-800/60'
                            : 'text-gray-600 hover:text-[#007BFF] hover:bg-[#007BFF]/5'
                            }`}
                    >
                        <Menu className="w-5 h-5" />
                    </button>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden lg:flex items-center space-x-1">
                        {eventCategories.map((category) => {
                            const isActive = location.pathname === category.path;
                            return (
                                <button
                                    key={category.label}
                                    onClick={() => handleNavigation(category.path)}
                                    className={`relative px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                                        ? 'text-[#007BFF] bg-[#007BFF]/10 shadow-md'
                                        : isDark
                                            ? 'text-gray-300 hover:text-[#007BFF] hover:bg-gray-800/60'
                                            : 'text-gray-600 hover:text-[#007BFF] hover:bg-[#007BFF]/5'
                                        }`}
                                >
                                    {category.label}
                                    {isActive && (
                                        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-[#007BFF] rounded-full"></div>
                                    )}
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
                        <form onSubmit={handleSearchSubmit} className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10" />
                            
                            <input
                                type="text"
                                placeholder="search"
                                value={searchQuery}
                                onChange={handleSearchChange}
                                className={`w-28 sm:w-48 lg:w-64 pl-10 pr-10 py-2 rounded-xl text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#007BFF]/30 focus:shadow-lg ${isDark
                                    ? 'bg-black/60 border border-gray-700/50 text-white placeholder-gray-400 focus:bg-black/80'
                                    : 'bg-[#F8F9FB] border border-gray-200/50 text-gray-900 placeholder-gray-500 focus:bg-white'
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
                                    <Loader2 className="w-4 h-4 text-[#007BFF] animate-spin" />
                                )}
                            </div>

                            {/* Search Results Dropdown */}
                            {isSearchDropdownOpen && (searchResults.length > 0 || isSearching) && (
                                <div className={`absolute top-full left-0 right-0 mt-2 rounded-2xl shadow-2xl border backdrop-blur-md z-50 max-h-96 overflow-y-auto ${isDark
                                    ? 'bg-black/95 border-gray-700/50'
                                    : 'bg-white/95 border-gray-200/50'
                                    }`}>
                                    {isSearching ? (
                                        <div className="p-4 text-center">
                                            <Loader2 className={`w-6 h-6 mx-auto mb-2 animate-spin ${isDark ? 'text-gray-400' : 'text-gray-600'}`} />
                                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                Searching fests and competitions...
                                            </p>
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        <>
                                            {searchResults.map((event, index) => (
                                                <div
                                                    key={event.id}
                                                    onClick={() => handleSearchResultClick(event)}
                                                    className={`flex items-center p-3 cursor-pointer transition-colors border-b last:border-b-0 ${isDark
                                                        ? 'border-gray-700 hover:bg-gray-800/60'
                                                        : 'border-gray-100 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className={`w-10 h-10 rounded-lg flex-shrink-0 mr-3 flex items-center justify-center text-xs font-bold ${
                                                        event.resultType === 'competition'
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
                                                                <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-600 rounded-full flex-shrink-0">
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
                            onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                            className={`relative p-2 lg:p-3 rounded-xl transition-all duration-200 hover:shadow-md ${location.pathname === '/notifications' || location.pathname === '/notification-panel'
                                ? 'text-[#007BFF] bg-[#007BFF]/10 shadow-md'
                                : isDark
                                    ? 'text-gray-300 hover:text-[#007BFF] hover:bg-gray-800/60'
                                    : 'text-gray-600 hover:text-[#007BFF] hover:bg-[#007BFF]/5'
                                } ${isNotificationOpen ? (isDark ? 'bg-gray-800/60 text-[#007BFF]' : 'bg-[#007BFF]/5 text-[#007BFF]') : ''}`}>
                            <Bell className="w-4 lg:w-5 h-4 lg:h-5" />
                            {unreadCount > 0 && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00C9A7] rounded-full border-2 border-white flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">
                                        {unreadCount}
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
                                                    <div className={`p-2 rounded-lg flex-shrink-0 ${notification.type === 'event'
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
                                                                <div className="w-2 h-2 bg-[#007BFF] rounded-full flex-shrink-0 ml-2 mt-1"></div>
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

                    {/* User Profile Avatar */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                if (isAuthenticated) {
                                    setIsProfileOpen(true);
                                } else {
                                    _setSearchParams({ showLogin: 'true' });
                                }
                            }}
                            className={`w-8 lg:w-10 h-8 lg:h-10 rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${isAuthenticated
                                ? 'bg-gradient-to-br from-[#007BFF] to-[#00C9A7]'
                                : isDark
                                    ? 'bg-gray-700 hover:bg-gray-600'
                                    : 'bg-gray-200 hover:bg-gray-300'
                                }`}
                        >
                            {isAuthenticated && user?.name ? (
                                <span className="text-white font-bold text-xs lg:text-sm">
                                    {user.name.charAt(0).toUpperCase()}
                                </span>
                            ) : (
                                <User className={`w-4 lg:w-5 h-4 lg:h-5 ${isDark ? 'text-gray-300' : 'text-gray-600'
                                    }`} />
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation Menu */}
            {isMobileMenuOpen && (
                <div className={`lg:hidden mt-4 py-4 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                    <nav className="flex flex-col space-y-2">
                        {eventCategories.map((category) => {
                            const isActive = location.pathname === category.path;
                            return (
                                <button
                                    key={category.label}
                                    onClick={() => {
                                        handleNavigation(category.path);
                                        setIsMobileMenuOpen(false);
                                    }}
                                    className={`text-left px-4 py-2 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                                        ? 'text-[#007BFF] bg-[#007BFF]/10 shadow-md'
                                        : isDark
                                            ? 'text-gray-300 hover:text-[#007BFF] hover:bg-gray-800/60'
                                            : 'text-gray-600 hover:text-[#007BFF] hover:bg-[#007BFF]/5'
                                        }`}
                                >
                                    {category.label}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            )}
        </header>
    );
};

export default Navbar;
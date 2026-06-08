import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../utils/imageImports';
// ✅ FIX: Use native fetch instead of axios (axios XMLHttpRequest causes ERR_NETWORK on mobile)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const fetchJSON = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}`;
    const timeout = options.timeout || 20000;
    const maxRetries = options.retries || 3;
    
    const attemptFetch = async (retryCount = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(url, {
                method: 'GET',
                credentials: 'omit',
                mode: 'cors',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            return { data };
        } catch (err) {
            clearTimeout(timeoutId);
            
            // Retry on network errors (not on 404, 400, etc.)
            const isNetworkError = err.name === 'AbortError' || 
                                   err.name === 'TypeError' || 
                                   err.message.includes('Failed to fetch') ||
                                   err.message.includes('Network');
            
            if (isNetworkError && retryCount < maxRetries) {
                console.log(`🔄 Retry ${retryCount + 1}/${maxRetries} for ${endpoint}`);
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 1000));
                return attemptFetch(retryCount + 1);
            }
            
            if (err.name === 'AbortError') { 
                const e = new Error('Request timeout'); 
                e.code = 'ECONNABORTED'; 
                e.isNetworkError = true;
                throw e; 
            }
            err.isNetworkError = isNetworkError;
            throw err;
        }
    };
    
    return attemptFetch();
};

const CompetitionListPage = () => {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { eventId } = useParams();
    
    const [eventData, setEventData] = useState(null);
    const [competitions, setCompetitions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('');

    // Fetch event and competitions data from backend
    useEffect(() => {
        const fetchData = async () => {
            if (!eventId) {
                navigate('/');
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Fetch event data with populated competitions (same as main page)
                // Add cache busting timestamp to ensure fresh data
                const timestamp = Date.now();
                const eventResponse = await fetchJSON(`/fests/${eventId}/public?t=${timestamp}`);
                const festData = eventResponse.data;

                if (!festData) {
                    setError('Event not found');
                    return;
                }

                const transformedEventData = {
                    id: festData._id || festData.id,
                    title: festData.festName,
                    subtitle: festData.collegeName,
                    festival_name: festData.festName,
                    organizing_body: festData.collegeName,
                    type: festData.festType,
                    description: festData.description,
                    dateTime: festData.festDate,
                    venue: festData.venue,
                    image: festData.coverImage,
                    heroImage: festData.coverImage
                };

                setEventData(transformedEventData);

                // Process competitions from the populated fest data (same as main page)
                if (festData.competitions && Array.isArray(festData.competitions) && festData.competitions.length > 0) {
                    console.log('Competition-list - Processing populated competitions:', festData.competitions);
                    
                    // Group competitions by type
                    const groupedCompetitions = {};
                    festData.competitions.forEach(comp => {
                        const category = comp.competitionType?.toUpperCase() || 'OTHER';
                        if (!groupedCompetitions[category]) {
                            groupedCompetitions[category] = [];
                        }
                        groupedCompetitions[category].push({
                            id: comp._id,
                            name: comp.name,
                            title: comp.name,
                            subtitle: comp.subtitle || comp.description,
                            image: comp.coverImage,
                            fee: comp.registrationFee || 'Free',
                            prize: comp.prizePool || 'TBD',
                            description: comp.description,
                            dateTime: comp.dateTime,
                            venue: comp.venue,
                            rules: comp.commonRules || [],
                            commonRulesMessage: comp.commonRulesMessage || '',
                            rounds: comp.rounds || [],
                            contact: comp.contact,
                            // Include all original fields for hasCompleteDetails check
                            prizePool: comp.prizePool,
                            registrationFee: comp.registrationFee,
                            competitionType: comp.competitionType,
                            coverImage: comp.coverImage,
                            gallery: comp.gallery,
                            commonRules: comp.commonRules
                        });
                    });
                    
                    setCompetitions(groupedCompetitions);
                    console.log('Competition-list - Grouped competitions:', groupedCompetitions);
                    
                    // Set initial active tab
                    const availableTabs = Object.keys(groupedCompetitions);
                    if (availableTabs.length > 0) {
                        setActiveTab(availableTabs[0]);
                    }
                } else {
                    console.log('Competition-list - No competitions found in fest data');
                    setCompetitions({});
                }

            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load event data');
                setTimeout(() => navigate('/'), 2000);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [eventId, navigate]);

    // 🔄 Listen for admin updates and refetch data
    useEffect(() => {
        const handleAdminUpdate = (e) => {
            // Only refetch if the updated fest is the one we're viewing
            if (!e.detail?.festId || e.detail?.festId === eventId) {
                console.log('🔄 Admin update detected for current fest - refetching competitions list');
                // Refetch the event data with cache busting
                const fetchUpdatedData = async () => {
                    try {
                        const timestamp = Date.now();
                        const eventResponse = await fetchJSON(`/fests/${eventId}/public?t=${timestamp}`);
                        const festData = eventResponse.data;

                        if (festData) {
                            const transformedEventData = {
                                id: festData._id || festData.id,
                                title: festData.festName,
                                subtitle: festData.collegeName,
                                festival_name: festData.festName,
                                organizing_body: festData.collegeName,
                                type: festData.festType,
                                description: festData.description,
                                dateTime: festData.festDate,
                                venue: festData.venue,
                                image: festData.coverImage,
                                heroImage: festData.coverImage
                            };

                            setEventData(transformedEventData);

                            // Process competitions
                            if (festData.competitions && Array.isArray(festData.competitions) && festData.competitions.length > 0) {
                                const groupedCompetitions = {};
                                festData.competitions.forEach(comp => {
                                    const category = comp.competitionType?.toUpperCase() || 'OTHER';
                                    if (!groupedCompetitions[category]) {
                                        groupedCompetitions[category] = [];
                                    }
                                    groupedCompetitions[category].push({
                                        id: comp._id,
                                        name: comp.name,
                                        title: comp.name,
                                        subtitle: comp.subtitle || comp.description,
                                        image: comp.coverImage,
                                        fee: comp.registrationFee || 'Free',
                                        prize: comp.prizePool || 'TBD',
                                        description: comp.description,
                                        dateTime: comp.dateTime,
                                        venue: comp.venue,
                                        rules: comp.commonRules || [],
                                        commonRulesMessage: comp.commonRulesMessage || '',
                                        rounds: comp.rounds || [],
                                        contact: comp.contact,
                                        prizePool: comp.prizePool,
                                        registrationFee: comp.registrationFee,
                                        competitionType: comp.competitionType,
                                        coverImage: comp.coverImage,
                                        gallery: comp.gallery,
                                        commonRules: comp.commonRules
                                    });
                                });
                                setCompetitions(groupedCompetitions);
                            } else {
                                setCompetitions({});
                            }
                        }
                    } catch (err) {
                        console.error('Error refetching updated competition data:', err);
                    }
                };
                fetchUpdatedData();
            }
        };

        // Listen for custom admin update event (same-tab)
        window.addEventListener('admin_fest_updated', handleAdminUpdate);

        // Also listen for storage events (cross-tab updates)
        const handleStorageChange = (e) => {
            if (e.key === 'admin_data_updated') {
                console.log('🔄 Admin update detected (cross-tab) - refetching competitions list');
                handleAdminUpdate({ detail: { festId: eventId } });
            }
        };
        window.addEventListener('storage', handleStorageChange);

        return () => {
            window.removeEventListener('admin_fest_updated', handleAdminUpdate);
            window.removeEventListener('storage', handleStorageChange);
        };
    }, [eventId]);

    // Get available tabs from competitions data
    const availableTabs = Object.keys(competitions || {});

    const handleBackClick = () => {
        navigate(-1);
    };

    const handleCompetitionClick = (competition) => {
        navigate(`/competitions-view-details/${competition.id}`, {
            state: {
                competition: competition,
                eventData: eventData
            }
        });
    };

    // Loading state
    if (loading) {
        return (
            <div className={`min-h-screen ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} flex items-center justify-center`}>
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
                    <h2 className="text-xl font-semibold">Loading competitions...</h2>
                </div>
            </div>
        );
    }

    // Error state
    if (error || !eventData) {
        return (
            <div className={`min-h-screen ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} flex items-center justify-center`}>
                <div className="text-center max-w-md mx-auto p-6">
                    <div className="mb-6">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-900/20' : 'bg-red-100'}`}>
                            <svg className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold mb-4">{error || 'Event not found'}</h2>
                    <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
                        Unable to load competitions. Please check your connection.
                    </p>
                    <div className="space-y-3">
                        <button
                            onClick={() => window.location.reload()}
                            className="w-full bg-cyan-500 text-white px-6 py-3 rounded-lg hover:bg-cyan-600 transition font-medium"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className={`w-full px-6 py-3 rounded-lg transition font-medium ${
                                isDark 
                                    ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#161718] text-white' : 'bg-[#EDEDF2] text-gray-900'} transition-colors duration-300`}>
            {/* Header */}
            <div className={`flex items-center justify-between p-4  ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                    <button onClick={handleBackClick} className={`${isDark ? 'text-white hover:text-gray-300' : 'text-gray-900 hover:text-gray-600'} transition-colors`}>
                        <ChevronLeft className="w-6 h-6" />
                    </button>
                    <h1 className="text-xl font-semibold">Competitions</h1>
                </div>

            </div>

            {/* Tabs */}
            <div className={`flex gap-8 px-4 pt-6 pb-4  ${isDark ? 'border-gray-800' : 'border-gray-200'} overflow-x-auto scrollbar-hide`}>
                {availableTabs.map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`text-sm font-medium pb-2 transition-colors whitespace-nowrap ${activeTab === tab
                            ? 'text-cyan-400 -2 border-cyan-400'
                            : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-600 hover:text-gray-900'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {/* Competition List */}
            <div className="p-4 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {competitions[activeTab]?.map((comp, idx) => {
                    // Safety check for comp object
                    if (!comp || typeof comp !== 'object') {
                        console.warn('Invalid competition object:', comp);
                        return null;
                    }

                    return (
                        <div
                            key={idx}
                            className={`${isDark
                                ? 'bg-[#111213] '
                                : 'bg-white border-gray-200'
                                } rounded-2xl overflow-hidden  transition-all duration-300 hover:shadow-lg`}
                        >
                            <div className="flex gap-4 p-3">
                                {/* Image */}
                                <div className="w-32 h-32 shrink-0">
                                    <img
                                        src={getImageUrl(comp.image, { preset: 'cardSm' })}
                                        alt={comp.name}
                                        className="w-full h-full object-cover rounded-xl"
                                        onError={(e) => handleImageErrorWithFallback(e, 128, 128, '#0ea5e9', comp.name || 'Competition')}
                                    />
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <h3 className={`text-base font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {typeof comp.name === 'string' ? comp.name : 'Competition'}
                                        </h3>

                                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-1`}>
                                            Fee - ₹{typeof comp.fee === 'object' ? JSON.stringify(comp.fee) : comp.fee || 'TBA'}
                                        </p>
                                    </div>

                                    {/* Always show View details button for competitions */}
                                    <button
                                        onClick={() => handleCompetitionClick(comp)}
                                        className="self-start bg-[#00C2CB] text-black text-sm font-semibold px-6 py-2 rounded-full hover:from-cyan-500 hover:to-cyan-600 transition-all mt-2"
                                    >
                                        View details
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                </div>

                {/* Empty state */}
                {(!competitions[activeTab] || competitions[activeTab].length === 0) && (
                    <div className="text-center py-12">
                        <div className={`text-6xl mb-4 ${isDark ? 'text-gray-700' : 'text-gray-300'}`}>🏆</div>
                        <h3 className={`text-lg font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            No competitions yet
                        </h3>
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            Competitions for {activeTab} category will be announced soon.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompetitionListPage;
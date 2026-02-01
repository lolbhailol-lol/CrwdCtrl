import React, { useState, useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { getImageUrl } from '../../utils/imageImports';
import axios from 'axios';

// Configure axios base URL - HARDCODED FOR PRODUCTION FIX
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.baseURL = API_BASE_URL;

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
                const eventResponse = await axios.get(`/fests/${eventId}/public`);
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
            <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} flex items-center justify-center`}>
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
            <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} flex items-center justify-center`}>
                <div className="text-center">
                    <h2 className="text-2xl font-bold mb-4">{error || 'Event not found'}</h2>
                    <button
                        onClick={() => navigate('/')}
                        className="bg-cyan-500 text-white px-6 py-2 rounded-lg hover:bg-cyan-600 transition"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} transition-colors duration-300`}>
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
            <div className="p-4 space-y-4">
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
                                ? 'bg-[#1B1C1E] '
                                : 'bg-white border-gray-200'
                                } rounded-2xl overflow-hidden  transition-all duration-300 hover:shadow-lg`}
                        >
                            <div className="flex gap-4 p-3">
                                {/* Image */}
                                <div className="w-32 h-32 flex-shrink-0">
                                    <img
                                        src={getImageUrl(comp.image)}
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
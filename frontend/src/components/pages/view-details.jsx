import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Bell, User, Home, ChevronRight, Sun, Moon, Phone, Instagram, Mail, ArrowLeft, Share, MoreHorizontal } from 'lucide-react';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import shareIcon from '../../assets/share.svg';
import calendarIcon from '../../assets/calendar.svg';
import locationIcon from '../../assets/location-.svg';
import Sidebar from '../Sidebar';
import Navbar from '../Navbar';
import Footer from '../Footer';
import { useDarkMode } from '../../context/DarkModeContext';
import { useAuth } from '../../context/AuthContext';
import { useRegisteredEvents } from '../../context/RegisteredEventsContext';
import { getImageUrl, aarohanLogoImg } from '../../utils/imageImports';
import carnivalSymbios from '../../data/real-data/symbi-images/carnival-symbios.jpg';
import CrwdCtrlLogin from './login';
import CrwdCtrlRegister from './register';
import axios from 'axios';

// Configure axios base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
axios.defaults.baseURL = API_BASE_URL;

function EventDetailsPage() {
  const { isDark } = useDarkMode();
  const { isAuthenticated } = useAuth();
  const { registerForEvent, isRegistered } = useRegisteredEvents();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('GROUP');
  const [currentArtist, setCurrentArtist] = useState(0);
  const [currentHeroImage, setCurrentHeroImage] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const eventsRef = useRef(null);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  
  // Fetch event data from backend API
  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) {
        console.log('ViewDetails - No eventId provided, redirecting to dashboard');
        navigate('/');
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        console.log('ViewDetails - Fetching event data for ID:', eventId);
        
        // Fetch from public fests API - this already includes populated competitions
        const response = await axios.get(`/fests/${eventId}/public`);
        console.log('ViewDetails - API Response:', response.data);
        const festData = response.data;

        // Debug: Check if registrationLink exists in the response
        console.log('ViewDetails - Registration Link from API:', festData.registrationLink);

        if (festData && (festData._id || festData.id)) {
          // Transform backend fest data to match expected UI structure
          const transformedData = {
            id: festData._id || festData.id,
            title: festData.festName || 'Untitled Event',
            subtitle: festData.collegeName || 'Unknown College',
            festival_name: festData.festName || 'Untitled Event',
            organizing_body: festData.collegeName || 'Unknown College',
            type: festData.festType || 'cultural',
            category: festData.festType || 'cultural',
            description: festData.description || 'No description available',
            overview: festData.description || 'No description available',
            dateTime: festData.festDate || 'Date TBA',
            date: festData.festDate || 'Date TBA',
            venue: festData.venue || 'Venue TBA',
            location: festData.venue || 'Venue TBA',
            image: festData.coverImage || '/placeholder-image.jpg',
            heroImage: festData.coverImage || '/placeholder-image.jpg',
            galleryImages: festData.galleryImages || [],
            ticketPrice: festData.ticketPrice || 'Free',
            status: festData.status || 'upcoming',
            registrationLink: festData.registrationLink || '', // ✅ ADD MISSING FIELD
            // ✅ ADD REGISTRATION CONFIGURATION
            registration: {
              mode: festData.registration?.mode || 'NOT_STARTED',
              externalLink: festData.registration?.externalLink || '',
              formSchema: festData.registration?.formSchema || []
            },
            artists: festData.artists || [],
            artistsHeading: festData.artistsHeading || "Artists You'll Love",
            contacts: festData.contacts || [],
            sponsors: festData.sponsors || [],
            competitions: {},
            competitionsHeading: festData.competitionsHeading || "Competitions",
            theme: festData.festType === 'cultural' ? 'Cultural Festival' :
                   festData.festType === 'technical' ? 'Technical Festival' :
                   festData.festType === 'sports' ? 'Sports Festival' : 'Festival'
          };

          // Process competitions from the populated fest data
          if (festData.competitions && Array.isArray(festData.competitions) && festData.competitions.length > 0) {
            console.log('ViewDetails - Processing populated competitions:', festData.competitions);
            console.log('ViewDetails - First competition structure:', festData.competitions[0]);
            
            // Group competitions by type
            const groupedCompetitions = {};
            festData.competitions.forEach(comp => {
              console.log('ViewDetails - Processing competition:', {
                id: comp._id,
                name: comp.name,
                venue: comp.venue,
                commonRules: comp.commonRules,
                rounds: comp.rounds
              });
              
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
                dateTime: comp.dateTime, // Use dateTime from competition model
                venue: comp.venue,
                rules: comp.commonRules || [], // Use commonRules from competition model
                commonRulesMessage: comp.commonRulesMessage || '', // Include message field for rules
                rounds: comp.rounds || [],
                contact: comp.contact
              });
            });
            transformedData.competitions = groupedCompetitions;
            console.log('ViewDetails - Grouped competitions:', groupedCompetitions);
          } else {
            console.log('ViewDetails - No competitions found in fest data');
            console.log('ViewDetails - Competitions field value:', festData.competitions);
            transformedData.competitions = {};
          }

          setEventData(transformedData);
          setCurrentHeroImage(transformedData.heroImage || transformedData.image);
          
          // Debug: Check if registrationLink is properly mapped
          console.log('ViewDetails - Transformed Registration Link:', transformedData.registrationLink);
          console.log('ViewDetails - Event data set successfully');
        } else {
          setError('Event not found');
        }
      } catch (err) {
        console.error('ViewDetails - Error fetching event data:', err);
        setError('Failed to load event details');
      } finally {
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, navigate]);

  // Check for login modal parameter
  useEffect(() => {
    if (searchParams.get('showLogin') === 'true') {
      setShowLogin(true);
    }
  }, [searchParams]);

  // Get available competition tabs based on event data
  const availableTabs = Object.keys(eventData?.competitions || {});

  // Set initial active tab to the first available tab
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs, activeTab]);

  // Update hero image when event data changes
  useEffect(() => {
    if (eventData?.heroImage) {
      setCurrentHeroImage(eventData.heroImage);
    }
  }, [eventData]);

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

  // Loading state
  if (loading) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Loading event...</h2>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !eventData) {
    return (
      <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} flex items-center justify-center`}>
        <div className="text-center">
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            {error || 'Event not found'}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const isPersona = eventData.title.toLowerCase() === 'persona fest';
  const isSaksham = eventData.title.toLowerCase() === 'saksham 4.0';

  const handleRegister = () => {
    // Check authentication first
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    // Handle dynamic registration based on mode
    const registrationMode = eventData?.registration?.mode || 'NOT_STARTED';

    if (registrationMode === 'EXTERNAL_LINK') {
      // External registration link
      const externalLink = eventData?.registration?.externalLink || eventData?.registrationLink;
      if (externalLink && externalLink.trim() !== '') {
        window.open(externalLink, '_blank');
      } else {
        alert('Registration link is not available. Please contact the organizers.');
      }
    } else if (registrationMode === 'INTERNAL_FORM') {
      // Internal form - navigate to registration page
      navigate(`/fest/${eventData.id}/register`);
    } else if (registrationMode === 'CLOSED') {
      // Registration is closed
      alert('Registration for this fest is closed.');
    } else {
      // Registration not started
      alert('Registration for this fest has not started yet.');
    }
    // For NOT_STARTED mode, do nothing (button is disabled)
  };

  const handleCompetitionRegister = (competition) => {
    console.log('handleCompetitionRegister called with:', competition);
    console.log('eventData:', eventData);

    try {
      // Determine fest name from eventData
      const festName = eventData?.festival_name || eventData?.fest_name || eventData?.title;
      console.log('Detected fest name:', festName);

      // Create basic competition data from the available information
      const fullCompetitionData = {
        id: competition.id || `comp_${Date.now()}`,
        title: competition.name || 'Competition',
        subtitle: competition.subtitle || 'Competition Event',
        category: 'Cultural',
        subcategory: competition.subtitle || 'Event',
        date: eventData?.date || 'TBA',
        time: eventData?.time || 'TBA',
        venue: eventData?.venue || eventData?.location || 'TBA',
        image: getImageUrl(competition.image) || '/default-image.jpg',
        description: `Join the ${competition.name} competition and showcase your talent!`,
        registrationFee: `₹${competition.fee || 'TBA'}`,
        entryFee: `₹${competition.fee || 'TBA'}`,
        prizePool: `₹${competition.prize || 'TBA'}`,
        prize: `₹${competition.prize || 'TBA'}`,
        teamSize: 'TBA',
        duration: 'TBA',
        contact: eventData?.contact || {
          email: 'info@fest.edu.in',
          phone: 'TBA',
          instagram: 'TBA'
        },
        rules: [
          'All participants must carry valid ID proof',
          'Participants must report 30 minutes before the event',
          'Judges\' decisions are final and binding',
          'Use of unfair means will lead to disqualification'
        ],
        commonRules: eventData?.common_rules || [],
        prizes: {
          first: `₹${competition.prize || 'TBA'}`,
          second: 'TBA',
          third: 'TBA'
        },
        rounds: {
          description: `The ${competition.name} competition will be conducted as per fest guidelines.`,
          list: ['Registration', 'Event'],
          round1: {
            title: 'Registration',
            rules: ['Complete registration process', 'Submit required documents', 'Pay registration fee']
          },
          round2: {
            title: 'Main Event',
            rules: ['Follow event guidelines', 'Adhere to time limits', 'Maintain discipline']
          }
        },
        organizer: eventData?.organizing_body || 'Event Organizer',
        festival: festName,
        registrationDeadline: eventData?.registration_deadline || 'TBA',
        status: 'Open',
        fest: festName // Add fest identifier
      };

      console.log('Navigating with full competition data:', fullCompetitionData);

      // Navigate to competition details page with competition ID in URL
      navigate(`/competitions-view-details/${competition.id}`, {
        state: {
          competition: fullCompetitionData,
          eventData: eventData
        }
      });
    } catch (error) {
      console.error('Navigation error:', error);
      alert('Navigation failed: ' + error.message);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: eventData.title,
        text: eventData.overview.substring(0, 100) + '...',
        url: window.location.href,
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('Event link copied to clipboard!');
    }
  };

  const handleGalleryImageClick = (imageUrl) => {
    setCurrentHeroImage(imageUrl);
  };

  const toggleReadMore = () => {
    setShowFullOverview(!showFullOverview);
  };

  const handleViewAllCompetitions = () => {
    navigate(`/competition-list/${eventData.id}`, {
      state: {
        eventData: eventData,
        initialTab: activeTab
      }
    });
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0E0E0F] text-white' : 'bg-white text-gray-900'} transition-colors duration-300`}>
      {/* Desktop Version */}
      <div className="hidden lg:block">
        <div className={`transition-all duration-300`}>
          {/* Content */}
          <div className="max-w-9xl mx-auto px-2  py-4 ml-3">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Left Column - Event Details */}
              <div className="lg:col-span-2 space-y-4 sm:space-y-6">
                {/* Hero Image */}
                <div className="relative rounded-2xl overflow-hidden">
                  <img
                    src={getImageUrl(currentHeroImage)}
                    alt={eventData.title}
                    className="w-full h-64 sm:h-80 lg:h-96 object-cover"
                    onError={(e) => {
                      handleImageErrorWithFallback(e, 400, 300, '#6366f1', eventData.title || 'Event');
                    }}
                  />
                  {eventData.id === 'fest_001' && (
                    <div className="absolute top-3 sm:top-4 left-3 sm:left-4 pt-70">
                      <img
                        src={aarohanLogoImg}
                        alt="Aarohan Logo"
                        className="w-12 h-12 sm:w-16 sm:h-16 object-contain bg-white/90 rounded-lg p-2 shadow-sm"
                      />
                    </div>
                  )}
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex flex-col space-y-2">
                    {eventData.galleryImages?.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleGalleryImageClick(img)}
                        className={`w-10 sm:w-12 h-10 sm:h-12 ${currentHeroImage === img ? 'ring-2 ring-blue-500 ring-offset-2' : ''} bg-white rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 transition-all duration-200`}
                      >
                        <img
                          src={getImageUrl(img)}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            handleImageErrorWithFallback(e, 100, 100, '#6366f1', 'Gallery');
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fest Overview */}
                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 transition-colors duration-300`}>
                  <h2 className={`text-xl sm:text-2xl font-bold mb-3 sm:mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Event Overview</h2>
                  <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed text-sm sm:text-base`}>
                    {showFullOverview ? eventData.overview : `${eventData.overview.substring(0, 200)}...`}
                    {eventData.overview.length > 200 && (
                      <button
                        onClick={toggleReadMore}
                        className="text-blue-500 ml-1 font-semibold hover:text-blue-600 transition-colors"
                      >
                        {showFullOverview ? ' read less' : ' read more'}
                      </button>
                    )}
                  </p>
                </div>

                {/* Competitions */}
                {(() => {
                  return null;
                })()}
                {availableTabs.length > 0 && (
                  <div ref={eventsRef} className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 transition-colors duration-300`}>
                    <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {eventData.competitionsHeading || "Competitions"}
                    </h2>

                    {/* Tabs */}
                    <div className={`flex space-x-6 border-b ${isDark ? 'border-gray-600' : 'border-gray-200'} mb-6 overflow-x-auto`}>
                      {availableTabs.map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`pb-2 font-semibold whitespace-nowrap transition-colors duration-200 ${activeTab === tab
                            ? 'text-blue-600 border-b-2 border-blue-600'
                            : isDark
                              ? 'text-gray-300 hover:text-blue-400'
                              : 'text-gray-600 hover:text-blue-600'
                            }`}
                        >
                          {tab}
                        </button>
                      ))}
                    </div>

                    {/* Competition Cards */}
                    <div className={`${eventData.competitions[activeTab]?.length > 4 ? 'max-h-96 overflow-y-auto pr-2' : ''}`} style={{ scrollbarWidth: 'thin' }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {eventData.competitions[activeTab]?.map((comp, idx) => {
                          // Check if competition has all required details for "View details" button
                          const hasCompleteDetails = comp.venue && 
                                                   ((comp.rules && comp.rules.length > 0) || (comp.commonRulesMessage && comp.commonRulesMessage.trim())) && 
                                                   (comp.rounds && comp.rounds.length > 0);
                          
                          return (
                            <div key={idx} className={`${isDark ? 'bg-[#0a0a0a] hover:bg-gray-600' : 'bg-white hover:shadow-lg'} rounded-xl p-4 transition-all duration-300 h-full flex flex-col`}>
                              <div className="flex space-x-4 flex-1">
                                <img
                                  src={getImageUrl(comp.image)}
                                  alt={comp.name}
                                  className="w-24 h-24 rounded-lg object-cover flex-shrink-0"
                                  onError={(e) => {
                                    handleImageErrorWithFallback(e, 100, 100, '#0ea5e9', comp.name || 'Competition');
                                  }}
                                />
                                <div className="flex-1 flex flex-col justify-between">
                                  <div>
                                    <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>
                                      {typeof comp.name === 'string' ? comp.name : 'Competition'}
                                    </h3>

                                  </div>
                                  <div className="space-y-1">
                                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                      Fee: ₹{typeof comp.fee === 'object' ? JSON.stringify(comp.fee) : comp.fee || 'TBA'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                              {/* Only show View details button when competition has complete details */}
                              {hasCompleteDetails && eventData.status !== 'coming_soon' && eventData.status !== 'Registration Not Started' && !isPersona && !isSaksham && (
                                <button
                                  onClick={() => handleCompetitionRegister(comp)}
                                  className="w-full mt-3 bg-cyan-400 hover:bg-cyan-500 text-gray-900 font-semibold py-2 rounded-lg transition"
                                >
                                  View details
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Our Past Sponsors */}
                {eventData.sponsors && eventData.sponsors.length > 0 && (
                  <div className=" rounded-2xl p-4 sm:p-6">
                    <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Our Sponsors</h2>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {eventData.sponsors.map((sponsor, idx) => (
                        <div
                          key={idx}
                          className={`aspect-square ${isDark ? 'bg-[#1B1C1E] hover:bg-gray-600' : 'bg-[#F5F6FA] '} rounded-lg flex items-center justify-center p-1 transition-all duration-300`}
                        >
                          <img
                            src={getImageUrl(sponsor.logo)}
                            alt={sponsor.name}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              handleImageErrorWithFallback(e, 100, 60, '#4285F4', sponsor.name || 'Sponsor');
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Registration Card & Artists */}
              <div className="lg:col-span-1 space-y-4 sm:space-y-5">
                <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 top-24 mb-10 pt-6 sm:pt-8 pb-8 sm:pb-10 transition-colors duration-300`}>
                  <div className="flex items-start justify-between mb-4 sm:mb-6">
                    <h1 className={`text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{eventData.title}<br />{eventData.subtitle}</h1>
                  </div>

                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    <div className="flex items-center space-x-3">
                      <img src={calendarIcon} alt="Calendar" className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'filter brightness-150 invert' : ''}`} />
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{eventData.dateTime}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <img src={locationIcon} alt="Location" className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'filter brightness-150 invert' : ''}`} />
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{eventData.venue}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>🎭</div>
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{eventData.theme}</span>
                    </div>
                  </div>

                  <div className="mb-4">

                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleRegister}
                      className={`flex-1 font-semibold py-2.5 sm:py-3 rounded-xl transition text-sm sm:text-base ${
                        eventData?.registration?.mode === 'NOT_STARTED' || eventData?.registration?.mode === 'CLOSED'
                          ? 'bg-gray-500 hover:bg-gray-600 text-white cursor-not-allowed'
                          : isRegistered(eventData.id)
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-gradient-to-r from-[#0060DF] to-[#00C2CB] hover:opacity-90 text-white'
                      }`}
                      disabled={eventData?.registration?.mode === 'NOT_STARTED' || eventData?.registration?.mode === 'CLOSED'}
                      title={eventData?.registration?.mode === 'NOT_STARTED' ? 'Registrations Not Started' : 
                             eventData?.registration?.mode === 'CLOSED' ? 'Registration Closed' : ''}
                    >
                      {eventData?.registration?.mode === 'NOT_STARTED'
                        ? 'Registrations Not Started'
                        : eventData?.registration?.mode === 'CLOSED'
                        ? 'Registration Closed'
                        : isRegistered(eventData.id) 
                        ? '✓ Registered' 
                        : 'Register Now'}
                    </button>
                    <button
                      onClick={handleShare}
                      className={`p-2.5 sm:p-3 ${isDark ? 'bg-[#1B1C1E] hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-xl transition`}
                    >
                      <img src={shareIcon} alt="Share" className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'filter brightness-150 invert' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Artists Section */}
                <div >
                  <h2 className={`text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {eventData.artistsHeading || "Artists You'll Love"}
                  </h2>
                </div>
                {eventData.artists && eventData.artists.length > 0 && (
                  <div className={`${isDark ? 'bg-[#1B1C1E] rounded-2xl' : 'bg-white-100 rounded-2xl'} w-full`}>

                    {/* Artist Card */}
                    <div className={`w-full max-w-full rounded-2xl overflow-hidden duration-300 
                      ${isDark
                        ? 'bg-[#1B1C1E] border-8 border-[#1B1C1E]'
                        : 'bg-[#F5F6FA] border-8 border-[#F5F6FA]'
                      }`}
                    >
                      <div className="relative h-[280px] sm:h-[300px] overflow-hidden">
                        <img
                          src={getImageUrl(eventData.artists[currentArtist].image)}
                          alt={eventData.artists[currentArtist].name}
                          className="w-full h-full object-cover transition-transform duration-300 rounded-[16px]"
                          onError={(e) => {
                            handleImageErrorWithFallback(e, 300, 300, '#6366f1', eventData.artists[currentArtist].name || 'Artist');
                          }}
                        />

                        {/* Navigation arrows for multiple artists */}
                        {eventData.artists.length > 1 && (
                          <>
                            <button
                              onClick={() => setCurrentArtist(currentArtist === eventData.artists.length - 1 ? 0 : currentArtist + 1)}
                              className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition-all duration-300 flex items-center justify-center"
                              title="Next Artist"
                            >
                              <ChevronRight size={16} className="sm:w-5 sm:h-5" />
                            </button>
                          </>
                        )}
                      </div>

                      <div className={`p-4 sm:p-5 rounded-[16px] ${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
                        {/* Artist Name */}
                        <div className="mb-2">
                          <h3 className={`text-lg sm:text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {eventData.artists[currentArtist].name}
                          </h3>
                          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {eventData.artists[currentArtist].genre}
                          </p>
                        </div>

                        {/* Event Details */}
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {eventData.venue}
                              </p>
                              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-900'}`}>
                                {eventData.artists[currentArtist].message || 'No message available'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Carousel dots */}
                    {eventData.artists.length > 1 && (
                      <div className="flex justify-center space-x-3 py-6">
                        {eventData.artists.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentArtist(idx)}
                            className={`h-2 rounded-full transition-all duration-300 ${currentArtist === idx
                              ? 'bg-cyan-400 w-8 shadow-lg'
                              : `${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'} w-2`
                              }`}
                            title={`View ${eventData.artists[idx].name}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Details */}
                {eventData.contacts && eventData.contacts.length > 0 && (
                  <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-100'} rounded-2xl p-4 transition-colors duration-300`}>
                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h3>
                    <div className="space-y-2">
                      {eventData.contacts.map((contact, index) => (
                        <div key={index} className={`${isDark ? 'bg-[#0a0a0a]' : 'bg-white'} rounded-lg p-3 transition-colors duration-300`}>
                          {/* Name - Role in one line */}
                          <div className="mb-1">
                            <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {contact.name || 'Contact Person'}
                            </span>
                            {contact.role && (
                              <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-2`}>
                                - {contact.role}
                              </span>
                            )}
                          </div>

                          {/* Contact info in compact format */}
                          <div className="space-y-1">
                            {contact.phone && (
                              <div className="flex items-center">
                                <Phone size={12} className={`${isDark ? 'text-blue-400' : 'text-blue-600'} mr-2`} />
                                <a
                                  href={`tel:${contact.phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                                  className={`text-xs ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition`}
                                >
                                  {contact.phone}
                                </a>
                              </div>
                            )}

                            {contact.email && (
                              <div className="flex items-center">
                                <Mail size={12} className={`${isDark ? 'text-green-400' : 'text-green-600'} mr-2`} />
                                <a
                                  href={`mailto:${contact.email}`}
                                  className={`text-xs ${isDark ? 'text-gray-300 hover:text-green-400' : 'text-gray-600 hover:text-green-600'} transition truncate`}
                                >
                                  {contact.email}
                                </a>
                              </div>
                            )}

                            {contact.instagramId && (
                              <div className="flex items-center">
                                <Instagram size={12} className={`${isDark ? 'text-pink-400' : 'text-pink-600'} mr-2`} />
                                <a
                                  href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`text-xs ${isDark ? 'text-gray-300 hover:text-pink-400' : 'text-gray-600 hover:text-pink-600'} transition`}
                                >
                                  {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className={`transition-all duration-300`}>
          <Footer />
        </div>
      </div>

      {/* Mobile Version */}
      <div className="lg:hidden">
        {/* Mobile Content */}
        <div className="pb-20">
          {/* Header Icons */}
          <div className="relative z-20">
            <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/20 to-transparent">
              <button
                onClick={() => navigate(-1)}
                className="p-2 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 rounded-full transition"
              >
                <ArrowLeft size={20} />
              </button>
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleShare}
                  className="p-2 bg-black/30 backdrop-blur-sm text-white hover:bg-black/50 rounded-full transition"
                >
                  <Share size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Event Banner with Thumbnails */}
          {/* Wrapper to match page background */}
          <div className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-[#F5F6FA]'}`}>
            {/* Event Banner */}
            <div className="relative -mt-16 rounded-b-4xl">
              <img
                src={getImageUrl(currentHeroImage)}
                alt={eventData.title}
                className="w-full h-64 object-cover rounded-b-4xl"
                style={{
                  filter: isDark ? 'brightness(0.85)' : 'none',
                }}
                onError={(e) => {
                  handleImageErrorWithFallback(e, 400, 256, '#6366f1', eventData.title || 'Event');
                }}
              />
              {eventData.id === 'fest_001' && (
                <div className="absolute top-20 left-4 z-10 pt-30">
                  <img
                    src={aarohanLogoImg}
                    alt="Aarohan Logo"
                    className="w-16 h-16 object-contain bg-white/90 rounded-lg p-2 shadow-sm"
                  />
                </div>
              )}

              {/* Thumbnail Gallery */}
              {eventData.galleryImages && eventData.galleryImages.length > 0 && (
                <div className="absolute top-20 right-4 flex flex-col space-y-2 z-10">
                  {eventData.galleryImages.slice(0, 4).map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleGalleryImageClick(img)}
                      className={`w-14 h-14 rounded-lg overflow-hidden shadow-sm transition-all duration-200 backdrop-blur-sm${currentHeroImage === img ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${isDark ? 'bg-[#232326] hover:ring-blue-400' : 'bg-white/90 hover:ring-blue-500'}`}
                    >
                      <img
                        src={getImageUrl(img)}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover"
                        style={{
                          filter: isDark ? 'brightness(0.85)' : 'none',
                        }}
                        onError={(e) => {
                          handleImageErrorWithFallback(e, 56, 56, '#6366f1', 'Gallery');
                        }}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Event Info Card */}
          <div className={`${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-50'} p-5`}>
            {/* Event Logo and Name Section */}
            <div className="flex items-center space-x-4 mb-5 pt-10">
              <div className="flex-1">
                <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} leading-tight`}>
                  {eventData.title}
                </h1>
                <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'} mt-1`}>
                  {eventData.subtitle}
                </p>
              </div>
            </div>

            {/* Event Details - Information Rows */}
            <div className="space-y-4 mb-5">
              <div className="flex items-center space-x-3">
                <div className={`p-2 ${isDark ? 'bg-blue-900/30' : 'bg-blue-50'} rounded-lg`}>
                  <img src={calendarIcon} alt="Calendar" className={`w-[18px] h-[18px] ${isDark ? 'filter contrast-150 hue-rotate-180' : ''}`} style={{ filter: isDark ? 'brightness(2) saturate(2) hue-rotate(200deg)' : '' }} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {eventData.dateTime}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className={`p-2 ${isDark ? 'bg-green-900/30' : 'bg-green-50'} rounded-lg`}>
                  <img src={locationIcon} alt="Location" className={`w-[18px] h-[18px] ${isDark ? 'filter brightness-150 contrast-150 hue-rotate-90' : ''}`} style={{ filter: isDark ? 'brightness(2) saturate(2) hue-rotate(90deg)' : '' }} />
                </div>
                <div>
                  <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {eventData.venue}
                  </p>
                </div>
              </div>
            </div>

            {/* Short Description */}
            <div className="mt-5">
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed`}>
                {showFullOverview ? eventData.overview : `${eventData.overview.substring(0, 150)}...`}
                {eventData.overview.length > 150 && (
                  <button
                    onClick={toggleReadMore}
                    className="text-blue-500 ml-1 font-semibold hover:text-blue-600 transition-colors"
                  >
                    {showFullOverview ? ' read less' : ' read more'}
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* Artists You'll Love */}
          {eventData.artists && eventData.artists.length > 0 && (
            <div className={`${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} p-4`}>
              <h2 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {eventData.artistsHeading || "Artists You'll Love"}
              </h2>
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex space-x-4">
                  {eventData.artists.map((artist, idx) => (
                    <div key={idx} className={`min-w-[280px] ${isDark ? 'bg-[#1B1C1E] hover:bg-[#232326]' : 'bg-white hover:shadow-lg'} rounded-xl overflow-hidden transition-all duration-300`}>
                      <div className="relative h-40">
                        <img
                          src={getImageUrl(artist.image)}
                          alt={artist.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            handleImageErrorWithFallback(e, 280, 160, '#8b5cf6', artist.name || 'Artist');
                          }}
                        />
                        <button className="absolute top-3 right-3 p-1.5 bg-black/30 backdrop-blur-sm rounded-full">
                          <Share size={14} className="text-white" />
                        </button>
                      </div>
                      <div className="p-3">
                        <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {artist.name}
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {artist.genre}
                        </p>
                        <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          {artist.message || 'No message available'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Competitions */}
          {availableTabs.length > 0 && (
            <div className={`${isDark ? 'bg-[#0E0E0F]' : 'bg-gray-50'} p-4`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {eventData.competitionsHeading || "Competitions"}
                </h2>
                <button
                  onClick={handleViewAllCompetitions}
                  className="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors"
                >
                  View All
                </button>
              </div>
              <div className="overflow-x-auto md:overflow-visible scrollbar-hide">
                <div className="flex space-x-4">
                  {eventData.competitions[activeTab]?.slice(0, 3).map((comp, idx) => {
                    // Check if competition has all required details for "View details" button
                    const hasCompleteDetails = comp.venue && 
                                             ((comp.rules && comp.rules.length > 0) || (comp.commonRulesMessage && comp.commonRulesMessage.trim())) && 
                                             (comp.rounds && comp.rounds.length > 0);
                    
                    return (
                      <div key={idx} className={`min-w-[250px] ${isDark ? 'bg-[#1B1C1E] hover:bg-[#232326]' : 'bg-white hover:shadow-lg'} rounded-xl p-4 transition-all duration-300`}>
                        <img
                          src={getImageUrl(comp.image)}
                          alt={comp.name}
                          className="w-full h-32 rounded-lg object-cover mb-3"
                          onError={(e) => {
                            handleImageErrorWithFallback(e, 250, 128, '#0ea5e9', comp.name || 'Competition');
                          }}
                        />
                        <h3 className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {typeof comp.name === 'string' ? comp.name : 'Competition'}
                        </h3>
                        <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                          Fee: ₹{typeof comp.fee === 'object' ? JSON.stringify(comp.fee) : comp.fee || 'TBA'}
                        </p>

                        {/* Only show View details button when competition has complete details */}
                        {hasCompleteDetails && eventData.status !== 'coming_soon' && eventData.status !== 'Registration Not Started' && !isPersona && !isSaksham && (
                          <button
                            onClick={() => handleCompetitionRegister(comp)}
                            className="w-full bg-cyan-400 hover:bg-cyan-500 text-gray-900 font-semibold py-2 rounded-lg text-sm transition"
                          >
                            View details
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Contact Details */}
          {eventData.contacts && eventData.contacts.length > 0 && (
            <div className={`${isDark ? 'bg-[#0E0E0F]' : 'bg-white'} p-3 rounded-xl mt-4`}>
              <h3 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h3>
              <div className="space-y-2">
                {eventData.contacts.map((contact, index) => (
                  <div key={index} className={`${isDark ? 'bg-[#1B1C1E]' : 'bg-gray-50'} rounded-lg p-3`}>
                    {/* Name - Role in one line */}
                    <div className="mb-1">
                      <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {contact.name || 'Contact Person'}
                      </span>
                      {contact.role && (
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'} ml-2`}>
                          - {contact.role}
                        </span>
                      )}
                    </div>

                    {/* Contact info in compact format */}
                    <div className="space-y-1">
                      {contact.phone && (
                        <div className="flex items-center">
                          <Phone size={12} className={`${isDark ? 'text-blue-400' : 'text-blue-600'} mr-2`} />
                          <a
                            href={`tel:${contact.phone.replace(/\s*\([^)]*\)/, '').trim()}`}
                            className={`text-xs ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition`}
                          >
                            {contact.phone}
                          </a>
                        </div>
                      )}

                      {contact.email && (
                        <div className="flex items-center">
                          <Mail size={12} className={`${isDark ? 'text-green-400' : 'text-green-600'} mr-2`} />
                          <a
                            href={`mailto:${contact.email}`}
                            className={`text-xs ${isDark ? 'text-gray-300 hover:text-green-400' : 'text-gray-600 hover:text-green-600'} transition truncate`}
                          >
                            {contact.email}
                          </a>
                        </div>
                      )}

                      {contact.instagramId && (
                        <div className="flex items-center">
                          <Instagram size={12} className={`${isDark ? 'text-pink-400' : 'text-pink-600'} mr-2`} />
                          <a
                            href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-xs ${isDark ? 'text-gray-300 hover:text-pink-400' : 'text-gray-600 hover:text-pink-600'} transition`}
                          >
                            {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fixed Register Button */}
          <div className={`fixed bottom-0 left-0 right-0 ${isDark ? 'bg-[#0E0E0F]' : ''}  ${isDark ? 'border-gray-700' : 'border-gray-200'} p-2`}>
            <button
              onClick={handleRegister}
              disabled={eventData?.registration?.mode === 'NOT_STARTED' || eventData?.registration?.mode === 'CLOSED'}
              className={`w-full font-semibold py-3 rounded-xl transition ${
                eventData?.registration?.mode === 'NOT_STARTED' || eventData?.registration?.mode === 'CLOSED'
                  ? 'bg-gray-500 hover:bg-gray-600 text-white cursor-not-allowed'
                  : isRegistered(eventData.id)
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gradient-to-r from-[#0060DF] to-[#00C2CB] hover:opacity-90 text-white'
              }`}
            >
              {eventData?.registration?.mode === 'NOT_STARTED'
                ? 'Registrations Not Started'
                : eventData?.registration?.mode === 'CLOSED'
                ? 'Registration Closed'
                : isRegistered(eventData.id) 
                ? '✓ Registered' 
                : 'Register Now'}
            </button>
          </div>
        </div>
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

export default EventDetailsPage;
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Calendar, MapPin, Heart } from "lucide-react";
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Phone, Instagram, Mail, ArrowLeft, Share, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import shareIcon from '../../assets/share.svg';
import calendarIcon from '../../assets/calendar.svg';
import locationIcon from '../../assets/location-.svg';
import { useDarkMode } from '../../context/DarkModeContext';
import { useDialog } from '../../context/DialogContext';
import { useAuth } from '../../context/AuthContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import CardShareButton from '../../components/CardShareButton';
import { shareContent } from '../../utils/externalLink';
import {
  transformFestPublicData,
  buildCompetitionNavPayload,
  resolveCompetitionFee,
  isFestPlaceholderCopy,
  festHasCompetitionGroups,
} from '../../utils/festPublicTransform';
import CrwdCtrlLogin from '../auth/login';
import CrwdCtrlRegister from '../auth/register';
import { publicFetchJSONRetry as fetchJSON } from '../../services/api/client';
import Seo from '../../components/Seo';
import { breadcrumbSchema, eventSchema } from '../../utils/seo';
import { festPath, competitionPath, entityMatchesRouteParam } from '../../utils/slugRoutes';
import { loadFestDetailCache, saveFestDetailCache, saveCompetitionDetailCache } from '../../utils/detailPageCache';
import { signalDetailPageReady } from '../../utils/bootSplash';
import DetailPageLoader from '../../components/DetailPageLoader';
import CompetitionCoverImage from '../../components/CompetitionCoverImage';
import FestPublicLiveStrip from '../../components/FestPublicLiveStrip';
import { isMindSparkFest, formatMindSparkModuleLabel, MindSparkLiveBadge } from '../../features/fests/mindspark';
import { useInAppBack } from '../../hooks/useInAppBack';

function formatCompetitionTabLabel(tab) {
  if (!tab || tab === 'OTHER') return 'Other';
  if (tab === tab.toUpperCase() || tab.includes(' ') || tab.includes('-')) {
    return formatMindSparkModuleLabel(tab);
  }
  return tab.charAt(0) + tab.slice(1).toLowerCase();
}

function formatCompFee(compOrFee) {
  if (compOrFee && typeof compOrFee === 'object') {
    return resolveCompetitionFee(compOrFee).label;
  }
  return resolveCompetitionFee({ registrationFee: compOrFee }).label;
}

function getPrimaryPhone(contacts = []) {
  for (const contact of contacts) {
    if (!contact?.phone) continue;
    const entry = contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean)[0];
    if (entry) return entry.replace(/\s*\([^)]*\)/, '').trim();
  }
  return null;
}

function getPrimaryInstagram(contacts = []) {
  for (const contact of contacts) {
    if (contact?.instagramId) return contact.instagramId.replace('@', '');
  }
  return null;
}

function CompetitionScrollCard({ comp, isDark, isFavorite, onToggleFavorite, onClick, onPointerDown }) {
  const compName = typeof comp.name === 'string' ? comp.name : 'Competition';
  const feeLabel = formatCompFee(comp);
  const feeIsFree = feeLabel === 'Free';

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={`card-surface w-46 shrink-0 text-left rounded-2xl overflow-hidden transition active:scale-[0.98] flex flex-col ${
        isDark ? 'bg-black!' : 'bg-white'
      }`}
    >
      <div className="relative h-48 w-full shrink-0">
        <CompetitionCoverImage
          src={comp.image}
          alt={compName}
          preset="cardSm"
          containerClassName="absolute inset-0 w-full h-full"
        />
        <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
      </div>
      <div className={`px-4 pt-3 pb-4 flex flex-col gap-2.5 ${isDark ? 'bg-black' : 'bg-white'}`}>
        <h3 className={`text-[15px] font-bold leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {compName}
        </h3>
        <p
          className={`text-[15px] font-bold tracking-wide ${
            feeIsFree
              ? isDark ? 'text-emerald-400' : 'text-emerald-600'
              : isDark ? 'text-[#0ECCEE]' : 'text-[#0099B8]'
          }`}
        >
          {feeLabel}
        </p>
      </div>
    </button>
  );
}

function resolveSeededFest(eventId, location) {
  const fromState = location?.state?.eventData?.title ? location.state.eventData : null;
  if (fromState && (!eventId || entityMatchesRouteParam(fromState, eventId, ['title', 'festName', 'festival_name']))) {
    return fromState;
  }
  const cached = eventId ? loadFestDetailCache(eventId) : null;
  if (cached && entityMatchesRouteParam(cached, eventId, ['title', 'festName', 'festival_name'])) {
    return cached;
  }
  return null;
}

function EventDetailsPage() {
  const { isDark } = useDarkMode();
  const { toast } = useDialog();
  const { isAuthenticated } = useAuth();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const goBack = useInAppBack();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('GROUP');
  const [currentArtist, setCurrentArtist] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventData, setEventData] = useState(() => resolveSeededFest(eventId, location));
  const [currentHeroImage, setCurrentHeroImage] = useState(() => {
    const seed = resolveSeededFest(eventId, location);
    return seed?.heroImage || seed?.image || '';
  });
  const [fetchDone, setFetchDone] = useState(() => Boolean(resolveSeededFest(eventId, location)));
  const [error, setError] = useState(null);
  const [bodyReady, setBodyReady] = useState(() => Boolean(resolveSeededFest(eventId, location)));
  const eventsRef = useRef(null);
  const fetchGenRef = useRef(0);

  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS

  // Switching fests reuses this page — drop previous hero immediately
  useLayoutEffect(() => {
    const seed = resolveSeededFest(eventId, location);
    fetchGenRef.current += 1;
    setEventData(seed);
    // Blank hero until live fetch — avoids previous/demo image flash
    setCurrentHeroImage('');
    setFetchDone(Boolean(seed));
    setError(null);
    setActiveTab('GROUP');
    setShowFullOverview(false);
    setLightboxIndex(null);
    setBodyReady(false);
    if (seed) {
      const t = window.setTimeout(() => setBodyReady(true), 16);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [eventId]);

  // Fetch event data from backend API
  useEffect(() => {
    const gen = fetchGenRef.current;
    const fetchEventData = async () => {
      if (!eventId) {
        navigate('/');
        return;
      }

      try {
        setError(null);

        // ✅ iOS/Safari compatibility - longer timeout
        const userAgent = navigator.userAgent || '';
        const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
        const isSafari = /Safari/i.test(userAgent) && !/Chrome/i.test(userAgent);
        const timeout = (isIOS || isSafari) ? 20000 : 10000;
        
        // Fetch from public fests API - this already includes populated competitions
        // Add cache busting timestamp to ensure fresh data
        const response = await fetchJSON(`/fests/${eventId}/public`, {
          timeout: timeout,
          cacheBust: false,
        });
        const festData = response.data;

        const transformedData = transformFestPublicData(festData);
        if (gen !== fetchGenRef.current) return;
        if (transformedData) {
          setEventData(transformedData);
          setCurrentHeroImage(transformedData.heroImage || transformedData.image);
          saveFestDetailCache(eventId, transformedData);
          setBodyReady(true);
        } else {
          setError('Event not found');
        }
      } catch (err) {
        if (gen !== fetchGenRef.current) return;
        console.error('ViewDetails - Error fetching event data:', err);

        const cached = eventId ? loadFestDetailCache(eventId) : null;
        if (cached && entityMatchesRouteParam(cached, eventId, ['title', 'festName', 'festival_name'])) {
          setEventData(cached);
          setCurrentHeroImage(cached.heroImage || cached.image);
          setBodyReady(true);
        } else if (err.response?.status === 404) {
          setError('Fest not found - it may not be approved yet or the link might be incorrect');
        } else if (err.response?.status === 400) {
          setError('Invalid fest ID format');
        } else {
          setError('Failed to load event details');
        }
      } finally {
        if (gen === fetchGenRef.current) setFetchDone(true);
      }
    };

    fetchEventData();
  }, [eventId, navigate]);

  useEffect(() => {
    if (!eventData || !eventId) return;
    if (!festHasCompetitionGroups(eventData) && !fetchDone) return;
    const canonical = festPath({ id: eventData.id, _id: eventData.id, festName: eventData.title, title: eventData.title });
    if (canonical && window.location.pathname !== canonical) {
      navigate(`${canonical}${window.location.search || ''}`, {
        replace: true,
        state: { ...location.state, eventData },
      });
    }
  }, [eventData, eventId, navigate, location.state, fetchDone]);

  // 🔄 Listen for admin updates and refetch data
  useEffect(() => {
    const handleAdminUpdate = (e) => {
      // Only refetch if the updated fest is the one we're viewing
      if (!e.detail?.festId || e.detail?.festId === eventId) {
        // Refetch the event data with cache busting
        const fetchUpdatedData = async () => {
          try {
            const timestamp = Date.now();
            const response = await fetchJSON(`/fests/${eventId}/public?t=${timestamp}`);
            const transformedData = transformFestPublicData(response.data);
            if (transformedData) {
              setEventData(transformedData);
              setCurrentHeroImage(transformedData.heroImage || transformedData.image);
              saveFestDetailCache(eventId, transformedData);
            }
          } catch (err) {
            console.error('Error refetching updated event data:', err);
          }
        };
        fetchUpdatedData();
      }
    };

    // Listen for custom event from admin
    window.addEventListener('admin_fest_updated', handleAdminUpdate);

    // Also listen for localStorage changes (cross-tab updates)
    const handleStorageChange = (e) => {
      if (e.key === 'admin_data_updated') {
        handleAdminUpdate({ detail: { festId: eventId } });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('admin_fest_updated', handleAdminUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [eventId]);
  useEffect(() => {
    if (searchParams.get('showLogin') === 'true') {
      setShowLogin(true);
    }
  }, [searchParams]);

  // ✅ CRITICAL FIX: Auto-close login modal when user becomes authenticated
  useEffect(() => {
    if (isAuthenticated && showLogin) {
      setShowLogin(false);
    }
    if (isAuthenticated && showRegister) {
      setShowRegister(false);
    }
  }, [isAuthenticated, showLogin, showRegister]);

  // Get available competition tabs based on event data
  const availableTabs = Object.keys(eventData?.competitions || {});
  const visibleTab = availableTabs.includes(activeTab) ? activeTab : (availableTabs[0] || '');

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

  useEffect(() => {
    const ready =
      festHasCompetitionGroups(eventData)
      || (fetchDone && Boolean(eventData?.title || error));
    if (ready) {
      signalDetailPageReady();
    }
  }, [eventData, fetchDone, error]);

  if (fetchDone && error && !eventData) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="mb-6">
            <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${isDark ? 'bg-red-900/20' : 'bg-red-100'}`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-red-400' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h2 className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'} mb-4`}>
            {error || 'Event not found'}
          </h2>
          <p className={`${isDark ? 'text-gray-400' : 'text-gray-600'} mb-6`}>
            The fest page you're looking for might have been removed or there's a connection issue.
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

  if (!eventData?.title) {
    return <DetailPageLoader label="" />;
  }

  // Wait until competitions are in the payload (or the fetch finished with none).
  if (!festHasCompetitionGroups(eventData) && !fetchDone) {
    return <DetailPageLoader label="" />;
  }

  const pageEvent = eventData;

  const prefetchCompetition = (competition) => {
    const payload = buildCompetitionNavPayload(competition, pageEvent);
    const compId = competition?.id || competition?._id;
    if (compId && payload) saveCompetitionDetailCache(compId, payload);
  };

  const handleCompetitionRegister = (competition) => {
    prefetchCompetition(competition);
    navigate(competitionPath(competition), {
      state: {
        competition: buildCompetitionNavPayload(competition, pageEvent),
        eventData: pageEvent,
      },
    });
  };

  const handleShare = async () => {
    const result = await shareContent({
      title: pageEvent.title,
      text: `${(pageEvent.overview || pageEvent.description || '').substring(0, 100)}...`,
      url: window.location.href,
    });
    if (result === 'copied') {
      toast('Event link copied to clipboard!');
    }
  };

  const handleGalleryImageClick = (imageUrl) => {
    setCurrentHeroImage(imageUrl);
  };

  const openLightbox = (index) => {
    if (index != null && index >= 0) setLightboxIndex(index);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const toggleReadMore = () => {
    setShowFullOverview(!showFullOverview);
  };

  const primaryPhone = getPrimaryPhone(pageEvent.contacts);
  const primaryInstagram = getPrimaryInstagram(pageEvent.contacts);
  const galleryPreview = pageEvent.galleryImages || [];

  const handleFestFavorite = () => {
    toggleFavorite(pageEvent.id, {
      ...pageEvent,
      id: pageEvent.id,
      _id: pageEvent.id,
      _type: 'fest',
      type: 'fest',
      title: pageEvent.title,
      festName: pageEvent.title,
      subtitle: pageEvent.collegeName || pageEvent.subtitle,
      collegeName: pageEvent.collegeName || pageEvent.subtitle,
      heroImage: pageEvent.heroImage || pageEvent.image,
      coverImage: pageEvent.heroImage || pageEvent.image,
      venue: pageEvent.venue,
      dateTime: pageEvent.dateTime,
    });
  };

  const handleArtistShare = (artist) => {
    shareContent({
      title: artist.name,
      text: `${artist.name} at ${pageEvent.title}`,
      url: window.location.href,
    });
  };

  const canonicalPath = festPath({ id: pageEvent.id, _id: pageEvent.id, festName: pageEvent.title, title: pageEvent.title });
  const festDescription = `${pageEvent.title}${!isFestPlaceholderCopy(pageEvent.collegeName) ? ` by ${pageEvent.collegeName}` : ''}${pageEvent.description ? ` — ${pageEvent.description}` : ''}`;
  const heroImage = currentHeroImage || pageEvent.heroImage || pageEvent.image;
  const overviewText = isFestPlaceholderCopy(pageEvent.overview) ? '' : pageEvent.overview;
  const dateLabel = isFestPlaceholderCopy(pageEvent.dateTime) ? '' : pageEvent.dateTime;
  const venueLabel = isFestPlaceholderCopy(pageEvent.venue) ? '' : pageEvent.venue;
  const collegeLabel = isFestPlaceholderCopy(pageEvent.collegeName || pageEvent.subtitle)
    ? ''
    : (pageEvent.collegeName || pageEvent.subtitle);

  return (
    <div
      key={eventId || eventData?.id || 'fest'}
      className={`crwdctrl-page min-h-screen overflow-x-clip animate-detail-enter transition-opacity duration-300 ${
        bodyReady ? 'opacity-100' : 'opacity-90'
      } ${isDark ? 'bg-black' : 'bg-white'}`}
    >
      <Seo
        title={pageEvent.title}
        description={festDescription}
        canonical={canonicalPath}
        image={pageEvent.heroImage || pageEvent.image}
        type="article"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Fests', path: '/fests' },
            { name: pageEvent.title, path: canonicalPath },
          ]),
          eventSchema({
            name: pageEvent.title,
            description: pageEvent.description,
            url: canonicalPath,
            image: pageEvent.heroImage || pageEvent.image,
            location: venueLabel || undefined,
            price: pageEvent.ticketPrice,
            organizerName: collegeLabel || undefined,
            availabilityUrl: canonicalPath,
          }),
        ]}
      />
      {/* Desktop Version - Show at 768px and above */}
      <div className="hidden md:block">
        <div className={`transition-all duration-300`}>
          {/* Content */}
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Left Column - Event Details */}
              <div className="md:col-span-2 space-y-4 sm:space-y-6">
                {/* Hero Image */}
                <div className="relative rounded-2xl overflow-hidden bg-[#1A1B1D]">
                  {heroImage ? (
                  <img
                    src={getImageUrl(heroImage, { preset: 'hero' })}
                    alt={pageEvent.title}
                    className="w-full h-64 sm:h-80 xl:h-96 object-cover"
                  />
                  ) : (
                    <div className="w-full h-64 sm:h-80 xl:h-96" />
                  )}
                  <div className="absolute top-3 sm:top-4 right-3 sm:right-4 flex flex-col space-y-2">
                    {pageEvent.galleryImages?.map((img, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleGalleryImageClick(img)}
                        className={`w-10 sm:w-12 h-10 sm:h-12 ${currentHeroImage === img ? 'ring-2 ring-blue-500 ring-offset-2' : ''} bg-white rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-300 hover:ring-offset-1 transition-all duration-200`}
                      >
                        <img
                          src={getImageUrl(img, { preset: 'thumb' })}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            handleImageErrorWithFallback(e, 100, 100, '#2A2B2E', 'Gallery');
                          }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fest Overview */}
                {overviewText ? (
                <div className={`${isDark ? 'bg-[#111213]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 transition-colors duration-300`}>
                  <h2 className={`text-xl sm:text-2xl font-bold mb-3 sm:mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>About Us</h2>
                  <p className={`${isDark ? 'text-gray-300' : 'text-gray-700'} leading-relaxed text-sm sm:text-base`}>
                    {showFullOverview || overviewText.length <= 200 ? overviewText : `${overviewText.substring(0, 200)}...`}
                    {overviewText.length > 200 && (
                      <button
                        onClick={toggleReadMore}
                        className="text-blue-500 ml-1 font-semibold hover:text-blue-600 transition-colors"
                      >
                        {showFullOverview ? ' read less' : ' read more'}
                      </button>
                    )}
                  </p>
                </div>
                ) : null}

                {isMindSparkFest(pageEvent.id || eventId, pageEvent) ? (
                  <FestPublicLiveStrip festId={pageEvent.id || eventId} isDark={isDark} />
                ) : null}

                {/* Competitions */}
                {availableTabs.length > 0 && (
                  <div ref={eventsRef} className={`${isDark ? 'bg-[#111213]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 transition-colors duration-300`}>
                    <h2 className={`text-xl sm:text-2xl font-bold mb-4 sm:mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {pageEvent.competitionsHeading || "Competitions"}
                    </h2>

                    {/* Category pills */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {availableTabs.map(tab => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setActiveTab(tab)}
                          className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                            visibleTab === tab
                              ? isDark
                                ? 'border border-[#0ECCEE] text-[#0ECCEE] bg-[#0ECCEE]/10'
                                : 'border border-sky-400 text-sky-600 bg-white'
                              : isDark
                              ? 'text-gray-400 hover:text-gray-200'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {formatCompetitionTabLabel(tab)}
                        </button>
                      ))}
                    </div>

                    {/* Competition Cards — horizontal scroll */}
                    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                      <div className="flex gap-4 pb-1">
                        {pageEvent.competitions[visibleTab]?.map((comp, idx) => (
                          <CompetitionScrollCard
                            key={comp.id || idx}
                            comp={comp}
                            isDark={isDark}
                            isFavorite={isFavorite(comp.id)}
                            onToggleFavorite={() => toggleFavorite(comp.id, {
                              id: comp.id,
                              title: comp.name,
                              image: comp.image,
                              type: 'Competition',
                            })}
                            onClick={() => handleCompetitionRegister(comp)}
                            onPointerDown={() => prefetchCompetition(comp)}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Our Past Sponsors */}
                {pageEvent.sponsors && pageEvent.sponsors.length > 0 && (
                  <div className=" rounded-2xl p-4 sm:p-6">
                    <h2 className={`text-xl font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Our Sponsors</h2>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                      {pageEvent.sponsors.map((sponsor, idx) => (
                        <div
                          key={idx}
                          className={`aspect-square ${isDark ? 'bg-[#111213] hover:bg-gray-600' : 'bg-[#EDEDF2] '} rounded-lg flex items-center justify-center p-1 transition-all duration-300`}
                        >
                          <img
                            src={getImageUrl(sponsor.logo, { preset: 'thumb' })}
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
                <div className={`sticky top-24 ${isDark ? 'bg-[#111213]' : 'bg-gray-100'} rounded-2xl p-4 sm:p-6 mb-10 pt-6 sm:pt-8 pb-8 sm:pb-10 transition-colors duration-300`}>
                  <div className="flex items-start justify-between mb-4 sm:mb-6 gap-3">
                    <h1 className={`text-lg sm:text-2xl font-bold min-w-0 ${isDark ? 'text-white' : 'text-gray-900'}`}>{pageEvent.title}{collegeLabel ? <><br />{collegeLabel}</> : null}</h1>
                    {isMindSparkFest(pageEvent.id || eventId, pageEvent) ? (
                      <MindSparkLiveBadge />
                    ) : null}
                  </div>

                  <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                    {dateLabel ? (
                    <div className="flex items-center space-x-3">
                      <img src={calendarIcon} alt="Calendar" className={`w-[18px] h-[18px] ${isDark ? 'invert brightness-200' : ''}`}/>
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{dateLabel}</span>
                    </div>
                    ) : null}
                    {venueLabel ? (
                    <div className="flex items-center space-x-3">
                      <img src={locationIcon} alt="Location" className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'filter brightness-150 invert' : ''}`} />
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{venueLabel}</span>
                    </div>
                    ) : null}
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>🎭</div>
                      <span className={`text-sm sm:text-base ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{pageEvent.theme}</span>
                    </div>
                  </div>

                  <div className="mb-4">

                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={handleShare}
                      className={`p-2.5 sm:p-3 ${isDark ? 'bg-[#111213] hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'} rounded-xl transition`}
                    >
                      <img src={shareIcon} alt="Share" className={`w-4 h-4 sm:w-5 sm:h-5 ${isDark ? 'filter brightness-150 invert' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Artists Section */}
                <div >
                  <h2 className={`text-lg sm:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {pageEvent.artistsHeading || "Artists You'll Love"}
                  </h2>
                </div>
                {pageEvent.artists && pageEvent.artists.length > 0 && (
                    <div className={`${isDark ? 'bg-[#111213] rounded-2xl' : 'bg-[#EDEDF2] rounded-2xl'} w-full overflow-hidden`}>

                      {/* Artist Card — image flush into sheet (no border ring gap) */}
                      <div className={`w-full max-w-full rounded-2xl overflow-hidden ${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'}`}>
                        <div className="relative detail-hero-height overflow-hidden bg-[#1A1B1D]">
                          <img
                              src={getImageUrl(pageEvent.artists[currentArtist].image, { preset: 'card' })}
                              alt={pageEvent.artists[currentArtist].name}
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300"
                              onError={(e) => {
                                handleImageErrorWithFallback(e, 300, 300, '#2A2B2E', pageEvent.artists[currentArtist].name || 'Artist');
                              }}
                          />

                          {/* Navigation arrows for multiple artists */}
                          {pageEvent.artists.length > 1 && (
                              <>
                                {/* Left Arrow */}
                                <button
                                    onClick={() => setCurrentArtist(currentArtist === 0 ? pageEvent.artists.length - 1 : currentArtist - 1)}
                                    className="absolute left-2 sm:left-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition-all duration-300 flex items-center justify-center"
                                    title="Previous Artist"
                                >
                                  <ChevronLeft size={16} className="sm:w-5 sm:h-5" />
                                </button>

                                {/* Right Arrow */}
                                <button
                                    onClick={() => setCurrentArtist(currentArtist === pageEvent.artists.length - 1 ? 0 : currentArtist + 1)}
                                    className="absolute right-2 sm:right-4 top-1/2 transform -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 bg-black/30 backdrop-blur-sm text-white rounded-full hover:bg-black/50 transition-all duration-300 flex items-center justify-center"
                                    title="Next Artist"
                                >
                                  <ChevronRight size={16} className="sm:w-5 sm:h-5" />
                                </button>
                              </>
                          )}
                        </div>

                        <div className={`p-4 sm:p-5 ${isDark ? 'bg-[#111213]' : 'bg-[#EDEDF2]'}`}>
                          {/* Artist Name */}
                          <div className="mb-2">
                            <h3 className={`text-lg sm:text-xl font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {pageEvent.artists[currentArtist].name}
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                              {pageEvent.artists[currentArtist].genre}
                            </p>
                          </div>

                          {/* Event Details */}
                          <div className="space-y-1 mb-3">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <p className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                  {pageEvent.venue}
                                </p>
                                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-900'}`}>
                                  {pageEvent.artists[currentArtist].message || 'No message available'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    {/* Carousel dots */}
                    {pageEvent.artists.length > 1 && (
                      <div className="flex justify-center space-x-3 py-6">
                        {pageEvent.artists.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentArtist(idx)}
                            className={`h-2 rounded-full transition-all duration-300 ${currentArtist === idx
                              ? 'bg-cyan-400 w-8 shadow-lg'
                              : `${isDark ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'} w-2`
                              }`}
                            title={`View ${pageEvent.artists[idx].name}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact Details */}
                {pageEvent.contacts && pageEvent.contacts.length > 0 && (
                  <div className={`${isDark ? 'bg-[#111213]' : 'bg-gray-100'} rounded-2xl p-4 transition-colors duration-300`}>
                    <h3 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h3>
                    <div className="space-y-2">
                      {pageEvent.contacts.map((contact, index) => (
                        <div key={index} className={`${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'} rounded-lg p-3 transition-colors duration-300`}>
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
                            {contact.phone && contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean).map((entry, pi) => {
                              const nameMatch = entry.match(/\(([^)]+)\)/);
                              const name = nameMatch ? nameMatch[1].trim() : null;
                              const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                              return (
                                <div key={pi} className="flex items-start gap-1.5">
                                  <Phone size={12} className={`${isDark ? 'text-blue-400' : 'text-blue-600'} mt-0.5 shrink-0`} />
                                  <div>
                                    {name && <span className={`text-fluid-2xs ${isDark ? 'text-gray-500' : 'text-gray-400'} block leading-tight`}>{name}</span>}
                                    <a
                                      href={`tel:${rawNumber.replace(/[\s-]/g, '')}`}
                                      className={`text-xs ${isDark ? 'text-gray-300 hover:text-blue-400' : 'text-gray-600 hover:text-blue-600'} transition`}
                                    >
                                      {rawNumber}
                                    </a>
                                  </div>
                                </div>
                              );
                            })}

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
      </div>

      {/* Mobile Version - Show below 768px */}
      <div className={`md:hidden pb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
        {/* Hero with overlay controls — full bleed, overlaps into content sheet */}
        <div className="relative h-[320px] overflow-hidden bg-[#1A1B1D]">
          {heroImage ? (
          <img
            src={getImageUrl(heroImage, { preset: 'hero' })}
            alt={pageEvent.title}
            className="absolute inset-0 w-full h-full object-cover object-[center_30%]"
          />
          ) : null}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,var(--safe-top))] pb-3 bg-linear-to-b from-black/35 to-transparent z-10">
            <button
              type="button"
              onClick={goBack}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
              aria-label="Back to fests"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
                aria-label="Share"
              >
                <Share size={20} />
              </button>
              <button
                type="button"
                onClick={handleFestFavorite}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
                aria-label={isFavorite(pageEvent.id) ? 'Remove from favourites' : 'Add to favourites'}
              >
                <Heart
                  size={20}
                  className={isFavorite(pageEvent.id) ? 'fill-red-500 text-red-500' : 'text-white'}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Content sheet — overlaps hero so rounded corners sit on the image (no white ring) */}
        <div className={`relative -mt-10 rounded-t-[28px] z-10 overflow-hidden px-5 pt-6 pb-4 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="min-w-0 flex-1">
              <h1 className={`text-2xl font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {pageEvent.title}
              </h1>
              {collegeLabel ? (
              <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
                {collegeLabel}
              </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isMindSparkFest(pageEvent.id || eventId, pageEvent) ? (
                <MindSparkLiveBadge />
              ) : null}
              {primaryPhone && (
                <a
                  href={`tel:${primaryPhone.replace(/[\s-]/g, '')}`}
                  className="size-11 rounded-full bg-[#0ECCEE] flex items-center justify-center shadow-md"
                  aria-label="Call organizer"
                >
                  <Phone size={20} className="text-black" />
                </a>
              )}
            </div>
          </div>

          {(dateLabel || venueLabel) ? (
          <div className="space-y-3 mb-5">
            {dateLabel ? (
            <div className="flex items-center gap-3">
              <Calendar size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{dateLabel}</p>
            </div>
            ) : null}
            {venueLabel ? (
            <div className="flex items-center gap-3">
              <MapPin size={18} className={isDark ? 'text-gray-500' : 'text-gray-400'} />
              <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{venueLabel}</p>
            </div>
            ) : null}
          </div>
          ) : null}

          {overviewText ? (
          <div>
            <h2 className={`text-base font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>About Us</h2>
            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              {showFullOverview || overviewText.length <= 160 ? overviewText : `${overviewText.substring(0, 160)}...`}
              {overviewText.length > 160 && (
                <button
                  type="button"
                  onClick={toggleReadMore}
                  className="text-[#0060DF] ml-1 font-semibold"
                >
                  {showFullOverview ? 'read less' : 'read more'}
                </button>
              )}
            </p>
          </div>
          ) : null}
        </div>

        {/* Artists Over the Years */}
        {pageEvent.artists && pageEvent.artists.length > 0 && (
          <section className={`px-4 mb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <h2 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {pageEvent.artistsHeading || 'Artist Over the Years'}
            </h2>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-4 pb-1">
                {pageEvent.artists.map((artist, idx) => (
                  <div
                    key={idx}
                    className={`card-surface w-[18rem] shrink-0 rounded-2xl overflow-hidden ${isDark ? 'bg-black!' : 'bg-white'}`}
                  >
                    <div className="relative h-46 w-full">
                      <img
                        src={getImageUrl(artist.image, { preset: 'card' })}
                        alt={artist.name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => {
                          handleImageErrorWithFallback(e, 288, 184, '#8b5cf6', artist.name || 'Artist');
                        }}
                      />
                    </div>
                    <div className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className={`text-base font-bold leading-snug line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {artist.name}
                          </h3>
                          <p className={`text-sm font-medium mt-1.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {artist.genre || 'Artist'}
                          </p>
                        </div>
                        <CardShareButton
                          onClick={() => handleArtistShare(artist)}
                          isDark={isDark}
                          className="shrink-0 mt-0.5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Competitions */}
        {isMindSparkFest(pageEvent.id || eventId, pageEvent) ? (
          <div className="px-4 mb-6">
            <FestPublicLiveStrip festId={pageEvent.id || eventId} isDark={isDark} />
          </div>
        ) : null}
        {availableTabs.length > 0 && (
          <section className={`px-4 mb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <h2 className={`text-base font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {pageEvent.competitionsHeading || 'Competitions'}
            </h2>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-4 pb-1">
              {availableTabs.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition ${
                    visibleTab === tab
                      ? isDark
                        ? 'border border-[#0ECCEE] text-[#0ECCEE] bg-[#0ECCEE]/10'
                        : 'border border-sky-400 text-sky-600 bg-white'
                      : isDark
                      ? 'text-gray-400'
                      : 'text-gray-600'
                  }`}
                >
                  {formatCompetitionTabLabel(tab)}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
              <div className="flex gap-4 pb-1">
                {pageEvent.competitions[visibleTab]?.map((comp, idx) => (
                  <CompetitionScrollCard
                    key={comp.id || idx}
                    comp={comp}
                    isDark={isDark}
                    isFavorite={isFavorite(comp.id)}
                    onToggleFavorite={() => toggleFavorite(comp.id, {
                      id: comp.id,
                      title: comp.name,
                      image: comp.image,
                      type: 'Competition',
                    })}
                    onClick={() => handleCompetitionRegister(comp)}
                    onPointerDown={() => prefetchCompetition(comp)}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Contact Details */}
        {pageEvent.contacts && pageEvent.contacts.length > 0 && (
          <section className={`px-4 mb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <h2 className={`text-base font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
            <div className="space-y-3">
              {pageEvent.contacts.map((contact, index) => (
                <div
                  key={index}
                  className={`rounded-xl p-3 ${isDark ? 'bg-[#1f2021]' : 'bg-gray-100'}`}
                >
                  {(contact.name || contact.role) && (
                    <div className="mb-2">
                      <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {contact.name || 'Contact Person'}
                      </span>
                      {contact.role && (
                        <span className={`text-xs ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                          - {contact.role}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {contact.phone && contact.phone.split(/\s*(?:,|\/)\s*/).filter(Boolean).map((entry, pi) => {
                      const nameMatch = entry.match(/\(([^)]+)\)/);
                      const name = nameMatch ? nameMatch[1].trim() : null;
                      const rawNumber = entry.replace(/\s*\([^)]*\)/, '').trim();
                      return (
                        <a
                          key={pi}
                          href={`tel:${rawNumber.replace(/[\s-]/g, '')}`}
                          className="flex items-center gap-2.5"
                        >
                          <span className="size-9 shrink-0 rounded-full bg-[#0060DF] flex items-center justify-center">
                            <Phone size={16} className="text-white" />
                          </span>
                          <span className="min-w-0">
                            {name && (
                              <span className={`block text-[11px] leading-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                {name}
                              </span>
                            )}
                            <span className={`block text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                              {rawNumber}
                            </span>
                          </span>
                        </a>
                      );
                    })}

                    {contact.instagramId && (
                      <a
                        href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2.5"
                      >
                        <span className="size-9 shrink-0 rounded-full bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center">
                          <Instagram size={16} className="text-white" />
                        </span>
                        <span className={`text-sm ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {contact.instagramId.startsWith('@') ? contact.instagramId : `@${contact.instagramId}`}
                        </span>
                      </a>
                    )}

                    {contact.email && (
                      <a
                        href={`mailto:${contact.email}`}
                        className="flex items-center gap-2.5"
                      >
                        <span className="size-9 shrink-0 rounded-full bg-emerald-600 flex items-center justify-center">
                          <Mail size={16} className="text-white" />
                        </span>
                        <span className={`text-sm truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {contact.email}
                        </span>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Gallery — horizontal swipe (same pattern as run clubs) */}
        {galleryPreview.length > 0 && (
          <section className={`mb-8 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
            <div className="flex items-end justify-between gap-3 mb-3 px-4">
              <h2 className={`text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Gallery</h2>
              {galleryPreview.length > 1 ? (
                <p className={`text-xs shrink-0 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                  Swipe · {galleryPreview.length} photos
                </p>
              ) : null}
            </div>
            <div
              className="flex gap-3 overflow-x-auto px-4 pb-2 snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {galleryPreview.map((img, idx) => {
                const src = getImageUrl(img, { preset: 'detail' }) || getImageUrl(img, { preset: 'thumb' });
                return (
                  <button
                    key={`${img}-${idx}`}
                    type="button"
                    onClick={() => openLightbox(idx)}
                    aria-label={`View gallery image ${idx + 1} of ${galleryPreview.length}`}
                    className={`relative shrink-0 snap-center w-[78vw] max-w-[340px] h-[220px] rounded-3xl overflow-hidden border active:scale-[0.985] transition-transform ${
                      isDark ? 'border-white/10 bg-[#111213]' : 'border-gray-100 bg-white shadow-sm'
                    }`}
                  >
                    <img
                      src={src}
                      alt={`Gallery ${idx + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => {
                        handleImageErrorWithFallback(e, 340, 220, '#2A2B2E', 'Gallery');
                      }}
                    />
                    <span className="absolute inset-0 bg-linear-to-t from-black/45 via-transparent to-transparent pointer-events-none" />
                    <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/45 text-white text-[11px] font-medium tabular-nums backdrop-blur-sm">
                      {idx + 1}/{galleryPreview.length}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* Gallery Lightbox */}
      {lightboxIndex != null && galleryPreview[lightboxIndex] && (
        <div
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center"
          onClick={closeLightbox}
        >
          <button
            type="button"
            onClick={closeLightbox}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white backdrop-blur-sm"
            style={{ top: 'max(1rem, var(--safe-top))' }}
            aria-label="Close"
          >
            <X size={24} />
          </button>

          <img
            src={getImageUrl(galleryPreview[lightboxIndex], { preset: 'hero' })}
            alt={`Gallery ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => {
              handleImageErrorWithFallback(e, 600, 600, '#2A2B2E', 'Gallery');
            }}
          />

          {galleryPreview.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === 0 ? galleryPreview.length - 1 : prev - 1));
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur-sm flex items-center justify-center"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIndex((prev) => (prev === galleryPreview.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur-sm flex items-center justify-center"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
              <div className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm">
                {lightboxIndex + 1} / {galleryPreview.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div className="fixed inset-0 z-50">
          <CrwdCtrlLogin
            googleOnly
            title="Sign in to register"
            subtitle="One tap with Google — then finish registration"
            onClose={handleCloseLogin}
          />
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
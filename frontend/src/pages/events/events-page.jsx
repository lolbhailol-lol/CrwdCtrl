import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Bell, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getImageUrl } from '../../utils/imageImports';
import { getCoverImageUrl } from '../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import CategorySearchRow from '../../components/CategorySearchRow';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import { shareContent, openExternalUrl } from '../../utils/externalLink';
import { navigateToSearchResult } from '../../utils/searchNavigation';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import AppLogo from '../../components/AppLogo';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import CardShareButton from '../../components/CardShareButton';
import CarouselDotPagination from '../../components/CarouselDotPagination';
import HeroBanner from '../../components/HeroBanner';
import {
    HeroBannerSkeleton,
    CompactPortraitCardsRowSkeleton,
    WideActivityCardsRowSkeleton,
} from '../../components/HomeEventCardSkeleton';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { mapEventShow } from '../../constants/eventsPage';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { breadcrumbSchema, faqSchema, itemListSchema } from '../../utils/seo';
import { EVENTS_FAQ } from '../../constants/faqs';
import { eventShowPath } from '../../utils/slugRoutes';

const EVENTS_DESCRIPTION =
    'Discover events, shows and meetups near you — concerts, stand-up comedy, workshops and more. Find and book tickets to events around you on CrwdCtrl.';

import { API_BASE_URL as API } from '../../services/api/client';

const EVENTS_CACHE_KEY = 'crwdctrl_events_page_v1';
const readEventsCache = () => {
    try {
        const raw = sessionStorage.getItem(EVENTS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
};
const writeEventsCache = (payload) => {
    try {
        sessionStorage.setItem(EVENTS_CACHE_KEY, JSON.stringify(payload));
    } catch {
        /* storage full / unavailable */
    }
};

function SpotlightCard({ show, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-portrait flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200"
            onClick={onClick}
        >
            <div className="card-portrait-image relative overflow-hidden">
                {show.image ? (
                    <img
                        src={getCoverImageUrl(show, 'cardPortrait') || getImageUrl(show.image, { preset: 'cardPortrait' })}
                        alt={show.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#2a1a3a', show.title || 'Event')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-purple-800 to-indigo-600 flex items-center justify-center">
                        <span className="text-5xl">🎭</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>
            <div className="flex items-start justify-between px-3 pb-3 pt-2 w-full">
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(show.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(show.basedIn)}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="mt-0.5 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        shareContent({ title: show.title, url: window.location.origin + '/events' });
                    }}
                />
            </div>
        </div>
    );
}

function UpcomingShowCard({ show, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-wide rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200"
            onClick={onClick}
        >
            <div className="card-wide-image relative">
                {show.image ? (
                    <img
                        src={getCoverImageUrl(show, 'cardWide') || getImageUrl(show.image, { preset: 'cardWide' })}
                        alt={show.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 320, 224, '#2a1a3a', show.title || 'Event')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <span className="text-6xl">🎭</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(show.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(show.type)}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="ml-3"
                    onClick={(e) => {
                        e.stopPropagation();
                        shareContent({ title: show.title, url: window.location.origin + '/events' });
                    }}
                />
            </div>
        </div>
    );
}

function CommunityEventCard({ show, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-portrait flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200"
            onClick={onClick}
        >
            <div className="card-portrait-image relative overflow-hidden">
                {show.image ? (
                    <img
                        src={getCoverImageUrl(show, 'cardPortrait') || getImageUrl(show.image, { preset: 'cardPortrait' })}
                        alt={show.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#2a1a3a', show.title || 'Event')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-purple-800 to-indigo-600 flex items-center justify-center">
                        <span className="text-5xl">🎭</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>
            <div className="flex items-start justify-between px-3 pb-3 pt-2 w-full">
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(show.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(show.date)}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="mt-0.5 shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        shareContent({ title: show.title, url: window.location.origin + '/events' });
                    }}
                />
            </div>
        </div>
    );
}

export default function EventsPage() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const cached = readEventsCache();
    const [shows, setShows] = useState(() => (Array.isArray(cached?.shows) ? cached.shows.map(mapEventShow) : []));
    const [rawShows, setRawShows] = useState(() => (Array.isArray(cached?.shows) ? cached.shows : []));
    const [carouselFests, setCarouselFests] = useState(() => (Array.isArray(cached?.fests) ? cached.fests : []));
    const [carouselTreks, setCarouselTreks] = useState(() => (Array.isArray(cached?.treks) ? cached.treks : []));
    const [carouselCommunities, setCarouselCommunities] = useState(() => (Array.isArray(cached?.communities) ? cached.communities : []));
    const [carouselSports, setCarouselSports] = useState(() => (Array.isArray(cached?.sports) ? cached.sports : []));
    const [carouselRunClubs, setCarouselRunClubs] = useState(() => (Array.isArray(cached?.clubs) ? cached.clubs : []));
    const [loading, setLoading] = useState(!cached);
    const [upcomingPg, setUpcomingPg] = useState(0);
    const upcomingScrollRef = useRef(null);
    usePageContentLoading(loading);

    const loadData = useCallback(async () => {
        const hasCache = Boolean(readEventsCache());
        try {
            const [eventsRes, festsRes, treksRes, commRes, sportsRes, clubsRes] = await Promise.all([
                fetch(`${API}/events?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
                fetch(`${API}/fests/all?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
                fetch(`${API}/treks?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
                fetch(`${API}/trek-communities?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
                fetch(`${API}/sports?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
                fetch(`${API}/run-clubs?_cb=${Date.now()}`, { headers: { Accept: 'application/json' }, credentials: 'omit', mode: 'cors' }),
            ]);

            let nextShows = [];
            let nextFests = [];
            let nextTreks = [];
            let nextCommunities = [];
            let nextSports = [];
            let nextClubs = [];

            if (eventsRes.ok) {
                const data = await eventsRes.json();
                nextShows = Array.isArray(data?.shows) ? data.shows : [];
                setRawShows(nextShows);
                setShows(nextShows.map(mapEventShow));
            } else if (!hasCache) {
                setRawShows([]);
                setShows([]);
            }
            if (festsRes.ok) {
                const data = await festsRes.json();
                nextFests = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                setCarouselFests(nextFests);
            }
            if (treksRes.ok) {
                const data = await treksRes.json();
                nextTreks = Array.isArray(data?.treks) ? data.treks : [];
                setCarouselTreks(nextTreks);
            }
            if (commRes.ok) {
                const data = await commRes.json();
                nextCommunities = Array.isArray(data?.communities) ? data.communities : [];
                setCarouselCommunities(nextCommunities);
            }
            if (sportsRes.ok) {
                const data = await sportsRes.json();
                nextSports = Array.isArray(data?.events) ? data.events : [];
                setCarouselSports(nextSports);
            }
            if (clubsRes.ok) {
                const data = await clubsRes.json();
                nextClubs = Array.isArray(data?.clubs) ? data.clubs : [];
                setCarouselRunClubs(nextClubs);
            }

            writeEventsCache({
                shows: nextShows,
                fests: nextFests,
                treks: nextTreks,
                communities: nextCommunities,
                sports: nextSports,
                clubs: nextClubs,
            });
        } catch {
            if (!hasCache) setShows([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        const handleAdminChange = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) {
                loadData();
                localStorage.removeItem('admin_data_updated');
            }
        };
        window.addEventListener('storage', handleAdminChange);
        return () => window.removeEventListener('storage', handleAdminChange);
    }, [loadData]);

    const sortByPriority = useCallback(
        (arr) => [...arr].sort((a, b) => (a.pagePriority || 999) - (b.pagePriority || 999)),
        [],
    );

    const heroShows = useMemo(() => sortByPriority(shows.filter((s) => s.pageSection === 'hero')), [shows, sortByPriority]);
    const spotlightShows = useMemo(() => sortByPriority(shows.filter((s) => s.pageSection === 'spotlight')), [shows, sortByPriority]);
    const upcomingShows = useMemo(() => sortByPriority(shows.filter((s) => s.pageSection === 'upcoming')), [shows, sortByPriority]);
    const communityShows = useMemo(() => sortByPriority(shows.filter((s) => s.pageSection === 'community')), [shows, sortByPriority]);

    const heroBannerEvents = useMemo(
        () => heroShows.map((show) => ({
            id: show.id,
            image: getCoverImageUrl(show, 'hero') || show.image,
            title: show.title,
            subtitle: show.basedIn,
            dateTime: show.date,
        })),
        [heroShows],
    );

    const handleShowClick = useCallback((show) => {
        if (show?.id) {
            navigate(eventShowPath(show));
        } else if (show.bookingLink) {
            openExternalUrl(show.bookingLink);
        }
    }, [navigate]);

    const handleHeroClick = useCallback(
        (id) => {
            const show = heroShows.find((s) => s.id === id);
            if (show) handleShowClick(show);
        },
        [heroShows, handleShowClick],
    );

    const handleFav = useCallback(
        (show) => {
            toggleFavorite(show.id, {
                ...show,
                id: show.id,
                _id: show.id,
                _type: 'events',
                type: 'events',
                title: show.title,
                subtitle: show.basedIn,
                image: show.image,
            });
        },
        [toggleFavorite],
    );

    const eventsSearchQuickPicks = useMemo(
        () => shows.slice(0, 10).map((show) => ({
            id: show.id,
            title: show.title,
            subtitle: show.city || show.organizer,
            description: show.type,
            image: show.image,
            resultType: 'fest',
        })),
        [shows],
    );

    const eventsKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({ fests: shows.map((s) => ({ festName: s.title, collegeName: s.city })) }),
        [shows],
    );

    const handleEventsSearchNavigate = useCallback(
        (result) => navigateToSearchResult(navigate, result),
        [navigate],
    );

    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    const EmptyState = ({ label }) => (
        <div className={`mx-4 py-6 text-center rounded-2xl text-sm ${isDark ? 'bg-[#111213] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
            {label}
        </div>
    );

    return (
        <div className="crwdctrl-page crwdctrl-page--hub min-h-screen transition-colors">
            <Seo
                title="Events & Shows"
                description={EVENTS_DESCRIPTION}
                canonical="/events"
                keywords="events, shows, concerts, comedy, workshops, meetups, tickets"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Events', path: '/events' },
                    ]),
                    itemListSchema({
                        name: 'Events & Shows on CrwdCtrl',
                        description: EVENTS_DESCRIPTION,
                        url: '/events',
                    }),
                    faqSchema(EVENTS_FAQ),
                ]}
            />
            <MobileStickyHeader
                isDark={isDark}
                brandingRow={
                    <>
                        <AppLogo />
                        <div className="mobile-header-actions">
                            <button
                                type="button"
                                className={`p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
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
                    <CategorySearchRow isDark={isDark}>
                        <MobileHeroSearchField
                            isDark={isDark}
                            placeholder="search events, shows"
                            quickPickItems={eventsSearchQuickPicks}
                            keywordCatalog={eventsKeywordCatalog}
                            onResultNavigate={handleEventsSearchNavigate}
                        />
                    </CategorySearchRow>
                }
                categoryBar={<HomeCategoryBar activeCategory="events" isDark={isDark} noPadding />}
            />

            <main className="pb-8">
                {!loading && heroBannerEvents.length > 0 && (
                    <HeroBanner events={heroBannerEvents} onEventClick={handleHeroClick} />
                )}
                {loading && <HeroBannerSkeleton />}

                <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 crwdctrl-hub-body">
                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
                            In the Spotlight
                        </h2>
                        {loading ? (
                            <div className="carousel-scroll-gutter overflow-x-auto scrollbar-hide">
                                <CompactPortraitCardsRowSkeleton count={3} className="" />
                            </div>
                        ) : spotlightShows.length === 0 ? (
                            <EmptyState label="No spotlight events yet" />
                        ) : (
                            <div
                                className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2">
                                    {spotlightShows.map((show) => (
                                        <div key={show.id} className="shrink-0">
                                            <SpotlightCard
                                                show={show}
                                                isDark={isDark}
                                                isFavorite={isFavorite(show.id)}
                                                onToggleFavorite={() => handleFav(show)}
                                                onClick={() => handleShowClick(show)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
                            Upcoming Shows
                        </h2>
                        {loading ? (
                            <div className="carousel-scroll-gutter overflow-x-auto scrollbar-hide">
                                <WideActivityCardsRowSkeleton count={2} className="" />
                            </div>
                        ) : upcomingShows.length === 0 ? (
                            <EmptyState label="No upcoming shows yet" />
                        ) : (
                            <>
                                <div
                                    ref={upcomingScrollRef}
                                    className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                    onScroll={(e) => setUpcomingPg(Math.round(e.target.scrollLeft / 328))}
                                >
                                    <div className="flex gap-4 pb-1">
                                        {upcomingShows.map((show) => (
                                            <div key={show.id} className="shrink-0">
                                                <UpcomingShowCard
                                                    show={show}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(show.id)}
                                                    onToggleFavorite={() => handleFav(show)}
                                                    onClick={() => handleShowClick(show)}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CarouselDotPagination total={upcomingShows.length} current={upcomingPg} />
                            </>
                        )}
                    </section>

                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
                            Community Events
                        </h2>
                        {loading ? (
                            <div className="carousel-scroll-gutter overflow-x-auto scrollbar-hide">
                                <CompactPortraitCardsRowSkeleton count={3} className="" />
                            </div>
                        ) : communityShows.length === 0 ? (
                            <EmptyState label="No community events yet" />
                        ) : (
                            <div
                                className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2">
                                    {communityShows.map((show) => (
                                        <div key={show.id} className="shrink-0">
                                            <CommunityEventCard
                                                show={show}
                                                isDark={isDark}
                                                isFavorite={isFavorite(show.id)}
                                                onToggleFavorite={() => handleFav(show)}
                                                onClick={() => handleShowClick(show)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    <CustomPageSectionsRenderer
                        targetPage="events"
                        fests={carouselFests}
                        treks={carouselTreks}
                        communities={carouselCommunities}
                        sports={carouselSports}
                        runClubs={carouselRunClubs}
                        eventShows={rawShows}
                        isDark={isDark}
                        loading={loading}
                        isFavorite={isFavorite}
                        onToggleFavorite={onSectionFav}
                        onItemClick={onItemClick}
                        getShareUrl={getShareUrl}
                    />
                </div>

                <FaqSection items={EVENTS_FAQ} />
            </main>
        </div>
    );
}

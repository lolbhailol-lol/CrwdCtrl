import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getCoverImageUrl } from '../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import { openExternalUrl } from '../../utils/externalLink';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import CategorySearchRow from '../../components/CategorySearchRow';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import AppLogo from '../../components/AppLogo';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import HomeCarouselSection from '../../components/HomeCarouselSection';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { CompactPortraitCardsRowSkeleton } from '../../components/HomeEventCardSkeleton';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { SPORTS_BROWSE_CATEGORIES } from '../../constants/sportsBrowseCategories';
import {
    SPORT_TYPE_LABELS,
    getSportsDisplayType,
    showsInUpcoming,
    sortUpcomingEvents,
} from '../../constants/sportsPage';
import { normalizeImageUrl } from '../../utils/uploadUrls';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import { navigateToSearchResult } from '../../utils/searchNavigation';
import { festPath, runClubPath, sportRunPath } from '../../utils/slugRoutes';
import ContentImage from '../../components/ContentImage';
import { preloadImages } from '../../utils/preloadImages';

import { publicFetchJSONRetry } from '../../services/api/client';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { breadcrumbSchema, faqSchema, itemListSchema } from '../../utils/seo';
import { SPORTS_FAQ } from '../../constants/faqs';

const SPORTS_DESCRIPTION =
    'Discover sports events, running clubs and gym communities near you. Find runs, tournaments and sports fests, and join active communities on CrwdCtrl.';

const SPORTS_CACHE_KEY = 'crwdctrl_sports_page_v1';
const readSportsCache = () => {
    try {
        const raw = sessionStorage.getItem(SPORTS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!parsed || typeof parsed !== 'object') return null;
        return {
            events: Array.isArray(parsed.events) ? parsed.events : [],
            fests: Array.isArray(parsed.fests) ? parsed.fests : [],
            clubs: Array.isArray(parsed.clubs) ? parsed.clubs : [],
        };
    } catch {
        return null;
    }
};
const writeSportsCache = (payload) => {
    try {
        sessionStorage.setItem(SPORTS_CACHE_KEY, JSON.stringify(payload));
    } catch {
        /* storage full / unavailable */
    }
};

const BROWSE_CATEGORIES = SPORTS_BROWSE_CATEGORIES;

function RunClubCard({ club, isDark, isFavorite, onToggleFavorite, onClick, eager = false }) {
    const imgSrc = getCoverImageUrl(club, 'cardPortrait');
    return (
        <div className="card-portrait shrink-0 cursor-pointer active:scale-95 transition-all" onClick={onClick}>
            <div className="card-portrait-image relative">
                {imgSrc ? (
                    <ContentImage
                        src={imgSrc}
                        alt={club.title}
                        preset="cardPortrait"
                        loading={eager ? 'eager' : 'lazy'}
                        fetchPriority={eager ? 'high' : undefined}
                        showPlaceholderUntilLoad
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#2A2B2E', club.title || 'Run Club')}
                    />
                ) : (
                    <div className="w-full h-full bg-[#1A1B1D]" />
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>
            <div className="mt-2 w-full min-w-0 max-w-(--card-portrait-w)">
                <p className={`card-event-title font-inter truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {toCardText(club.title)}
                </p>
                <p className={`card-event-subtitle font-inter truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {toCardText(club.subtitle || 'Based in')}
                </p>
            </div>
        </div>
    );
}

export default function SportsCategoryPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const cached = readSportsCache();
    const [sportsEvents, setSportsEvents] = useState(cached?.events || []);
    const [sportsFests, setSportsFests] = useState(cached?.fests || []);
    const [runClubEntities, setRunClubEntities] = useState(cached?.clubs || []);
    const [loading, setLoading] = useState(!cached);
    const [loadError, setLoadError] = useState('');
    usePageContentLoading(loading);

    const loadData = useCallback(async () => {
        const hasCache = Boolean(readSportsCache());
        if (!hasCache) setLoading(true);
        setLoadError('');
        try {
            const [eventsRes, festsRes, clubsRes] = await Promise.all([
                publicFetchJSONRetry('/sports', { cacheBust: true }),
                publicFetchJSONRetry('/fests/all', { cacheBust: true }),
                publicFetchJSONRetry('/run-clubs', { cacheBust: true }),
            ]);

            const eventsData = eventsRes?.data;
            const nextEvents = Array.isArray(eventsData?.events) ? eventsData.events : [];
            setSportsEvents(nextEvents);

            const festsData = festsRes?.data;
            const all = Array.isArray(festsData?.fests)
                ? festsData.fests
                : Array.isArray(festsData)
                    ? festsData
                    : [];
            const nextFests = all.filter((f) => f.festType === 'sports' && f.status !== 'lastyearhit');
            setSportsFests(nextFests);

            const clubsData = clubsRes?.data;
            const nextClubs = Array.isArray(clubsData?.clubs) ? clubsData.clubs : [];
            setRunClubEntities(nextClubs);

            writeSportsCache({ events: nextEvents, fests: nextFests, clubs: nextClubs });
        } catch (err) {
            if (!hasCache) {
                setSportsEvents([]);
                setSportsFests([]);
                setRunClubEntities([]);
            }
            setLoadError(
                err?.isNetworkError || err?.code === 'ERR_NETWORK' || err?.code === 'ECONNABORTED'
                    ? 'Could not load sports events. Check your connection and try again.'
                    : (err?.message || 'Could not load sports events. Try again.'),
            );
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

    const normalizedActivities = useMemo(() => {
        return sortUpcomingEvents(
            sportsEvents.filter((e) => e.showOnSportsPage !== false && showsInUpcoming(e) && e.runClubId),
        ).map((e) => ({
            id: e._id,
            kind: 'event',
            sportType: e.sportType,
            title: e.title,
            subtitle: getSportsDisplayType(e, SPORT_TYPE_LABELS),
            image: getCoverImageUrl(e, 'cardWide') || normalizeImageUrl(e.coverImage) || normalizeImageUrl(e.images?.[0]) || null,
            shareUrl: e.registrationLink || `${window.location.origin}/sports`,
            registrationLink: e.registrationLink,
            festId: null,
        }));
    }, [sportsEvents]);

    const filteredActivities = normalizedActivities;

    const runClubs = useMemo(() => {
        return runClubEntities
            .filter((c) => c.showOnSportsPage !== false && c.showInRunClubs !== false)
            .map((c) => ({
                id: c._id,
                kind: 'club',
                title: c.name,
                subtitle: c.basedIn || c.organizer || 'Based in',
                coverImage: normalizeImageUrl(c.coverImage) || null,
                coverImages: c.coverImages || null,
                image: normalizeImageUrl(c.coverImage) || null,
                registrationLink: c.registrationLink,
                sortKey: c.runClubPriority ?? 999,
            }))
            .sort((a, b) => a.sortKey - b.sortKey);
    }, [runClubEntities]);

    const hasSportsContent = runClubs.length > 0 || filteredActivities.length > 0;

    useEffect(() => {
        if (loading) return;
        const clubUrls = runClubs.slice(0, 4).map((c) => getCoverImageUrl(c, 'cardPortrait'));
        const activityUrls = filteredActivities.slice(0, 4).map((a) => a.image);
        preloadImages([...clubUrls, ...activityUrls], { limit: 8 });
    }, [loading, runClubs, filteredActivities]);

    const ComingSoon = () => (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
            <h2 className={`text-3xl font-bold font-inter tracking-tight animate-pulse ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Coming Soon
            </h2>
            <div className="flex gap-1.5 mt-5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2.5 h-2.5 rounded-full bg-[#0ECCEE] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
        </div>
    );

    const LoadFailed = () => (
        <div className="flex flex-col items-center justify-center min-h-[50vh] px-6 text-center gap-4">
            <h2 className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Couldn’t load events
            </h2>
            <p className={`text-sm max-w-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {loadError || 'Check your connection and try again.'}
            </p>
            <button
                type="button"
                onClick={() => loadData()}
                className="px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
            >
                Retry
            </button>
        </div>
    );

    const handleActivityClick = (item) => {
        if (item.kind === 'fest' && item.festId) {
            navigate(festPath({ _id: item.festId, festName: item.title, title: item.title }));
            return;
        }
        if (item.kind === 'event' && item.id) {
            navigate(sportRunPath(item));
            return;
        }
        if (item.registrationLink) {
            openExternalUrl(item.registrationLink);
        }
    };

    const sectionTitle = `home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`;
    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    const sportsSearchQuickPicks = useMemo(
        () => [
            ...normalizedActivities.slice(0, 6).map((item) => ({
                id: item.id,
                title: item.title,
                subtitle: item.subtitle,
                image: item.image,
                resultType: item.kind === 'fest' ? 'fest' : 'sport',
            })),
            ...runClubs.slice(0, 4).map((club) => ({
                id: club.id,
                title: club.title,
                subtitle: club.subtitle,
                image: club.image,
                resultType: 'runclub',
            })),
        ],
        [normalizedActivities, runClubs],
    );

    const sportsKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({
            fests: sportsFests,
            sports: sportsEvents,
            runClubs: runClubEntities,
        }),
        [sportsFests, sportsEvents, runClubEntities],
    );

    const handleSportsSearchNavigate = useCallback(
        (result) => navigateToSearchResult(navigate, result),
        [navigate],
    );

    return (
        <div className="crwdctrl-page min-h-screen transition-colors">
            <Seo
                title="Sports, Running Clubs & Gym Communities"
                description={SPORTS_DESCRIPTION}
                canonical="/sports"
                keywords="sports events, running clubs, gym communities, marathons, runs, sports fest"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Sports', path: '/sports' },
                    ]),
                    itemListSchema({
                        name: 'Sports & Running Clubs on CrwdCtrl',
                        description: SPORTS_DESCRIPTION,
                        url: '/sports',
                        items: [
                            ...runClubEntities
                                .filter((c) => (c?._id || c?.id) && (c?.name || c?.clubName))
                                .map((c) => ({ name: c.name || c.clubName, url: runClubPath(c) })),
                            ...sportsFests
                                .filter((f) => f?._id && f?.festName)
                                .map((f) => ({ name: f.festName, url: festPath(f) })),
                        ],
                    }),
                    faqSchema(SPORTS_FAQ),
                ]}
            />
            <MobileStickyHeader
                isDark={isDark}
                brandingRow={
                    <>
                        <AppLogo className="cursor-pointer" onClick={() => navigate('/')} />
                        <div className="mobile-header-actions">
                            <button
                                type="button"
                                onClick={() => navigate('/')}
                                className={`p-2 rounded-xl bg-transparent transition-colors ${
                                    isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'
                                }`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors ${
                                    isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'
                                }`}
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
                            placeholder="search sports, run clubs"
                            quickPickItems={sportsSearchQuickPicks}
                            keywordCatalog={sportsKeywordCatalog}
                            onResultNavigate={handleSportsSearchNavigate}
                        />
                    </CategorySearchRow>
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="sports" noPadding />}
            />

            <main className="pb-8">
                <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0">
                {!loading && loadError && !hasSportsContent ? (
                    <LoadFailed />
                ) : !loading && !hasSportsContent ? (
                    <ComingSoon />
                ) : (
                <>
                {/* ── Upcoming Activities (Weekend Plans card style) ── */}
                <div className="mt-5">
                    <HomeCarouselSection
                        title="Upcoming Activities"
                        items={filteredActivities}
                        isDark={isDark}
                        wideCard
                        loading={loading}
                        emptyFallback={
                            <section className="home-section-block">
                                <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Upcoming Activities
                                </h2>
                                <div className={`mx-4 text-center py-10 rounded-3xl ${isDark ? 'bg-black text-gray-400' : 'bg-[#F2F4F7] text-gray-500'}`}>
                                    <p className="text-sm">No upcoming sports activities yet</p>
                                </div>
                            </section>
                        }
                        isFavorite={(id) => isFavorite(id)}
                        onToggleFavorite={(item) =>
                            toggleFavorite(item.id, {
                                id: item.id,
                                title: item.title,
                                image: item.image,
                                type: 'Sports',
                            })
                        }
                        onItemClick={handleActivityClick}
                        getShareUrl={(item) => item.shareUrl}
                    />
                </div>

                {/* ── Explore Run Clubs ── */}
                <section className="home-section-block">
                    <h2 className={sectionTitle}>Explore Run Clubs</h2>
                    {loading ? (
                        <CompactPortraitCardsRowSkeleton count={3} withShare={false} />
                    ) : runClubs.length === 0 ? (
                        <div
                            className={`mx-4 py-8 text-center rounded-2xl text-sm ${
                                isDark ? 'bg-[#111213] text-gray-500' : 'bg-[#F5F6FA] text-gray-400'
                            }`}
                        >
                            No run clubs added yet
                        </div>
                    ) : (
                        <div
                            className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                        >
                            <div className="flex gap-4 pb-2">
                                {runClubs.map((club, index) => (
                                    <RunClubCard
                                        key={club.id}
                                        club={club}
                                        isDark={isDark}
                                        eager={index < 3}
                                        isFavorite={isFavorite(club.id)}
                                        onToggleFavorite={() =>
                                            toggleFavorite(club.id, {
                                                id: club.id,
                                                title: club.title,
                                                image: club.image,
                                                type: 'Run Club',
                                            })
                                        }
                                        onClick={() => {
                                            navigate(runClubPath(club), {
                                                state: {
                                                    club: {
                                                        _id: club.id,
                                                        name: club.title,
                                                        basedIn: club.subtitle,
                                                        coverImage: club.image,
                                                        registrationLink: club.registrationLink,
                                                    },
                                                },
                                            });
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                <CustomPageSectionsRenderer
                    targetPage="sports"
                    fests={sportsFests}
                    sports={sportsEvents}
                    runClubs={runClubEntities}
                    isDark={isDark}
                    loading={loading}
                    isFavorite={isFavorite}
                    onToggleFavorite={onSectionFav}
                    onItemClick={onItemClick}
                    getShareUrl={getShareUrl}
                />

                {/* ── Browse by Categories ── */}
                <section className="home-section-block">
                    <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
                        Browse by Categories
                    </h2>
                    <div className="grid grid-cols-4 gap-x-2 w-full">
                        {BROWSE_CATEGORIES.map((cat) => (
                            <div
                                key={cat.id}
                                className="touch-target flex flex-col items-center gap-1.5 min-w-0"
                            >
                                <div
                                    className={`size-[clamp(3.25rem,19vw,5rem)] rounded-full overflow-hidden ${
                                        isDark ? 'bg-[#111213]' : 'bg-slate-100'
                                    }`}
                                >
                                    <img
                                        src={cat.image}
                                        alt={cat.label}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span
                                    className={`text-xs sm:text-sm font-medium font-inter leading-tight tracking-tight text-center truncate w-full ${
                                        isDark ? 'text-white' : 'text-black'
                                    }`}
                                >
                                    {cat.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </section>
                </>
                )}
                </div>

                {(loading || hasSportsContent) && <FaqSection items={SPORTS_FAQ} />}
            </main>
        </div>
    );
}

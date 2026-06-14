import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import HomeCategoryBar from '../HomeCategoryBar';
import MobileStickyHeader from '../MobileStickyHeader';
import CategorySearchRow from '../CategorySearchRow';
import MobileHeroSearchField from '../MobileHeroSearchField';
import AppLogo from '../AppLogo';
import CardFavoriteButton from '../CardFavoriteButton';
import HomeCarouselSection from '../HomeCarouselSection';
import CustomPageSectionsRenderer from '../CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { CompactPortraitCardsRowSkeleton } from '../HomeEventCardSkeleton';
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

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const BROWSE_CATEGORIES = SPORTS_BROWSE_CATEGORIES;

function RunClubCard({ club, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div className="card-portrait shrink-0 cursor-pointer active:scale-95 transition-all" onClick={onClick}>
            <div className="card-portrait-image">
                {club.image ? (
                    <img
                        src={getImageUrl(club.image, { preset: 'card' })}
                        alt={club.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#14532d', club.title || 'Run Club')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-5xl">🏃</span>
                    </div>
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

    const [sportsEvents, setSportsEvents] = useState([]);
    const [sportsFests, setSportsFests] = useState([]);
    const [runClubEntities, setRunClubEntities] = useState([]);
    const [loading, setLoading] = useState(true);
    usePageContentLoading(loading);

    const loadData = useCallback(async () => {
        try {
            const [eventsRes, festsRes, clubsRes] = await Promise.all([
                fetch(`${API}/sports?_cb=${Date.now()}`, {
                    credentials: 'omit',
                    mode: 'cors',
                    headers: { Accept: 'application/json' },
                }),
                fetch(`${API}/fests/all?_cb=${Date.now()}`, {
                    credentials: 'omit',
                    mode: 'cors',
                    headers: { Accept: 'application/json' },
                }),
                fetch(`${API}/run-clubs?_cb=${Date.now()}`, {
                    credentials: 'omit',
                    mode: 'cors',
                    headers: { Accept: 'application/json' },
                }),
            ]);

            if (eventsRes.ok) {
                const data = await eventsRes.json();
                setSportsEvents(Array.isArray(data?.events) ? data.events : []);
            } else {
                setSportsEvents([]);
            }

            if (festsRes.ok) {
                const data = await festsRes.json();
                const all = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                setSportsFests(all.filter((f) => f.festType === 'sports' && f.status !== 'lastyearhit'));
            } else {
                setSportsFests([]);
            }

            if (clubsRes.ok) {
                const data = await clubsRes.json();
                setRunClubEntities(Array.isArray(data?.clubs) ? data.clubs : []);
            } else {
                setRunClubEntities([]);
            }
        } catch {
            setSportsEvents([]);
            setSportsFests([]);
            setRunClubEntities([]);
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
        const fromEvents = sortUpcomingEvents(
            sportsEvents.filter((e) => showsInUpcoming(e) && e.runClubId),
        ).map((e) => ({
            id: e._id,
            kind: 'event',
            sportType: e.sportType,
            title: e.title,
            subtitle: getSportsDisplayType(e, SPORT_TYPE_LABELS),
            image: normalizeImageUrl(e.images?.[0]) || null,
            shareUrl: e.registrationLink || `${window.location.origin}/sports`,
            registrationLink: e.registrationLink,
            festId: null,
        }));

        const fromFests = sportsFests.map((f) => ({
            id: f._id,
            kind: 'fest',
            sportType: 'sport_fest',
            title: f.festName,
            subtitle: f.festType || 'sports',
            image: f.coverImage || f.galleryImages?.[0] || f.festImages?.[0] || null,
            shareUrl: `${window.location.origin}/view-details/${f._id}`,
            registrationLink: null,
            festId: f._id,
        }));

        return [...fromEvents, ...fromFests];
    }, [sportsEvents, sportsFests]);

    const filteredActivities = normalizedActivities;

    const runClubs = useMemo(() => {
        return runClubEntities
            .map((c) => ({
                id: c._id,
                kind: 'club',
                title: c.name,
                subtitle: c.basedIn || c.organizer || 'Based in',
                image: normalizeImageUrl(c.coverImage) || null,
                registrationLink: c.registrationLink,
                sortKey: c.runClubPriority ?? 999,
            }))
            .sort((a, b) => a.sortKey - b.sortKey);
    }, [runClubEntities]);

    const handleActivityClick = (item) => {
        if (item.kind === 'fest' && item.festId) {
            navigate(`/view-details/${item.festId}`);
            return;
        }
        if (item.kind === 'event' && item.id) {
            navigate(`/sports/run/${item.id}`);
            return;
        }
        if (item.registrationLink) {
            window.open(item.registrationLink, '_blank', 'noopener,noreferrer');
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
                <div className="max-w-2xl lg:max-w-7xl mx-auto">
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
                                {runClubs.map((club) => (
                                    <RunClubCard
                                        key={club.id}
                                        club={club}
                                        isDark={isDark}
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
                                            navigate(`/sports/run-club/${club.id}`, {
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
                </div>
            </main>
        </div>
    );
}

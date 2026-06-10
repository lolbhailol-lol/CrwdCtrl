import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
import HeroSearchBar from '../HeroSearchBar';
import AppLogo from '../AppLogo';
import CardFavoriteButton from '../CardFavoriteButton';
import CardShareButton from '../CardShareButton';
import CarouselDotPagination from '../CarouselDotPagination';
import {
    WideActivityCardsRowSkeleton,
    CompactPortraitCardsRowSkeleton,
} from '../HomeEventCardSkeleton';
import { SPORTS_BROWSE_CATEGORIES } from '../../constants/sportsBrowseCategories';
import {
    SPORT_TYPE_LABELS,
    getSportsDisplayType,
    showsInRunClubs,
    showsInUpcoming,
    sortUpcomingEvents,
    sortRunClubEvents,
    normalizeSportsSections,
} from '../../constants/sportsPage';
import { normalizeImageUrl } from '../../utils/uploadUrls';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const BROWSE_CATEGORIES = SPORTS_BROWSE_CATEGORIES;

const ACTIVITY_CARD_W = 320; // w-80
const ACTIVITY_CARD_GAP = 16; // gap-4

function useCenteredCarouselSidePad(ref, cardWidth = ACTIVITY_CARD_W) {
    const [sidePad, setSidePad] = useState(0);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const update = () => {
            setSidePad(Math.max(0, (el.clientWidth - cardWidth) / 2));
        };

        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('resize', update);

        return () => {
            ro.disconnect();
            window.removeEventListener('resize', update);
        };
    }, [ref, cardWidth]);

    return sidePad;
}

const ACTIVITY_SCROLL_STEP = ACTIVITY_CARD_W + ACTIVITY_CARD_GAP;

function buildActivitySlides(items) {
    if (items.length <= 1) {
        return { slides: items.map((item) => ({ item, key: `${item.kind}-${item.id}` })), loop: false, startIndex: 0 };
    }
    const last = items[items.length - 1];
    const first = items[0];
    return {
        loop: true,
        startIndex: 1,
        slides: [
            { item: last, key: `loop-before-${last.kind}-${last.id}` },
            ...items.map((item) => ({ item, key: `${item.kind}-${item.id}` })),
            { item: first, key: `loop-after-${first.kind}-${first.id}` },
        ],
    };
}

function scrollActivityToIndex(el, index, smooth = false) {
    el.scrollTo({ left: index * ACTIVITY_SCROLL_STEP, behavior: smooth ? 'smooth' : 'instant' });
}

function useActivityLoopCarousel(scrollRef, items, sidePad) {
    const { slides, loop, startIndex } = useMemo(() => buildActivitySlides(items), [items]);
    const [activeIndex, setActiveIndex] = useState(0);
    const jumpingRef = useRef(false);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || items.length === 0) return;

        jumpingRef.current = true;
        scrollActivityToIndex(el, loop ? startIndex : 0, false);
        setActiveIndex(0);
        requestAnimationFrame(() => {
            jumpingRef.current = false;
        });
    }, [items, loop, startIndex, sidePad, scrollRef]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el || items.length <= 1) return;

        const onScroll = () => {
            if (jumpingRef.current) return;

            const slideIndex = Math.round(el.scrollLeft / ACTIVITY_SCROLL_STEP);
            const lastSlideIndex = items.length + 1;

            if (loop && slideIndex === 0) {
                jumpingRef.current = true;
                scrollActivityToIndex(el, items.length, false);
                setActiveIndex(items.length - 1);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (loop && slideIndex === lastSlideIndex) {
                jumpingRef.current = true;
                scrollActivityToIndex(el, 1, false);
                setActiveIndex(0);
                requestAnimationFrame(() => {
                    jumpingRef.current = false;
                });
                return;
            }

            if (loop) {
                setActiveIndex(Math.max(0, Math.min(items.length - 1, slideIndex - 1)));
            } else {
                setActiveIndex(Math.max(0, slideIndex));
            }
        };

        el.addEventListener('scroll', onScroll, { passive: true });
        return () => el.removeEventListener('scroll', onScroll);
    }, [items, loop, scrollRef]);

    return { slides, activeIndex };
}

function ActivityCard({ item, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-wide snap-center cursor-pointer active:scale-[0.98] transition-all duration-200 rounded-2xl overflow-hidden"
            onClick={onClick}
        >
            <div className="card-wide-image">
                {item.image ? (
                    <img
                        src={getImageUrl(item.image, { preset: 'cardLg' })}
                        alt={item.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 320, 224, '#14532d', item.title || 'Sports')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-emerald-800 to-green-600 flex items-center justify-center">
                        <span className="text-6xl">⚽</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>

            {/* Name + Type + share */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0 flex-1">
                    <p className={`card-event-title font-inter line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(item.title)}
                    </p>
                    <p className={`card-event-subtitle font-inter line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(item.subtitle)}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="ml-3"
                    onClick={() => {
                        if (navigator.share) {
                            navigator.share({ title: item.title, url: item.shareUrl }).catch(() => {});
                        }
                    }}
                />
            </div>
        </div>
    );
}

function RunClubCard({ club, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div className="card-portrait snap-center cursor-pointer active:scale-95 transition-all" onClick={onClick}>
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
            <div className="mt-2 w-full min-w-0 max-w-[var(--card-portrait-w)]">
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
    const [searchQuery, setSearchQuery] = useState('');

    const activitiesScrollRef = useRef(null);

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
        const fromEvents = sortUpcomingEvents(sportsEvents.filter(showsInUpcoming)).map((e) => ({
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

    const filteredActivities = useMemo(() => {
        if (!searchQuery.trim()) return normalizedActivities;
        const q = searchQuery.toLowerCase();
        return normalizedActivities.filter(
            (item) =>
                item.title?.toLowerCase().includes(q) ||
                item.subtitle?.toLowerCase().includes(q)
        );
    }, [normalizedActivities, searchQuery]);

    const activitiesSidePad = useCenteredCarouselSidePad(activitiesScrollRef);
    const { slides: activitySlides, activeIndex: activitiesIdx } = useActivityLoopCarousel(
        activitiesScrollRef,
        filteredActivities,
        activitiesSidePad
    );

    const runClubs = useMemo(() => {
        const fromClubs = runClubEntities.map((c) => ({
            id: c._id,
            title: c.name,
            subtitle: c.basedIn || c.organizer || 'Based in',
            image: normalizeImageUrl(c.coverImage) || null,
            registrationLink: c.registrationLink,
            sortKey: c.runClubPriority ?? 999,
        }));

        const legacyEvents = sortRunClubEvents(sportsEvents.filter(showsInRunClubs)).map((e) => ({
            id: e._id,
            title: e.title,
            subtitle: e.city || e.organizer || 'Based in',
            image: normalizeImageUrl(e.images?.[0]) || null,
            registrationLink: e.registrationLink,
            sortKey: normalizeSportsSections(e).runClubPriority ?? 999,
        }));

        return [...fromClubs, ...legacyEvents].sort((a, b) => a.sortKey - b.sortKey);
    }, [runClubEntities, sportsEvents]);

    const handleActivityClick = (item) => {
        if (item.kind === 'fest' && item.festId) {
            navigate(`/view-details/${item.festId}`);
            return;
        }
        if (item.registrationLink) {
            window.open(item.registrationLink, '_blank', 'noopener,noreferrer');
        }
    };

    const sectionTitle = `home-section-heading font-inter px-4 mb-3 ${
        isDark ? 'text-white' : 'text-black'
    }`;

    return (
        <div className={`min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#ffffff]'}`}>
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
                    <HeroSearchBar
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery('')}
                        isDark={isDark}
                    />
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="sports" noPadding />}
            />

            <main className="pb-28">
                <div className="max-w-2xl lg:max-w-7xl mx-auto">
                {/* ── Upcoming Activities ── */}
                <section className="mt-5 mb-8">
                    <h2 className={sectionTitle}>Upcoming Activities</h2>
                    {loading ? (
                        <WideActivityCardsRowSkeleton count={2} className="mx-auto px-4" />
                    ) : filteredActivities.length === 0 ? (
                        <div
                            className={`mx-4 py-10 text-center rounded-2xl text-sm ${
                                isDark ? 'bg-[#111213] text-gray-500' : 'bg-[#F5F6FA] text-gray-400'
                            }`}
                        >
                            No upcoming sports activities yet
                        </div>
                    ) : (
                        <>
                            <div
                                ref={activitiesScrollRef}
                                className="carousel-scroll-center carousel-scroll-center--wide overflow-x-auto scrollbar-hide"
                                style={{
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    paddingInline: activitiesSidePad ? `${activitiesSidePad}px` : `calc(50% - ${ACTIVITY_CARD_W / 2}px)`,
                                    scrollPaddingInline: activitiesSidePad ? `${activitiesSidePad}px` : `calc(50% - ${ACTIVITY_CARD_W / 2}px)`,
                                }}
                            >
                                <div
                                    className="flex pb-1 w-max"
                                    style={{ gap: ACTIVITY_CARD_GAP }}
                                >
                                    {activitySlides.map(({ item, key }) => (
                                        <ActivityCard
                                            key={key}
                                            item={item}
                                            isDark={isDark}
                                            isFavorite={isFavorite(item.id)}
                                            onToggleFavorite={() =>
                                                toggleFavorite(item.id, {
                                                    id: item.id,
                                                    title: item.title,
                                                    image: item.image,
                                                    type: 'Sports',
                                                })
                                            }
                                            onClick={() => handleActivityClick(item)}
                                        />
                                    ))}
                                </div>
                            </div>
                            <CarouselDotPagination total={filteredActivities.length} active={activitiesIdx} />
                        </>
                    )}
                </section>

                {/* ── Explore Run Clubs ── */}
                <section className="mb-8">
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
                            className="carousel-scroll-center carousel-scroll-center--portrait overflow-x-auto scrollbar-hide"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
                                            if (club.registrationLink) {
                                                window.open(club.registrationLink, '_blank', 'noopener,noreferrer');
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── Browse by Categories ── */}
                <section className="mb-8 px-4">
                    <h2 className={`home-section-heading font-inter mb-5 ${isDark ? 'text-white' : 'text-black'}`}>
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

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MapPin } from 'lucide-react';
import AppLogo from '../AppLogo';
import CardShareButton from '../CardShareButton';
import { TREK_BROWSE_CATEGORIES } from '../../constants/trekBrowseCategories';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import HomeCategoryBar from '../HomeCategoryBar';
import MobileStickyHeader from '../MobileStickyHeader';
import HeroSearchBar from '../HeroSearchBar';
import HeroSearchDropdown from '../HeroSearchDropdown';
import { useHeroSearch } from '../../hooks/useHeroSearch';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import CardFavoriteButton from '../CardFavoriteButton';
import CarouselDotPagination from '../CarouselDotPagination';
import HeroBanner from '../HeroBanner';
import {
    HeroBannerSkeleton,
    CompactPortraitCardsRowSkeleton,
    WideActivityCardsRowSkeleton,
} from '../HomeEventCardSkeleton';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const fetchJSON = async (endpoint) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${API_BASE_URL}${endpoint}${sep}_cb=${Date.now()}`;
    try {
        const response = await fetch(url, {
            method: 'GET', credentials: 'omit', mode: 'cors',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) { clearTimeout(timeoutId); throw err; }
};

/* Browse by Trek Categories — circular PNG icons */
const TREK_CATEGORIES = TREK_BROWSE_CATEGORIES;

/* ── Community Card — fluid portrait card, heart overlay, Name + Based in + share below ── */
function CommunityCard({ trek, isDark, isFavorite, onToggleFavorite, onClick, fullWidth = false }) {
    return (
        <div
            className={`card-surface flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200 ${
                fullWidth ? 'w-full' : 'card-portrait'
            }`}
            onClick={onClick}
        >
            <div className={`relative overflow-hidden ${fullWidth ? 'w-full aspect-[5/3]' : 'card-portrait-image'}`}>
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image, { preset: 'cardLg' })}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-5xl">🏔️</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>

            <div className={`flex items-start justify-between px-3 pb-3 pt-2 ${fullWidth ? 'w-full' : 'w-full'}`}>
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(trek.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(trek.subtitle || 'Based in')}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="mt-0.5 shrink-0"
                    onClick={() => {
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                />
            </div>
        </div>
    );
}

/* ── Weekend Plans Card — fluid wide card, Trek Name + Type + share ── */
function WeekendCard({ trek, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-wide rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all duration-200"
            onClick={onClick}
        >
            <div className="card-wide-image">
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image, { preset: 'cardLg' })}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 320, 224, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <span className="text-6xl">🏔️</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>

            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(trek.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(trek.type || 'Trek')}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="ml-3"
                    onClick={() => {
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                />
            </div>
        </div>
    );
}

/* ── Beginner Card — portrait card, Name + Date + share below ── */
function BeginnerCard({ trek, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className="card-surface card-portrait flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-95 transition-all duration-200"
            onClick={onClick}
        >
            <div className="card-portrait-image">
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image, { preset: 'cardLg' })}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-5xl">🏔️</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>

            <div className="flex items-start justify-between px-3 pb-3 pt-2 w-full">
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {toCardText(trek.title)}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {toCardText(trek.date || 'Date TBA')}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="mt-0.5 shrink-0"
                    onClick={() => {
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                />
            </div>
        </div>
    );
}

/* ── Main Page ── */
function TreksPage() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const [treks, setTreks] = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, _setActiveCategory] = useState(null);
    const [weekendPg, setWeekendPg] = useState(0);

    const weekendScrollRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [trekData, commData] = await Promise.all([
                fetchJSON('/treks'),
                fetchJSON('/trek-communities'),
            ]);
            const commList = (Array.isArray(commData?.communities) ? commData.communities : [])
                .filter(c => c.showOnTreks !== false);
            setCommunities(commList.map(c => ({
                id: c._id,
                title: c.name,
                subtitle: c.basedIn || '',
                image: c.coverImage || c.galleryImages?.[0] || null,
                aboutUs: c.aboutUs,
                trekCategories: c.trekCategories || [],
                galleryImages: c.galleryImages || [],
                contactPhone: c.contactPhone,
                contactInstagram: c.contactInstagram,
                trekPageSection: c.trekPageSection || 'communities',
                trekPagePriority: c.trekPagePriority || 999,
                type: 'Community',
            })));
            const list = Array.isArray(trekData?.treks) ? trekData.treks : [];
            setTreks(list.map(t => ({
                id: t._id,
                title: t.trekName,
                subtitle: t.city || t.startingPoint || '',
                image: t.coverImage || t.images?.[0] || null,
                difficulty: t.difficultyLevel,
                duration: t.trekDuration,
                date: t.trekDate
                    ? new Date(t.trekDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null,
                trekCategory: t.trekCategory || null,
                featuredSection: t.featuredSection || null,
                homeSection: t.homeSection || null,
                trekPagePriority: t.trekPagePriority || 999,
                type: t.difficultyLevel
                    ? t.difficultyLevel.charAt(0).toUpperCase() + t.difficultyLevel.slice(1)
                    : 'Trek',
            })));
        } catch { setTreks([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Refresh when admin makes changes in another tab
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

    const trekQuickPicks = useMemo(
        () => [
            ...communities.slice(0, 5).map((c) => ({ ...c, resultType: 'community' })),
            ...treks.slice(0, 5).map((t) => ({ ...t, resultType: 'trek' })),
        ],
        [communities, treks],
    );

    const handleTrekSearchNavigate = useCallback((result) => {
        if (result.resultType === 'competition') {
            navigate(`/competitions-view-details/${result.id}`);
            return;
        }
        if (result.resultType === 'fest') {
            navigate(`/view-details/${result.id}`);
            return;
        }
        if (result.resultType === 'community' || result.type === 'Community') {
            navigate(`/treks/community/${result.id}`, { state: { community: result } });
            return;
        }
        navigate(`/trek/${result.id}`, {
            state: { trek: { ...result, trekName: result.title, images: result.image ? [result.image] : [] } },
        });
    }, [navigate]);

    const searchKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({ treks, communities }),
        [treks, communities],
    );

    const heroSearch = useHeroSearch({
        quickPickItems: trekQuickPicks,
        keywordCatalog: searchKeywordCatalog,
        onResultNavigate: handleTrekSearchNavigate,
    });

    const sortTrekPage = arr => [...arr].sort((a, b) => (a.trekPagePriority || 999) - (b.trekPagePriority || 999));
    const matchesSearch = useCallback((item) => {
        if (!heroSearch.searchQuery.trim()) return true;
        const q = heroSearch.searchQuery.toLowerCase();
        return (item.title || '').toLowerCase().includes(q) || (item.subtitle || '').toLowerCase().includes(q);
    }, [heroSearch.searchQuery]);
    const beginnerTreks = sortTrekPage(treks.filter(t => (t.featuredSection === 'beginner' || t.featuredSection === 'both') && matchesSearch(t)));
    const heroTreks = sortTrekPage(treks.filter(t => (t.featuredSection === 'hero' || t.featuredSection === 'both') && matchesSearch(t)));
    const weekendTreks = sortTrekPage(treks.filter(t => (t.featuredSection === 'weekend' || t.featuredSection === 'both') && matchesSearch(t)));
    const comingSoonCommunities = sortTrekPage(communities.filter(c => (c.trekPageSection === 'comingSoon' || c.trekPageSection === 'both') && matchesSearch(c)));
    const exploreCommunities    = sortTrekPage(communities.filter(c => (c.trekPageSection === 'communities' || c.trekPageSection === 'both' || !c.trekPageSection) && matchesSearch(c)));
    const heroItems = sortTrekPage([...heroTreks, ...comingSoonCommunities]);
    const categoryTreks = activeCategory ? treks.filter(t => t.trekCategory === activeCategory && matchesSearch(t)) : [];

    const heroBannerEvents = useMemo(() => heroItems.map(item => ({
        id: item.id,
        image: item.image,
        title: item.title,
        subtitle: item.subtitle,
        dateTime: item.date,
        status: item.trekPageSection === 'comingSoon' ? 'upcoming' : undefined,
    })), [heroItems]);

    const handleHeroClick = useCallback((id) => {
        const item = heroItems.find(i => i.id === id);
        if (!item) return;
        if (item.type === 'Community') {
            navigate(`/treks/community/${id}`, { state: { community: item } });
            return;
        }
        navigate(`/trek/${id}`, {
            state: { trek: { ...item, trekName: item.title, images: item.image ? [item.image] : [] } },
        });
    }, [heroItems, navigate]);

    const handleFav = useCallback((trek) => {
        toggleFavorite(trek.id, { id: trek.id, title: trek.title, image: trek.image, type: 'Trek' });
    }, [toggleFavorite]);

    const handleCommunityClick = useCallback((trek) => {
        navigate(`/treks/community/${trek.id}`, { state: { community: trek } });
    }, [navigate]);

    /* empty state helper */
    const EmptyState = ({ label }) => (
        <div className={`mx-4 py-6 text-center rounded-2xl text-sm ${isDark ? 'bg-[#111213] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
            {label}
        </div>
    );

    return (
        <div className={`crwdctrl-page min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#ffffff]'}`}>

            <MobileStickyHeader
                isDark={isDark}
                brandingRow={
                    <>
                        <AppLogo />
                        <div className="mobile-header-actions">
                            <button
                                className={`p-2 rounded-xl bg-transparent transition-colors
                                    ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors
                                    ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
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
                    <div className="relative" ref={heroSearch.searchRef}>
                        <HeroSearchBar
                            value={heroSearch.searchQuery}
                            onChange={(e) => heroSearch.setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') heroSearch.handleEnter(); }}
                            onClear={heroSearch.clearSearch}
                            placeholder="search treks, communities"
                            isDark={isDark}
                        />
                        <HeroSearchDropdown
                            isOpen={heroSearch.isOpen}
                            isSearching={heroSearch.isSearching}
                            searchQuery={heroSearch.searchQuery}
                            results={heroSearch.mergedResults}
                            popularTerms={heroSearch.popularTerms}
                            isDark={isDark}
                            onResultClick={heroSearch.handleResultClick}
                            onSuggestionClick={heroSearch.applySuggestion}
                            className="absolute left-0 right-0 top-full mt-1"
                        />
                    </div>
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="treks" noPadding />}
            />

            <main className="pb-28">
                <div className="max-w-2xl lg:max-w-7xl mx-auto pt-6 lg:pt-0">

                    {/* ── Hero Banner — same as Dashboard ── */}
                    {!loading && heroBannerEvents.length > 0 && (
                        <HeroBanner
                            events={heroBannerEvents}
                            onEventClick={handleHeroClick}
                            isDark={isDark}
                        />
                    )}
                    {loading && <HeroBannerSkeleton className="mb-6 px-4" />}

                    {/* ── Explore the Communities — Figma: w-40 h-52 (160×208) cards ── */}
                    <section className="mb-6 mt-4">
                        <h2 className={`home-section-heading px-4 mb-3 font-inter
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Explore the Communities
                        </h2>
                        {loading ? (
                            <CompactPortraitCardsRowSkeleton count={3} />
                        ) : exploreCommunities.length === 0 ? (
                            <EmptyState label="No communities added yet" />
                        ) : (
                            <div
                                className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2">
                                    {exploreCommunities.map((comm) => (
                                        <div key={comm.id} className="shrink-0">
                                            <CommunityCard
                                                trek={comm}
                                                isDark={isDark}
                                                isFavorite={isFavorite(comm.id)}
                                                onToggleFavorite={() => handleFav(comm)}
                                                onClick={() => handleCommunityClick(comm)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── Upcoming Weekend Plans — Figma: size-80 (320px) card ── */}
                    <section className="mb-6">
                        <h2 className={`home-section-heading px-4 mb-3 font-inter
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Upcoming Weekend Plans
                        </h2>
                        {loading ? (
                            <WideActivityCardsRowSkeleton count={2} />
                        ) : weekendTreks.length === 0 ? (
                            <EmptyState label="No weekend plans added yet" />
                        ) : (
                            <>
                                <div
                                    ref={weekendScrollRef}
                                    className="carousel-scroll-center carousel-scroll-center--wide overflow-x-auto scrollbar-hide"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                    onScroll={(e) => setWeekendPg(Math.round(e.target.scrollLeft / 328))}
                                >
                                    <div className="flex gap-4 pb-1">
                                        {weekendTreks.map((trek) => (
                                            <div key={trek.id} className="snap-center">
                                                <WeekendCard
                                                    trek={trek}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(trek.id)}
                                                    onToggleFavorite={() => handleFav(trek)}
                                                    onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <CarouselDotPagination total={weekendTreks.length} current={weekendPg} />
                            </>
                        )}
                    </section>

                    {/* ── Browse by Trek Categories — Figma: size-20 rounded-full circles ── */}
                    <section className="mb-6">
                        <h2 className={`home-section-heading px-4 mb-6 font-inter
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Browse by Trek Categories
                        </h2>
                        <div
                            className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            <div className="flex gap-6 pb-2 pt-1">
                                {TREK_CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => navigate(`/treks/category/${cat.id}`)}
                                        className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-all duration-200"
                                    >
                                        {/* Circle with HomeCategoryBar-style lift effect */}
                                        <div className={`transition-all duration-200 ${activeCategory === cat.id ? '-translate-y-2 scale-110' : 'scale-100'}`}>
                                            <div
                                                className={`size-20 rounded-full overflow-hidden transition-all duration-200 ${
                                                    activeCategory === cat.id ? 'ring-2 ring-[#0ECCEE] ring-offset-2' : ''
                                                } ${isDark ? 'bg-[#111213]' : 'bg-slate-100'}`}
                                            >
                                                <img
                                                    src={cat.image}
                                                    alt={cat.label}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                        <span className={`text-sm font-medium font-inter leading-5 tracking-tight
                                            ${activeCategory === cat.id
                                                ? 'text-[#0ECCEE]'
                                                : isDark ? 'text-gray-200' : 'text-black'
                                            }`}>
                                            {cat.label}
                                        </span>
                                        {/* Figma: white active indicator under label */}
                                        <div className={`h-1.5 rounded-2xl transition-all duration-200
                                            ${activeCategory === cat.id
                                                ? `w-5 ${isDark ? 'bg-[#0ECCEE]' : 'bg-gray-800'}`
                                                : 'w-0'
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filtered cards when category is active */}
                        {activeCategory && (
                            <div className="mt-4">
                                {categoryTreks.length > 0 ? (
                                    <div
                                        className="carousel-scroll-center carousel-scroll-center--portrait overflow-x-auto scrollbar-hide"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                    >
                                        <div className="flex gap-4 pb-2">
                                            {categoryTreks.map(trek => (
                                                <BeginnerCard
                                                    key={trek.id}
                                                    trek={trek}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(trek.id)}
                                                    onToggleFavorite={() => handleFav(trek)}
                                                    onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`mx-4 py-6 text-center rounded-2xl text-sm
                                        ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                                        No treks in this category yet
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── Beginner Friendly — same w-40 h-52, Name + Date + share ── */}
                    <section className="mb-6">
                        <h2 className={`home-section-heading px-4 mb-3 font-inter
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Beginner Friendly
                        </h2>
                        {loading ? (
                            <CompactPortraitCardsRowSkeleton count={3} />
                        ) : beginnerTreks.length === 0 ? (
                            <EmptyState label="No beginner treks added yet" />
                        ) : (
                            <div
                                className="carousel-scroll-center carousel-scroll-center--portrait overflow-x-auto scrollbar-hide"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2">
                                    {beginnerTreks.map((trek) => (
                                        <div key={trek.id} className="snap-center">
                                            <BeginnerCard
                                                trek={trek}
                                                isDark={isDark}
                                                isFavorite={isFavorite(trek.id)}
                                                onToggleFavorite={() => handleFav(trek)}
                                                onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </main>
        </div>
    );
}

export default TreksPage;

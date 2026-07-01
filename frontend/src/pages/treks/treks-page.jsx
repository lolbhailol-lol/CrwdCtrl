import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, MapPin } from 'lucide-react';
import AppLogo from '../../components/AppLogo';
import CardShareButton from '../../components/CardShareButton';
import { shareContent } from '../../utils/externalLink';
import { TREK_BROWSE_CATEGORIES } from '../../constants/trekBrowseCategories';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getCoverImageUrl } from '../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import CategorySearchRow from '../../components/CategorySearchRow';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import { useHeroSearch } from '../../hooks/useHeroSearch';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import CarouselDotPagination from '../../components/CarouselDotPagination';
import HeroBanner from '../../components/HeroBanner';
import {
    HeroBannerSkeleton,
    CompactPortraitCardsRowSkeleton,
    WideActivityCardsRowSkeleton,
} from '../../components/HomeEventCardSkeleton';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { publicFetchJSONRetry } from '../../services/api/client';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { breadcrumbSchema, faqSchema, itemListSchema } from '../../utils/seo';
import { TREKS_FAQ } from '../../constants/faqs';
import { formatTrekCardDate } from '../../utils/trekDateDisplay';

const TREKS_DESCRIPTION =
    'Discover treks, hiking trips and adventure communities near you. Browse upcoming treks, join trekking communities and book your next outdoor adventure on CrwdCtrl.';

const fetchJSON = async (endpoint) => {
    const { data } = await publicFetchJSONRetry(endpoint, { cacheBust: true });
    return data;
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
            <div className={`relative overflow-hidden ${fullWidth ? 'w-full aspect-5/3' : 'card-portrait-image'}`}>
                {(() => {
                    const preset = fullWidth ? 'cardLandscape' : 'cardPortrait';
                    const imgSrc = getCoverImageUrl(trek, preset);
                    return imgSrc ? (
                        <img
                            src={imgSrc}
                            alt={trek.title}
                            className="w-full h-full object-cover"
                            onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title || 'Trek')}
                        />
                    ) : (
                        <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                            <span className="text-5xl">🏔️</span>
                        </div>
                    );
                })()}
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
                        shareContent({ title: trek.title, url: window.location.origin + '/treks' });
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
                {getCoverImageUrl(trek, 'cardWide') ? (
                    <img
                        src={getCoverImageUrl(trek, 'cardWide')}
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
                        shareContent({ title: trek.title, url: window.location.origin + '/treks' });
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
                {getCoverImageUrl(trek, 'cardPortrait') ? (
                    <img
                        src={getCoverImageUrl(trek, 'cardPortrait')}
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
                        {toCardText(formatTrekCardDate(trek))}
                    </p>
                </div>
                <CardShareButton
                    isDark={isDark}
                    className="mt-0.5 shrink-0"
                    onClick={() => {
                        shareContent({ title: trek.title, url: window.location.origin + '/treks' });
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
    const [rawTreks, setRawTreks] = useState([]);
    const [rawCommunities, setRawCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, _setActiveCategory] = useState(null);
    const [weekendPg, setWeekendPg] = useState(0);
    usePageContentLoading(loading);

    const weekendScrollRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [trekData, commData] = await Promise.all([
                fetchJSON('/treks'),
                fetchJSON('/trek-communities'),
            ]);
            const commList = (Array.isArray(commData?.communities) ? commData.communities : [])
                .filter(c => c.showOnTreks !== false);
            setRawCommunities(commList);
            setCommunities(commList.map(c => ({
                id: c._id,
                title: c.name,
                subtitle: c.basedIn || '',
                coverImage: c.coverImage || null,
                coverImages: c.coverImages || null,
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
            setRawTreks(list);
            setTreks(list.map(t => ({
                id: t._id,
                title: t.trekName,
                subtitle: t.city || t.startingPoint || '',
                coverImage: t.coverImage || null,
                coverImages: t.coverImages || null,
                image: t.coverImage || t.images?.[0] || null,
                difficulty: t.difficultyLevel,
                duration: t.trekDuration,
                trekDate: t.trekDate || null,
                dateLabel: t.dateLabel || '',
                trekBatches: t.trekBatches || [],
                date: formatTrekCardDate(t),
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
    const exploreCommunities    = sortTrekPage(communities.filter(c => (c.trekPageSection === 'communities' || c.trekPageSection === 'both') && matchesSearch(c)));
    const heroItems = sortTrekPage([...heroTreks, ...comingSoonCommunities]);
    const categoryTreks = activeCategory ? treks.filter(t => t.trekCategory === activeCategory && matchesSearch(t)) : [];
    const hasTrekContent = treks.length > 0 || communities.length > 0;

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
        toggleFavorite(trek.id, {
            ...trek,
            id: trek.id,
            _id: trek.id,
            _type: 'trek',
            type: 'trek',
            title: trek.title || trek.trekName,
            subtitle: trek.basedIn || trek.location,
            image: trek.image || trek.coverImage,
        });
    }, [toggleFavorite]);

    const handleCommunityClick = useCallback((trek) => {
        navigate(`/treks/community/${trek.id}`, { state: { community: trek } });
    }, [navigate]);

    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    /* empty state helper */
    const EmptyState = ({ label }) => (
        <div className={`mx-4 py-6 text-center rounded-2xl text-sm ${isDark ? 'bg-[#111213] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
            {label}
        </div>
    );

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

    return (
        <div className="crwdctrl-page crwdctrl-page--hub min-h-screen transition-colors">
            <Seo
                title="Treks & Adventure Communities"
                description={TREKS_DESCRIPTION}
                canonical="/treks"
                keywords="treks, trekking, hiking, adventure, trekking communities, weekend treks"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Treks', path: '/treks' },
                    ]),
                    itemListSchema({
                        name: 'Treks & Adventure on CrwdCtrl',
                        description: TREKS_DESCRIPTION,
                        url: '/treks',
                        items: [
                            ...treks
                                .filter((t) => t?.id && t?.title)
                                .map((t) => ({ name: t.title, url: `/trek/${t.id}` })),
                            ...communities
                                .filter((c) => c?.id && c?.title)
                                .map((c) => ({ name: c.title, url: `/treks/community/${c.id}` })),
                        ],
                    }),
                    faqSchema(TREKS_FAQ),
                ]}
            />

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
                    <CategorySearchRow isDark={isDark}>
                        <MobileHeroSearchField
                            isDark={isDark}
                            placeholder="search treks, communities"
                            quickPickItems={trekQuickPicks}
                            keywordCatalog={searchKeywordCatalog}
                            onResultNavigate={handleTrekSearchNavigate}
                            desktopRef={heroSearch.searchRef}
                            desktopSearch={heroSearch}
                        />
                    </CategorySearchRow>
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="treks" noPadding />}
            />

            <main className="pb-8">
                {!loading && heroBannerEvents.length > 0 && (
                    <HeroBanner
                        events={heroBannerEvents}
                        onEventClick={handleHeroClick}
                        isDark={isDark}
                    />
                )}
                {loading && <HeroBannerSkeleton />}

                <div className="max-w-2xl lg:max-w-none mx-auto lg:mx-0 crwdctrl-hub-body">
                    {!loading && !hasTrekContent ? (
                        <ComingSoon />
                    ) : (
                    <>
                    {/* ── Explore the Communities — Figma: w-40 h-52 (160×208) cards ── */}
                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
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
                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
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
                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
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
                    <section className="home-section-block">
                        <h2 className={`home-section-heading font-inter ${isDark ? 'text-white' : 'text-black'}`}>
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

                    <CustomPageSectionsRenderer
                        targetPage="treks"
                        treks={rawTreks}
                        communities={rawCommunities}
                        isDark={isDark}
                        loading={loading}
                        isFavorite={isFavorite}
                        onToggleFavorite={onSectionFav}
                        onItemClick={onItemClick}
                        getShareUrl={getShareUrl}
                    />
                    </>
                    )}

                </div>

                {(loading || hasTrekContent) && <FaqSection items={TREKS_FAQ} />}
            </main>
        </div>
    );
}

export default TreksPage;

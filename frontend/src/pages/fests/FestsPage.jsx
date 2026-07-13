import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Bell } from 'lucide-react';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import ContentImage from '../../components/ContentImage';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import HomeCategoryBar from '../../components/HomeCategoryBar';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import MobileStickyHeader from '../../components/MobileStickyHeader';
import CategorySearchRow from '../../components/CategorySearchRow';
import MobileHeroSearchField from '../../components/MobileHeroSearchField';
import HeroBanner from '../../components/HeroBanner';
import AppLogo from '../../components/AppLogo';
import CardShareButton from '../../components/CardShareButton';
import { shareContent } from '../../utils/externalLink';
import { FestCardsRowSkeleton } from '../../components/HomeEventCardSkeleton';
import CulturalIcon from '../../assets/mobile-icons/cul.svg';
import TechIcon from '../../assets/mobile-icons/techhh.svg';
import SportsIcon from '../../assets/mobile-icons/spor.svg';
import { buildSearchKeywordsFromCatalog } from '../../utils/buildSearchKeywords';
import { navigateToSearchResult } from '../../utils/searchNavigation';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { fetchRawPublicFests } from '../../services/api/fests.api';
import Seo from '../../components/Seo';
import FaqSection from '../../components/FaqSection';
import { breadcrumbSchema, faqSchema, itemListSchema } from '../../utils/seo';
import { FESTS_FAQ } from '../../constants/faqs';
import { festPath } from '../../utils/slugRoutes';

const FESTS_DESCRIPTION =
    'Browse and register for college fests near you — cultural, technical and sports festivals. Find upcoming and ongoing fests, competitions and events on CrwdCtrl.';

const FESTS_CACHE_KEY = 'crwdctrl_fests_page_v1';
const readFestsCache = () => {
    try {
        const raw = sessionStorage.getItem(FESTS_CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};
const writeFestsCache = (list) => {
    try {
        sessionStorage.setItem(FESTS_CACHE_KEY, JSON.stringify(list));
    } catch {
        /* storage full / unavailable */
    }
};

const SUBCATEGORIES = [
    { id: 'cultural',   label: 'CULTURAL', icon: CulturalIcon, path: '/cultural-fest' },
    { id: 'technical',  label: 'TECH',     icon: TechIcon,     path: '/tech-fest' },
    { id: 'sports',     label: 'SPORTS',   icon: SportsIcon,   path: '/sports-fest' },
];

// ── Sub-category tile (crisp SVG on iOS) ───────────────────────────────────
const SubcategoryTile = ({ cat, isDark, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={cat.label}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="flex flex-col items-center justify-center gap-1.5 pt-1 pb-3 lg:pt-2 lg:pb-5 rounded-2xl lg:rounded-3xl transition-opacity duration-150 active:opacity-80"
    >
        <img
            src={cat.icon}
            alt={cat.label}
            width={128}
            height={113}
            draggable={false}
            decoding="sync"
            className="crisp-icon category-icon-lg pointer-events-none"
        />
        <span className={`text-fluid-xs lg:text-sm font-bold ${isDark ? 'text-white' : 'text-[#111827]'}`}>
            {toCardText(cat.label)}
        </span>
    </button>
);

// ── Fest Event Card ──────────────────────────────────────────────────────────
const FestEventCard = ({ fest, isDark, isFavorite, onToggleFavorite, onViewDetails }) => {
    const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];

    const handleShare = (e) => {
        e.stopPropagation();
        shareContent({
            title: fest.festName,
            text: `Check out ${fest.festName}`,
            url: `${window.location.origin}${festPath(fest)}`,
        });
    };

    return (
        <div
            className="card-surface card-carousel-fest lg:w-auto rounded-2xl lg:rounded-3xl overflow-hidden cursor-pointer snap-start shrink-0 transition-all duration-200 active:scale-[0.98]"
            onClick={onViewDetails}
        >
            {/* Image */}
            <div className="relative aspect-video lg:aspect-8/5 overflow-hidden">
                <ContentImage
                    src={img}
                    alt={fest.festName}
                    preset="cardVideo"
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(e, 320, 190, '#2A2B2E', fest.festName || 'Fest')}
                />
                <CardFavoriteButton isFavorite={isFavorite} onClick={onToggleFavorite} />
            </div>

            {/* Info */}
            <div className="px-3 pt-3 pb-3 lg:px-4 lg:pt-4 lg:pb-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="min-w-0 flex-1">
                        <h3 className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {toCardText(fest.festName)}
                        </h3>
                        <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {toCardText(fest.collegeName)}
                        </p>
                    </div>
                    <CardShareButton onClick={handleShare} isDark={isDark} className="shrink-0" />
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                    className="w-full py-2.5 lg:py-3 rounded-xl text-sm lg:text-base font-bold text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                >
                    View details
                </button>
            </div>
        </div>
    );
};

// ── Horizontal Section ───────────────────────────────────────────────────────
const FestSection = ({ title, fests, loading, isDark, isFavorite, toggleFavorite, navigate }) => {
    if (!loading && fests.length === 0) return null;

    return (
        <section className="home-section-block">
            <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h2>

            <div
                className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
                <div className="flex gap-3 pb-1">
                    {loading
                        ? <FestCardsRowSkeleton count={2} />
                        : fests.map(fest => (
                            <FestEventCard
                                key={fest._id}
                                fest={fest}
                                isDark={isDark}
                                isFavorite={isFavorite(fest._id)}
                                onToggleFavorite={() => toggleFavorite(fest._id, fest)}
                                onViewDetails={() => navigate(festPath(fest))}
                            />
                        ))
                    }
                </div>
            </div>
        </section>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
export default function FestsPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const cached = readFestsCache();
    const [fests, setFests] = useState(cached || []);
    const [loading, setLoading] = useState(!cached);
    usePageContentLoading(loading);

    // Fetch all fests
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const list = await fetchRawPublicFests({ cacheBust: false });
                if (!cancelled) {
                    setFests(list);
                    writeFestsCache(list);
                }
            } catch (err) {
                console.error('FestsPage fetch error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const filtered = fests;

    const sortByPriority = (a, b) => (a.priority || 999) - (b.priority || 999);

    const ongoingFests = useMemo(() =>
        filtered.filter(f => f.status === 'ongoing').sort(sortByPriority),
        [filtered]
    );

    const upcomingFests = useMemo(() =>
        filtered.filter(f => f.status === 'upcoming' || f.status === 'beyondcampus').sort(sortByPriority),
        [filtered]
    );

    const lastYearFests = useMemo(() =>
        filtered.filter(f => f.status === 'lastyearhit').sort(sortByPriority),
        [filtered]
    );

    const isEmpty = !loading && ongoingFests.length === 0 && upcomingFests.length === 0 && lastYearFests.length === 0;
    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    const festsSearchQuickPicks = useMemo(
        () => fests.slice(0, 10).map((fest) => ({
            id: fest._id,
            title: fest.festName,
            subtitle: fest.collegeName,
            description: fest.description,
            image: fest.coverImage || fest.galleryImages?.[0],
            resultType: 'fest',
        })),
        [fests],
    );

    const festsKeywordCatalog = useMemo(
        () => buildSearchKeywordsFromCatalog({ fests }),
        [fests],
    );

    const handleFestsSearchNavigate = useCallback(
        (result) => navigateToSearchResult(navigate, result),
        [navigate],
    );

    return (
        <div className="crwdctrl-page crwdctrl-page--hub fests-page min-h-screen">
            <Seo
                title="College Fests"
                description={FESTS_DESCRIPTION}
                canonical="/fests"
                keywords="college fests, cultural fest, tech fest, sports fest, fest registration, campus events"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Fests', path: '/fests' },
                    ]),
                    itemListSchema({
                        name: 'College Fests on CrwdCtrl',
                        description: FESTS_DESCRIPTION,
                        url: '/fests',
                        items: fests
                            .filter((fest) => fest?._id && fest?.festName)
                                .map((fest) => ({ name: fest.festName, url: festPath(fest) })),
                    }),
                    faqSchema(FESTS_FAQ),
                ]}
            />

            <MobileStickyHeader
                isDark={isDark}
                shellClassName="fests-page-header"
                brandingRow={
                    <>
                        <AppLogo className="cursor-pointer" onClick={() => navigate('/')} />
                        <div className="mobile-header-actions">
                            <button
                                onClick={() => navigate('/')}
                                className={`p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
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
                            placeholder="search college, fest"
                            quickPickItems={festsSearchQuickPicks}
                            keywordCatalog={festsKeywordCatalog}
                            onResultNavigate={handleFestsSearchNavigate}
                        />
                    </CategorySearchRow>
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="fests" noPadding />}
            />

            <main className="pb-8 lg:pb-12">
                <HeroBanner
                    events={[...ongoingFests, ...upcomingFests]
                        .filter(f => f.image || f.heroImage)
                        .slice(0, 5)
                        .map(f => ({
                            id: f._id,
                            image: f.heroImage || f.image,
                            title: f.festName,
                            dateTime: f.festDate,
                            status: f.status || 'ongoing',
                        }))}
                    onEventClick={(id) => {
                        const selected = [...ongoingFests, ...upcomingFests].find((f) => f._id === id || f.id === id);
                        navigate(festPath(selected || { _id: id }));
                    }}
                    isDark={isDark}
                />

                <div className="crwdctrl-hub-body">
                {/* ── Sub-category tiles: Cultural / Tech / Sports ── */}
                <section className="home-section-block mt-3 mb-6 lg:mt-3 lg:mb-10">
                    <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Categories
                    </h2>
                    <div className="grid grid-cols-3 gap-3 lg:gap-6">
                        {SUBCATEGORIES.map(cat => (
                            <SubcategoryTile
                                key={cat.id}
                                cat={cat}
                                isDark={isDark}
                                onClick={() => navigate(cat.path)}
                            />
                        ))}
                    </div>
                </section>

                {/* ── Ongoing Events ── */}
                <FestSection
                    title="Ongoing Events"
                    fests={ongoingFests}
                    loading={loading}
                    isDark={isDark}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    navigate={navigate}
                />

                {/* ── Upcoming Events ── */}
                <FestSection
                    title="Upcoming Events"
                    fests={upcomingFests}
                    loading={loading}
                    isDark={isDark}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    navigate={navigate}
                />

                <CustomPageSectionsRenderer
                    targetPage="fests"
                    fests={fests}
                    isDark={isDark}
                    loading={loading}
                    isFavorite={isFavorite}
                    onToggleFavorite={onSectionFav}
                    onItemClick={onItemClick}
                    getShareUrl={getShareUrl}
                />

                {/* ── Last Year Hits ── */}
                {lastYearFests.length > 0 && (
                    <FestSection
                        title="Last Year Hits"
                        fests={lastYearFests}
                        loading={loading}
                        isDark={isDark}
                        isFavorite={isFavorite}
                        toggleFavorite={toggleFavorite}
                        navigate={navigate}
                    />
                )}

                {/* ── Empty state ── */}
                {isEmpty && (
                    <div className={`mx-(--page-gutter) text-center py-16 lg:py-20 rounded-2xl
                                   ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-white text-gray-500 shadow-sm'}`}>
                        <div className="text-5xl mb-3">🎪</div>
                        <p className="text-base lg:text-lg font-semibold mb-1">
                            No fests available yet
                        </p>
                    </div>
                )}
                </div>{/* end pt-5 wrapper */}

                <FaqSection items={FESTS_FAQ} />
            </main>
        </div>
    );
}

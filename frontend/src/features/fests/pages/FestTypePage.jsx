import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Search, X, Sparkles, Flame, Calendar, MapPin, SlidersHorizontal, CheckCircle2 } from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { toCardText } from '../../../utils/cardText';
import HomeEventCard from '../../../components/HomeEventCard';
import { FestSubpageLoadingSkeleton } from '../../../components/HomeEventCardSkeleton';
import CarouselDotPagination from '../../../components/CarouselDotPagination';
import { getCarouselScrollPage } from '../../../utils/horizontalScroll';
import CustomPageSectionsRenderer from '../../../components/CustomPageSectionsRenderer';
import Seo from '../../../components/Seo';
import { breadcrumbSchema, itemListSchema } from '../../../utils/seo';
import { usePageSectionHandlers } from '../../../utils/pageSectionHandlers';
import { fetchRawPublicFests, prefetchFestDetail } from '../../../services/api/fests.api';
import { readFestsCacheByType, writeFestsCache } from '../../../utils/festsSessionCache';
import { usePageContentLoading } from '../../../hooks/usePageContentLoading';
import { festPath } from '../../../utils/slugRoutes';
import { buildFestDetailNavState } from '../../../utils/detailPageCache';
import { usePublicConfig } from '../../../hooks/usePublicConfig';
import { useInAppBack } from '../../../hooks/useInAppBack';
import { isTechfestFest } from '../techfest/isTechfestFest';

const FEST_TYPE_SEO = {
    cultural: {
        title: 'Cultural Fests',
        description:
            'Discover and register for cultural college fests near you — music, dance, drama, art and more. Browse upcoming and ongoing cultural festivals on CrwdCtrl.',
    },
    technical: {
        title: 'Tech Fests',
        description:
            'Discover and register for technical college fests, hackathons, coding competitions and tech events near you on CrwdCtrl.',
    },
    sports: {
        title: 'Sports Fests',
        description:
            'Discover and register for sports college fests, tournaments and athletic events near you on CrwdCtrl.',
    },
};

const GENRE_THEMES = {
    technical: {
        accentName: 'cyan',
        textAccent: 'text-cyan-400',
        bgAccent: 'bg-cyan-500/10',
        borderAccent: 'border-cyan-500/30',
        glowBorder: 'hover:border-cyan-400/50',
        badgeBg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
        gradientHero: 'from-cyan-950/30 via-[#0B0C0E] to-transparent',
        pillActive: 'bg-cyan-400 text-black font-extrabold shadow-[0_0_20px_rgba(34,211,238,0.4)]',
        tagline: 'Code · Hackathons · Robotics · AI Competitions',
        icon: '💻',
    },
    cultural: {
        accentName: 'fuchsia',
        textAccent: 'text-fuchsia-400',
        bgAccent: 'bg-fuchsia-500/10',
        borderAccent: 'border-fuchsia-500/30',
        glowBorder: 'hover:border-fuchsia-400/50',
        badgeBg: 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/30',
        gradientHero: 'from-fuchsia-950/30 via-[#0B0C0E] to-transparent',
        pillActive: 'bg-fuchsia-500 text-white font-extrabold shadow-[0_0_20px_rgba(217,70,239,0.4)]',
        tagline: 'Music · Dance · Drama · Creative Arts',
        icon: '🎭',
    },
    sports: {
        accentName: 'emerald',
        textAccent: 'text-emerald-400',
        bgAccent: 'bg-emerald-500/10',
        borderAccent: 'border-emerald-500/30',
        glowBorder: 'hover:border-emerald-400/50',
        badgeBg: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30',
        gradientHero: 'from-emerald-950/30 via-[#0B0C0E] to-transparent',
        pillActive: 'bg-emerald-400 text-black font-extrabold shadow-[0_0_20px_rgba(52,211,153,0.4)]',
        tagline: 'Tournaments · Athletics · Esports · Fitness',
        icon: '⚽',
    },
};

const NAV_TABS = [
    { id: 'all', label: 'All Fests', path: '/fests' },
    { id: 'technical', label: 'Tech Fests', path: '/tech-fest' },
    { id: 'cultural', label: 'Cultural Fests', path: '/cultural-fest' },
    { id: 'sports', label: 'Sports Fests', path: '/sports-fest' },
];

export const FEST_TYPE_PAGES = {
    cultural: {
        festType: 'cultural',
        title: 'Cultural',
        emoji: '🎭',
        imageFallbackColor: '#1a1a2e',
        emptyMessage: 'No cultural fests right now',
        targetPage: 'cultural-fest',
    },
    technical: {
        festType: 'technical',
        title: 'Tech',
        emoji: '💻',
        imageFallbackColor: '#0a1628',
        emptyMessage: 'No tech fests right now',
        targetPage: 'tech-fest',
    },
    sports: {
        festType: 'sports',
        title: 'Sports',
        emoji: '⚽',
        imageFallbackColor: '#1a2a1a',
        emptyMessage: 'No sports fests right now',
        targetPage: 'sports-fest',
    },
};

function festCardName(fest) {
    return fest.festName;
}

function festCardCollegeName(fest) {
    return isTechfestFest(fest) ? 'IIT Bombay' : toCardText(fest.collegeName);
}

export default function FestTypePage({
    festType,
    title,
    emoji,
    imageFallbackColor: _imageFallbackColor,
    emptyMessage,
    targetPage,
}) {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();
    const publicConfig = usePublicConfig();

    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const openFestDetails = (fest) => {
        prefetchFestDetail(fest);
        const eventData = buildFestDetailNavState(fest);
        navigate(festPath(fest), { state: eventData ? { eventData } : undefined });
    };

    const cached = readFestsCacheByType(festType);
    const [fests, setFests] = useState(cached || []);
    const [loading, setLoading] = useState(!cached?.length);
    const [featuredPg, setFeaturedPg] = useState(0);
    const scrollRef = useRef(null);
    usePageContentLoading(loading);

    const theme = GENRE_THEMES[festType] || GENRE_THEMES.technical;

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const all = await fetchRawPublicFests({ cacheBust: false });
                if (cancelled) return;
                writeFestsCache(all);
                setFests(
                    all.filter((fest) => fest.festType === festType && fest.status !== 'lastyearhit'),
                );
            } catch {
                if (!cancelled) {
                    const existing = readFestsCacheByType(festType);
                    if (existing?.length) setFests(existing);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [festType]);

    const featured = useMemo(
        () => fests.filter((fest) => fest.status === 'ongoing'),
        [fests]
    );

    const listed = useMemo(() => {
        return fests.filter((fest) => {
            // Text search
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchName = fest.festName?.toLowerCase().includes(q);
                const matchCollege = fest.collegeName?.toLowerCase().includes(q);
                const matchCity = fest.city?.toLowerCase().includes(q) || fest.location?.toLowerCase().includes(q);
                if (!matchName && !matchCollege && !matchCity) return false;
            }
            // Status filter
            if (statusFilter === 'ongoing') return fest.status === 'ongoing';
            if (statusFilter === 'upcoming') return fest.status === 'upcoming' || fest.status === 'beyondcampus';
            return true;
        });
    }, [fests, searchQuery, statusFilter]);

    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    const seoMeta = FEST_TYPE_SEO[festType] || {
        title: `${title} Fests`,
        description: `Discover and register for ${title.toLowerCase()} college fests near you on CrwdCtrl.`,
    };
    const canonicalPath = `/${targetPage}`;
    const seoJsonLd = [
        breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Fests', path: '/fests' },
            { name: seoMeta.title, path: canonicalPath },
        ]),
        itemListSchema({
            name: seoMeta.title,
            description: seoMeta.description,
            url: canonicalPath,
            items: fests
                .filter((fest) => fest?._id && fest?.festName)
                .map((fest) => ({ name: fest.festName, url: festPath(fest) })),
        }),
    ];

    return (
        <div className={`crwdctrl-page crwdctrl-page--content crwdctrl-mobile-page min-h-screen ${isDark ? 'bg-[#07090E] text-white' : 'bg-[#F8F9FA] text-gray-900'}`}>
            <Seo
                title={seoMeta.title}
                description={seoMeta.description}
                canonical={canonicalPath}
                jsonLd={seoJsonLd}
            />

            {/* ── Sleek Glassmorphic Sticky Header ── */}
            <header className={`sticky top-0 z-40 backdrop-blur-xl border-b transition-colors ${
                isDark ? 'bg-[#07090E]/85 border-white/10' : 'bg-white/85 border-gray-200 shadow-xs'
            }`}>
                <div className="max-w-7xl mx-auto px-3 sm:px-6 pt-3 pb-2.5">
                    {/* Top Row: Back, Title & Stats Badge */}
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <button
                                type="button"
                                onClick={goBack}
                                aria-label="Back to fests"
                                className={`size-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                                    isDark
                                        ? 'bg-white/5 border border-white/10 text-white hover:bg-white/15 hover:border-cyan-400/40'
                                        : 'bg-white border border-gray-200 text-gray-800 hover:bg-gray-100 shadow-xs'
                                } active:scale-95`}
                            >
                                <ArrowLeft size={18} />
                            </button>

                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-lg sm:text-2xl font-black tracking-tight truncate flex items-center gap-1.5">
                                        <span>{emoji}</span>
                                        <span>{title} Fests</span>
                                    </h1>
                                    <span className={`hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-full ${theme.badgeBg}`}>
                                        {fests.length} {fests.length === 1 ? 'Event' : 'Events'}
                                    </span>
                                </div>
                                <p className={`text-xs truncate hidden sm:block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {theme.tagline}
                                </p>
                            </div>
                        </div>

                        {/* Search input in header */}
                        <div className="relative w-44 sm:w-64 shrink-0">
                            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search fest, college..."
                                className={`w-full h-9 pl-9 pr-7 text-xs rounded-xl transition-all focus:outline-none focus:ring-1 ${
                                    isDark
                                        ? 'bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:border-cyan-400 focus:ring-cyan-400/20'
                                        : 'bg-gray-100 border border-transparent text-gray-900 placeholder-gray-500 focus:bg-white focus:border-cyan-500 focus:ring-cyan-500/20'
                                }`}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                                    aria-label="Clear search"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Category Switcher Tabs */}
                    <div className="flex items-center gap-2 mt-2.5 overflow-x-auto scrollbar-hide pb-0.5" style={{ scrollbarWidth: 'none' }}>
                        {NAV_TABS.map((tab) => {
                            const isActive = tab.id === festType;
                            return (
                                <Link
                                    key={tab.id}
                                    to={tab.path}
                                    className={`text-xs px-3.5 py-1.5 rounded-full whitespace-nowrap transition-all duration-200 ${
                                        isActive
                                            ? theme.pillActive
                                            : isDark
                                                ? 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white border border-white/5'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                                    }`}
                                >
                                    {tab.label}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-3 sm:px-6 pt-4 pb-28">
                {loading ? (
                    <FestSubpageLoadingSkeleton listedCount={6} />
                ) : (
                    <>
                        {/* ── Featured Ongoing Showcase (if any) ── */}
                        {featured.length > 0 && !searchQuery && (
                            <section className="mb-8">
                                <div className="flex items-center justify-between mb-3 px-1">
                                    <div className="flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                        </span>
                                        <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-1.5">
                                            <span>{publicConfig.labels.fests.featured || 'Featured Live Fests'}</span>
                                        </h2>
                                    </div>
                                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-white/10 text-cyan-300' : 'bg-gray-200 text-gray-700'}`}>
                                        {featured.length} Live
                                    </span>
                                </div>

                                <div
                                    ref={scrollRef}
                                    className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                    style={{ scrollbarWidth: 'none' }}
                                    onScroll={(e) => setFeaturedPg(getCarouselScrollPage(e.currentTarget))}
                                >
                                    <div className="flex gap-4 pb-2">
                                        {featured.map((fest) => {
                                            const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                            return (
                                                <HomeEventCard
                                                    key={fest._id}
                                                    event={{
                                                        id: fest._id,
                                                        title: festCardName(fest),
                                                        subtitle: festCardCollegeName(fest),
                                                        communityName: festCardCollegeName(fest),
                                                        image: img,
                                                        displayDate: fest.festDate,
                                                        date: fest.festDate,
                                                        category: festType,
                                                    }}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(fest._id)}
                                                    onToggleFavorite={() => toggleFavorite(fest._id, fest)}
                                                    onViewDetails={() => openFestDetails(fest)}
                                                    shareUrl={`${window.location.origin}${festPath(fest)}`}
                                                    wideCard
                                                />
                                            );
                                        })}
                                    </div>
                                </div>
                                <CarouselDotPagination total={featured.length} current={featuredPg} className="mt-2" />
                            </section>
                        )}

                        {/* ── Listed Fests Section ── */}
                        <section className="mb-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-1">
                                <div>
                                    <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                                        {searchQuery ? `Search Results (${listed.length})` : `Explore ${title} Fests`}
                                    </h2>
                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                        Discover competitions, workshops, and registrations
                                    </p>
                                </div>

                                {/* Status Filters */}
                                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                                    {[
                                        { id: 'all', label: 'All Status' },
                                        { id: 'ongoing', label: '🟢 Ongoing' },
                                        { id: 'upcoming', label: '🚀 Upcoming' },
                                    ].map((f) => (
                                        <button
                                            key={f.id}
                                            type="button"
                                            onClick={() => setStatusFilter(f.id)}
                                            className={`text-xs px-3 py-1.5 rounded-xl font-semibold transition-all ${
                                                statusFilter === f.id
                                                    ? isDark
                                                        ? 'bg-white text-black shadow-md'
                                                        : 'bg-black text-white shadow-md'
                                                    : isDark
                                                        ? 'bg-white/5 text-gray-400 hover:text-white border border-white/5'
                                                        : 'bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200'
                                            }`}
                                        >
                                            {f.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {listed.length === 0 ? (
                                <div className={`text-center py-16 px-4 rounded-3xl border transition-all ${
                                    isDark
                                        ? 'bg-[#0D0F14] border-white/10 text-gray-400'
                                        : 'bg-white border-gray-200 text-gray-500 shadow-sm'
                                }`}>
                                    <div className="text-5xl mb-3">{emoji}</div>
                                    <p className="text-base font-semibold mb-1">
                                        {searchQuery ? `No festivals found for "${searchQuery}"` : emptyMessage}
                                    </p>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                                        {searchQuery
                                            ? 'Try checking for spelling mistakes or explore another category.'
                                            : 'Check back soon as new college festivals are listed regularly.'}
                                    </p>
                                    {searchQuery ? (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-400 text-black hover:bg-cyan-300 transition-colors"
                                        >
                                            Clear Search
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/fests')}
                                            className="px-4 py-2 rounded-xl text-xs font-bold bg-cyan-400 text-black hover:bg-cyan-300 transition-colors"
                                        >
                                            Explore All Categories
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                    {listed.map((fest) => {
                                        const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                        return (
                                            <div key={fest._id} className="transition-transform duration-200 hover:-translate-y-1">
                                                <HomeEventCard
                                                    event={{
                                                        id: fest._id,
                                                        title: festCardName(fest),
                                                        subtitle: festCardCollegeName(fest),
                                                        communityName: festCardCollegeName(fest),
                                                        description: fest.description,
                                                        image: img,
                                                        displayDate: fest.festDate,
                                                        date: fest.festDate,
                                                        city: fest.city || fest.location,
                                                        category: festType,
                                                    }}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(fest._id)}
                                                    onToggleFavorite={() => toggleFavorite(fest._id, fest)}
                                                    onViewDetails={() => openFestDetails(fest)}
                                                    shareUrl={`${window.location.origin}${festPath(fest)}`}
                                                    wideCard
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        <CustomPageSectionsRenderer
                            targetPage={targetPage}
                            fests={fests}
                            isDark={isDark}
                            loading={loading}
                            isFavorite={isFavorite}
                            onToggleFavorite={onSectionFav}
                            onItemClick={onItemClick}
                            getShareUrl={getShareUrl}
                        />
                    </>
                )}
            </main>
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import { FestSubpageLoadingSkeleton } from '../../components/HomeEventCardSkeleton';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import CarouselDotPagination from '../../components/CarouselDotPagination';
import { getCarouselScrollPage } from '../../utils/horizontalScroll';
import CustomPageSectionsRenderer from '../../components/CustomPageSectionsRenderer';
import Seo from '../../components/Seo';
import { breadcrumbSchema, itemListSchema } from '../../utils/seo';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';
import { fetchRawPublicFests, prefetchFestDetail } from '../../services/api/fests.api';
import { readFestsCacheByType, writeFestsCache } from '../../utils/festsSessionCache';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import { festPath } from '../../utils/slugRoutes';
import { buildFestDetailNavState } from '../../utils/detailPageCache';

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

const STATUS_BADGE = {
    ongoing:      { label: 'Ongoing',      cls: 'bg-green-500 text-white' },
    upcoming:     { label: 'Upcoming',     cls: 'bg-blue-500 text-white' },
    beyondcampus: { label: 'Beyond Campus', cls: 'bg-purple-500 text-white' },
    completed:    { label: 'Completed',    cls: 'bg-gray-500 text-white' },
    lastyearhit:  { label: 'Last Year',    cls: 'bg-amber-500 text-black' },
};

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

function StatusBadge({ status }) {
    const badge = STATUS_BADGE[status];
    if (!badge) return null;
    return (
        <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-lg ${badge.cls}`}>
            {badge.label}
        </span>
    );
}

/**
 * festDate is a free-form display string ("12-14 Feb 2025", "To Be Announced").
 * Never parse with new Date() — that produces "Invalid Date" / wrong dates.
 */
function formatFestDate(date) {
    if (!date) return '';
    return String(date).trim();
}

export default function FestTypePage({
    festType,
    title,
    emoji,
    imageFallbackColor,
    emptyMessage,
    targetPage,
}) {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

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

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                // One full public list — filter client-side and warm shared cache for sibling pages
                const all = await fetchRawPublicFests({ cacheBust: false });
                if (cancelled) return;
                writeFestsCache(all);
                setFests(
                    all.filter((fest) => fest.festType === festType && fest.status !== 'lastyearhit'),
                );
            } catch {
                if (!cancelled) setFests([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, [festType]);

    const featured = fests.filter((fest) => fest.status === 'ongoing');
    const listed = fests.filter((fest) => fest.status !== 'ongoing');
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
        <div className="crwdctrl-page crwdctrl-page--content crwdctrl-mobile-page min-h-screen">
            <Seo
                title={seoMeta.title}
                description={seoMeta.description}
                canonical={canonicalPath}
                jsonLd={seoJsonLd}
            />
            <div
                className={`crwdctrl-sticky-header sticky top-0 z-40 rounded-b-[16px] px-4 pb-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${isDark ? 'bg-[#111213]' : 'bg-[#F2F4F7]'}`}
                style={{ paddingTop: 'max(var(--safe-top), 12px)' }}
            >
                <div className="flex items-center gap-3 mt-2">
                    <button
                        type="button"
                        onClick={() => navigate('/fests', { replace: true })}
                        aria-label="Back to fests"
                        className={`touch-target size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}
                    >
                        <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-700'} />
                    </button>
                    <h1 className={`text-2xl font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</h1>
                </div>
            </div>

            <main className="pt-5 pb-28">
                {loading ? (
                    <FestSubpageLoadingSkeleton listedCount={3} />
                ) : (
                    <>
                        {featured.length > 0 && (
                            <section className="mb-6">
                                <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-black'}`}>Featured Fests</h2>
                                <div
                                    ref={scrollRef}
                                    className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                    style={{ scrollbarWidth: 'none' }}
                                    onScroll={(e) => setFeaturedPg(getCarouselScrollPage(e.currentTarget))}
                                >
                                    <div className="flex gap-4 pb-1">
                                        {featured.map((fest) => {
                                            const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                            return (
                                                <div
                                                    key={fest._id}
                                                    className="card-surface card-carousel-fest rounded-2xl overflow-hidden snap-start"
                                                    onPointerDown={() => prefetchFestDetail(fest)}
                                                >
                                                    <div className="fest-card-image">
                                                        {img ? (
                                                            <img
                                                                src={getImageUrl(img, { preset: 'cardPortrait' })}
                                                                alt={fest.festName}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => handleImageErrorWithFallback(e, 320, 175, imageFallbackColor, fest.festName)}
                                                            />
                                                        ) : (
                                                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                                <span className="text-5xl">{emoji}</span>
                                                            </div>
                                                        )}
                                                        <StatusBadge status={fest.status} />
                                                        <CardFavoriteButton
                                                            isFavorite={isFavorite(fest._id)}
                                                            onClick={() => toggleFavorite(fest._id, fest)}
                                                        />
                                                    </div>
                                                    <div className="px-4 pt-3 pb-4">
                                                        <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{toCardText(fest.festName)}</p>
                                                        <p className={`card-event-subtitle mb-3 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{toCardText(fest.collegeName)}</p>
                                                        <button
                                                            onClick={() => openFestDetails(fest)}
                                                            className="w-full h-11 rounded-2xl bg-[#0ECCEE] text-black text-sm font-medium shadow-md"
                                                        >
                                                            View details
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <CarouselDotPagination total={featured.length} current={featuredPg} />
                            </section>
                        )}

                        <section className="px-4">
                            <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-black'}`}>Listed Fest</h2>
                            {listed.length === 0 && featured.length === 0 ? (
                                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="text-4xl mb-2">{emoji}</div>
                                    <p>{emptyMessage}</p>
                                </div>
                            ) : listed.length === 0 ? null : (
                                <div className="space-y-3">
                                    {listed.map((fest) => {
                                        const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                        return (
                                            <div
                                                key={fest._id}
                                                onClick={() => openFestDetails(fest)}
                                                onPointerDown={() => prefetchFestDetail(fest)}
                                                className="card-surface flex rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
                                            >
                                                <div className="relative list-card-thumb shrink-0">
                                                    {img ? (
                                                        <img
                                                            src={getImageUrl(img, { preset: 'cardPortrait' })}
                                                            alt={fest.festName}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => handleImageErrorWithFallback(e, 160, 160, imageFallbackColor, fest.festName)}
                                                        />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                            <span className="text-4xl">{emoji}</span>
                                                        </div>
                                                    )}
                                                    <StatusBadge status={fest.status} />
                                                    <CardFavoriteButton
                                                        isFavorite={isFavorite(fest._id)}
                                                        onClick={() => toggleFavorite(fest._id, fest)}
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0 px-4 py-4">
                                                    <p className={`card-event-title line-clamp-2 mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{toCardText(fest.festName)}</p>
                                                    <p className={`card-event-subtitle line-clamp-1 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{toCardText(fest.collegeName)}</p>
                                                    {fest.festDate && (
                                                        <p className={`text-xs font-medium leading-4 tracking-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                            {formatFestDate(fest.festDate)}
                                                        </p>
                                                    )}
                                                </div>
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

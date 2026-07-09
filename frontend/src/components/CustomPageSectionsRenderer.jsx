import { useCallback, useEffect, useMemo, useState } from 'react';
import HomeCarouselSection from './HomeCarouselSection';
import HeroBanner from './HeroBanner';
import HomeCarouselCardsSkeleton from './HomeEventCardSkeleton';
import { buildPageCarouselItems } from '../utils/homeCarouselItems';
import { mapHomeCarouselDisplayItems } from '../utils/mapHomeCarouselDisplayItems';
import { getCardSizeProps } from '../utils/homeCardSize';
import { TRENDING_CARD_GAP } from '../hooks/useHomeCarousel';
import { publicFetchJSONRetry } from '../services/api/client';

async function fetchPageSections(targetPage) {
    const { data } = await publicFetchJSONRetry(`/page-sections?page=${encodeURIComponent(targetPage)}`, { cacheBust: true });
    return Array.isArray(data?.sections) ? data.sections : [];
}

export default function CustomPageSectionsRenderer({
    targetPage,
    fests = [],
    treks = [],
    communities = [],
    sports = [],
    runClubs = [],
    eventShows = [],
    transformedFests = [],
    isDark = false,
    loading = false,
    isFavorite,
    onToggleFavorite,
    onItemClick,
    getShareUrl,
}) {
    const [sections, setSections] = useState([]);

    const loadSections = useCallback(() => {
        fetchPageSections(targetPage)
            .then((list) => setSections(list))
            .catch(() => setSections([]));
    }, [targetPage]);

    useEffect(() => {
        loadSections();
    }, [loadSections]);

    useEffect(() => {
        const onAdminUpdate = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) loadSections();
        };
        window.addEventListener('storage', onAdminUpdate);
        return () => window.removeEventListener('storage', onAdminUpdate);
    }, [loadSections]);

    const carousels = useMemo(() => {
        const mapItems = (sectionSlug) =>
            mapHomeCarouselDisplayItems(
                buildPageCarouselItems(fests, treks, communities, targetPage, sectionSlug, sports, runClubs, eventShows),
                transformedFests,
            );

        return sections
            .map((section) => ({
                section,
                items: mapItems(section.slug),
                cardProps: getCardSizeProps(section.cardSize),
            }))
            .filter(({ items }) => items.length > 0);
    }, [sections, fests, treks, communities, sports, runClubs, eventShows, transformedFests, targetPage]);

    if (loading && !carousels.length) {
        return (
            <>
                <section className="home-section-block">
                    <HomeCarouselCardsSkeleton tallCard className="mt-1" />
                </section>
                <section className="home-section-block">
                    <HomeCarouselCardsSkeleton wideCard className="mt-1" />
                </section>
            </>
        );
    }

    if (!carousels.length && !loading) return null;

    const buildHeroBannerEvents = (items) => items.map((item) => ({
        id: item.id || item._id,
        image: item._image || item.image || item.coverImage || item.poster,
        title: item._title || item.title || item.festName || item.name,
        subtitle: item._subtitle || item.subtitle,
        dateTime: item.dateTime || item.date,
    }));

    return (
        <>
            {carousels.map(({ section, items, cardProps }) => {
                if (cardProps.heroCard && items.length > 0) {
                    const heroEvents = buildHeroBannerEvents(items);
                    return (
                        <div key={section.slug} className="home-section-block">
                            {section.title && (
                                <h2 className={`home-section-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {section.title}
                                </h2>
                            )}
                            <HeroBanner
                                events={heroEvents}
                                onEventClick={(id) => {
                                    const hit = items.find((it) => (it.id || it._id) === id);
                                    if (hit) onItemClick(hit);
                                }}
                            />
                        </div>
                    );
                }

                return (
                <HomeCarouselSection
                    key={section.slug}
                    title={section.title}
                    items={items}
                    isDark={isDark}
                    loading={loading}
                    tallCard={cardProps.tallCard}
                    wideCard={cardProps.wideCard}
                    miniCard={cardProps.miniCard}
                    portraitCard={cardProps.portraitCard}
                    heroCard={cardProps.heroCard}
                    cardGap={cardProps.tallCard ? TRENDING_CARD_GAP : undefined}
                    isFavorite={isFavorite}
                    onToggleFavorite={onToggleFavorite}
                    onItemClick={onItemClick}
                    getShareUrl={getShareUrl}
                />
                );
            })}
        </>
    );
}

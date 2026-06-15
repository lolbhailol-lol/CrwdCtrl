import { useCallback, useEffect, useMemo, useState } from 'react';
import HomeCarouselSection from './HomeCarouselSection';
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
                buildPageCarouselItems(fests, treks, communities, targetPage, sectionSlug, sports, runClubs),
                transformedFests,
            );

        return sections
            .map((section) => ({
                section,
                items: mapItems(section.slug),
                cardProps: getCardSizeProps(section.cardSize),
            }))
            .filter(({ items }) => items.length > 0);
    }, [sections, fests, treks, communities, sports, runClubs, transformedFests, targetPage]);

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

    return (
        <>
            {carousels.map(({ section, items, cardProps }) => (
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
            ))}
        </>
    );
}

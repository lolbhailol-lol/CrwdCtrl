import { useCallback, useEffect, useMemo, useState } from 'react';
import HomeCarouselSection from './HomeCarouselSection';
import { buildPageCarouselItems } from '../utils/homeCarouselItems';
import { mapHomeCarouselDisplayItems } from '../utils/mapHomeCarouselDisplayItems';
import { getCardSizeProps } from '../utils/homeCardSize';
import { TRENDING_CARD_GAP } from '../hooks/useHomeCarousel';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

async function fetchPageSections(targetPage) {
    const res = await fetch(`${API_BASE_URL}/page-sections?page=${encodeURIComponent(targetPage)}&_cb=${Date.now()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.sections) ? data.sections : [];
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

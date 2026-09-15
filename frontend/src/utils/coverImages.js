import { getImageUrl } from './imageImports';
import { normalizeImageList, normalizeImageUrl } from './uploadUrls';

/** Admin slots + preset mapping for public pages */
export const COVER_IMAGE_SLOTS = [
    { key: 'page', aspectId: 'eventPage', label: 'Event page top image', short: '5:4', preset: 'eventPage', previewClass: 'w-20 aspect-[5/4]' },
    { key: 'portrait', aspectId: 'cardPortrait', label: 'Portrait card (community)', short: '10:13', preset: 'cardPortrait', previewClass: 'w-16 aspect-[10/13]' },
    { key: 'wide', aspectId: 'cardWide', label: 'Wide card', short: '10:7', preset: 'cardWide', previewClass: 'w-20 aspect-[10/7]' },
    { key: 'hero', aspectId: 'hero', label: 'Hero banner (listings)', short: '15:7', preset: 'hero', previewClass: 'w-24 aspect-[120/56]' },
    { key: 'square', aspectId: 'square', label: 'Square', short: '1:1', preset: 'square', previewClass: 'w-14 aspect-square' },
    { key: 'landscape', aspectId: 'cardLandscape', label: 'Landscape row', short: '5:3', preset: 'cardLandscape', previewClass: 'w-20 aspect-[5/3]' },
    { key: 'video', aspectId: 'cardVideo', label: 'Video card', short: '16:9', preset: 'cardVideo', previewClass: 'w-20 aspect-video' },
];

export const PRESET_TO_COVER_KEY = Object.fromEntries(
    COVER_IMAGE_SLOTS.map((s) => [s.preset, s.key]),
);

/** Cloudinary preset names that map to coverImages keys */
export const PRESET_ALIASES = {
    cardPortrait: 'portrait',
    cardWide: 'wide',
    cardLandscape: 'landscape',
    cardVideo: 'video',
    cardTrending: 'portrait',
    cardPanel: 'portrait',
    card: 'portrait',
    cardLg: 'portrait',
    cardSm: 'portrait',
    hero: 'hero',
    communityBanner: 'hero',
    eventPage: 'page',
    square: 'square',
    thumb: 'square',
};

export const EMPTY_COVER_IMAGES = () =>
    Object.fromEntries(COVER_IMAGE_SLOTS.map((s) => [s.key, '']));

export function normalizeCoverImages(raw) {
    const base = EMPTY_COVER_IMAGES();
    if (!raw || typeof raw !== 'object') return base;
    COVER_IMAGE_SLOTS.forEach(({ key }) => {
        base[key] = normalizeImageUrl(raw[key]);
    });
    return base;
}

export function primaryCoverUrl(coverImages = {}, fallback = '') {
    const preferred = ['portrait', 'wide', 'hero', 'landscape', 'video', 'square', 'page'];
    for (const key of preferred) {
        if (coverImages[key]) return coverImages[key];
    }
    return normalizeImageUrl(fallback);
}

/** All non-empty cover slot + legacy coverImage URLs for an entity. */
export function collectCoverUrls(entityOrCovers = {}, legacyCover = '') {
    const covers = normalizeCoverImages(
        entityOrCovers?.coverImages !== undefined ? entityOrCovers.coverImages : entityOrCovers,
    );
    const urls = new Set();
    Object.values(covers).forEach((url) => {
        if (url) urls.add(url);
    });
    const legacy = normalizeImageUrl(
        legacyCover
        || entityOrCovers?.coverImage
        || entityOrCovers?.image
        || '',
    );
    if (legacy) urls.add(legacy);
    return urls;
}

/** Gallery / images[] with any cover or card URLs removed. */
export function excludeCoverUrlsFromGallery(images, entityOrCovers = {}, legacyCover = '') {
    const covers = collectCoverUrls(entityOrCovers, legacyCover);
    return normalizeImageList(images).filter((url) => !covers.has(url));
}

/** Collect gallery-style photos (not the primary logo/cover when possible). */
export function collectGalleryCandidateUrls(entity = {}) {
    const urls = [];
    const push = (u) => {
        const n = normalizeImageUrl(u);
        if (n && !urls.includes(n)) urls.push(n);
    };
    const lists = [
        entity.galleryImages,
        entity.festImages,
        entity.images,
        entity.gallery,
    ];
    for (const list of lists) {
        if (!Array.isArray(list)) continue;
        list.forEach(push);
    }
    return urls;
}

/**
 * Best image for a home / featured card layout.
 * Tall cards: prefer portrait slot or gallery photos (fest logos look crushed in tall frames).
 * Wide/hero: prefer wide/video/hero slots, then cover.
 */
export function pickBestCardImage(entity, layout = 'tall') {
    if (!entity) return '';
    const covers = normalizeCoverImages(entity.coverImages);
    const gallery = collectGalleryCandidateUrls(entity);
    const legacyCover = normalizeImageUrl(
        entity.coverImage || entity.image || entity.heroImage || entity.poster || entity.banner || '',
    );

    if (layout === 'portrait') {
        return (
            covers.portrait
            || covers.page
            || covers.square
            || gallery[0]
            || legacyCover
            || covers.wide
            || covers.video
            || ''
        );
    }

    if (layout === 'wide' || layout === 'hero') {
        return (
            (layout === 'hero' ? covers.hero : '')
            || covers.wide
            || covers.video
            || covers.landscape
            || legacyCover
            || gallery[0]
            || covers.portrait
            || ''
        );
    }

    // tall / trending (11:10) — gallery photo beats wide fest logo
    return (
        covers.portrait
        || covers.page
        || covers.square
        || gallery[0]
        || gallery[1]
        || covers.wide
        || covers.video
        || covers.landscape
        || legacyCover
        || ''
    );
}

/** Raw URL for a layout — falls back across related slots then gallery then coverImage */
export function resolveCoverImage(entity, preset = 'cardPortrait') {
    if (!entity) return '';
    const key = PRESET_ALIASES[preset] || 'portrait';
    const covers = normalizeCoverImages(entity.coverImages);
    if (covers[key]) return covers[key];

    // Prefer layout-friendly slots before forcing a mismatched crop of the main cover
    const fallbackKeys = {
        video: ['wide', 'landscape', 'hero', 'page', 'portrait', 'square'],
        wide: ['video', 'landscape', 'hero', 'page', 'portrait', 'square'],
        landscape: ['wide', 'video', 'hero', 'page', 'portrait', 'square'],
        hero: ['wide', 'video', 'landscape', 'page', 'portrait', 'square'],
        portrait: ['page', 'square', 'wide', 'video', 'landscape', 'hero'],
        page: ['portrait', 'wide', 'video', 'hero', 'landscape', 'square'],
        square: ['portrait', 'page', 'wide', 'video'],
    };
    for (const alt of fallbackKeys[key] || []) {
        if (covers[alt]) return covers[alt];
    }

    return normalizeImageUrl(
        entity.coverImage
        || entity.image
        || entity.heroImage
        || entity.poster
        || entity.banner
        || entity.images?.[0]
        || '',
    );
}

/** Cloudinary-optimized URL for a layout */
export function getCoverImageUrl(entity, preset = 'cardPortrait') {
    const raw = resolveCoverImage(entity, preset);
    if (!raw) return null;
    return getImageUrl(raw, { preset }) || raw;
}

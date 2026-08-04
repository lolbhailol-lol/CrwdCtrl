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

/** Raw URL for a layout — falls back to coverImage / image */
export function resolveCoverImage(entity, preset = 'cardPortrait') {
    if (!entity) return '';
    const key = PRESET_ALIASES[preset] || 'portrait';
    const covers = normalizeCoverImages(entity.coverImages);
    if (covers[key]) return covers[key];
    return normalizeImageUrl(entity.coverImage || entity.image || entity.heroImage || '');
}

/** Cloudinary-optimized URL for a layout */
export function getCoverImageUrl(entity, preset = 'cardPortrait') {
    const raw = resolveCoverImage(entity, preset);
    if (!raw) return null;
    return getImageUrl(raw, { preset }) || raw;
}

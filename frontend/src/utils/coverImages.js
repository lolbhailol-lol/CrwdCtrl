import { getImageUrl } from './imageImports';

/** Admin slots + preset mapping for public pages */
export const COVER_IMAGE_SLOTS = [
    { key: 'portrait', aspectId: 'cardPortrait', label: 'Portrait card', short: '10:13', preset: 'cardPortrait', previewClass: 'w-16 aspect-[10/13]' },
    { key: 'wide', aspectId: 'cardWide', label: 'Wide card', short: '10:7', preset: 'cardWide', previewClass: 'w-20 aspect-[10/7]' },
    { key: 'hero', aspectId: 'hero', label: 'Hero banner', short: '15:7', preset: 'hero', previewClass: 'w-24 aspect-[120/56]' },
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
    square: 'square',
    thumb: 'square',
};

export const EMPTY_COVER_IMAGES = () =>
    Object.fromEntries(COVER_IMAGE_SLOTS.map((s) => [s.key, '']));

export function normalizeCoverImages(raw) {
    const base = EMPTY_COVER_IMAGES();
    if (!raw || typeof raw !== 'object') return base;
    COVER_IMAGE_SLOTS.forEach(({ key }) => {
        const v = raw[key];
        base[key] = typeof v === 'string' ? v.trim() : '';
    });
    return base;
}

export function primaryCoverUrl(coverImages = {}, fallback = '') {
    for (const { key } of COVER_IMAGE_SLOTS) {
        if (coverImages[key]) return coverImages[key];
    }
    return (fallback || '').trim();
}

/** Raw URL for a layout — falls back to coverImage / image */
export function resolveCoverImage(entity, preset = 'cardPortrait') {
    if (!entity) return '';
    const key = PRESET_ALIASES[preset] || 'portrait';
    const covers = normalizeCoverImages(entity.coverImages);
    if (covers[key]) return covers[key];
    return entity.coverImage || entity.image || entity.heroImage || '';
}

/** Cloudinary-optimized URL for a layout */
export function getCoverImageUrl(entity, preset = 'cardPortrait') {
    const raw = resolveCoverImage(entity, preset);
    return getImageUrl(raw, { preset }) || raw || null;
}

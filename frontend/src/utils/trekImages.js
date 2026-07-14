import { normalizeImageList, normalizeImageUrl } from './uploadUrls';

/**
 * Detail-page top slider images (4–5). Falls back to legacy cover + images merge.
 */
export function resolveTrekHeroSlides(trek) {
    if (!trek) return [];
    const dedicated = normalizeImageList(trek.heroImages);
    if (dedicated.length) return dedicated;

    const cover =
        normalizeImageUrl(trek.coverImage)
        || normalizeImageUrl(trek.coverImages?.hero)
        || normalizeImageUrl(trek.coverImages?.portrait)
        || normalizeImageUrl(trek.image)
        || '';
    const extras = normalizeImageList(trek.images);
    const slides = [];
    if (cover) slides.push(cover);
    extras.forEach((url) => {
        if (url && !slides.includes(url)) slides.push(url);
    });
    return slides;
}

/**
 * Gallery below overview — only when dedicated heroImages exist (so images[] isn't the legacy slider).
 */
export function resolveTrekGalleryImages(trek) {
    if (!trek) return [];
    if (normalizeImageList(trek.heroImages).length) {
        return normalizeImageList(trek.images);
    }
    return [];
}

/** Admin form: seed slider from legacy fields if heroImages empty */
export function seedTrekHeroImagesForForm(trek) {
    if (!trek) return [];
    const dedicated = normalizeImageList(trek.heroImages);
    if (dedicated.length) return dedicated;
    return resolveTrekHeroSlides(trek).slice(0, 5);
}

/**
 * Gallery field — always show stored images[].
 * Legacy note: older treks used images[] as the slider; those also appear in the slider field until you split them.
 */
export function seedTrekGalleryForForm(trek) {
    if (!trek) return [];
    return normalizeImageList(trek.images);
}

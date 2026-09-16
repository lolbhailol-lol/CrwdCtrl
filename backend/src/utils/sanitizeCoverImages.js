const COVER_KEYS = ['page', 'portrait', 'wide', 'hero', 'square', 'landscape', 'video'];

function normalizeUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object' && value.url) return String(value.url).trim();
    if (typeof value === 'object' && value.secure_url) return String(value.secure_url).trim();
    return '';
}

function sanitizeCoverImages(input) {
    const out = {};
    if (!input || typeof input !== 'object') {
        COVER_KEYS.forEach((k) => { out[k] = ''; });
        return out;
    }
    COVER_KEYS.forEach((k) => {
        out[k] = normalizeUrl(input[k]);
    });
    return out;
}

function primaryCoverUrl(coverImages = {}, fallback = '') {
    const order = ['portrait', 'wide', 'hero', 'landscape', 'video', 'square', 'page'];
    for (const key of order) {
        if (coverImages[key]) return coverImages[key];
    }
    return normalizeUrl(fallback);
}

/**
 * Layout-specific URL. Never prefer portrait for hero/wide when a matching crop exists.
 * `fallback` is the legacy coverImage field (often the portrait crop).
 */
function layoutCoverUrl(coverImages = {}, layout = 'portrait', fallback = '') {
    const covers = sanitizeCoverImages(coverImages);
    const legacy = normalizeUrl(fallback);

    if (layout === 'hero' || layout === 'wide') {
        const order = layout === 'hero'
            ? ['hero', 'wide', 'video', 'landscape', 'page']
            : ['wide', 'video', 'landscape', 'hero', 'page'];
        for (const key of order) {
            if (covers[key]) return covers[key];
        }
        return legacy || covers.portrait || covers.square || '';
    }

    const portraitOrder = ['portrait', 'page', 'square'];
    for (const key of portraitOrder) {
        if (covers[key]) return covers[key];
    }
    return legacy || covers.wide || covers.hero || covers.landscape || covers.video || '';
}

function collectCoverUrls(coverImages = {}, legacyCover = '') {
    const covers = sanitizeCoverImages(coverImages);
    const urls = new Set();
    Object.values(covers).forEach((url) => {
        if (url) urls.add(url);
    });
    const legacy = normalizeUrl(legacyCover);
    if (legacy) urls.add(legacy);
    return urls;
}

function excludeCoverUrlsFromGallery(images, coverImages = {}, legacyCover = '') {
    const covers = collectCoverUrls(coverImages, legacyCover);
    if (!Array.isArray(images)) return [];
    return images.map(normalizeUrl).filter((url) => url && !covers.has(url));
}

module.exports = {
    COVER_KEYS,
    sanitizeCoverImages,
    primaryCoverUrl,
    layoutCoverUrl,
    normalizeUrl,
    collectCoverUrls,
    excludeCoverUrlsFromGallery,
};

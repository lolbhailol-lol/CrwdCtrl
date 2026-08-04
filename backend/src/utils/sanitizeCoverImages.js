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
    const order = ['portrait', 'wide', 'hero', 'page', 'landscape', 'video', 'square'];
    for (const key of order) {
        if (coverImages[key]) return coverImages[key];
    }
    return normalizeUrl(fallback);
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
    normalizeUrl,
    collectCoverUrls,
    excludeCoverUrlsFromGallery,
};

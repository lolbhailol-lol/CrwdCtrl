/** Normalize upload API responses (`urls: [{ url }]`) to plain URL strings */
export function parseUploadedUrls(data) {
    if (!data) return [];
    if (typeof data.url === 'string' && data.url.trim()) return [data.url.trim()];

    const raw = data.urls || data.imageUrls || [];
    if (!Array.isArray(raw)) return [];

    return raw
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
                return String(item.url || item.secure_url || '').trim();
            }
            return '';
        })
        .filter(Boolean);
}

export function normalizeImageList(images) {
    if (!Array.isArray(images)) return [];
    return images
        .map((item) => {
            if (typeof item === 'string') return item.trim();
            if (item && typeof item === 'object') {
                return String(item.url || item.secure_url || '').trim();
            }
            return '';
        })
        .filter(Boolean);
}

export function normalizeImageUrl(value) {
    if (!value) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'object') return String(value.url || value.secure_url || '').trim();
    return '';
}

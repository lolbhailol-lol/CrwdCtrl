/**
 * Warm the browser image cache for above-the-fold / soon-visible URLs.
 * Safe to call repeatedly — browsers dedupe identical GETs.
 */
export function preloadImages(urls, { limit = 8 } = {}) {
    if (typeof window === 'undefined' || !Array.isArray(urls) || urls.length === 0) return;

    const seen = new Set();
    let count = 0;

    for (const url of urls) {
        if (!url || typeof url !== 'string' || seen.has(url)) continue;
        seen.add(url);
        count += 1;

        // Prefer <link rel="preload"> for the first couple (higher priority in Chrome)
        if (count <= 2 && document?.head) {
            const already = Array.from(
                document.head.querySelectorAll('link[rel="preload"][as="image"]'),
            ).some((link) => link.getAttribute('href') === url);
            if (!already) {
                const link = document.createElement('link');
                link.rel = 'preload';
                link.as = 'image';
                link.href = url;
                link.fetchPriority = 'high';
                document.head.appendChild(link);
            }
        } else {
            const img = new Image();
            img.decoding = 'async';
            img.src = url;
        }

        if (count >= limit) break;
    }
}

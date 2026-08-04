/**
 * Cloudinary on-the-fly transforms — crisp enough on Retina, sized for real card CSS.
 * Prefer smaller delivery over max quality: slow cards kill UX on mobile networks.
 */

const CLOUDINARY_UPLOAD = '/upload/';

/**
 * Widths target ~2× CSS display size (portrait ~160px, wide ~320–360px, hero ~full mobile).
 * Cap DPR at 2.0 in transforms — dpr_auto on 3× phones was pulling 3× payloads.
 * @type {Record<string, { width: number, height?: number, crop: string, quality?: string }>}
 */
export const IMAGE_PRESETS = {
    thumb: { width: 128, height: 128, crop: 'fill', quality: 'eco' },
    square: { width: 360, height: 360, crop: 'fill', quality: 'eco' },
    /** Portrait cards — .card-portrait-image ~160×208 CSS */
    cardPortrait: { width: 360, height: 468, crop: 'fill', quality: 'eco' },
    /** Wide activity cards — .card-wide-image ~320×224 CSS */
    cardWide: { width: 720, height: 504, crop: 'fill', quality: 'eco' },
    /** Full-width community row — aspect 5:3 */
    cardLandscape: { width: 720, height: 432, crop: 'fill', quality: 'eco' },
    /** 16:9 carousel / video-style cards */
    cardVideo: { width: 640, height: 360, crop: 'fill', quality: 'eco' },
    /** 7:5 home artist tiles */
    cardPanel: { width: 560, height: 400, crop: 'fill', quality: 'eco' },
    cardSm: { width: 360, height: 468, crop: 'fill', quality: 'eco' },
    /** @deprecated use cardPortrait */
    card: { width: 400, height: 520, crop: 'fill', quality: 'eco' },
    cardLg: { width: 560, height: 728, crop: 'fill', quality: 'eco' },
    /** Home / hub hero — mobile-first; still sharp on desktop via dpr_2 */
    hero: { width: 960, height: 448, crop: 'fill', quality: 'good' },
    /** Event detail page top image (5:4) */
    eventPage: { width: 960, height: 768, crop: 'fill', quality: 'good' },
    /** Community detail header */
    communityBanner: { width: 786, height: 792, crop: 'fill', quality: 'good' },
    detail: { width: 1200, height: 675, crop: 'limit', quality: 'good' },
};

/** Hint for `<img sizes>` so the browser can pick the right candidate when srcset is added later */
export const IMAGE_PRESET_SIZES = {
    thumb: '64px',
    square: '180px',
    cardPortrait: '(min-width: 1024px) 160px, 42vw',
    cardWide: '(min-width: 1024px) 360px, 84vw',
    cardLandscape: '100vw',
    cardVideo: '(min-width: 1024px) 320px, 80vw',
    cardPanel: '(min-width: 1024px) 280px, 78vw',
    cardSm: '160px',
    card: '(min-width: 1024px) 200px, 50vw',
    cardLg: '(min-width: 1024px) 280px, 70vw',
    hero: '(min-width: 1024px) 960px, 100vw',
    eventPage: '(min-width: 768px) 672px, 100vw',
    communityBanner: '100vw',
    detail: '(min-width: 1024px) 1200px, 100vw',
};

export function isCloudinaryUrl(url) {
    return typeof url === 'string'
        && url.includes('res.cloudinary.com')
        && url.includes(CLOUDINARY_UPLOAD);
}

// g_auto is only valid with cropping modes; it errors with limit/fit/scale/pad
const GRAVITY_SAFE_CROPS = ['fill', 'lfill', 'fill_pad', 'crop', 'thumb', 'auto'];

function buildTransform({ width, height, crop, quality = 'eco' }) {
    const parts = [`c_${crop}`, `w_${width}`];
    if (height) parts.push(`h_${height}`);
    if (GRAVITY_SAFE_CROPS.includes(crop)) parts.push('g_auto');
    // eco for cards (faster), good for heroes; cap DPR so 3× phones don't download 3× pixels
    parts.push(`q_auto:${quality}`, 'f_auto', 'dpr_2.0');
    return parts.join(',');
}

/** Remove existing transform segments; keep version + public path */
function stripCloudinaryTransforms(pathAfterUpload) {
    if (!pathAfterUpload) return pathAfterUpload;

    const segments = pathAfterUpload.split('/');
    const kept = [];

    for (const segment of segments) {
        if (/^v\d+$/.test(segment)) {
            kept.push(segment);
            continue;
        }
        if (segment.includes(',') || /^[a-z]{1,3}_[^/]+$/i.test(segment)) {
            continue;
        }
        kept.push(segment);
    }

    return kept.join('/');
}

/**
 * @param {string} url
 * @param {keyof typeof IMAGE_PRESETS | string} [preset='card']
 */
export function optimizeImageUrl(url, preset = 'card') {
    if (!url || !isCloudinaryUrl(url)) return url;

    const config = IMAGE_PRESETS[preset] || IMAGE_PRESETS.card;
    const transform = buildTransform(config);

    const uploadIdx = url.indexOf(CLOUDINARY_UPLOAD);
    const prefix = url.slice(0, uploadIdx + CLOUDINARY_UPLOAD.length);
    const rawPath = url.slice(uploadIdx + CLOUDINARY_UPLOAD.length);
    const cleanPath = stripCloudinaryTransforms(rawPath);

    return `${prefix}${transform}/${cleanPath}`;
}

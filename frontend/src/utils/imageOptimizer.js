/**
 * Cloudinary on-the-fly transforms — crisp on Retina, right-sized for performance.
 * Originals stay full quality in Cloudinary; delivery is optimized per context.
 */

const CLOUDINARY_UPLOAD = '/upload/';

/** @type {Record<string, { width: number, height?: number, crop: string }>} */
export const IMAGE_PRESETS = {
    thumb: { width: 192, height: 192, crop: 'fill' },
    /** Square gallery tiles */
    square: { width: 480, height: 480, crop: 'fill' },
    /** Portrait cards — matches .card-portrait-image (10:13) */
    cardPortrait: { width: 520, height: 676, crop: 'fill' },
    /** Wide activity cards — matches .card-wide-image (10:7) */
    cardWide: { width: 800, height: 560, crop: 'fill' },
    /** Full-width community row — aspect 5:3 */
    cardLandscape: { width: 750, height: 450, crop: 'fill' },
    /** 16:9 carousel / video-style cards */
    cardVideo: { width: 640, height: 360, crop: 'fill' },
    /** 7:5 home artist tiles */
    cardPanel: { width: 700, height: 500, crop: 'fill' },
    cardSm: { width: 480, height: 624, crop: 'fill' },
    /** @deprecated use cardPortrait — kept for callers; now 10:13 */
    card: { width: 640, height: 832, crop: 'fill' },
    cardLg: { width: 800, height: 1040, crop: 'fill' },
    hero: { width: 1200, height: 560, crop: 'fill' },
    /** Community detail page header — matches mobile ImmersiveHero (393×396) */
    communityBanner: { width: 786, height: 792, crop: 'fill' },
    detail: { width: 1600, height: 900, crop: 'limit' },
};

export function isCloudinaryUrl(url) {
    return typeof url === 'string'
        && url.includes('res.cloudinary.com')
        && url.includes(CLOUDINARY_UPLOAD);
}

// g_auto is only valid with cropping modes; it errors with limit/fit/scale/pad
const GRAVITY_SAFE_CROPS = ['fill', 'lfill', 'fill_pad', 'crop', 'thumb', 'auto'];

function buildTransform({ width, height, crop }) {
    const parts = [`c_${crop}`, `w_${width}`];
    if (height) parts.push(`h_${height}`);
    if (GRAVITY_SAFE_CROPS.includes(crop)) parts.push('g_auto');
    parts.push('q_auto:good', 'f_auto', 'dpr_auto', 'fl_progressive');
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

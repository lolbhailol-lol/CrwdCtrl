import { optimizeImageUrl } from './imageOptimizer';
// Keep only lightweight runtime paths (no static imports from src/data/real-data).
// This prevents legacy fest assets from being force-bundled into production JS.
export const imageMap = {};
export const aarohanLogoImg = '/logo-crwdctrl.png';

// Utility function to get the proper image URL for production
export const getImageUrl = (imagePath, options = {}) => {
    if (!imagePath) {
        return null;
    }

    if (typeof imagePath === 'object') {
        const nested = imagePath.url || imagePath.secure_url;
        return nested ? getImageUrl(String(nested), options) : null;
    }

    if (typeof imagePath !== 'string') {
        return null;
    }

    const { preset } = options;

    // If already a full URL or browser-generated URL
    if (
        imagePath.startsWith('blob:') ||
        imagePath.startsWith('data:') ||
        imagePath.startsWith('http')
    ) {
        return preset ? optimizeImageUrl(imagePath, preset) : imagePath;
    }

    // If it's a hardcoded/imported image
    if (imageMap?.[imagePath]) {
        return imageMap[imagePath];
    }

    // Normalize path (with leading slash)
    const normalizedPath = imagePath.startsWith('/')
        ? imagePath
        : '/' + imagePath;

    if (imageMap?.[normalizedPath]) {
        return imageMap[normalizedPath];
    }

    // Keep absolute-looking and relative upload paths (do not drop already-uploaded URLs)
    if (preset) {
        return optimizeImageUrl(imagePath, preset) || imagePath;
    }
    return imagePath;
};

/** Resolved + Cloudinary-optimized URL for a given display context */
export const getOptimizedImageUrl = (imagePath, preset = 'card') =>
    getImageUrl(imagePath, { preset });
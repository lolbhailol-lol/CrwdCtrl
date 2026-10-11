/**
 * Fallback image generator utility
 * Creates canvas-based fallback images to replace via.placeholder.com URLs
 * Prevents external requests and improves performance
 */

export const createFallbackImage = (width, height, backgroundColor, text, textColor = '#ffffff') => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        // Set text properties
        const fontSize = Math.max(12, Math.min(width, height) / 8);
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw text (handle multi-line if text is too long)
        const maxWidth = width * 0.8;
        const words = text.split(' ');
        let line = '';
        const lines = [];

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && i > 0) {
                lines.push(line);
                line = words[i] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line);

        // Draw lines centered
        const lineHeight = fontSize * 1.2;
        const totalHeight = lines.length * lineHeight;
        const startY = (height - totalHeight) / 2 + fontSize / 2;

        lines.forEach((line, index) => {
            ctx.fillText(line.trim(), width / 2, startY + index * lineHeight);
        });

        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error generating fallback image:', error);
        // Return a minimal data URL if canvas fails
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="${backgroundColor}"/>
                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="${Math.max(12, Math.min(width, height) / 8)}">${text}</text>
            </svg>
        `)}`;
    }
};

const PHOTO_FALLBACKS = {
    run: '/images/fallback-community-run.webp',
    trek: '/images/fallback-trekking.webp',
    festival: '/images/fallback-festival.webp',
    campus: '/images/fallback-campus-tech.webp',
};

export const resolveFallbackImageUrl = (text = '', width = 0, height = 0) => {
    // Keep compact logos, avatars, and thumbnails as simple text placeholders.
    if (Math.min(Number(width) || 0, Number(height) || 0) < 100) return null;
    const title = String(text).toLowerCase();
    if (/trek|hike|mountain|waterfall|fort|trail/.test(title)) return PHOTO_FALLBACKS.trek;
    if (/run|rush|runner|marathon|mile|lap|jog|fitness|sport/.test(title)) return PHOTO_FALLBACKS.run;
    if (/tech|code|cyber|robot|blockchain|hack|innovation|workshop|startup|kart|game|competition|hunt/.test(title)) return PHOTO_FALLBACKS.campus;
    if (/fest|festival|concert|music|dj|jalsa|navratri|dance|garba|rave|show|event|halloween/.test(title)) return PHOTO_FALLBACKS.festival;
    return PHOTO_FALLBACKS.festival;
};

export const handleImageErrorWithFallback = (event, width, height, backgroundColor, text, textColor = '#ffffff') => {
    const img = event.target;

    // Prevent infinite error loops
    if (img.dataset.fallbackApplied === 'true') {
        return;
    }

    img.dataset.fallbackApplied = 'true';
    const photoFallback = resolveFallbackImageUrl(text, width, height);
    if (photoFallback) {
        img.alt = `Illustrative ${String(text || 'event').trim()} photo`;
        img.src = photoFallback;
        return;
    }
    img.src = createFallbackImage(width, height, backgroundColor, text, textColor);
};

// Common fallback generators for different use cases
export const eventImageFallback = (eventTitle) =>
    createFallbackImage(300, 160, '#2A2B2E', eventTitle || 'Event', '#9CA3AF');

export const competitionImageFallback = (compName) =>
    createFallbackImage(128, 128, '#2A2B2E', compName || 'Competition', '#9CA3AF');

export const artistImageFallback = (artistName) =>
    createFallbackImage(280, 160, '#2A2B2E', artistName || 'Artist', '#9CA3AF');

export const sponsorImageFallback = (sponsorName) =>
    createFallbackImage(100, 60, '#2A2B2E', sponsorName || 'Sponsor', '#9CA3AF');

export const galleryImageFallback = () =>
    createFallbackImage(100, 100, '#2A2B2E', 'Gallery', '#9CA3AF');

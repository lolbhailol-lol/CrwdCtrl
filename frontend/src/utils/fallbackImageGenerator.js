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

export const handleImageErrorWithFallback = (event, width, height, backgroundColor, text, textColor = '#ffffff') => {
    const img = event.target;

    // Prevent infinite error loops
    if (img.dataset.fallbackApplied === 'true') {
        return;
    }

    img.dataset.fallbackApplied = 'true';
    img.src = createFallbackImage(width, height, backgroundColor, text, textColor);
};

// Common fallback generators for different use cases
export const eventImageFallback = (eventTitle) =>
    createFallbackImage(300, 160, '#6366f1', eventTitle || 'Event', '#ffffff');

export const competitionImageFallback = (compName) =>
    createFallbackImage(128, 128, '#0ea5e9', compName || 'Competition', '#ffffff');

export const artistImageFallback = (artistName) =>
    createFallbackImage(280, 160, '#8b5cf6', artistName || 'Artist', '#ffffff');

export const sponsorImageFallback = (sponsorName) =>
    createFallbackImage(100, 60, '#4285F4', sponsorName || 'Sponsor', '#ffffff');

export const galleryImageFallback = () =>
    createFallbackImage(100, 100, '#6366f1', 'Gallery', '#ffffff');
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

const categoryForArtwork = (title = '', category = '') => {
    const value = `${category} ${title}`.toLowerCase();
    if (/trek|hike|mountain|waterfall|fort|trail/.test(value)) return 'OUTDOORS';
    if (/run|runner|marathon|mile|lap|jog|fitness|sport|athletic|race|cricket|football|basketball|badminton|yoga/.test(value)) return 'SPORTS';
    if (/business|management|startup|marketing|finance|entrepreneur|case/.test(value)) return 'BUSINESS';
    if (/media|photo|film|frame|camera|journal|content|design|art|fashion/.test(value)) return 'CREATIVE';
    if (/music|sing|band|dance|theater|theatre|drama|cultural|garba|rave|dj|concert/.test(value)) return 'PERFORMING ARTS';
    if (/esport|gaming|video game/.test(value)) return 'GAMING';
    if (/quiz|literary|debate|poetry|spelling|knowledge/.test(value)) return 'KNOWLEDGE';
    if (/informal|fun event|icebreaker/.test(value)) return 'CAMPUS FUN';
    if (/\bboys\b|\bgirls\b/.test(value)) return 'SPORTS';
    if (/tech|code|cyber|robot|blockchain|hack|innovation|workshop|kart|game|quiz|stem|science/.test(value)) return 'TECH & INNOVATION';
    return 'CAMPUS FEST';
};

const artworkPalette = (text) => {
    let hash = 2166136261;
    for (const char of String(text || 'event')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const hue = Math.abs(hash >>> 0) % 360;
    return [`hsl(${hue} 80% 48%)`, `hsl(${(hue + 54) % 360} 82% 58%)`, `hsl(${(hue + 170) % 360} 78% 42%)`];
};

const escapeSvgText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
}[char]));

/** Branded, event-specific artwork for a broken/missing catalog image. */
export const createUniqueFallbackArtwork = (text = 'Event', category = '', width = 1200, height = 800) => {
    const safeWidth = Math.max(240, Math.min(1600, Number(width) || 1200));
    const safeHeight = Math.max(240, Math.min(1600, Number(height) || 800));
    const title = String(text || 'Event').trim().slice(0, 64);
    const label = categoryForArtwork(title, category);
    const [primary, secondary, accent] = artworkPalette(`${label}:${title}:${category}`);
    const words = title.split(/\s+/);
    const lines = [];
    let line = '';
    words.forEach((word) => {
        const candidate = `${line} ${word}`.trim();
        if (candidate.length > 19 && line) { lines.push(line); line = word; }
        else line = candidate;
    });
    if (line) lines.push(line);
    const maxLineLength = Math.max(1, ...lines.slice(0, 3).map((lineText) => lineText.length));
    const baseFontSize = Math.min(safeWidth, safeHeight) * (lines.length > 2 ? 0.105 : 0.13);
    const fontSize = Math.round(Math.max(18, Math.min(baseFontSize, (safeWidth * 0.78) / (maxLineLength * 0.62))));
    const titleStartY = (safeHeight * 0.52) - ((Math.min(lines.length, 3) - 1) * fontSize * 1.12 / 2);
    const titleLines = lines.slice(0, 3).map((lineText, index) =>
        `<text x="8%" y="${titleStartY + index * (fontSize * 1.12)}" font-size="${fontSize}" font-weight="800">${escapeSvgText(lineText)}</text>`
    ).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${safeWidth}" height="${safeHeight}" viewBox="0 0 ${safeWidth} ${safeHeight}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#10121b"/><stop offset=".52" stop-color="${primary}"/><stop offset="1" stop-color="#11131d"/></linearGradient><linearGradient id="shine" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${secondary}" stop-opacity=".82"/><stop offset="1" stop-color="${accent}" stop-opacity=".16"/></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#bg)"/><circle cx="84%" cy="18%" r="32%" fill="url(#shine)" opacity=".86"/><circle cx="91%" cy="86%" r="28%" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"/><path d="M0 ${safeHeight*.78} Q${safeWidth*.29} ${safeHeight*.47} ${safeWidth*.57} ${safeHeight*.84} T${safeWidth} ${safeHeight*.56} V${safeHeight} H0Z" fill="#090b12" fill-opacity=".7"/><path d="M0 ${safeHeight*.82} Q${safeWidth*.32} ${safeHeight*.52} ${safeWidth*.6} ${safeHeight*.88} T${safeWidth} ${safeHeight*.61}" fill="none" stroke="url(#shine)" stroke-width="${Math.max(8, safeHeight*.016)}" opacity=".9"/><rect x="7%" y="10%" width="3.5%" height="8%" rx="8" fill="${secondary}"/><text x="12%" y="16%" fill="#fff" font-size="${Math.round(safeHeight*.045)}" font-weight="700" letter-spacing="4">${escapeSvgText(label)}</text><g fill="#fff" font-family="Arial, Helvetica, sans-serif" letter-spacing="-2">${titleLines}</g><line x1="8%" y1="83%" x2="34%" y2="83%" stroke="${secondary}" stroke-width="6"/><text x="8%" y="91%" fill="#fff" fill-opacity=".76" font-size="${Math.round(safeHeight*.034)}" font-family="Arial, Helvetica, sans-serif" letter-spacing="3">CRWCTRL  /  CAMPUS EVENTS</text><text x="91%" y="91%" text-anchor="end" fill="#fff" fill-opacity=".9" font-size="${Math.round(safeHeight*.04)}" font-family="Arial, Helvetica, sans-serif" font-weight="700">${escapeSvgText((label.slice(0, 1) || 'C').toUpperCase())}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
};

export const resolveFallbackImageUrl = (text = '', width = 0, height = 0, category = '') => {
    // Keep compact logos, avatars, and tiny thumbnails as simple text placeholders.
    if (Math.min(Number(width) || 0, Number(height) || 0) < 100) return null;
    const key = `${text} ${category}`.toLowerCase();
    if (/trek|hike|mountain|waterfall|fort|trail/.test(key)) return PHOTO_FALLBACKS.trek;
    if (/run|runner|marathon|mile|lap|jog|fitness|running club/.test(key)) return PHOTO_FALLBACKS.run;
    if (/student|campus workshop|classroom/.test(key)) return PHOTO_FALLBACKS.campus;
    if (/^(event|fest|festival|gallery)$/i.test(String(text).trim())) return PHOTO_FALLBACKS.festival;
    return createUniqueFallbackArtwork(text, category, width, height);
};

export const handleImageErrorWithFallback = (event, width, height, backgroundColor, text, textColor = '#ffffff') => {
    const img = event.target;

    // Prevent infinite error loops
    if (img.dataset.fallbackApplied === 'true') {
        return;
    }

    img.dataset.fallbackApplied = 'true';
    const artworkFallback = resolveFallbackImageUrl(text, width, height);
    if (artworkFallback) {
        img.alt = `Illustrative ${String(text || 'event').trim()} artwork`;
        img.src = artworkFallback;
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

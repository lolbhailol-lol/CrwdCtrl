// Image utility functions for handling fallback images and preventing DNS errors

/**
 * Generate a fallback image using canvas instead of via.placeholder.com
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} backgroundColor - Background color (hex)
 * @param {string} textColor - Text color (hex)
 * @param {string} text - Text to display
 * @returns {string} Data URL for the generated image
 */
export const generateFallbackImage = (width, height, backgroundColor = '#6366f1', textColor = '#ffffff', text = 'Image') => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        
        // Fill background
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
        
        // Set text properties
        const fontSize = Math.min(width, height) / 8;
        ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Draw text
        ctx.fillText(text, width / 2, height / 2);
        
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error generating fallback image:', error);
        // Return a minimal data URL if canvas fails
        return `data:image/svg+xml;base64,${btoa(`
            <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                <rect width="100%" height="100%" fill="${backgroundColor}"/>
                <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="${textColor}" font-family="sans-serif" font-size="${Math.min(width, height) / 8}">${text}</text>
            </svg>
        `)}`;
    }
};

/**
 * Create a safe image source with fallback
 * @param {string} originalSrc - Original image source
 * @param {number} width - Fallback image width
 * @param {number} height - Fallback image height
 * @param {string} fallbackText - Text to show in fallback
 * @param {string} backgroundColor - Background color for fallback
 * @returns {string} Safe image source
 */
export const getSafeImageSrc = (originalSrc, width = 300, height = 200, fallbackText = 'Image', backgroundColor = '#6366f1') => {
    // If no original source, return fallback immediately
    if (!originalSrc) {
        return generateFallbackImage(width, height, backgroundColor, '#ffffff', fallbackText);
    }
    
    // Check if the original source is a via.placeholder.com URL
    if (originalSrc.includes('via.placeholder.com')) {
        return generateFallbackImage(width, height, backgroundColor, '#ffffff', fallbackText);
    }
    
    return originalSrc;
};

/**
 * Handle image load error by setting a fallback
 * @param {Event} event - The image load error event
 * @param {number} width - Fallback image width
 * @param {number} height - Fallback image height
 * @param {string} fallbackText - Text to show in fallback
 * @param {string} backgroundColor - Background color for fallback
 */
export const handleImageError = (event, width = 300, height = 200, fallbackText = 'Image', backgroundColor = '#6366f1') => {
    const img = event.target;
    
    // Prevent infinite error loops
    if (img.dataset.fallbackApplied === 'true') {
        return;
    }
    
    img.dataset.fallbackApplied = 'true';
    img.src = generateFallbackImage(width, height, backgroundColor, '#ffffff', fallbackText);
};

/**
 * Preload an image and return a promise
 * @param {string} src - Image source URL
 * @returns {Promise} Promise that resolves with the image or rejects with error
 */
export const preloadImage = (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        
        img.src = src;
    });
};

/**
 * Create a lazy loading image element with fallback
 * @param {string} src - Image source
 * @param {string} alt - Alt text
 * @param {Object} options - Additional options
 * @returns {HTMLImageElement} Image element
 */
export const createLazyImage = (src, alt = '', options = {}) => {
    const {
        width = 300,
        height = 200,
        fallbackText = alt || 'Image',
        backgroundColor = '#6366f1',
        className = '',
        loading = 'lazy'
    } = options;
    
    const img = document.createElement('img');
    
    // Set basic attributes
    img.alt = alt;
    img.loading = loading;
    img.className = className;
    
    // Set safe source
    img.src = getSafeImageSrc(src, width, height, fallbackText, backgroundColor);
    
    // Add error handler
    img.onerror = (event) => handleImageError(event, width, height, fallbackText, backgroundColor);
    
    return img;
};

// Export color constants for consistency
export const FALLBACK_COLORS = {
    PRIMARY: '#6366f1',
    SECONDARY: '#0ea5e9', 
    SUCCESS: '#10b981',
    WARNING: '#f59e0b',
    DANGER: '#ef4444',
    INFO: '#8b5cf6',
    DARK: '#374151',
    LIGHT: '#f3f4f6'
};
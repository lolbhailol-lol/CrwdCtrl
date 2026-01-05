/**
 * Image preprocessing utility for production-safe image handling
 * Ensures all image paths are properly processed for Vite bundling
 */

import { getImageUrl } from './imageImports';

/**
 * Recursively process all image-like properties in an object
 * @param {any} obj - Object to process
 * @returns {any} - Processed object with converted image URLs
 */
export const processImagePaths = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(processImagePaths);
    }

    const processed = {};

    for (const [key, value] of Object.entries(obj)) {
        // Check if this is likely an image property
        if (isImageProperty(key, value)) {
            processed[key] = getImageUrl(value);
        } else if (typeof value === 'object') {
            processed[key] = processImagePaths(value);
        } else {
            processed[key] = value;
        }
    }

    return processed;
};

/**
 * Check if a property is likely to contain an image path
 * @param {string} key - Property name
 * @param {any} value - Property value
 * @returns {boolean} - True if likely an image property
 */
const isImageProperty = (key, value) => {
    if (typeof value !== 'string') return false;

    // Common image property names
    const imagePropertyNames = [
        'image', 'img', 'src', 'photo', 'picture', 'icon', 'logo', 'avatar',
        'heroImage', 'artistImage', 'fallbackImage', 'cardImage', 'thumbnail',
        'galleryImage', 'coverImage', 'backgroundImage', 'profileImage'
    ];

    // Check if key contains any image-related terms
    const keyLower = key.toLowerCase();
    const isImageKey = imagePropertyNames.some(term => keyLower.includes(term));

    // Check if value looks like an image path
    const isImagePath = value.includes('.jpg') || value.includes('.jpeg') ||
        value.includes('.png') || value.includes('.svg') ||
        value.includes('.webp') || value.includes('.gif') ||
        value.startsWith('/src/') || value.startsWith('./') ||
        value.startsWith('../');

    return isImageKey || isImagePath;
};

/**
 * Process event data to ensure all images are production-ready
 * @param {Object} eventData - Event data object
 * @returns {Object} - Processed event data
 */
export const processEventData = (eventData) => {
    return processImagePaths(eventData);
};

/**
 * Process an array of events
 * @param {Array} events - Array of event objects
 * @returns {Array} - Array of processed event objects
 */
export const processEventsArray = (events) => {
    if (!Array.isArray(events)) {
        console.warn('processEventsArray: Expected array, got', typeof events);
        return [];
    }

    return events.map(processEventData);
};

/**
 * Safe image loader with fallback handling
 * @param {string} imagePath - Image path to load
 * @param {Object} options - Options for fallback
 * @returns {string} - Safe image URL
 */
export const safeImageLoad = (imagePath, options = {}) => {
    const {
        fallback = '/placeholder-image.jpg',
        width = 300,
        height = 200,
        text = 'Image'
    } = options;

    try {
        const processedUrl = getImageUrl(imagePath);

        // If processing failed or returned null/undefined, use fallback
        if (!processedUrl || processedUrl === imagePath && imagePath.startsWith('/src/')) {
            console.warn(`Failed to process image: ${imagePath}, using fallback`);
            return getImageUrl(fallback);
        }

        return processedUrl;
    } catch (error) {
        console.error(`Error processing image ${imagePath}:`, error);
        return getImageUrl(fallback);
    }
};

/**
 * Batch process multiple image URLs
 * @param {string[]} imagePaths - Array of image paths
 * @returns {string[]} - Array of processed image URLs
 */
export const batchProcessImages = (imagePaths) => {
    if (!Array.isArray(imagePaths)) {
        return [];
    }

    return imagePaths.map(path => safeImageLoad(path));
};
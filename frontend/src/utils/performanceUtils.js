/**
 * Performance optimization utilities for image loading and component rendering
 */

// Debounce function to limit API calls
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

// Throttle function for scroll events
export const throttle = (func, limit) => {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

// Image preloader with cache
class ImageCache {
    constructor() {
        this.cache = new Map();
        this.loading = new Set();
    }

    async preload(src) {
        if (this.cache.has(src)) {
            return this.cache.get(src);
        }

        if (this.loading.has(src)) {
            return new Promise(resolve => {
                const checkCache = () => {
                    if (this.cache.has(src)) {
                        resolve(this.cache.get(src));
                    } else {
                        setTimeout(checkCache, 10);
                    }
                };
                checkCache();
            });
        }

        this.loading.add(src);

        try {
            const img = new Image();
            return new Promise((resolve, reject) => {
                img.onload = () => {
                    this.cache.set(src, img);
                    this.loading.delete(src);
                    resolve(img);
                };
                img.onerror = () => {
                    this.loading.delete(src);
                    reject(new Error(`Failed to load image: ${src}`));
                };
                img.src = src;
            });
        } catch (error) {
            this.loading.delete(src);
            throw error;
        }
    }

    clear() {
        this.cache.clear();
        this.loading.clear();
    }

    getFromCache(src) {
        return this.cache.get(src);
    }
}

export const imageCache = new ImageCache();

// Intersection Observer for lazy loading
export const createIntersectionObserver = (callback, options = {}) => {
    const defaultOptions = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };

    return new IntersectionObserver(callback, { ...defaultOptions, ...options });
};

// Performance monitoring
export const performanceMonitor = {
    marks: new Map(),

    mark(name) {
        this.marks.set(name, performance.now());
    },

    measure(name, startMark) {
        const startTime = this.marks.get(startMark);
        if (startTime) {
            const duration = performance.now() - startTime;
            console.log(`${name}: ${duration.toFixed(2)}ms`);
            return duration;
        }
        return 0;
    },

    clear() {
        this.marks.clear();
    }
};

// Memory usage tracking
export const memoryMonitor = {
    track() {
        if (performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    },

    log() {
        const memory = this.track();
        if (memory) {
            console.log('Memory Usage:', {
                used: `${(memory.used / 1048576).toFixed(2)} MB`,
                total: `${(memory.total / 1048576).toFixed(2)} MB`,
                limit: `${(memory.limit / 1048576).toFixed(2)} MB`
            });
        }
    }
};

// Clean up functions
export const cleanup = {
    images: () => {
        imageCache.clear();
    },

    performance: () => {
        performanceMonitor.clear();
    },

    all: () => {
        cleanup.images();
        cleanup.performance();
    }
};
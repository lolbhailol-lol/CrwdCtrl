import { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl } from '../utils/imageOptimizer';

/**
 * Optimized image for cards, heroes, and admin-uploaded content.
 * Lazy-loads by default; Cloudinary URLs get retina-ready delivery transforms.
 * Optional shimmer until load to avoid empty aspect-box pop-in.
 */
export default function ContentImage({
    src,
    alt = '',
    preset = 'card',
    className = '',
    loading = 'lazy',
    fetchPriority,
    draggable = false,
    onError,
    onLoad,
    showPlaceholderUntilLoad = false,
    placeholderClassName = 'bg-gray-200 dark:bg-gray-800 animate-pulse',
    ...props
}) {
    const resolved = getImageUrl(src);
    const optimized = optimizeImageUrl(resolved, preset);
    const finalSrc = optimized || resolved;
    const [loaded, setLoaded] = useState(!showPlaceholderUntilLoad || !finalSrc);

    useEffect(() => {
        setLoaded(!showPlaceholderUntilLoad || !finalSrc);
    }, [finalSrc, showPlaceholderUntilLoad]);

    const handleLoad = (e) => {
        setLoaded(true);
        onLoad?.(e);
    };

    const handleError = (e) => {
        setLoaded(true);
        onError?.(e);
    };

    if (!showPlaceholderUntilLoad) {
        return (
            <img
                src={finalSrc}
                alt={alt}
                loading={loading}
                fetchPriority={fetchPriority}
                decoding="async"
                draggable={draggable}
                className={`content-image ${className}`.trim()}
                onError={onError}
                onLoad={onLoad}
                {...props}
            />
        );
    }

    return (
        <>
            {!loaded && (
                <div
                    aria-hidden
                    className={`absolute inset-0 ${placeholderClassName}`}
                />
            )}
            <img
                src={finalSrc}
                alt={alt}
                loading={loading}
                fetchPriority={fetchPriority}
                decoding="async"
                draggable={draggable}
                className={`content-image ${className} ${loaded ? 'opacity-100' : 'opacity-0'}`.trim()}
                onError={handleError}
                onLoad={handleLoad}
                {...props}
            />
        </>
    );
}

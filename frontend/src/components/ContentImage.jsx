import { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl, IMAGE_PRESET_SIZES } from '../utils/imageOptimizer';

/**
 * Optimized image for cards, heroes, and admin-uploaded content.
 * Cloudinary URLs get compact delivery transforms; lazy images are low-priority.
 */
export default function ContentImage({
    src,
    alt = '',
    preset = 'card',
    className = '',
    loading = 'lazy',
    fetchPriority,
    sizes,
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

    const resolvedSizes = sizes || IMAGE_PRESET_SIZES[preset] || undefined;
    const resolvedPriority =
        fetchPriority
        ?? (loading === 'eager' ? 'high' : 'low');

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
                fetchPriority={resolvedPriority}
                sizes={resolvedSizes}
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
                fetchPriority={resolvedPriority}
                sizes={resolvedSizes}
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

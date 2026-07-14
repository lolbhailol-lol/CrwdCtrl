import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl, IMAGE_PRESET_SIZES } from '../utils/imageOptimizer';

const PLACEHOLDER_LIGHT = 'bg-[#E8EAED]';
const PLACEHOLDER_DARK = 'dark:bg-[#1A1B1D]';

/**
 * Optimized image — falls back to the original URL if a Cloudinary transform fails.
 */
const ContentImage = forwardRef(function ContentImage({
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
    placeholderClassName = `${PLACEHOLDER_LIGHT} ${PLACEHOLDER_DARK}`,
    ...props
}, ref) {
    const resolved = getImageUrl(src) || (typeof src === 'string' ? src.trim() : '') || null;
    const optimized = resolved ? optimizeImageUrl(resolved, preset) : null;
    const preferredSrc = optimized || resolved;
    const localRef = useRef(null);
    const [displaySrc, setDisplaySrc] = useState(preferredSrc);
    const [usedFallback, setUsedFallback] = useState(false);
    const [loaded, setLoaded] = useState(!showPlaceholderUntilLoad || !preferredSrc);

    useEffect(() => {
        setDisplaySrc(preferredSrc);
        setUsedFallback(false);
    }, [preferredSrc]);

    const setRefs = useCallback((node) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    const markLoaded = useCallback(() => {
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (!showPlaceholderUntilLoad || !displaySrc) {
            setLoaded(true);
            return;
        }
        setLoaded(false);
        const el = localRef.current;
        if (el?.complete && el.naturalWidth > 0) {
            setLoaded(true);
        }
    }, [displaySrc, showPlaceholderUntilLoad]);

    const handleLoad = (e) => {
        markLoaded();
        onLoad?.(e);
    };

    const handleError = (e) => {
        if (!usedFallback && resolved && displaySrc && displaySrc !== resolved) {
            setUsedFallback(true);
            setDisplaySrc(resolved);
            setLoaded(false);
            return;
        }
        markLoaded();
        onError?.(e);
    };

    const resolvedSizes = sizes || IMAGE_PRESET_SIZES[preset] || undefined;
    const resolvedPriority =
        fetchPriority
        ?? (loading === 'eager' ? 'high' : 'low');

    if (!displaySrc) return null;

    if (!showPlaceholderUntilLoad) {
        return (
            <img
                ref={setRefs}
                src={displaySrc}
                alt={alt}
                loading={loading}
                fetchPriority={resolvedPriority}
                sizes={resolvedSizes}
                decoding="async"
                draggable={draggable}
                className={`content-image ${className}`.trim()}
                onError={handleError}
                onLoad={handleLoad}
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
                ref={setRefs}
                src={displaySrc}
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
});

export default ContentImage;

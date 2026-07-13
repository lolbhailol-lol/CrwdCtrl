import { useState, useEffect, useRef, useCallback, forwardRef } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl, IMAGE_PRESET_SIZES } from '../utils/imageOptimizer';

const PLACEHOLDER_LIGHT = 'bg-[#E8EAED]';
const PLACEHOLDER_DARK = 'dark:bg-[#1A1B1D]';

/**
 * Optimized image — skips flash when the browser already has the file cached.
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
    const resolved = getImageUrl(src);
    const optimized = optimizeImageUrl(resolved, preset);
    const finalSrc = optimized || resolved;
    const localRef = useRef(null);
    const [loaded, setLoaded] = useState(!showPlaceholderUntilLoad || !finalSrc);

    const setRefs = useCallback((node) => {
        localRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
    }, [ref]);

    const markLoaded = useCallback(() => {
        setLoaded(true);
    }, []);

    useEffect(() => {
        if (!showPlaceholderUntilLoad || !finalSrc) {
            setLoaded(true);
            return;
        }
        setLoaded(false);
        const el = localRef.current;
        if (el?.complete && el.naturalWidth > 0) {
            setLoaded(true);
        }
    }, [finalSrc, showPlaceholderUntilLoad]);

    const handleLoad = (e) => {
        markLoaded();
        onLoad?.(e);
    };

    const handleError = (e) => {
        markLoaded();
        onError?.(e);
    };

    const resolvedSizes = sizes || IMAGE_PRESET_SIZES[preset] || undefined;
    const resolvedPriority =
        fetchPriority
        ?? (loading === 'eager' ? 'high' : 'low');

    if (!showPlaceholderUntilLoad) {
        return (
            <img
                ref={setRefs}
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
                ref={setRefs}
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
});

export default ContentImage;

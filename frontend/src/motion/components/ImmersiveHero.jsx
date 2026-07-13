import { useState, useEffect } from 'react';

/**
 * Full-width hero with a gradient overlay. Static, full-bleed image (object-cover)
 * so it always covers edge-to-edge with no scroll-linked movement/gaps.
 */
export default function ImmersiveHero({
    imageSrc,
    imageAlt = '',
    height = '396px',
    overlayClass = 'bg-linear-to-t from-black/70 via-black/20 to-black/30',
    children,
    fallback = null,
    onImageError,
    className = '',
}) {
    const [loaded, setLoaded] = useState(!imageSrc);

    useEffect(() => {
        setLoaded(!imageSrc);
    }, [imageSrc]);

    return (
        <div className={`relative w-full shrink-0 overflow-hidden ${className}`} style={{ height }}>
            {imageSrc ? (
                <>
                    {!loaded && (
                        <div aria-hidden className="absolute inset-0 bg-gray-800 animate-pulse" />
                    )}
                    <img
                        src={imageSrc}
                        alt={imageAlt}
                        className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                            loaded ? 'opacity-100' : 'opacity-0'
                        }`}
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        onLoad={() => setLoaded(true)}
                        onError={(e) => {
                            setLoaded(true);
                            onImageError?.(e);
                        }}
                    />
                </>
            ) : (
                fallback
            )}
            <div className={`absolute inset-0 pointer-events-none ${overlayClass}`} />
            {children}
        </div>
    );
}

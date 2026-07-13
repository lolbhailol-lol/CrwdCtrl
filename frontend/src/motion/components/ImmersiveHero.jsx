import { useState, useEffect, useRef } from 'react';

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
    const imgRef = useRef(null);
    const [loaded, setLoaded] = useState(!imageSrc);

    useEffect(() => {
        if (!imageSrc) {
            setLoaded(true);
            return;
        }
        setLoaded(false);
        const el = imgRef.current;
        if (el?.complete && el.naturalWidth > 0) {
            setLoaded(true);
        }
    }, [imageSrc]);

    return (
        <div className={`relative w-full shrink-0 overflow-hidden ${className}`} style={{ height }}>
            {imageSrc ? (
                <>
                    {!loaded && (
                        <div aria-hidden className="absolute inset-0 bg-[#1A1B1D]" />
                    )}
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt={imageAlt}
                        className={`absolute inset-0 w-full h-full object-cover ${
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

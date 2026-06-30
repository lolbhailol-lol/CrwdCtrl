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
    return (
        <div className={`relative w-full shrink-0 overflow-hidden ${className}`} style={{ height }}>
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt={imageAlt}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={onImageError}
                />
            ) : (
                fallback
            )}
            <div className={`absolute inset-0 pointer-events-none ${overlayClass}`} />
            {children}
        </div>
    );
}

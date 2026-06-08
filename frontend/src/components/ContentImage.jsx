import { getImageUrl } from '../utils/imageImports';
import { optimizeImageUrl } from '../utils/imageOptimizer';

/**
 * Optimized image for cards, heroes, and admin-uploaded content.
 * Lazy-loads by default; Cloudinary URLs get retina-ready delivery transforms.
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
    ...props
}) {
    const resolved = getImageUrl(src);
    const optimized = optimizeImageUrl(resolved, preset);

    return (
        <img
            src={optimized || resolved}
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

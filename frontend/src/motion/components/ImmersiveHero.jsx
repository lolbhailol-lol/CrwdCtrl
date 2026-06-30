import { motion, useScroll, useTransform } from 'framer-motion';
import { useMotionSafe } from '../utils';
import { parallaxImage } from '../variants';

/**
 * Full-width hero with gradient overlay and optional parallax on scroll.
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
    const { reduced } = useMotionSafe();
    const { scrollY } = useScroll();
    const y = useTransform(scrollY, [0, 400], [0, reduced ? 0 : 48]);
    const scale = useTransform(scrollY, [0, 400], [1, reduced ? 1 : 1.06]);

    return (
        <div className={`relative w-full shrink-0 overflow-hidden ${className}`} style={{ height }}>
            {imageSrc ? (
                reduced ? (
                    <img
                        src={imageSrc}
                        alt={imageAlt}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={onImageError}
                    />
                ) : (
                    <motion.div className="absolute -inset-y-16 inset-x-0" style={{ y, scale }}>
                        <motion.img
                            src={imageSrc}
                            alt={imageAlt}
                            className="w-full h-full object-cover"
                            variants={parallaxImage}
                            initial="hidden"
                            animate="visible"
                            onError={onImageError}
                        />
                    </motion.div>
                )
            ) : (
                fallback
            )}
            <div className={`absolute inset-0 pointer-events-none ${overlayClass}`} />
            {children}
        </div>
    );
}

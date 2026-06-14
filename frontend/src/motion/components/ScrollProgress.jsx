import { motion, useScroll, useSpring } from 'framer-motion';
import { BRAND } from '../tokens';
import { useMotionSafe } from '../utils';

/** Thin scroll progress bar — trek/experience detail pages */
export default function ScrollProgress({ className = '' }) {
    const { reduced } = useMotionSafe();
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

    if (reduced) return null;

    return (
        <motion.div
            className={`fixed top-0 left-0 right-0 z-100002 h-[2px] origin-left pointer-events-none ${className}`}
            style={{ scaleX, backgroundColor: BRAND.cyan }}
            aria-hidden="true"
        />
    );
}

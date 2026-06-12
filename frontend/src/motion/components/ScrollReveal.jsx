import { motion } from 'framer-motion';
import { fadeUp } from '../variants';
import { useMotionSafe } from '../utils';

/**
 * Fade-up reveal on scroll — use for page sections.
 * Only animates transform + opacity (60fps safe).
 */
export default function ScrollReveal({
    children,
    className = '',
    delay = 0,
    as = 'div',
    variant = fadeUp,
    ...props
}) {
    const { reduced, viewport, transition } = useMotionSafe();
    const Component = motion[as] || motion.div;

    if (reduced) {
        const Tag = as;
        return <Tag className={className} {...props}>{children}</Tag>;
    }

    return (
        <Component
            className={className}
            variants={variant}
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
            transition={{ ...transition, delay }}
            {...props}
        >
            {children}
        </Component>
    );
}

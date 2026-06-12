import { motion } from 'framer-motion';
import { staggerContainer, fadeUp } from '../variants';
import { useMotionSafe } from '../utils';

/**
 * Stagger children into view — card rows, search results, galleries.
 */
export default function StaggerChildren({
    children,
    className = '',
    stagger = 0.07,
    childVariant = fadeUp,
    as = 'div',
}) {
    const { reduced, viewport } = useMotionSafe();
    const Component = motion[as] || motion.div;

    if (reduced) {
        const Tag = as;
        return <Tag className={className}>{children}</Tag>;
    }

    return (
        <Component
            className={className}
            variants={staggerContainer(stagger)}
            initial="hidden"
            whileInView="visible"
            viewport={viewport}
        >
            {Array.isArray(children)
                ? children.map((child, i) =>
                    child ? (
                        <motion.div key={child.key ?? i} variants={childVariant}>
                            {child}
                        </motion.div>
                    ) : null,
                )
                : children}
        </Component>
    );
}

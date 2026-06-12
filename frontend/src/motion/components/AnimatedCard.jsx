import { motion } from 'framer-motion';
import { cardInteraction } from '../variants';
import { useMotionSafe, cn } from '../utils';

/**
 * Global discovery card wrapper — hover lift, press, image zoom.
 * Wrap existing card markup; preserves click handlers on children.
 */
export default function AnimatedCard({
    children,
    className = '',
    onClick,
    enableHover = true,
    as = 'div',
    ...props
}) {
    const { reduced } = useMotionSafe();
    const Component = motion[as] || motion.div;

    const baseClass = cn('motion-card', className);

    if (reduced || !enableHover) {
        const Tag = as;
        return (
            <Tag className={baseClass} onClick={onClick} {...props}>
                {children}
            </Tag>
        );
    }

    return (
        <Component
            className={baseClass}
            onClick={onClick}
            initial="rest"
            whileHover={enableHover ? 'hover' : undefined}
            whileTap="tap"
            variants={cardInteraction}
            {...props}
        >
            {children}
        </Component>
    );
}

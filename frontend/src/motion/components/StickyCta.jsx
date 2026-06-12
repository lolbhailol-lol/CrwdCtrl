import { motion } from 'framer-motion';
import { stickyCta } from '../variants';
import { useMotionSafe } from '../utils';

/** Fixed bottom CTA with slide-up entrance */
export default function StickyCta({ children, className = '' }) {
    const { reduced } = useMotionSafe();

    if (reduced) {
        return (
            <div
                className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 ${className}`}
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
            >
                {children}
            </div>
        );
    }

    return (
        <motion.div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 ${className}`}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
            variants={stickyCta}
            initial="hidden"
            animate="visible"
        >
            {children}
        </motion.div>
    );
}

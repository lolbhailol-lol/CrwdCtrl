import { motion } from 'framer-motion';
import { bookingBarEnter } from './variants';
import { useTrekMotionSafe } from './utils';

/** Sticky bottom booking CTA — trek detail page only */
export default function StickyBookingBar({ children, className = '' }) {
    const { reduced } = useTrekMotionSafe();

    const shell = (
        <div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 ${className}`}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
        >
            {children}
        </div>
    );

    if (reduced) return shell;

    return (
        <motion.div
            className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 ${className}`}
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
            variants={bookingBarEnter}
            initial="hidden"
            animate="visible"
        >
            {children}
        </motion.div>
    );
}

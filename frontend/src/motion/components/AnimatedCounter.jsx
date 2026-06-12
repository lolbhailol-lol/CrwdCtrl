import { useEffect, useState } from 'react';
import { motion, useSpring, useMotionValueEvent } from 'framer-motion';
import { useMotionSafe } from '../utils';

/** Animated stat counter — run club / community hero stats */
export default function AnimatedCounter({ value = 0, suffix = '', className = '' }) {
    const { reduced } = useMotionSafe();
    const spring = useSpring(reduced ? value : 0, { stiffness: 80, damping: 20 });
    const [display, setDisplay] = useState(value);

    useEffect(() => {
        if (reduced) {
            setDisplay(value);
            return;
        }
        spring.set(value);
    }, [value, spring, reduced]);

    useMotionValueEvent(spring, 'change', (v) => {
        setDisplay(Math.round(v));
    });

    return (
        <motion.span className={className}>
            {display}{suffix}
        </motion.span>
    );
}

import { useReducedMotion } from 'framer-motion';
import { VIEWPORT } from './tokens';

/** Respects prefers-reduced-motion — returns instant transitions when enabled */
export function useMotionSafe() {
    const reduced = useReducedMotion();
    return {
        reduced: Boolean(reduced),
        viewport: reduced ? { once: true, amount: 0.01 } : VIEWPORT,
        transition: reduced ? { duration: 0 } : undefined,
        initial: reduced ? false : undefined,
    };
}

/** GPU-friendly style hints for animated elements */
export const gpuLayer = {
    willChange: 'transform, opacity',
    transform: 'translateZ(0)',
};

/** Merge class names */
export function cn(...parts) {
    return parts.filter(Boolean).join(' ');
}

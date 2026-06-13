import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BootSplashOverlay from '../../components/BootSplashOverlay';
import { DURATION } from '../tokens';
import { BOOT_SPLASH_FADE_MS } from '../../utils/bootSplash';

/**
 * React splash fallback — logo pieces assemble when HTML boot splash is skipped.
 */
export default function SplashScreen({ onComplete, durationMs = DURATION.splash * 1000 }) {
    const [phase, setPhase] = useState('in');

    useEffect(() => {
        const fadeOutAt = durationMs - BOOT_SPLASH_FADE_MS;
        const outTimer = setTimeout(() => setPhase('out'), fadeOutAt);
        const doneTimer = setTimeout(() => {
            setPhase('done');
            onComplete?.();
        }, durationMs);
        return () => {
            clearTimeout(outTimer);
            clearTimeout(doneTimer);
        };
    }, [durationMs, onComplete]);

    return (
        <AnimatePresence mode="wait">
            {phase !== 'done' && (
                <motion.div
                    key="splash"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: phase === 'out' ? 0 : 1 }}
                    transition={{
                        duration: BOOT_SPLASH_FADE_MS / 1000,
                        ease: [0.45, 0, 0.55, 1],
                    }}
                    style={{ pointerEvents: phase === 'out' ? 'none' : 'auto' }}
                >
                    <BootSplashOverlay />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

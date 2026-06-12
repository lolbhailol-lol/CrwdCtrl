import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import BootLogoAssemble from '../../components/BootLogoAssemble';
import { BRAND, DURATION } from '../tokens';
import { BOOT_SPLASH_FADE_MS } from '../../utils/bootSplash';

function getSplashBackground() {
    if (typeof document === 'undefined') return '#ffffff';
    return document.documentElement.classList.contains('dark') ? BRAND.darkBg : '#ffffff';
}

/**
 * React splash fallback — logo pieces assemble when HTML boot splash is skipped.
 */
export default function SplashScreen({ onComplete, durationMs = DURATION.splash * 1000 }) {
    const [phase, setPhase] = useState('in');
    const splashBg = getSplashBackground();
    const isDark = splashBg === BRAND.darkBg;

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
                    className={`boot-splash-screen fixed inset-0 z-[2147483647] flex items-center justify-center ${
                        isDark ? 'boot-splash-screen--dark' : 'boot-splash-screen--light'
                    }`}
                    initial={{ opacity: 1 }}
                    animate={{ opacity: phase === 'out' ? 0 : 1 }}
                    transition={{
                        duration: BOOT_SPLASH_FADE_MS / 1000,
                        ease: [0.45, 0, 0.55, 1],
                    }}
                    role="status"
                    aria-label="Loading CrwdCtrl"
                >
                    <div className="boot-splash-inner boot-splash-inner--large">
                        <BootLogoAssemble />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

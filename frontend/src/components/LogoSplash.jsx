import { useDarkMode } from '../context/DarkModeContext';
import lightLogo from '../assets/crwdctrl-logo-light.png';
import darkLogo from '../assets/loading-image/dark-mode-logo.svg';

const DEFAULT_MARK_PX = 72;

/**
 * Branded loading screen — logo + top progress bar.
 * Compact size keeps it sharp on iOS; auth/route loaders dismiss quickly.
 */
export default function LogoSplash({ size = DEFAULT_MARK_PX, large = false }) {
    const { isDark } = useDarkMode();
    const isMark = !isDark;
    const wordmarkHeight = Math.round(size * 0.9);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center transition-colors duration-200 ${
                isDark ? 'bg-[#161718]' : 'bg-white'
            }`}
            role="status"
            aria-label="Loading CrwdCtrl"
        >
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[2px] overflow-hidden">
                <div className="route-progress-bar h-full bg-[#0ECCEE]" />
            </div>
            <img
                src={isDark ? darkLogo : lightLogo}
                alt="CrwdCtrl"
                width={isMark ? size : undefined}
                height={isMark ? size : wordmarkHeight}
                className={`${isMark ? 'app-splash-mark' : 'app-splash-wordmark'}${large ? ' app-splash-large' : ''}`}
                style={
                    isMark
                        ? { width: size, height: size, maxWidth: size, maxHeight: size }
                        : { height: wordmarkHeight, maxHeight: wordmarkHeight, maxWidth: 'min(280px, 72vw)' }
                }
                draggable={false}
                decoding="sync"
            />
        </div>
    );
}

import { useDarkMode } from '../context/DarkModeContext';
import markLogo from '../assets/crwdctrl-mark.png';
import { LOGO_SOURCE_PX } from '../constants/logo';

const DEFAULT_DISPLAY_PX = 72;
const LARGE_DISPLAY_PX = 152;

/** Branded loading screen — 500×500 source asset, scaled for splash */
export default function LogoSplash({ size = DEFAULT_DISPLAY_PX, large = false }) {
    const { isDark } = useDarkMode();
    const displayPx = large ? LARGE_DISPLAY_PX : size;

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
                src={markLogo}
                alt="CrwdCtrl"
                width={LOGO_SOURCE_PX}
                height={LOGO_SOURCE_PX}
                className={`app-splash-mark app-logo-mark${large ? ' app-splash-large' : ''}`}
                style={{
                    width: displayPx,
                    height: displayPx,
                    maxWidth: displayPx,
                    maxHeight: displayPx,
                }}
                draggable={false}
                decoding="sync"
            />
        </div>
    );
}

import { useDarkMode } from '../context/DarkModeContext';
import markLogo from '../assets/crwdctrl-mark.png';
import { LOGO_SOURCE_PX } from '../constants/logo';

/** Branded loading screen — matches index.html #boot-splash sizing */
export default function LogoSplash({ large = true } = {}) {
    const { isDark } = useDarkMode();

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${
                isDark ? 'bg-[#161718]' : 'bg-white'
            }`}
            role="status"
            aria-label="Loading CrwdCtrl"
        >
            <img
                src={markLogo}
                alt="CrwdCtrl"
                width={LOGO_SOURCE_PX}
                height={LOGO_SOURCE_PX}
                className={`app-splash-mark app-logo-mark${large ? ' app-splash-large' : ''}`}
                draggable={false}
                decoding="sync"
                fetchPriority="high"
            />
        </div>
    );
}

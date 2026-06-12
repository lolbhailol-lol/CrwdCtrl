import { useDarkMode } from '../context/DarkModeContext';
import BootLogoAssemble from './BootLogoAssemble';

/** Branded loading screen — logo pieces assemble, matches index.html #boot-splash */
export default function LogoSplash({ large = true } = {}) {
    const { isDark } = useDarkMode();

    return (
        <div
            className={`boot-splash-screen fixed inset-0 z-50 flex items-center justify-center ${
                isDark ? 'boot-splash-screen--dark' : 'boot-splash-screen--light'
            }`}
            role="status"
            aria-label="Loading CrwdCtrl"
        >
            <div className={`boot-splash-inner${large ? ' boot-splash-inner--large' : ''}`}>
                <BootLogoAssemble />
            </div>
        </div>
    );
}

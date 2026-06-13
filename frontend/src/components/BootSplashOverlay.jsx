import BootLogoAssemble from './BootLogoAssemble';
import { useBootSplashTheme } from '../hooks/useBootSplashTheme';

/**
 * Full-screen boot splash — same slice animation + dark/light bg everywhere.
 * Used by HTML #boot-splash (inline), LogoSplash, AuthLoadingPage, SplashScreen.
 */
export default function BootSplashOverlay({
    large = true,
    className = '',
    role = 'status',
    'aria-label': ariaLabel = 'Loading CrwdCtrl',
    children,
    ...props
}) {
    const isDark = useBootSplashTheme();

    return (
        <div
            className={[
                'boot-splash-screen',
                isDark ? 'boot-splash-screen--dark' : 'boot-splash-screen--light',
                className,
            ].filter(Boolean).join(' ')}
            role={role}
            aria-label={ariaLabel}
            {...props}
        >
            <div className={`boot-splash-inner${large ? ' boot-splash-inner--large' : ''}`}>
                {children ?? <BootLogoAssemble />}
            </div>
        </div>
    );
}

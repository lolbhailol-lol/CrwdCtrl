import BootSplashOverlay from './BootSplashOverlay';

/** Branded loading screen — logo slices assemble, matches index.html #boot-splash */
export default function LogoSplash({ large = true } = {}) {
    return <BootSplashOverlay large={large} />;
}

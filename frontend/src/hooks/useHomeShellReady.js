import { useLayoutEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
    hasHomeShellReadyOnce,
    isHomeHubPath,
    isHomeShellReady,
    resetHomeShellReady,
    setHomeShellReady,
} from '../utils/homeShellReady';

/** True when footer / bottom nav may show on the home hub routes. Call once (AppContent). */
export function useHomeShellReady() {
    const { pathname } = useLocation();
    const onHomeHub = isHomeHubPath(pathname);
    const [ready, setReady] = useState(() => !onHomeHub || isHomeShellReady());

    useLayoutEffect(() => {
        if (!onHomeHub) {
            resetHomeShellReady();
            setReady(true);
            return undefined;
        }

        if (hasHomeShellReadyOnce() || isHomeShellReady()) {
            setHomeShellReady(true);
            setReady(true);
            return undefined;
        }

        setHomeShellReady(false);
        setReady(false);

        const sync = () => setReady(true);
        window.addEventListener('crwdctrl:home-ready', sync);
        // Safety unlock — never leave the app stuck on the home hub loader
        const failSafe = window.setTimeout(() => {
            setHomeShellReady(true);
            setReady(true);
        }, 4000);
        return () => {
            window.removeEventListener('crwdctrl:home-ready', sync);
            window.clearTimeout(failSafe);
        };
    }, [onHomeHub]);

    return !onHomeHub || ready;
}

/** Footer / bottom nav — subscribe only. Must not reset the overlay (that stacked 3× loaders). */
export function useHomeShellReadyValue() {
    const { pathname } = useLocation();
    const onHomeHub = isHomeHubPath(pathname);
    const [ready, setReady] = useState(() => !onHomeHub || isHomeShellReady());

    useLayoutEffect(() => {
        if (!onHomeHub) {
            setReady(true);
            return undefined;
        }

        setReady(isHomeShellReady());
        const sync = () => setReady(true);
        window.addEventListener('crwdctrl:home-ready', sync);
        return () => window.removeEventListener('crwdctrl:home-ready', sync);
    }, [onHomeHub]);

    return !onHomeHub || ready;
}

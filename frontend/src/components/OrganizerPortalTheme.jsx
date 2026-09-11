import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isOrganizerPortalPath } from '../utils/organizerPortalPaths';

function readSavedThemeDark() {
    try {
        const saved = localStorage.getItem('crwdctrl-theme');
        if (saved === 'dark') return true;
        if (saved === 'light') return false;
    } catch {
        /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function syncBootMarkLayers() {
    try {
        const dark = document.documentElement.classList.contains('dark');
        document.querySelectorAll('#boot-splash img.boot-3d-layer[data-mark-light]').forEach((el) => {
            el.src = dark
                ? (el.getAttribute('data-mark-dark') || '/crwdctrl-mark.png')
                : (el.getAttribute('data-mark-light') || '/crwdctrl-mark-light.png');
        });
        const fallback = document.getElementById('boot-fallback');
        if (fallback) {
            fallback.style.background = dark ? '#161718' : '#ffffff';
            fallback.style.color = dark ? '#ffffff' : '#111111';
        }
    } catch {
        /* ignore */
    }
}

/** Organizer portals always use dark theme + dark boot logo, regardless of site light mode. */
export default function OrganizerPortalTheme() {
    const { pathname } = useLocation();
    const forceDark = isOrganizerPortalPath(pathname);

    useEffect(() => {
        const root = document.documentElement;
        if (forceDark) {
            root.dataset.organizerDark = '1';
            root.classList.add('dark');
            syncBootMarkLayers();
            return () => {
                delete root.dataset.organizerDark;
                const restoreDark = readSavedThemeDark();
                root.classList.toggle('dark', restoreDark);
                syncBootMarkLayers();
                try {
                    window.dispatchEvent(new CustomEvent('crwdctrl:theme-restore', {
                        detail: { isDark: restoreDark },
                    }));
                } catch {
                    /* ignore */
                }
            };
        }
        delete root.dataset.organizerDark;
        return undefined;
    }, [forceDark]);

    return null;
}

import { useLayoutEffect, useState } from 'react';
import { getBootSplashIsDark } from '../utils/bootSplash';

/** Theme for boot splash — reads html.dark set by initThemeClass / DarkModeProvider */
export function useBootSplashTheme() {
    const [isDark, setIsDark] = useState(() => getBootSplashIsDark());

    useLayoutEffect(() => {
        setIsDark(getBootSplashIsDark());
        const root = document.documentElement;
        const observer = new MutationObserver(() => {
            setIsDark(getBootSplashIsDark());
        });
        observer.observe(root, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    return isDark;
}

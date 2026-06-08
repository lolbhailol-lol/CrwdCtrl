/** Apply saved/system theme before first paint — matches DarkModeProvider logic */
export function initThemeClass() {
    if (typeof window === 'undefined') return false;

    try {
        const saved = localStorage.getItem('crwdctrl-theme');
        const isDark =
            saved === 'dark' ||
            (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);

        document.documentElement.classList.toggle('dark', isDark);
        return isDark;
    } catch {
        return false;
    }
}

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { flushSync } from 'react-dom';

const DarkModeContext = createContext();

const THEME_SWITCH_MS = 340;

function applyThemeToDocument(isDarkMode) {
    const root = document.documentElement;
    if (root.dataset.organizerDark === '1') {
        root.classList.add('dark');
        return;
    }
    root.classList.toggle('dark', isDarkMode);
    localStorage.setItem('crwdctrl-theme', isDarkMode ? 'dark' : 'light');
}

export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkMode must be used within a DarkModeProvider');
    }
    return context;
};

export const DarkModeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
        }
        return false;
    });

    // Keep document class in sync if isDark ever changes outside toggle
    useEffect(() => {
        applyThemeToDocument(isDark);
    }, [isDark]);

    useEffect(() => {
        const handler = (event) => {
            const next = Boolean(event.detail?.isDark);
            setIsDark(next);
            applyThemeToDocument(next);
        };
        window.addEventListener('crwdctrl:theme-restore', handler);
        return () => window.removeEventListener('crwdctrl:theme-restore', handler);
    }, []);

    const toggleDarkMode = useCallback(() => {
        const root = document.documentElement;
        if (root.dataset.organizerDark === '1') return;
        const nextDark = !root.classList.contains('dark');
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const applyTheme = () => {
            root.classList.add('theme-switching');
            applyThemeToDocument(nextDark);
            flushSync(() => setIsDark(nextDark));
        };

        const finish = () => {
            window.setTimeout(() => root.classList.remove('theme-switching'), THEME_SWITCH_MS);
        };

        if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
            document.startViewTransition(() => {
                applyTheme();
            }).finished.then(finish).catch(finish);
            return;
        }

        applyTheme();
        finish();
    }, []);

    return (
        <DarkModeContext.Provider value={{ isDark, isDarkMode: isDark, toggleDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};

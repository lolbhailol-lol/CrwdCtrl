import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkMode must be used within a DarkModeProvider');
    }
    return context;
};

export const DarkModeProvider = ({ children }) => {
    // Initialize dark mode from localStorage or system preference
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('crwdctrl-theme');
            if (savedTheme) {
                return savedTheme === 'dark';
            }
            // Check system preference
            return window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        return false;
    });

    // Apply dark mode to document and save to localStorage
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('crwdctrl-theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('crwdctrl-theme', 'light');
        }
    }, [isDark]);

    const toggleDarkMode = () => {
        setIsDark(prev => !prev);
    };

    return (
        <DarkModeContext.Provider value={{ isDark, isDarkMode: isDark, toggleDarkMode }}>
            {children}
        </DarkModeContext.Provider>
    );
};
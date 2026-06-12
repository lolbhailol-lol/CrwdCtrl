import React, { createContext, useContext, useState, useEffect } from 'react';

const DarkModeContext = createContext();

export const useDarkMode = () => {
    const context = useContext(DarkModeContext);
    if (!context) {
        throw new Error('useDarkMode must be used within a DarkModeProvider');
    }
    return context;
};

export const DarkModeProvider = ({ children }) => {
    // Sync with html.dark set in index.html inline script (avoids theme flash)
    const [isDark, setIsDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return document.documentElement.classList.contains('dark');
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
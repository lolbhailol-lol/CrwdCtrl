import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext();

export const SidebarProvider = ({ children }) => {
    // Persistent sidebar collapse state for desktop views
    const [isCollapsed, setIsCollapsed] = useState(() => {
        try {
            const saved = localStorage.getItem('crwdctrl_sidebar_collapsed');
            return saved !== null ? JSON.parse(saved) : false;
        } catch {
            return false;
        }
    });

    // Mobile menu drawer state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    useEffect(() => {
        try {
            localStorage.setItem('crwdctrl_sidebar_collapsed', JSON.stringify(isCollapsed));
        } catch (e) {
            console.error('Failed to save sidebar collapse state', e);
        }
    }, [isCollapsed]);

    const toggleCollapse = () => setIsCollapsed((prev) => !prev);
    const toggleMobileMenu = () => setIsMobileMenuOpen((prev) => !prev);
    const closeMobileMenu = () => setIsMobileMenuOpen(false);
    const openMobileMenu = () => setIsMobileMenuOpen(true);

    return (
        <SidebarContext.Provider
            value={{
                isCollapsed,
                setIsCollapsed,
                toggleCollapse,
                isMobileMenuOpen,
                setIsMobileMenuOpen,
                toggleMobileMenu,
                closeMobileMenu,
                openMobileMenu,
            }}
        >
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error('useSidebar must be used within a SidebarProvider');
    }
    return context;
};

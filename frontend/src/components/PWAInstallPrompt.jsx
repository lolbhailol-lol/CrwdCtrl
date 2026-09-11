import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

export default function PWAInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showBanner, setShowBanner] = useState(false);
    const { isDark } = useDarkMode();

    useEffect(() => {
        // Check if already dismissed
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        if (dismissed) {
            const dismissedAt = new Date(dismissed);
            const daysSinceDismissed = (Date.now() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissed < 7) return; // Don't show again for 7 days
        }

        const handler = (e) => {
            if (window.location.pathname.startsWith('/campus-hunt')) {
                return;
            }
            e.preventDefault();
            setDeferredPrompt(e);
            // Show banner after a short delay (don't interrupt initial load)
            setTimeout(() => setShowBanner(true), 3000);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setShowBanner(false);
        }
        if (window.location.pathname.startsWith('/campus-hunt')) {
            return undefined;
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;

        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;

        if (outcome === 'accepted') {
            console.log('✅ PWA installed');
        }

        setDeferredPrompt(null);
        setShowBanner(false);
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa_install_dismissed', new Date().toISOString());
    };

    if (!showBanner) return null;

    return (
        <div className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-50 rounded-2xl shadow-2xl border backdrop-blur-md p-4 transition-all duration-300 animate-in slide-in-from-bottom ${
            isDark
                ? 'bg-gray-900/95 border-gray-700/50 text-white'
                : 'bg-white/95 border-gray-200/50 text-gray-900'
        }`}>
            <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-linear-to-br from-[#007BFF] to-[#00C9A7] shrink-0">
                    <Download className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">Install CrwdCtrl</h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Add to your home screen for a faster, app-like experience.
                    </p>
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={handleInstall}
                            className="px-4 py-1.5 rounded-lg bg-[#007BFF] text-white text-xs font-medium hover:bg-[#0056CC] transition-colors"
                        >
                            Install
                        </button>
                        <button
                            onClick={handleDismiss}
                            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isDark ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                        >
                            Not now
                        </button>
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    className={`p-1 rounded-lg transition-colors ${
                        isDark ? 'hover:bg-gray-800 text-gray-500' : 'hover:bg-gray-100 text-gray-400'
                    }`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

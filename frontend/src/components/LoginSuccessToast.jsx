import { CheckCircle2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../context/DarkModeContext';

export default function LoginSuccessToast({ visible, message = 'Logged in successfully!' }) {
    const { isDark } = useDarkMode();

    if (!visible || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed left-1/2 top-[max(1rem,var(--safe-top))] z-[10001] -translate-x-1/2 pointer-events-none transition-opacity duration-300"
            role="status"
            aria-live="polite"
        >
            <div
                className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 shadow-lg border ${
                    isDark
                        ? 'bg-[#111213] border-[#0ECCEE]/30 text-white'
                        : 'bg-white border-[#0ECCEE]/40 text-gray-900'
                }`}
            >
                <CheckCircle2 className="w-5 h-5 text-[#0ECCEE] shrink-0" aria-hidden />
                <span className="text-sm font-medium font-inter">{message}</span>
            </div>
        </div>,
        document.body,
    );
}

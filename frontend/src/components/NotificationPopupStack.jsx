import { Bell, CheckCircle2, LogIn, Ticket, CreditCard, ScanLine, Clock } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useDarkMode } from '../context/DarkModeContext';

const TONE_STYLES = {
    login: {
        icon: LogIn,
        iconClass: 'text-[#0ECCEE]',
        bgClass: 'bg-[#0ECCEE]/15',
        borderClass: 'border-[#0ECCEE]/30',
    },
    registration: {
        icon: Ticket,
        iconClass: 'text-green-500',
        bgClass: 'bg-green-500/15',
        borderClass: 'border-green-500/30',
    },
    payment: {
        icon: CreditCard,
        iconClass: 'text-emerald-500',
        bgClass: 'bg-emerald-500/15',
        borderClass: 'border-emerald-500/30',
    },
    checkin: {
        icon: ScanLine,
        iconClass: 'text-[#0ECCEE]',
        bgClass: 'bg-[#0ECCEE]/15',
        borderClass: 'border-[#0ECCEE]/30',
    },
    reminder: {
        icon: Clock,
        iconClass: 'text-amber-500',
        bgClass: 'bg-amber-500/15',
        borderClass: 'border-amber-500/30',
    },
    success: {
        icon: CheckCircle2,
        iconClass: 'text-green-500',
        bgClass: 'bg-green-500/15',
        borderClass: 'border-green-500/30',
    },
    info: {
        icon: Bell,
        iconClass: 'text-[#0ECCEE]',
        bgClass: 'bg-[#0ECCEE]/15',
        borderClass: 'border-[#0ECCEE]/25',
    },
};

function PopupIcon({ tone }) {
    const style = TONE_STYLES[tone] || TONE_STYLES.info;
    const Icon = style.icon;
    return (
        <div className={`mt-0.5 shrink-0 rounded-full p-1.5 ${style.bgClass}`}>
            <Icon className={`w-4 h-4 ${style.iconClass}`} aria-hidden />
        </div>
    );
}

export default function NotificationPopupStack({ items = [], onDismiss, onOpen }) {
    const { isDark } = useDarkMode();

    if (!items.length || typeof document === 'undefined') return null;

    return createPortal(
        <div
            className="fixed right-3 sm:right-4 top-[max(4.5rem,calc(env(safe-area-inset-top)_+_3.5rem))] z-[10000] flex flex-col gap-2 w-[min(100vw_-_1.5rem,_22rem)] pointer-events-none"
            aria-live="polite"
        >
            {items.map((item) => {
                const tone = item.tone || 'info';
                const style = TONE_STYLES[tone] || TONE_STYLES.info;
                return (
                    <div
                        key={item.id}
                        className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-lg transition-all duration-300 ${
                            isDark
                                ? `bg-[#111213] ${style.borderClass} text-white`
                                : `bg-white border-gray-200 text-gray-900`
                        }`}
                    >
                        <PopupIcon tone={tone} />
                        <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => onOpen?.(item)}
                        >
                            <p className="text-sm font-semibold leading-snug line-clamp-2">{item.title}</p>
                            {item.message ? (
                                <p className={`mt-0.5 text-xs leading-relaxed line-clamp-3 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {item.message}
                                </p>
                            ) : null}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDismiss?.(item.id)}
                            className={`shrink-0 rounded-md p-1 text-lg leading-none ${isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'}`}
                            aria-label="Dismiss notification"
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>,
        document.body,
    );
}

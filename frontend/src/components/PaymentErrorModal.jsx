import React from 'react';
import { AlertCircle, RefreshCw, LifeBuoy, X } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

const SUPPORT_EMAIL = 'crwdctrl.in@gmail.com';

/**
 * Friendly payment-failure fallback with Retry + Contact Support.
 * Controlled by the booking pages' checkout catch blocks.
 */
export default function PaymentErrorModal({
    open,
    message,
    orderId,
    onRetry,
    onClose,
}) {
    const { isDark } = useDarkMode();
    if (!open) return null;

    const supportHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        'CrwdCtrl payment issue',
    )}&body=${encodeURIComponent(
        `I had trouble completing a payment.${orderId ? `\n\nOrder ID: ${orderId}` : ''}\n\nPlease describe what happened:`,
    )}`;

    return (
        <div className="fixed inset-0 z-100020 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div
                role="dialog"
                aria-modal="true"
                className={`relative w-full max-w-sm rounded-2xl p-5 shadow-2xl ${
                    isDark ? 'bg-[#161718] text-white' : 'bg-white text-gray-900'
                }`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className={`absolute top-3 right-3 p-1.5 rounded-full ${
                        isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                    }`}
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-3">
                    <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDark ? 'bg-amber-500/15' : 'bg-amber-100'}`}>
                        <AlertCircle className="w-6 h-6 text-amber-500" />
                    </div>
                </div>

                <h3 className="text-lg font-semibold text-center">Payment unsuccessful</h3>
                <p className={`text-sm text-center mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                    {message || 'Your payment didn’t go through. Please try again.'}
                </p>

                <div className="flex flex-col gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onRetry}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 text-black transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Retry payment
                    </button>
                    <a
                        href={supportHref}
                        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-medium transition-colors ${
                            isDark
                                ? 'bg-[#111213] border border-gray-800 hover:bg-gray-800 text-white'
                                : 'bg-gray-50 border border-gray-200 hover:bg-gray-100 text-gray-900'
                        }`}
                    >
                        <LifeBuoy className="w-4 h-4" />
                        Contact support
                    </a>
                </div>
            </div>
        </div>
    );
}

import React from 'react';
import { AlertTriangle } from 'lucide-react';

/**
 * Presentational confirm/alert dialog. Controlled by DialogContext.
 */
export default function ConfirmDialog({
    open,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    tone = 'default',
    hideCancel = false,
    isDark = false,
    onConfirm,
    onCancel,
}) {
    if (!open) return null;

    const isDanger = tone === 'danger';

    return (
        <div className="fixed inset-0 z-100020 flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onCancel}
            />
            <div
                role="dialog"
                aria-modal="true"
                className={`relative w-full max-w-sm rounded-2xl p-5 shadow-2xl ${
                    isDark ? 'bg-[#161718] text-white' : 'bg-white text-gray-900'
                }`}
            >
                {isDanger && (
                    <div className="flex justify-center mb-3">
                        <div className={`flex items-center justify-center w-12 h-12 rounded-full ${isDark ? 'bg-red-500/15' : 'bg-red-100'}`}>
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    </div>
                )}

                {title && (
                    <h3 className={`text-lg font-semibold text-center ${isDanger ? '' : ''}`}>
                        {title}
                    </h3>
                )}
                {message && (
                    <p className={`text-sm text-center mt-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                        {message}
                    </p>
                )}

                <div className="flex gap-3 mt-5">
                    {!hideCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className={`flex-1 py-2.5 rounded-xl font-medium transition-colors ${
                                isDark
                                    ? 'bg-[#111213] border border-gray-800 hover:bg-gray-800'
                                    : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            {cancelText}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onConfirm}
                        className={`flex-1 py-2.5 rounded-xl font-semibold transition-colors ${
                            isDanger
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-[#0ECCEE] hover:bg-[#0ECCEE]/90 text-black'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

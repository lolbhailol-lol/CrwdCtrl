import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useDarkMode } from './DarkModeContext';
import ConfirmDialog from '../components/ConfirmDialog';

const DialogContext = createContext(null);

/**
 * App-wide styled dialogs + toasts, replacing native alert()/confirm().
 *  - confirm(opts) -> Promise<boolean>
 *  - alert(opts)   -> Promise<void>
 *  - toast(message, { duration }) -> shows a transient toast
 */
export function useDialog() {
    const ctx = useContext(DialogContext);
    if (!ctx) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return ctx;
}

let toastSeq = 0;

export function DialogProvider({ children }) {
    const { isDark } = useDarkMode();
    const [dialog, setDialog] = useState(null);
    const [toasts, setToasts] = useState([]);
    const resolverRef = useRef(null);

    const closeDialog = useCallback((result) => {
        setDialog(null);
        const resolve = resolverRef.current;
        resolverRef.current = null;
        resolve?.(result);
    }, []);

    const confirm = useCallback((opts = {}) => {
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({
                title: opts.title || 'Are you sure?',
                message: opts.message || '',
                confirmText: opts.confirmText || 'Confirm',
                cancelText: opts.cancelText || 'Cancel',
                tone: opts.tone || 'default',
                hideCancel: false,
            });
        });
    }, []);

    const alert = useCallback((opts = {}) => {
        return new Promise((resolve) => {
            resolverRef.current = () => resolve();
            setDialog({
                title: opts.title || '',
                message: opts.message || '',
                confirmText: opts.confirmText || 'OK',
                tone: opts.tone || 'default',
                hideCancel: true,
            });
        });
    }, []);

    const toast = useCallback((message, { duration = 2600 } = {}) => {
        if (!message) return;
        const id = ++toastSeq;
        setToasts((prev) => [...prev, { id, message }]);
        window.setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
    }, []);

    return (
        <DialogContext.Provider value={{ confirm, alert, toast }}>
            {children}

            <ConfirmDialog
                open={!!dialog}
                title={dialog?.title}
                message={dialog?.message}
                confirmText={dialog?.confirmText}
                cancelText={dialog?.cancelText}
                tone={dialog?.tone}
                hideCancel={dialog?.hideCancel}
                isDark={isDark}
                onConfirm={() => closeDialog(true)}
                onCancel={() => closeDialog(false)}
            />

            {toasts.length > 0 && (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-100030 flex flex-col items-center gap-2 px-4 w-full max-w-sm pointer-events-none">
                    {toasts.map((t) => (
                        <div
                            key={t.id}
                            className={`pointer-events-auto w-full text-center text-sm font-medium px-4 py-3 rounded-xl shadow-lg ${
                                isDark ? 'bg-[#1D1E20] text-white border border-gray-800' : 'bg-gray-900 text-white'
                            }`}
                        >
                            {t.message}
                        </div>
                    ))}
                </div>
            )}
        </DialogContext.Provider>
    );
}

export default DialogProvider;

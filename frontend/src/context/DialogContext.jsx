import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useDarkMode } from './DarkModeContext';
import ConfirmDialog from '../components/ConfirmDialog';

const DialogContext = createContext(null);
const TOAST_DURATION_MS = 1000;

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
    const [toast, setToast] = useState(null);
    const resolverRef = useRef(null);
    const toastTimerRef = useRef(null);

    const closeDialog = useCallback((result) => {
        setDialog(null);
        const resolve = resolverRef.current;
        resolverRef.current = null;
        resolve?.(result);
    }, []);

    const confirm = useCallback((opts = {}) => {
        const config = typeof opts === 'string' ? { message: opts } : opts;
        return new Promise((resolve) => {
            resolverRef.current = resolve;
            setDialog({
                title: config.title || 'Are you sure?',
                message: config.message || '',
                confirmText: config.confirmText || 'Confirm',
                cancelText: config.cancelText || 'Cancel',
                tone: config.tone || 'default',
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

    const showToast = useCallback((message, { duration = TOAST_DURATION_MS } = {}) => {
        if (!message) return;
        const id = ++toastSeq;

        if (toastTimerRef.current) {
            window.clearTimeout(toastTimerRef.current);
            toastTimerRef.current = null;
        }

        setToast({ id, message });

        toastTimerRef.current = window.setTimeout(() => {
            setToast((current) => (current?.id === id ? null : current));
            toastTimerRef.current = null;
        }, duration);
    }, []);

    return (
        <DialogContext.Provider value={{ confirm, alert, toast: showToast }}>
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

            {toast ? (
                <div className="fixed left-1/2 -translate-x-1/2 bottom-[calc(var(--safe-bottom)+5rem)] z-100030 px-4 w-full max-w-sm pointer-events-none">
                    <div
                        key={toast.id}
                        className={`app-toast-flash w-full text-center text-sm font-medium px-4 py-3 rounded-xl shadow-lg ${
                            isDark ? 'bg-[#1D1E20] text-white border border-gray-800' : 'bg-gray-900 text-white'
                        }`}
                    >
                        {toast.message}
                    </div>
                </div>
            ) : null}
        </DialogContext.Provider>
    );
}

export default DialogProvider;

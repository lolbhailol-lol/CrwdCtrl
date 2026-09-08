import { useEffect, useRef } from 'react';
import { isInAppBrowser } from '../config/apiBase';

/** One timer — never leave a full-screen 3D loader spinning forever. */
export function useDetailLoaderFailsafe(isLoading, onGiveUp) {
    const cbRef = useRef(onGiveUp);
    cbRef.current = onGiveUp;

    useEffect(() => {
        if (!isLoading) return undefined;
        const ms = isInAppBrowser() ? 8000 : 12000;
        const timer = window.setTimeout(() => {
            cbRef.current?.();
        }, ms);
        return () => window.clearTimeout(timer);
    }, [isLoading]);
}

import { useLayoutEffect } from 'react';
import { setHomeShellReady } from '../utils/homeShellReady';

/** Hides footer / bottom nav via body.page-content-loading while page data loads */
export function usePageContentLoading(isLoading) {
    useLayoutEffect(() => {
        if (!isLoading) {
            document.body.classList.remove('page-content-loading');
            return undefined;
        }
        document.body.classList.add('page-content-loading');
        return () => document.body.classList.remove('page-content-loading');
    }, [isLoading]);
}

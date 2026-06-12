import { useEffect } from 'react';

/** Hides footer / bottom nav via body.page-content-loading while page data loads */
export function usePageContentLoading(isLoading) {
    useEffect(() => {
        if (!isLoading) return undefined;
        document.body.classList.add('page-content-loading');
        return () => document.body.classList.remove('page-content-loading');
    }, [isLoading]);
}

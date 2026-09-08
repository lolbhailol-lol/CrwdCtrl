import { lazy } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from './chunkError';

/** Lazy route import with one automatic reload on stale chunk errors after deploy */
export function lazyWithRetry(importFn) {
    return lazy(async () => {
        try {
            return await importFn();
        } catch (error) {
            if (isChunkLoadError(error) && reloadOnceForChunkError()) {
                // Reload kicked off — wait briefly, then fail (never hang Suspense forever
                // in WhatsApp / in-app browsers where reload can be ignored).
                await new Promise((resolve) => setTimeout(resolve, 4000));
            }
            throw error;
        }
    });
}

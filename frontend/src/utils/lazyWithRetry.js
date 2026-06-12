import { lazy } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from './chunkError';

/** Lazy route import with one automatic reload on stale chunk errors after deploy */
export function lazyWithRetry(importFn) {
    return lazy(async () => {
        try {
            return await importFn();
        } catch (error) {
            if (isChunkLoadError(error) && reloadOnceForChunkError()) {
                return new Promise(() => {});
            }
            throw error;
        }
    });
}

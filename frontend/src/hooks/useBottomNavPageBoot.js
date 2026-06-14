import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SKELETON_LOADING_MS } from '../constants/skeletonLoading';
import { usePageContentLoading } from './usePageContentLoading';

/** @deprecated Use SKELETON_LOADING_MS from constants/skeletonLoading */
export const BOTTOM_NAV_PAGE_BOOT_MS = SKELETON_LOADING_MS;

/**
 * Optional hook for bottom-nav pages that need to keep chrome hidden while
 * real data is still loading. Route skeleton timing is handled globally by
 * PageTransition (SKELETON_LOADING_MS).
 */
export function useBottomNavPageBoot(extraLoading = false) {
    const { key: locationKey } = useLocation();
    const [bootLoading, setBootLoading] = useState(false);

    useEffect(() => {
        if (!extraLoading) {
            setBootLoading(false);
            return undefined;
        }
        setBootLoading(true);
        return () => setBootLoading(false);
    }, [locationKey, extraLoading]);

    const isPageLoading = bootLoading && extraLoading;
    usePageContentLoading(isPageLoading);
    return isPageLoading;
}

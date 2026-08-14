import { invalidateCatalogCache } from '../services/api/catalogCache';

const TREKS_PAGE_SESSION_KEY = 'crwdctrl_treks_page_v1';
const PUBLIC_CONFIG_LOCAL_KEY = 'crwdctrl_public_config_v1';

/**
 * After admin priority / section edits: drop catalog + treks session cache
 * and notify open public tabs (same tab + cross-tab).
 */
export function notifyAdminDataUpdated() {
    invalidateCatalogCache();
    try {
        sessionStorage.removeItem(TREKS_PAGE_SESSION_KEY);
    } catch {
        /* ignore */
    }
    try {
        localStorage.removeItem(PUBLIC_CONFIG_LOCAL_KEY);
    } catch {
        /* ignore */
    }
    try {
        localStorage.setItem('admin_data_updated', Date.now().toString());
        setTimeout(() => {
            try {
                localStorage.removeItem('admin_data_updated');
            } catch {
                /* ignore */
            }
        }, 1000);
    } catch {
        /* ignore */
    }
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('admin_data_updated'));
    }
}

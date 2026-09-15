import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'trek_organizer_session',
    memoryKey: '__trekOrganizerSession',
});

const MANUAL_LOGOUT_KEY = 'crwdctrl_trek_organizer_manual_logout';
const MANUAL_LOGOUT_MEMORY = '__trekOrganizerManualLogout';

function readManualLogout() {
    try {
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(MANUAL_LOGOUT_KEY) === '1') {
            return true;
        }
    } catch {
        /* ignore */
    }
    try {
        if (typeof localStorage !== 'undefined' && localStorage.getItem(MANUAL_LOGOUT_KEY) === '1') {
            return true;
        }
    } catch {
        /* ignore */
    }
    if (typeof window !== 'undefined' && window[MANUAL_LOGOUT_MEMORY]) return true;
    return false;
}

function writeManualLogout(on) {
    if (typeof window !== 'undefined') {
        window[MANUAL_LOGOUT_MEMORY] = on ? true : null;
    }
    const stores = [];
    try {
        if (typeof sessionStorage !== 'undefined') stores.push(sessionStorage);
    } catch {
        /* ignore */
    }
    try {
        if (typeof localStorage !== 'undefined') stores.push(localStorage);
    } catch {
        /* ignore */
    }
    stores.forEach((store) => {
        try {
            if (on) store.setItem(MANUAL_LOGOUT_KEY, '1');
            else store.removeItem(MANUAL_LOGOUT_KEY);
        } catch {
            /* ignore */
        }
    });
}

export const getTrekOrganizerSession = session.get;
export const getTrekOrganizerToken = session.token;
export const isTrekOrganizerTokenExpired = session.isExpired;
export const clearTrekOrganizerSession = session.clear;

export function clearTrekOrganizerManualLogout() {
    writeManualLogout(false);
}

export function setTrekOrganizerSession(value) {
    if (value?.token) clearTrekOrganizerManualLogout();
    session.set(value);
}

/** Call on explicit Log out so Firebase app-session does not immediately re-open the portal. */
export function markTrekOrganizerLoggedOut() {
    writeManualLogout(true);
    clearTrekOrganizerSession();
}

export function isTrekOrganizerManualLogout() {
    return readManualLogout();
}

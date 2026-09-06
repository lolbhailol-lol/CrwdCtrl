import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'run_club_organizer_session',
    memoryKey: '__runClubOrganizerSession',
});

export const getRunClubOrganizerSession = session.get;
export const getRunClubOrganizerToken = session.token;
export const isRunClubOrganizerTokenExpired = session.isExpired;

const MANUAL_LOGOUT_KEY = 'crwdctrl_organizer_manual_logout';
const MANUAL_LOGOUT_MEMORY = '__runClubOrganizerManualLogout';

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

export function clearRunClubOrganizerManualLogout() {
    writeManualLogout(false);
}

export function setRunClubOrganizerSession(value) {
    if (value?.token) clearRunClubOrganizerManualLogout();
    session.set(value);
}

export const clearRunClubOrganizerSession = session.clear;

export function markRunClubOrganizerLoggedOut() {
    writeManualLogout(true);
    clearRunClubOrganizerSession();
}

export function isRunClubOrganizerManualLogout() {
    return readManualLogout();
}

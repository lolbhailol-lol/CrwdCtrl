import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'run_club_organizer_session',
    memoryKey: '__runClubOrganizerSession',
});

export const getRunClubOrganizerSession = session.get;
export const getRunClubOrganizerToken = session.token;
export const isRunClubOrganizerTokenExpired = session.isExpired;

const MANUAL_LOGOUT_KEY = 'crwdctrl_organizer_manual_logout';

export function clearRunClubOrganizerManualLogout() {
    try {
        sessionStorage.removeItem(MANUAL_LOGOUT_KEY);
    } catch {
        /* ignore */
    }
}

export function setRunClubOrganizerSession(value) {
    if (value?.token) clearRunClubOrganizerManualLogout();
    session.set(value);
}

export const clearRunClubOrganizerSession = session.clear;

export function markRunClubOrganizerLoggedOut() {
    try {
        sessionStorage.setItem(MANUAL_LOGOUT_KEY, '1');
    } catch {
        /* ignore */
    }
    clearRunClubOrganizerSession();
}

export function isRunClubOrganizerManualLogout() {
    try {
        return sessionStorage.getItem(MANUAL_LOGOUT_KEY) === '1';
    } catch {
        return false;
    }
}

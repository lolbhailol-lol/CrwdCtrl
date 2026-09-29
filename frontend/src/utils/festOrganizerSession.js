import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'fest_organizer_session',
    memoryKey: '__festOrganizerSession',
});

export const getFestOrganizerSession = session.get;
export const setFestOrganizerSession = session.set;
export function clearFestOrganizerSession(...args) {
    try {
        Object.keys(sessionStorage)
            .filter((key) => key.startsWith('fo-view:'))
            .forEach((key) => sessionStorage.removeItem(key));
    } catch { /* storage unavailable */ }
    return session.clear(...args);
}
export const getFestOrganizerToken = session.token;
export const isFestOrganizerTokenExpired = session.isExpired;

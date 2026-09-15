import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'fest_organizer_session',
    memoryKey: '__festOrganizerSession',
});

export const getFestOrganizerSession = session.get;
export const setFestOrganizerSession = session.set;
export const clearFestOrganizerSession = session.clear;
export const getFestOrganizerToken = session.token;
export const isFestOrganizerTokenExpired = session.isExpired;

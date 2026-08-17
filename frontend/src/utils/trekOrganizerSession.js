import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'trek_organizer_session',
    memoryKey: '__trekOrganizerSession',
});

export const getTrekOrganizerSession = session.get;
export const setTrekOrganizerSession = session.set;
export const clearTrekOrganizerSession = session.clear;
export const getTrekOrganizerToken = session.token;
export const isTrekOrganizerTokenExpired = session.isExpired;

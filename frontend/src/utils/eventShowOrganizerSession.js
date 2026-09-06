import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'event_organizer_session',
    memoryKey: '__eventOrganizerSession',
});

export const getEventOrganizerSession = session.get;
export const setEventOrganizerSession = session.set;
export const clearEventOrganizerSession = session.clear;
export const getEventOrganizerToken = session.token;
export const isEventOrganizerTokenExpired = session.isExpired;

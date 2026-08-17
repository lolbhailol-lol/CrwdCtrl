import { createPortalSession } from './portalSessionFactory.js';

const session = createPortalSession({
    storageKey: 'run_club_organizer_session',
    memoryKey: '__runClubOrganizerSession',
});

export const getRunClubOrganizerSession = session.get;
export const setRunClubOrganizerSession = session.set;
export const clearRunClubOrganizerSession = session.clear;
export const getRunClubOrganizerToken = session.token;
export const isRunClubOrganizerTokenExpired = session.isExpired;

const SESSION_KEY = 'run_club_organizer_session';

export function getRunClubOrganizerSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setRunClubOrganizerSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearRunClubOrganizerSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function getRunClubOrganizerToken() {
    return getRunClubOrganizerSession()?.token || '';
}

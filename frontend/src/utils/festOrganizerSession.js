const SESSION_KEY = 'fest_organizer_session';

export function getFestOrganizerSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setFestOrganizerSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearFestOrganizerSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function getFestOrganizerToken() {
    return getFestOrganizerSession()?.token || '';
}

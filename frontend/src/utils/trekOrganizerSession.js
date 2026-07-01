const SESSION_KEY = 'trek_organizer_session';

export function getTrekOrganizerSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function setTrekOrganizerSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearTrekOrganizerSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function getTrekOrganizerToken() {
    return getTrekOrganizerSession()?.token || '';
}

import { getApiBaseUrl } from '../../config/apiBase';
import { getRunClubOrganizerToken, clearRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';

const API = getApiBaseUrl();

function handleOrganizerUnauthorized() {
    clearRunClubOrganizerSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/run-club-organizer/login')) {
        window.location.assign('/run-club-organizer/login');
    }
}

async function runClubOrganizerFetch(path, options = {}) {
    const token = getRunClubOrganizerToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
        handleOrganizerUnauthorized();
        throw new Error(data.message || 'Session expired');
    }
    if (!res.ok) {
        throw new Error(data.message || 'Request failed');
    }
    return data;
}

export async function runClubOrganizerLogin(username, password) {
    return runClubOrganizerFetch('/run-club-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function fetchRunClubOrganizerMe() {
    return runClubOrganizerFetch('/run-club-organizer/me');
}

export async function fetchRunClubOrganizerDashboard(eventId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/dashboard`);
}

export async function fetchRunClubOrganizerParticipants(eventId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants?${qs}`);
}

export async function fetchRunClubOrganizerParticipant(eventId, bookingId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}`);
}

export async function lookupRunClubOrganizerParticipant(eventId, q) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/lookup?q=${encodeURIComponent(q)}`);
}

export async function exportRunClubOrganizerParticipants(eventId) {
    const token = getRunClubOrganizerToken();
    const res = await fetch(`${API}/run-club-organizer/events/${eventId}/participants/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
        handleOrganizerUnauthorized();
        throw new Error('Session expired');
    }
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
}

export async function runClubOrganizerCheckin(eventId, payload) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/checkin`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchRunClubOrganizerCheckinStats(eventId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/checkin/stats`);
}

export async function resendRunClubOrganizerConfirmation(eventId, bookingId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}/resend-confirmation`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function deleteRunClubOrganizerParticipant(eventId, bookingId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}`, {
        method: 'DELETE',
    });
}

export async function sendRunClubOrganizerReminder(eventId, body) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/notifications/reminder`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function broadcastRunClubOrganizerAnnouncement(eventId, body) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/notifications/broadcast`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

import { getApiBaseUrl } from '../../config/apiBase';
import { getTrekOrganizerToken, clearTrekOrganizerSession } from '../../utils/trekOrganizerSession';

const API = getApiBaseUrl();

function handleOrganizerUnauthorized() {
    clearTrekOrganizerSession();
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/trek-organizer/login')) {
        window.location.assign('/trek-organizer/login');
    }
}

async function trekOrganizerFetch(path, options = {}) {
    const token = getTrekOrganizerToken();
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

export async function trekOrganizerLogin(username, password) {
    return trekOrganizerFetch('/trek-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function fetchTrekOrganizerMe() {
    return trekOrganizerFetch('/trek-organizer/me');
}

export async function fetchTrekOrganizerDashboard(trekId) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/dashboard`);
}

export async function updateTrekOrganizerRegistration(trekId, body) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/registration`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function fetchTrekOrganizerParticipants(trekId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants?${qs}`);
}

export async function fetchTrekOrganizerParticipant(trekId, bookingId) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/${bookingId}`);
}

export async function lookupTrekOrganizerParticipant(trekId, q) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/lookup?q=${encodeURIComponent(q)}`);
}

export async function exportTrekOrganizerParticipants(trekId) {
    const token = getTrekOrganizerToken();
    const res = await fetch(`${API}/trek-organizer/treks/${trekId}/participants/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
        handleOrganizerUnauthorized();
        throw new Error('Session expired');
    }
    if (!res.ok) throw new Error('Export failed');
    return res.blob();
}

export async function trekOrganizerCheckin(trekId, payload) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/checkin`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchTrekOrganizerCheckinStats(trekId) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/checkin/stats`);
}

export async function resendTrekOrganizerConfirmation(trekId, bookingId) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/${bookingId}/resend-confirmation`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function deleteTrekOrganizerParticipant(trekId, bookingId) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/${bookingId}`, {
        method: 'DELETE',
    });
}

export async function sendTrekOrganizerReminder(trekId, body) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/notifications/reminder`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function sendTrekOrganizerParticipantMessage(trekId, body) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/message`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function broadcastTrekOrganizerAnnouncement(trekId, body) {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/notifications/broadcast`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

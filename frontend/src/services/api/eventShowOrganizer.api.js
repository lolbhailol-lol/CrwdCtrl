import { getApiBaseUrl } from '../../config/apiBase';
import {
    getEventOrganizerToken,
    clearEventOrganizerSession,
    setEventOrganizerSession,
    isEventOrganizerTokenExpired,
} from '../../utils/eventShowOrganizerSession';

const API = getApiBaseUrl();

function handleUnauthorized() {
    clearEventOrganizerSession();
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/event-organizer/login')) return;
    window.location.href = `/event-organizer/login?from=${encodeURIComponent(path)}`;
}

async function eventOrganizerFetch(path, options = {}) {
    const token = getEventOrganizerToken();
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, {
        ...options,
        headers,
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
        handleUnauthorized();
        throw new Error(data.message || 'Session expired — please sign in again');
    }
    if (!res.ok) {
        throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
}

export async function eventOrganizerLogin(username, password) {
    const data = await eventOrganizerFetch('/event-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    if (data?.token) {
        setEventOrganizerSession({
            token: data.token,
            organizer: data.organizer,
            events: data.events || [],
        });
    }
    return data;
}

export async function fetchEventOrganizerMe() {
    return eventOrganizerFetch('/event-organizer/me');
}

export async function fetchEventOrganizerEvents() {
    return eventOrganizerFetch('/event-organizer/events');
}

export async function fetchEventOrganizerEvent(eventId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}`);
}

export async function fetchEventOrganizerDashboard(eventId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/dashboard`);
}

export async function setEventOrganizerRegistrationStatus(eventId, status) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/registration-status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
    });
}

export async function fetchEventOrganizerParticipants(eventId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const q = qs.toString();
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants${q ? `?${q}` : ''}`);
}

export async function fetchEventOrganizerParticipant(eventId, registrationId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants/${registrationId}`);
}

export async function updateEventOrganizerParticipantStatus(eventId, registrationId, status) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants/${registrationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
    });
}

export async function deleteEventOrganizerParticipant(eventId, registrationId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants/${registrationId}`, {
        method: 'DELETE',
    });
}

export function eventOrganizerExportUrl(eventId) {
    return `${API}/event-organizer/events/${eventId}/participants/export`;
}

export async function eventOrganizerCheckin(eventId, body) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/checkin`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function fetchEventOrganizerCheckinStats(eventId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/checkin/stats`);
}

export async function sendEventOrganizerReminder(eventId, payload) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/notifications/reminder`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
}

export async function sendEventOrganizerBroadcast(eventId, payload) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/notifications/broadcast`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
    });
}

export async function downloadEventOrganizerExport(eventId) {
    const token = getEventOrganizerToken();
    if (!token || isEventOrganizerTokenExpired(token)) {
        handleUnauthorized();
        throw new Error('Session expired');
    }
    const res = await fetch(eventOrganizerExportUrl(eventId), {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/csv' },
        mode: 'cors',
        credentials: 'omit',
    });
    if (res.status === 401) {
        handleUnauthorized();
        throw new Error('Session expired');
    }
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-${eventId}-registrations.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

import { getApiBaseUrl } from '../../config/apiBase';
import {
    getEventOrganizerToken,
    clearEventOrganizerSession,
    setEventOrganizerSession,
    getEventOrganizerSession,
    isEventOrganizerTokenExpired,
} from '../../utils/eventShowOrganizerSession';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';

const API = getApiBaseUrl();

function handleUnauthorized() {
    clearEventOrganizerSession();
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/event-organizer/login') || path.startsWith('/event-organizer/signup')) return;
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

export function applyEventOrganizerAuthPayload(data) {
    if (!data?.token) return false;
    setEventOrganizerSession({
        token: data.token,
        organizer: data.organizer,
        events: data.events || [],
    });
    return true;
}

export async function tryEventOrganizerAppSession(authToken = null) {
    const existing = getEventOrganizerToken();
    if (existing && !isEventOrganizerTokenExpired(existing)) {
        return getEventOrganizerSession();
    }

    const token = resolveAuthToken(authToken);
    if (!token) return null;

    const res = await fetch(`${API}/event-organizer/auth/app-session`, {
        method: 'POST',
        headers: getBearerAuthHeaders(token),
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
        if (data?.code) {
            const err = new Error(data.message || 'Event organizer session unavailable');
            err.code = data.code;
            err.status = res.status;
            throw err;
        }
        return null;
    }
    applyEventOrganizerAuthPayload(data);
    return getEventOrganizerSession();
}

export async function eventOrganizerSignup(payload) {
    return eventOrganizerFetch('/event-organizer/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchEventOrganizerSignupEvents() {
    return eventOrganizerFetch('/event-organizer/auth/events');
}

export async function fetchEventOrganizerProfileEligible(authToken = null) {
    const token = resolveAuthToken(authToken);
    if (!token) return { success: true, eligible: false };

    const res = await fetch(`${API}/event-organizer/auth/profile-eligible`, {
        headers: getBearerAuthHeaders(token),
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to check Event organizer access');
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

export async function updateEventOrganizerParticipantStatus(eventId, registrationId, status, options = {}) {
    const body = { status };
    if (options.entryId) body.entryId = options.entryId;
    if (options.entryIndex != null) body.entryIndex = options.entryIndex;
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants/${registrationId}/status`, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
}

export async function deleteEventOrganizerParticipant(eventId, registrationId) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants/${registrationId}`, {
        method: 'DELETE',
    });
}

export async function createEventOrganizerManualParticipant(eventId, payload) {
    return eventOrganizerFetch(`/event-organizer/events/${eventId}/participants`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export function eventOrganizerExportUrl(eventId, format = 'xlsx') {
    const qs = new URLSearchParams({ format: format === 'csv' ? 'csv' : 'xlsx' });
    return `${API}/event-organizer/events/${eventId}/participants/export?${qs}`;
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

export async function downloadEventOrganizerExport(eventId, { format = 'xlsx', fileName } = {}) {
    const token = getEventOrganizerToken();
    if (!token || isEventOrganizerTokenExpired(token)) {
        handleUnauthorized();
        throw new Error('Session expired');
    }
    const wantsExcel = format !== 'csv';
    const res = await fetch(eventOrganizerExportUrl(eventId, wantsExcel ? 'xlsx' : 'csv'), {
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: wantsExcel
                ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                : 'text/csv',
        },
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
    a.download = fileName
        || (wantsExcel
            ? `event-${eventId}-registrations.xlsx`
            : `event-${eventId}-registrations.csv`);
    a.click();
    URL.revokeObjectURL(url);
}

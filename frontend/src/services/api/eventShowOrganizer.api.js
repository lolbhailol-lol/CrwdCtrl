import { getApiBaseUrl, getApiBaseCandidates } from '../../config/apiBase';
import {
    getEventOrganizerToken,
    clearEventOrganizerSession,
    setEventOrganizerSession,
    getEventOrganizerSession,
    isEventOrganizerTokenExpired,
} from '../../utils/eventShowOrganizerSession';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';
import { resilientJsonFetch, resolveApiUrl, isProxyMissStatus } from './resilientFetch.js';

function apiBase() {
    return getApiBaseUrl();
}

function handleUnauthorized() {
    clearEventOrganizerSession();
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (path.startsWith('/event-organizer/login') || path.startsWith('/event-organizer/signup')) return;
    window.location.href = `/event-organizer/login?from=${encodeURIComponent(path)}`;
}

async function eventOrganizerFetch(path, options = {}) {
    const token = getEventOrganizerToken();
    const { data, response } = await resilientJsonFetch(path, {
        ...options,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {}),
        },
    });

    if (response.status === 401) {
        handleUnauthorized();
        throw new Error(data.message || 'Session expired — please sign in again');
    }
    if (!response.ok) {
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

    const { data, response } = await resilientJsonFetch('/event-organizer/auth/app-session', {
        method: 'POST',
        headers: getBearerAuthHeaders(token),
    });
    if (!response.ok || !data?.token) {
        if (data?.code) {
            const err = new Error(data.message || 'Event organizer session unavailable');
            err.code = data.code;
            err.status = response.status;
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

    const { data, response } = await resilientJsonFetch('/event-organizer/auth/profile-eligible', {
        headers: getBearerAuthHeaders(token),
    });
    if (!response.ok) {
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

export async function lookupEventOrganizerParticipant(eventId, q) {
    return eventOrganizerFetch(
        `/event-organizer/events/${eventId}/participants/lookup?q=${encodeURIComponent(q)}`,
    );
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
    return `${apiBase()}/event-organizer/events/${eventId}/participants/export?${qs}`;
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
    const path = `/event-organizer/events/${eventId}/participants/export?${new URLSearchParams({
        format: wantsExcel ? 'xlsx' : 'csv',
    })}`;
    const bases = getApiBaseCandidates();
    let lastError;
    let res;
    for (let i = 0; i < bases.length; i += 1) {
        res = await fetch(resolveApiUrl(path, bases[i]), {
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: wantsExcel
                    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    : 'text/csv',
            },
            mode: 'cors',
            credentials: 'omit',
            cache: 'no-store',
        });
        if (res.status === 401) {
            handleUnauthorized();
            throw new Error('Session expired');
        }
        if (isProxyMissStatus(res.status) && i < bases.length - 1) {
            await res.text().catch(() => '');
            lastError = new Error(`API host miss (HTTP ${res.status})`);
            continue;
        }
        break;
    }
    if (!res || !res.ok) throw lastError || new Error('Export failed');
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

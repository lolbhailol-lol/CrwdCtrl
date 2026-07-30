import { getApiBaseUrl } from '../../config/apiBase';
import {
    getTrekOrganizerToken,
    clearTrekOrganizerSession,
    setTrekOrganizerSession,
    getTrekOrganizerSession,
} from '../../utils/trekOrganizerSession';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';

const API = getApiBaseUrl();

function handleOrganizerUnauthorized() {
    clearTrekOrganizerSession();
    if (typeof window !== 'undefined'
        && !window.location.pathname.startsWith('/trek-organizer/login')
        && !window.location.pathname.startsWith('/trek-organizer/signup')) {
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
        const err = new Error(data.message || 'Request failed');
        err.code = data.code;
        err.status = res.status;
        throw err;
    }
    return data;
}

function applyTrekOrganizerAuthPayload(data) {
    setTrekOrganizerSession({
        token: data.token,
        organizer: data.organizer,
        community: data.community || null,
        treks: data.treks || [],
    });
}

export async function trekOrganizerLogin(username, password) {
    return trekOrganizerFetch('/trek-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function trekOrganizerSignup(payload) {
    return trekOrganizerFetch('/trek-organizer/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchTrekOrganizerSignupCommunities() {
    return trekOrganizerFetch('/trek-organizer/auth/communities');
}

/** Consumer user JWT — whether Profile should show Trek community */
export async function fetchTrekCommunityProfileEligible(authToken = null) {
    const token = resolveAuthToken(authToken);
    if (!token) return { success: true, eligible: false };
    const res = await fetch(`${API}/trek-organizer/auth/profile-eligible`, {
        headers: getBearerAuthHeaders(token),
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Failed to check Trek community access');
    return data;
}

/** Use main CrwdCtrl login to open trek portal without a second password. */
export async function tryTrekOrganizerAppSession(authToken = null) {
    const existing = getTrekOrganizerToken();
    if (existing) return getTrekOrganizerSession();

    const token = resolveAuthToken(authToken);
    if (!token) return null;

    const res = await fetch(`${API}/trek-organizer/auth/app-session`, {
        method: 'POST',
        headers: getBearerAuthHeaders(token),
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
        if (data?.code) {
            const err = new Error(data.message || 'Trek community session unavailable');
            err.code = data.code;
            err.status = res.status;
            throw err;
        }
        return null;
    }
    applyTrekOrganizerAuthPayload(data);
    return getTrekOrganizerSession();
}

export async function fetchTrekOrganizerMe() {
    return trekOrganizerFetch('/trek-organizer/me');
}

export async function fetchTrekOrganizerCustomers(params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    });
    const query = qs.toString();
    return trekOrganizerFetch(`/trek-organizer/customers${query ? `?${query}` : ''}`);
}

export async function exportTrekOrganizerCustomers(params = {}) {
    const token = getTrekOrganizerToken();
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    });
    const query = qs.toString();
    const res = await fetch(`${API}/trek-organizer/customers/export${query ? `?${query}` : ''}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
        handleOrganizerUnauthorized();
        throw new Error('Session expired');
    }
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
    }
    return res.blob();
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

export async function reviewTrekOrganizerPayment(trekId, bookingId, action, note = '') {
    return trekOrganizerFetch(`/trek-organizer/treks/${trekId}/participants/${bookingId}/review-payment`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
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

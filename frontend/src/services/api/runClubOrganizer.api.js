import { getApiBaseUrl } from '../../config/apiBase';
import { getRunClubOrganizerToken, clearRunClubOrganizerSession } from '../../utils/runClubOrganizerSession';

const API = getApiBaseUrl();

function handleOrganizerUnauthorized() {
    clearRunClubOrganizerSession();
    if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (
            !path.startsWith('/run-club-organizer/login')
            && !path.startsWith('/run-club-organizer/signup')
        ) {
            window.location.assign('/run-club-organizer/login');
        }
    }
}

async function runClubOrganizerFetch(path, options = {}) {
    const token = getRunClubOrganizerToken();
    const headers = {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
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
        throw new Error(data.message || data.error || 'Request failed');
    }
    return data;
}

export async function runClubOrganizerLogin(username, password) {
    return runClubOrganizerFetch('/run-club-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function runClubOrganizerSignup(payload) {
    return runClubOrganizerFetch('/run-club-organizer/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchRunClubOrganizerSignupClubs() {
    return runClubOrganizerFetch('/run-club-organizer/auth/clubs');
}

/** Consumer user JWT — whether Profile should show Club manager */
export async function fetchClubManagerProfileEligible() {
    const token = typeof localStorage !== 'undefined'
        ? (localStorage.getItem('crwdctrl_token') || '')
        : '';
    if (!token) return { success: true, eligible: false };

    const res = await fetch(`${API}/run-club-organizer/auth/profile-eligible`, {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { success: false, eligible: false };
    return data;
}

export async function fetchRunClubOrganizerMe() {
    return runClubOrganizerFetch('/run-club-organizer/me');
}

export async function fetchRunClubOrganizerEvents() {
    return runClubOrganizerFetch('/run-club-organizer/events');
}

export async function fetchRunClubOrganizerEvent(eventId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}`);
}

export async function createRunClubOrganizerEvent(payload) {
    return runClubOrganizerFetch('/run-club-organizer/events', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function updateRunClubOrganizerEvent(eventId, payload) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    });
}

export async function publishRunClubOrganizerEvent(eventId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function setRunClubOrganizerRegistrationStatus(eventId, status) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/registration-status`, {
        method: 'POST',
        body: JSON.stringify({ status }),
    });
}

export async function expireRunClubOrganizerPendingPayments(eventId) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/expire-pending-payments`, {
        method: 'POST',
        body: JSON.stringify({}),
    });
}

export async function uploadRunClubOrganizerImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('folder', 'crwdctrl/sports');
    return runClubOrganizerFetch('/run-club-organizer/upload/image', {
        method: 'POST',
        body: formData,
    });
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

export async function reviewRunClubOrganizerPayment(eventId, bookingId, action, note = '') {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}/review-payment`, {
        method: 'POST',
        body: JSON.stringify({ action, note }),
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

export async function notifyRunClubOrganizerParticipant(eventId, bookingId, body) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}/notify`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

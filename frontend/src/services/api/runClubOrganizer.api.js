import { getApiBaseUrl } from '../../config/apiBase';
import {
    getRunClubOrganizerToken,
    clearRunClubOrganizerSession,
    setRunClubOrganizerSession,
    getRunClubOrganizerSession,
    isRunClubOrganizerTokenExpired,
} from '../../utils/runClubOrganizerSession';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';
import { isEventsListingHub } from '../../utils/listingHubCopy';
import {
    organizerLoginPath,
    organizerSignupPath,
} from '../../utils/organizerPortalPaths';

export { organizerLoginPath, organizerSignupPath, organizerHomePath, organizerEventPath, organizerPortalBase } from '../../utils/organizerPortalPaths';

const API = getApiBaseUrl();

export function organizerSessionMatchesHub(session, hub = '') {
    if (!hub) return true;
    const clubHub = isEventsListingHub(session?.runClub) ? 'events' : 'sports';
    if (hub === 'events') return clubHub === 'events';
    if (hub === 'sports') return clubHub !== 'events';
    return true;
}

function isIOSBrowser() {
    if (typeof navigator === 'undefined') return false;
    const userAgent = navigator.userAgent || '';
    return /iPhone|iPad|iPod/i.test(userAgent)
        || (/Safari/i.test(userAgent) && !/Chrome/i.test(userAgent));
}

function isNetworkFetchError(err) {
    return err?.name === 'AbortError'
        || err?.name === 'TypeError'
        || err?.message?.includes('Failed to fetch')
        || err?.message?.includes('Network')
        || err?.message?.includes('timeout');
}

function handleOrganizerUnauthorized() {
    const session = getRunClubOrganizerSession();
    const isEvents = isEventsListingHub(session?.runClub);
    clearRunClubOrganizerSession();
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    if (
        path.startsWith('/run-club-organizer/login')
        || path.startsWith('/run-club-organizer/signup')
        || path.startsWith('/event-community-organizer/login')
        || path.startsWith('/event-community-organizer/signup')
    ) {
        return;
    }
    window.location.href = organizerLoginPath(isEvents, path);
}

async function runClubOrganizerFetch(path, options = {}) {
    const token = getRunClubOrganizerToken();
    const isFormData = options.body instanceof FormData;
    const baseHeaders = {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(options.headers || {}),
    };
    if (token) baseHeaders.Authorization = `Bearer ${token}`;

    const timeout = options.timeout ?? (isIOSBrowser() ? 20000 : 12000);
    const maxRetries = options.retries ?? (isIOSBrowser() ? 3 : 2);
    const useRetry = !options.signal && (options.method ?? 'GET').toUpperCase() === 'GET';

    const attempt = async (retryCount = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        try {
            const { signal: _ignored, timeout: _t, retries: _r, headers: _h, ...rest } = options;
            const res = await fetch(`${API}${path}`, {
                ...rest,
                headers: baseHeaders,
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
            });
            clearTimeout(timeoutId);

            const data = await res.json().catch(() => ({}));

            if (res.status === 401) {
                handleOrganizerUnauthorized();
                throw new Error(data.message || 'Session expired — please sign in again');
            }
            if (res.status === 403) {
                const err = new Error(data.message || 'Access denied for this club manager account');
                err.status = 403;
                throw err;
            }
            if (!res.ok) {
                throw new Error(data.message || data.error || 'Request failed');
            }
            return data;
        } catch (err) {
            clearTimeout(timeoutId);

            if (err?.status === 401 || err?.status === 403) throw err;
            if (err?.message?.includes('Session expired')) throw err;

            if (isNetworkFetchError(err) && useRetry && retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return attempt(retryCount + 1);
            }

            if (err?.name === 'AbortError') {
                throw new Error(
                    options.signal?.aborted
                        ? 'Request cancelled'
                        : 'Connection timed out — check your network and try again',
                );
            }

            if (isNetworkFetchError(err)) {
                throw new Error('Cannot reach server — check your connection and try again');
            }

            throw err;
        }
    };

    return attempt();
}

export function applyRunClubOrganizerAuthPayload(data) {
    if (!data?.token) return false;
    setRunClubOrganizerSession({
        token: data.token,
        organizer: data.organizer,
        runClub: data.runClub || null,
        events: data.events || [],
    });
    return true;
}

/** Use main CrwdCtrl login to open club manager without a second password. */
export async function tryRunClubOrganizerAppSession(authToken = null, hub = '') {
    const existing = getRunClubOrganizerToken();
    if (existing && !isRunClubOrganizerTokenExpired(existing)) {
        const session = getRunClubOrganizerSession();
        if (organizerSessionMatchesHub(session, hub)) {
            return session;
        }
        clearRunClubOrganizerSession();
    }

    const token = resolveAuthToken(authToken);
    if (!token) return null;

    const hubQuery = hub ? `?hub=${encodeURIComponent(hub)}` : '';
    const res = await fetch(`${API}/run-club-organizer/auth/app-session${hubQuery}`, {
        method: 'POST',
        headers: getBearerAuthHeaders(token),
        mode: 'cors',
        credentials: 'omit',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.token) {
        // Attach code so callers can send invite-only users to signup instead of looping
        if (data?.code) {
            const err = new Error(data.message || 'Club manager session unavailable');
            err.code = data.code;
            err.status = res.status;
            throw err;
        }
        return null;
    }
    applyRunClubOrganizerAuthPayload(data);
    return getRunClubOrganizerSession();
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

export async function fetchRunClubOrganizerSignupClubs(hub = '') {
    const hubQuery = hub ? `?hub=${encodeURIComponent(hub)}` : '';
    return runClubOrganizerFetch(`/run-club-organizer/auth/clubs${hubQuery}`);
}

/** Consumer user JWT — whether Profile should show Club manager */
export async function fetchClubManagerProfileEligible(authToken = null) {
    const token = resolveAuthToken(authToken);
    if (!token) return { success: true, eligible: false };

    const timeout = isIOSBrowser() ? 20000 : 12000;
    const maxRetries = isIOSBrowser() ? 3 : 1;

    const attempt = async (retryCount = 0) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(`${API}/run-club-organizer/auth/profile-eligible`, {
                headers: getBearerAuthHeaders(token),
                signal: controller.signal,
                mode: 'cors',
                credentials: 'omit',
            });
            clearTimeout(timeoutId);
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(data.message || data.error || 'Failed to check Club manager access');
            }
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            if (isNetworkFetchError(err) && retryCount < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
                return attempt(retryCount + 1);
            }
            throw err;
        }
    };

    return attempt();
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

export async function updateRunClubOrganizerRegistration(eventId, body) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/registration`, {
        method: 'PATCH',
        body: JSON.stringify(body),
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

export async function updateRunClubOrganizerParticipantFormAnswers(eventId, bookingId, answers) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/${bookingId}/form-answers`, {
        method: 'PATCH',
        body: JSON.stringify({ answers }),
    });
}

export async function lookupRunClubOrganizerParticipant(eventId, q) {
    return runClubOrganizerFetch(`/run-club-organizer/events/${eventId}/participants/lookup?q=${encodeURIComponent(q)}`);
}

export async function exportRunClubOrganizerParticipants(eventId, options = {}) {
    const token = getRunClubOrganizerToken();
    const format = String(options.format || 'csv').toLowerCase();
    const qs = new URLSearchParams();
    if (format) qs.set('format', format);
    const res = await fetch(`${API}/run-club-organizer/events/${eventId}/participants/export?${qs.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 401) {
        handleOrganizerUnauthorized();
        throw new Error('Session expired');
    }
    if (!res.ok) throw new Error('Export failed');
    const contentType = String(res.headers.get('content-type') || '');
    if (contentType.includes('text/html') || contentType.includes('application/json')) {
        throw new Error('Export failed — unexpected server response');
    }
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

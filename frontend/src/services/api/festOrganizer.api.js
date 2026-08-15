import { getApiBaseUrl, getApiBaseCandidates, isInAppBrowser } from '../../config/apiBase';
import {
    getFestOrganizerToken,
    clearFestOrganizerSession,
    setFestOrganizerSession,
} from '../../utils/festOrganizerSession';

function handleUnauthorized() {
    clearFestOrganizerSession();
    if (typeof window !== 'undefined'
        && !window.location.pathname.startsWith('/fest-organizer/login')
        && !window.location.pathname.startsWith('/fest-organizer/signup')) {
        window.location.assign('/fest-organizer/login');
    }
}

function isNetworkFetchError(err) {
    return err?.name === 'AbortError'
        || err?.name === 'TypeError'
        || err?.code === 'ERR_NETWORK'
        || err?.code === 'ERR_NOT_JSON'
        || err?.code === 'ECONNABORTED'
        || /failed to fetch|network error|load failed|timeout|networkerror/i.test(String(err?.message || ''));
}

function resolveUrl(path, base) {
    if (!path) return base;
    if (path.startsWith('http')) return path;
    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalized}`;
}

/**
 * Fest organizer API fetch with same-origin → Railway failover.
 * Fixes production "Failed to fetch" when Railway is cold or CORS blocks a host.
 */
async function festOrganizerFetch(path, options = {}) {
    const token = getFestOrganizerToken();
    const method = String(options.method || 'GET').toUpperCase();
    const timeout = options.timeout
        ?? (isInAppBrowser() ? 25000 : 18000);
    const maxRetries = options.retries ?? 3;
    const bases = getApiBaseCandidates();

    let body = options.body;
    if (body != null && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
        body = JSON.stringify(body);
    }

    const attempt = async (retryCount = 0, baseIndex = 0) => {
        const base = bases[Math.min(baseIndex, bases.length - 1)] || getApiBaseUrl();
        const url = resolveUrl(path, base);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        if (options.signal) {
            options.signal.addEventListener('abort', () => controller.abort(), { once: true });
        }

        const isSameOriginBase = typeof window !== 'undefined'
            && base.startsWith(window.location.origin);

        try {
            const res = await fetch(url, {
                method,
                credentials: 'omit',
                mode: isSameOriginBase ? 'same-origin' : 'cors',
                cache: 'no-store',
                headers: {
                    Accept: 'application/json',
                    ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...(options.headers || {}),
                },
                ...(body != null && method !== 'GET' && method !== 'HEAD' ? { body } : {}),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (options.rawResponse) return res;

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                const err = new Error('Non-JSON response');
                err.code = 'ERR_NOT_JSON';
                err.isNetworkError = true;
                if (baseIndex < bases.length - 1) {
                    return attempt(retryCount, baseIndex + 1);
                }
                throw err;
            }

            const data = await res.json().catch(() => ({}));

            if (res.status === 401) {
                handleUnauthorized();
                throw new Error(data.message || 'Session expired');
            }
            if (!res.ok) {
                const err = new Error(data.message || 'Request failed');
                err.code = data.code;
                err.status = res.status;
                // Retry transient gateway / overload
                if ((res.status === 408 || res.status === 425 || res.status === 429 || res.status >= 500)
                    && retryCount < maxRetries) {
                    const nextBase = retryCount >= 1 && baseIndex < bases.length - 1 ? baseIndex + 1 : baseIndex;
                    await new Promise((r) => setTimeout(r, Math.min(400 * (retryCount + 1), 1500)));
                    return attempt(retryCount + 1, nextBase);
                }
                throw err;
            }
            return data;
        } catch (err) {
            clearTimeout(timeoutId);

            if (err?.status === 401 || err?.status === 403) throw err;
            if (err?.message?.includes('Session expired')) throw err;
            if (options.signal?.aborted) {
                const aborted = new Error('Request cancelled');
                aborted.code = 'ECONNABORTED';
                throw aborted;
            }

            const canFlipHost = isNetworkFetchError(err) || err?.code === 'ERR_NOT_JSON';
            if (canFlipHost && baseIndex < bases.length - 1) {
                await new Promise((r) => setTimeout(r, Math.min(250 * (retryCount + 1), 900)));
                return attempt(retryCount, baseIndex + 1);
            }
            if (canFlipHost && retryCount < maxRetries) {
                await new Promise((r) => setTimeout(r, Math.min(400 * (retryCount + 1), 1500)));
                return attempt(retryCount + 1, baseIndex);
            }

            if (err?.name === 'AbortError') {
                throw new Error('Connection timed out — check your network and try again');
            }
            if (isNetworkFetchError(err)) {
                throw new Error('Cannot reach server — check your connection and try Sign in again');
            }
            throw err;
        }
    };

    return attempt();
}

export async function festOrganizerLogin(username, password) {
    return festOrganizerFetch('/fest-organizer/auth/login', {
        method: 'POST',
        retries: 4,
        timeout: 25000,
        body: { username, password },
    });
}

export async function festOrganizerSignup(payload) {
    return festOrganizerFetch('/fest-organizer/auth/signup', {
        method: 'POST',
        retries: 3,
        timeout: 25000,
        body: payload,
    });
}

export async function fetchFestOrganizerMe() {
    return festOrganizerFetch('/fest-organizer/me');
}

export async function fetchFestOrganizerDashboard(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/dashboard`);
}

export async function fetchFestOrganizerProShow(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/pro-show`);
}

export async function fetchFestOrganizerLiveUpdateMeta(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates/meta`);
}

export async function fetchFestOrganizerLiveUpdates(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates${q ? `?${q}` : ''}`);
}

export async function createFestOrganizerLiveUpdate(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates`, {
        method: 'POST',
        body,
    });
}

export async function updateFestOrganizerLiveUpdate(festId, updateId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates/${updateId}`, {
        method: 'PATCH',
        body,
    });
}

export async function publishFestOrganizerLiveUpdate(festId, updateId, body = {}) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates/${updateId}/publish`, {
        method: 'POST',
        body,
    });
}

export async function archiveFestOrganizerLiveUpdate(festId, updateId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates/${updateId}/archive`, {
        method: 'POST',
        body: {},
    });
}

export async function deleteFestOrganizerLiveUpdate(festId, updateId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/live-updates/${updateId}`, {
        method: 'DELETE',
    });
}

export async function updateFestOrganizerProShow(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/pro-show`, {
        method: 'PATCH',
        body,
    });
}

export async function fetchFestOrganizerProShowTickets(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/pro-show/tickets${q ? `?${q}` : ''}`);
}

export async function issueFestOrganizerProShowPass(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/pro-show/passes`, {
        method: 'POST',
        body,
    });
}

export async function fetchFestOrganizerCompetitionOps(festId, competitionId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/${competitionId}/ops`);
}

export async function fetchFestOrganizerCompetitions(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions`);
}

export async function createFestOrganizerCompetition(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions`, {
        method: 'POST',
        body,
    });
}

export async function deleteFestOrganizerCompetition(festId, competitionId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/${competitionId}`, {
        method: 'DELETE',
    });
}

export async function fetchFestOrganizerCompetitionDetails(festId, competitionId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/${competitionId}/details`);
}

export async function updateFestOrganizerCompetitionDetails(festId, competitionId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/${competitionId}`, {
        method: 'PUT',
        body,
    });
}

export async function fetchFestOrganizerFestDetails(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/details`);
}

export async function updateFestOrganizerFestDetails(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/details`, {
        method: 'PATCH',
        body,
    });
}

export async function uploadFestOrganizerImage(formData) {
    return festOrganizerFetch('/fest-organizer/upload/image', {
        method: 'POST',
        body: formData,
        timeout: 60000,
    });
}

export async function uploadFestOrganizerImages(formData) {
    return festOrganizerFetch('/fest-organizer/upload/images', {
        method: 'POST',
        body: formData,
        timeout: 90000,
    });
}

/** Adapter for admin Competition_Modal / FestFormModal reused in organizer portal */
export function buildFestOrganizerAdminApi(festId) {
    return {
        listCompetitions: async () => fetchFestOrganizerCompetitions(festId),
        saveCompetition: async ({ competitionId, payload }) => {
            if (competitionId) {
                return updateFestOrganizerCompetitionDetails(festId, competitionId, payload);
            }
            return createFestOrganizerCompetition(festId, payload);
        },
        deleteCompetition: async (competitionId) => deleteFestOrganizerCompetition(festId, competitionId),
        uploadImage: async (formData) => {
            const res = await festOrganizerFetch('/fest-organizer/upload/image', {
                method: 'POST',
                body: formData,
                timeout: 60000,
                rawResponse: true,
            });
            return res;
        },
        uploadImages: async (formData) => {
            const res = await festOrganizerFetch('/fest-organizer/upload/images', {
                method: 'POST',
                body: formData,
                timeout: 90000,
                rawResponse: true,
            });
            return res;
        },
        saveFest: async ({ payload }) => updateFestOrganizerFestDetails(festId, payload),
        clearCache: async () => {},
    };
}

export async function updateFestOrganizerCompetitionSlots(festId, competitionId, slotsAllotted) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/${competitionId}/slots`, {
        method: 'PATCH',
        body: { slotsAllotted },
    });
}

export async function fetchFestOrganizerProbables(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/probables${q ? `?${q}` : ''}`);
}

export async function createFestOrganizerProbable(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/probables`, {
        method: 'POST',
        body,
    });
}

export async function updateFestOrganizerProbable(festId, probableId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/probables/${probableId}`, {
        method: 'PATCH',
        body,
    });
}

export async function deleteFestOrganizerProbable(festId, probableId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/probables/${probableId}`, {
        method: 'DELETE',
    });
}

export async function convertFestOrganizerProbable(festId, probableId, body = {}) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/competitions/probables/${probableId}/convert`, {
        method: 'POST',
        body,
    });
}

export async function createFestOrganizerManualParticipant(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/manual`, {
        method: 'POST',
        body,
    });
}

export async function bulkUpdateFestOrganizerParticipantStatus(festId, registrationIds, status) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/bulk-status`, {
        method: 'PATCH',
        body: { registrationIds, status },
    });
}

export async function fetchFestOrganizerParticipants(festId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants${qs ? `?${qs}` : ''}`);
}

export async function fetchFestOrganizerParticipant(festId, registrationId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/${registrationId}`);
}

export async function deleteFestOrganizerParticipant(festId, registrationId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/${registrationId}`, {
        method: 'DELETE',
    });
}

export async function updateFestOrganizerParticipantStatus(festId, registrationId, status) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/${registrationId}/status`, {
        method: 'PATCH',
        body: { status },
    });
}

export async function exportFestOrganizerParticipants(festId, params = {}) {
    const qs = new URLSearchParams();
    if (params.competitionId) qs.set('competitionId', params.competitionId);
    qs.set('format', params.format || 'xlsx');
    const q = qs.toString();
    const res = await festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/export${q ? `?${q}` : ''}`, {
        rawResponse: true,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
    }
    return res.blob();
}

export async function notifyFestOrganizerParticipant(festId, registrationId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/participants/${registrationId}/notify`, {
        method: 'POST',
        body,
    });
}

export async function festOrganizerCheckin(festId, payload) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/checkin`, {
        method: 'POST',
        body: payload,
    });
}

export async function fetchFestOrganizerCheckinStats(festId, params = {}) {
    const qs = new URLSearchParams();
    if (params.competitionId) qs.set('competitionId', params.competitionId);
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/checkin/stats${q ? `?${q}` : ''}`);
}

export async function sendFestOrganizerReminder(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/notifications/reminder`, {
        method: 'POST',
        body,
    });
}

export async function sendFestOrganizerBroadcast(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/notifications/broadcast`, {
        method: 'POST',
        body,
    });
}

export async function fetchFestOrganizerNotifyContacts(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/notifications/contacts${q ? `?${q}` : ''}`);
}

export async function fetchFestOrganizerLeads(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads${q ? `?${q}` : ''}`);
}

export async function fetchFestOrganizerLeadStats(festId, params = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') qs.set(k, v);
    });
    const q = qs.toString();
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads/stats${q ? `?${q}` : ''}`);
}

export async function createFestOrganizerLead(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads`, {
        method: 'POST',
        body,
    });
}

export async function updateFestOrganizerLead(festId, leadId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads/${leadId}`, {
        method: 'PATCH',
        body,
    });
}

export async function deleteFestOrganizerLead(festId, leadId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads/${leadId}`, {
        method: 'DELETE',
    });
}

export async function exportFestOrganizerLeads(festId, params = {}) {
    const qs = new URLSearchParams();
    if (params.date) qs.set('date', params.date);
    if (params.today) qs.set('today', params.today);
    const q = qs.toString();
    const res = await festOrganizerFetch(`/fest-organizer/fests/${festId}/leads/export${q ? `?${q}` : ''}`, {
        rawResponse: true,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
    }
    return res.blob();
}

export function applyFestOrganizerAuthPayload(data) {
    setFestOrganizerSession({
        token: data.token,
        organizer: data.organizer,
        fests: data.fests || [],
    });
}

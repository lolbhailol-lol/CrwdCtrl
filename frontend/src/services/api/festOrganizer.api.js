import { getApiBaseUrl } from '../../config/apiBase';
import {
    getFestOrganizerToken,
    clearFestOrganizerSession,
    setFestOrganizerSession,
} from '../../utils/festOrganizerSession';

const API = getApiBaseUrl();

function handleUnauthorized() {
    clearFestOrganizerSession();
    if (typeof window !== 'undefined'
        && !window.location.pathname.startsWith('/fest-organizer/login')
        && !window.location.pathname.startsWith('/fest-organizer/signup')) {
        window.location.assign('/fest-organizer/login');
    }
}

async function festOrganizerFetch(path, options = {}) {
    const token = getFestOrganizerToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API}${path}`, { ...options, headers });
    if (options.rawResponse) return res;

    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
        handleUnauthorized();
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

export async function festOrganizerLogin(username, password) {
    return festOrganizerFetch('/fest-organizer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
}

export async function festOrganizerSignup(payload) {
    return festOrganizerFetch('/fest-organizer/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchFestOrganizerMe() {
    return festOrganizerFetch('/fest-organizer/me');
}

export async function fetchFestOrganizerDashboard(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/dashboard`);
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
        body: JSON.stringify({ status }),
    });
}

export async function exportFestOrganizerParticipants(festId, params = {}) {
    const qs = new URLSearchParams();
    if (params.competitionId) qs.set('competitionId', params.competitionId);
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

export async function festOrganizerCheckin(festId, payload) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/checkin`, {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

export async function fetchFestOrganizerCheckinStats(festId) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/checkin/stats`);
}

export async function sendFestOrganizerReminder(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/notifications/reminder`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

export async function sendFestOrganizerBroadcast(festId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/notifications/broadcast`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
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
        body: JSON.stringify(body),
    });
}

export async function updateFestOrganizerLead(festId, leadId, body) {
    return festOrganizerFetch(`/fest-organizer/fests/${festId}/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
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

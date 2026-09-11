import { getApiBaseUrl, getApiBaseCandidates, isInAppBrowser } from '../../config/apiBase';
import {
    getMindSparkPaymentsToken,
    clearMindSparkPaymentsSession,
    setMindSparkPaymentsSession,
} from '../../utils/mindsparkPaymentsSession';

function handleUnauthorized() {
    clearMindSparkPaymentsSession();
    if (typeof window !== 'undefined'
        && !window.location.pathname.startsWith('/mindspark-payments/login')) {
        window.location.assign('/mindspark-payments/login');
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

async function mindsparkPaymentsFetch(path, options = {}) {
    const token = getMindSparkPaymentsToken();
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

        const isSameOriginBase = typeof window !== 'undefined'
            && base.startsWith(window.location.origin);

        try {
            const res = await fetch(url, {
                method,
                credentials: 'omit',
                mode: isSameOriginBase ? 'same-origin' : 'cors',
                cache: 'no-store',
                headers: {
                    Accept: options.rawResponse ? '*/*' : 'application/json',
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

            const canFlipHost = isNetworkFetchError(err) || err?.code === 'ERR_NOT_JSON';
            if (canFlipHost && baseIndex < bases.length - 1) {
                await new Promise((r) => setTimeout(r, Math.min(250 * (retryCount + 1), 900)));
                return attempt(retryCount, baseIndex + 1);
            }
            if (canFlipHost && retryCount < maxRetries) {
                await new Promise((r) => setTimeout(r, Math.min(400 * (retryCount + 1), 1500)));
                return attempt(retryCount + 1, baseIndex);
            }
            throw err;
        }
    };

    return attempt();
}

export async function mindsparkPaymentsLogin(username, password) {
    return mindsparkPaymentsFetch('/mindspark-payments/auth/login', {
        method: 'POST',
        retries: 4,
        timeout: 25000,
        body: { username, password },
    });
}

export function applyMindSparkPaymentsAuthPayload(data) {
    setMindSparkPaymentsSession({
        token: data.token,
        organizer: data.organizer,
        fests: data.fests || [],
    });
}

export async function fetchMindSparkPaymentsSummary() {
    return mindsparkPaymentsFetch('/mindspark-payments/summary');
}

export async function fetchMindSparkPaymentsHistory(queryString = '') {
    const suffix = queryString.startsWith('?') ? queryString : queryString ? `?${queryString}` : '';
    return mindsparkPaymentsFetch(`/mindspark-payments/history${suffix}`);
}

export async function syncMindSparkPaymentsSettlements() {
    return mindsparkPaymentsFetch('/mindspark-payments/settlements/sync', {
        method: 'POST',
        body: { dashboard: true, limit: 80 },
    });
}

export async function downloadMindSparkPaymentsExport(queryString = '') {
    const suffix = queryString.startsWith('?') ? queryString : queryString ? `?${queryString}` : '';
    const res = await mindsparkPaymentsFetch(`/mindspark-payments/export${suffix}`, {
        rawResponse: true,
    });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Export failed');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^"]+)"?/i.exec(disposition);
    return { blob, filename: match?.[1] || 'mindspark-payments.csv' };
}

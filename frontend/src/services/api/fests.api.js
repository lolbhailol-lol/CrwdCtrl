/**
 * Public fest listing — raw API shapes for fest pages and detail views.
 */
import { publicFetch } from './client.js';

function parseFestsPayload(data) {
  if (Array.isArray(data?.fests)) return data.fests;
  if (Array.isArray(data)) return data;
  return [];
}

export async function fetchRawPublicFests(options = {}) {
  try {
    const params = new URLSearchParams();
    if (options.cacheBust !== false) params.set('_cb', String(Date.now()));
    if (options.festType) params.set('festType', options.festType);
    if (options.forceRefresh) params.set('force_refresh', '1');
    // Public discovery needs the full approved list — backend default is too low (20).
    params.set('limit', String(options.limit || 200));
    if (options.page) params.set('page', String(options.page));

    const qs = params.toString();
    const path = qs ? `/fests/all?${qs}` : '/fests/all';
    const response = await publicFetch(path);
    if (!response.ok) return [];
    const data = await response.json();
    return parseFestsPayload(data);
  } catch (error) {
    console.error('Error fetching public fests:', error);
    return [];
  }
}

export async function fetchPublicFestsByType(festType, options = {}) {
  const list = await fetchRawPublicFests({ ...options, festType });
  // Server filters by festType when provided; keep client filter as a safety net.
  return list.filter((fest) => fest.festType === festType && fest.status !== 'lastyearhit');
}

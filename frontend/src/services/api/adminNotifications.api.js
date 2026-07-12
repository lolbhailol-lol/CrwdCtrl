import { adminFetchJSON } from '../../utils/adminApi';

const BASE = '/admin/notifications';

export function fetchAudienceOptions() {
  return adminFetchJSON(`${BASE}/audiences/options`);
}

export function previewAudience(audience) {
  return adminFetchJSON(`${BASE}/preview`, {
    method: 'POST',
    body: JSON.stringify({ audience }),
  });
}

export function sendNotificationCampaign(payload) {
  return adminFetchJSON(`${BASE}/send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function testSendNotification(payload) {
  return adminFetchJSON(`${BASE}/test-send`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchCampaigns(params = {}) {
  const q = new URLSearchParams();
  if (params.page) q.set('page', params.page);
  if (params.limit) q.set('limit', params.limit);
  const qs = q.toString();
  return adminFetchJSON(`${BASE}/campaigns${qs ? `?${qs}` : ''}`);
}

export function fetchCampaign(id) {
  return adminFetchJSON(`${BASE}/campaigns/${id}`);
}

export function fetchAudiencePresets() {
  return adminFetchJSON(`${BASE}/presets`);
}

export function createAudiencePreset(payload) {
  return adminFetchJSON(`${BASE}/presets`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAudiencePreset(id) {
  return adminFetchJSON(`${BASE}/presets/${id}`, { method: 'DELETE' });
}

export function searchAdminUsers({ search = '', page = 1, limit = 20 } = {}) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) q.set('search', search);
  return adminFetchJSON(`/admin/users?${q.toString()}`);
}

export function fetchEventCard(audience = {}) {
  const q = new URLSearchParams();
  if (audience.type) q.set('type', audience.type);
  const f = audience.filters || {};
  if (f.festId) q.set('festId', f.festId);
  if (f.competitionId) q.set('competitionId', f.competitionId);
  if (f.competitionType) q.set('competitionType', f.competitionType);
  if (f.trekId) q.set('trekId', f.trekId);
  if (f.eventId) q.set('eventId', f.eventId);
  if (f.eventShowId) q.set('eventShowId', f.eventShowId);
  return adminFetchJSON(`${BASE}/event-card?${q.toString()}`);
}

export function previewCampaignEmail(payload) {
  return adminFetchJSON(`${BASE}/preview-email`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

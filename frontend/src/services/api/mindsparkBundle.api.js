import { getApiBaseUrl } from '../../config/apiBase';
import { apiUtils } from '../../utils/api';
import { getFestOrganizerToken } from '../../utils/festOrganizerSession';

async function call(path, { method = 'GET', body, token } = {}) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
export const fetchMindSparkBundleOffer = () => call('/mindspark/bundle/offer');
export const quoteMindSparkBundle = items => call('/mindspark/bundle/quote', { method: 'POST', body: { items } });
export const createMindSparkBundle = (payload, desk = false) => call(desk ? `/fest-organizer/fests/${payload.festId}/fest-day-desk/bundles` : '/mindspark/bundle/orders', { method: 'POST', body: payload, token: desk ? getFestOrganizerToken() : apiUtils.getToken() });
export const fetchMindSparkBundlePayment = token => call(`/mindspark/bundle/pay/${token}`);
export const verifyMindSparkBundlePayment = token => call(`/mindspark/bundle/pay/${token}/verify`, { method: 'POST' });
export const reissueMindSparkBundlePayment = token => call(`/mindspark/bundle/pay/${token}/reissue`, { method: 'POST' });

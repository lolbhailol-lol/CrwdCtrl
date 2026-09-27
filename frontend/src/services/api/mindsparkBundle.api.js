import { getApiBaseUrl, PRODUCTION_API_BASE_URL } from '../../config/apiBase';
import { apiUtils } from '../../utils/api';
import { createFestDayDeskBundle } from './festOrganizer.api';

async function call(path, { method = 'GET', body, token, base = getApiBaseUrl() } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Request failed');
  return data;
}
let offerRequest = null;
export const fetchMindSparkBundleOffer = () => {
  if (!offerRequest) {
    offerRequest = call('/mindspark/bundle/offer').catch((error) => {
      if (getApiBaseUrl() === PRODUCTION_API_BASE_URL) throw error;
      return call('/mindspark/bundle/offer', { base: PRODUCTION_API_BASE_URL });
    }).catch((error) => {
      offerRequest = null;
      throw error;
    });
  }
  return offerRequest;
};
export const prefetchMindSparkBundleOffer = () => {
  void fetchMindSparkBundleOffer().catch(() => {});
};
export const quoteMindSparkBundle = (payload) => call('/mindspark/bundle/quote', {
  method: 'POST',
  body: Array.isArray(payload) ? { items: payload } : payload,
});
export const createMindSparkBundle = (payload, desk = false) => desk
  ? createFestDayDeskBundle(payload.festId, payload)
  : call('/mindspark/bundle/orders', { method: 'POST', body: payload, token: apiUtils.getToken() });
export const fetchMindSparkBundlePayment = token => call(`/mindspark/bundle/pay/${token}`);
export const verifyMindSparkBundlePayment = (token, payment = null) => call(`/mindspark/bundle/pay/${token}/verify`, { method: 'POST', ...(payment ? { body: payment } : {}) });
export const reissueMindSparkBundlePayment = token => call(`/mindspark/bundle/pay/${token}/reissue`, { method: 'POST' });

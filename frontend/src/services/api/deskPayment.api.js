import { getApiBaseUrl } from '../../config/apiBase';

async function request(token, suffix = '', method = 'GET', body = null) {
  const response = await fetch(`${getApiBaseUrl()}/fest-organizer/desk-payment/${encodeURIComponent(token)}${suffix}`, {
    method, headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Payment request failed');
  return data;
}

export const fetchDeskPayment = (token) => request(token);
export const verifyDeskPayment = (token, payment = null) => request(token, '/verify', 'POST', payment);
export const reissueDeskPayment = (token) => request(token, '/reissue', 'POST');

import { getApiBaseUrl } from '../../config/apiBase';

async function request(token, suffix = '', method = 'GET') {
  const response = await fetch(`${getApiBaseUrl()}/fest-organizer/desk-payment/${encodeURIComponent(token)}${suffix}`, {
    method, headers: { Accept: 'application/json' }, cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'Payment request failed');
  return data;
}

export const fetchDeskPayment = (token) => request(token);
export const verifyDeskPayment = (token) => request(token, '/verify', 'POST');
export const reissueDeskPayment = (token) => request(token, '/reissue', 'POST');

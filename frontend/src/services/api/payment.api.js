import { resolveUrl } from './client.js';
import { getBearerAuthHeaders } from '../../utils/authToken.js';

/**
 * Server-authoritative payment quote (fest + competition registration).
 */
export async function fetchPaymentQuote(payload, token) {
  const response = await fetch(resolveUrl('/payment/quote'), {
    method: 'POST',
    headers: getBearerAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || 'Failed to calculate payment amount');
  }
  return data;
}

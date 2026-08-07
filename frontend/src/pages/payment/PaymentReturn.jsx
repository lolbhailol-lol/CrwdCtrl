import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader } from 'lucide-react';
import { getPendingPayment, isStalePendingPayment, clearPendingPayment } from '../../utils/deepLinks';
import {
  loadEventPayDraft,
  loadEventRegistrationDraft,
  completeEventPayAndRegister,
  clearEventPaymentArtifacts,
} from '../../utils/eventPaymentRecovery';
import { verifyPaymentWithRetry, goToBookings } from '../../utils/paymentNavigation';
import { API_BASE_URL } from '../../services/api/client';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';

/**
 * Cashfree redirect checkout lands here (order return_url = /payment/return?order_id=...).
 * Prefer forwarding to the page that started payment so it can finish registration.
 * If that context is gone (common after Google Pay), verify + complete event registration here.
 */
export default function PaymentReturn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('confirming'); // confirming | success | redirecting
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search);
      const orderIdFromUrl = params.get('order_id') || '';
      const pending = getPendingPayment();
      const returnPath =
        pending?.orderId && !isStalePendingPayment(pending) ? pending.returnPath : null;

      if (returnPath) {
        const [path, existingQuery] = returnPath.split('?');
        const merged = new URLSearchParams(existingQuery || '');
        params.forEach((value, key) => {
          if (!merged.has(key)) merged.set(key, value);
        });
        const qs = merged.toString();
        if (!cancelled) {
          setStatus('redirecting');
          navigate(qs ? `${path}?${qs}` : path, { replace: true });
        }
        return;
      }

      const orderId = orderIdFromUrl || pending?.orderId || '';
      if (!orderId) {
        if (!cancelled) goToBookings(navigate);
        return;
      }

      const draft =
        loadEventPayDraft(orderId)
        || (() => {
          const eventId = (pending?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1];
          return eventId ? loadEventRegistrationDraft(eventId) : null;
        })();

      const eventShowId = draft?.eventShowId
        || (pending?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1]
        || '';

      const token = resolveAuthToken();
      if (eventShowId && token) {
        try {
          if (!cancelled) setMessage('Payment received — finishing your registration…');
          const { ok, data: v } = await verifyPaymentWithRetry(API_BASE_URL, orderId, {
            token,
            kind: 'fest',
          });
          if (ok && v?.verified) {
            const reg = await completeEventPayAndRegister({
              apiBase: API_BASE_URL,
              token,
              eventShowId,
              orderId,
              responses: draft?.values || {},
              tierId: draft?.tierId || '',
              couponCode: draft?.couponCode || '',
            });
            clearPendingPayment();
            clearEventPaymentArtifacts(eventShowId, orderId);
            if (cancelled) return;
            setStatus('success');
            setMessage('Payment successful — registration confirmed!');
            const regId = reg.registrationId || reg._id;
            window.setTimeout(() => {
              if (regId) {
                navigate(`/registration-details/${regId}?type=event`, {
                  replace: true,
                  state: { refreshBookings: true, fromPayment: true },
                });
              } else {
                goToBookings(navigate);
              }
            }, 900);
            return;
          }
        } catch (err) {
          console.warn('[PaymentReturn] event recovery failed:', err?.message || err);
        }
      }

      // Last resort: hit verify so webhook lag still marks PAID; bookings page can recover.
      if (token) {
        try {
          await fetch(`${API_BASE_URL}/payment/verify`, {
            method: 'POST',
            headers: getBearerAuthHeaders(token),
            body: JSON.stringify({ payment_order_id: orderId }),
          });
        } catch {
          /* ignore */
        }
      }

      if (!cancelled) {
        goToBookings(navigate, null);
        // Pass order for bookings recovery via session flag
        try {
          sessionStorage.setItem(
            'crwdctrl_recover_event_order',
            JSON.stringify({ orderId, eventShowId, ts: Date.now() }),
          );
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex flex-col items-center justify-center px-4">
      {status === 'success' ? (
        <CheckCircle className="w-10 h-10 text-emerald-400 mb-4" />
      ) : (
        <Loader className="w-8 h-8 animate-spin text-[#0ECCEE] mb-4" />
      )}
      <p className="text-sm text-gray-400 text-center max-w-sm">{message}</p>
    </div>
  );
}

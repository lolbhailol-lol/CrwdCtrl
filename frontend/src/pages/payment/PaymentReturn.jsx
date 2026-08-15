import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Loader } from 'lucide-react';
import {
  getPendingPayment,
  isStalePendingPayment,
  clearPendingPayment,
  hasCashfreeReturnParams,
} from '../../utils/deepLinks';
import {
  loadEventPayDraft,
  loadEventRegistrationDraft,
  completeEventPayAndRegister,
  clearEventPaymentArtifacts,
} from '../../utils/eventPaymentRecovery';
import {
  verifyPaymentWithRetry,
  goToBookings,
  classifyVerifyError,
  clearCashfreeReturnAndPending,
} from '../../utils/paymentNavigation';
import { buildVerifiedPaymentFields } from '../../utils/useCashfree';
import { finalizeCompetitionAfterPayment } from '../../utils/competitionPaymentComplete';
import { saveFestRegistrationSuccess } from '../../utils/registrationDraft';
import { API_BASE_URL } from '../../services/api/client';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';

function parseFestRegisterReturn(returnPath) {
  if (!returnPath) return null;
  try {
    const [path, query = ''] = String(returnPath).split('?');
    const festMatch = path.match(/^\/fest\/([^/]+)\/register\/?$/);
    if (!festMatch) return null;
    const params = new URLSearchParams(query);
    return {
      festRouteId: festMatch[1],
      competitionId: params.get('competition') || '',
      path,
      query,
    };
  } catch {
    return null;
  }
}

async function completeFestPayAndRegister({ festRouteId, orderId, token }) {
  const regRes = await fetch(`${API_BASE_URL}/registrations/fests/${festRouteId}/pay-and-register`, {
    method: 'POST',
    headers: getBearerAuthHeaders(token),
    body: JSON.stringify({ payment_order_id: orderId }),
  });
  const regData = await regRes.json().catch(() => ({}));
  if (!regRes.ok) {
    throw new Error(regData.error || regData.message || 'Registration failed after payment.');
  }
  return regData._id || regData.registration?._id || regData.registrationId || null;
}

/**
 * Cashfree redirect checkout lands here (order return_url = /payment/return?order_id=...).
 * Prefer forwarding to the page that started payment so it can finish registration.
 * If that context is gone (common after Google Pay), verify + complete event registration here.
 * Fest/competition: complete pay-and-register here when possible, then open success UI.
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
      const festReturn = parseFestRegisterReturn(returnPath);

      if (returnPath && hasCashfreeReturnParams(search)) {
        const orderId = orderIdFromUrl || pending?.orderId || '';
        const token = resolveAuthToken();

        if (orderId && token) {
          try {
            const verifyResult = await verifyPaymentWithRetry(API_BASE_URL, orderId, {
              token,
              kind: 'fest',
              search,
            });

            if (verifyResult.status === 'cancelled') {
              clearCashfreeReturnAndPending(navigate, { pathname: returnPath.split('?')[0], search: '' });
              if (!cancelled) {
                setStatus('redirecting');
                navigate(returnPath.split('?')[0] + (returnPath.includes('?') ? `?${returnPath.split('?')[1]}` : ''), {
                  replace: true,
                  state: { paymentCancelled: true },
                });
              }
              return;
            }

            if (verifyResult.status === 'pending' && !verifyResult.verified) {
              if (!cancelled) {
                setStatus('redirecting');
                const [path, existingQuery] = returnPath.split('?');
                const merged = new URLSearchParams(existingQuery || '');
                params.forEach((value, key) => {
                  if (!merged.has(key)) merged.set(key, value);
                });
                const qs = merged.toString();
                navigate(qs ? `${path}?${qs}` : path, { replace: true, state: { fromPaymentReturn: true } });
              }
              return;
            }

            // Paid: finish fest/competition registration on this page so success UI always appears
            if (verifyResult.ok && verifyResult.verified && festReturn) {
              if (!cancelled) setMessage('Payment received — finishing your registration…');
              try {
                let regId = null;
                if (festReturn.competitionId) {
                  const verifiedFields = buildVerifiedPaymentFields(verifyResult.data, orderId);
                  ({ regId } = await finalizeCompetitionAfterPayment({
                    competitionId: festReturn.competitionId,
                    verifiedFields,
                    token,
                    draft: null,
                    tryFormSubmit: null,
                  }));
                } else {
                  regId = await completeFestPayAndRegister({
                    festRouteId: festReturn.festRouteId,
                    orderId,
                    token,
                  });
                }

                saveFestRegistrationSuccess({
                  festId: festReturn.festRouteId,
                  competitionId: festReturn.competitionId || null,
                  registrationId: regId,
                });
                clearPendingPayment();

                if (cancelled) return;
                setStatus('success');
                setMessage('Payment successful — registration confirmed!');

                const cleanQuery = new URLSearchParams(festReturn.query || '');
                ['order_id', 'order_token', 'cf_payment_id', 'payment_id'].forEach((key) => {
                  cleanQuery.delete(key);
                });
                if (festReturn.competitionId) cleanQuery.set('competition', festReturn.competitionId);
                const qs = cleanQuery.toString();
                const target = qs ? `${festReturn.path}?${qs}` : festReturn.path;

                window.setTimeout(() => {
                  if (cancelled) return;
                  navigate(target, {
                    replace: true,
                    state: {
                      registrationComplete: true,
                      registrationId: regId,
                      competitionId: festReturn.competitionId || null,
                      fromPaymentReturn: true,
                    },
                  });
                }, 700);
                return;
              } catch (err) {
                console.warn('[PaymentReturn] fest/competition recovery failed:', err?.message || err);
                /* fall through — page-level resume still has order_id */
              }
            }
          } catch {
            /* forward to return path for page-level resume */
          }
        }

        const [path, existingQuery] = returnPath.split('?');
        const merged = new URLSearchParams(existingQuery || '');
        params.forEach((value, key) => {
          if (!merged.has(key)) merged.set(key, value);
        });
        const qs = merged.toString();
        if (!cancelled) {
          setStatus('redirecting');
          navigate(qs ? `${path}?${qs}` : path, { replace: true, state: { fromPaymentReturn: true } });
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
          const verifyResult = await verifyPaymentWithRetry(API_BASE_URL, orderId, {
            token,
            kind: 'fest',
            search,
          });

          if (verifyResult.status === 'cancelled') {
            clearCashfreeReturnAndPending(navigate, { pathname: `/events/${eventShowId}/register`, search: '' });
            if (!cancelled) {
              navigate(`/events/${eventShowId}/register`, {
                replace: true,
                state: { paymentCancelled: true },
              });
            }
            return;
          }

          if (verifyResult.ok && verifyResult.verified) {
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

          const { kind, message: verifyMsg } = classifyVerifyError(verifyResult);
          if (kind === 'pending') {
            if (!cancelled) {
              navigate(`/events/${eventShowId}/register${search}`, { replace: true });
            }
            return;
          }
          if (kind === 'cancelled') {
            clearCashfreeReturnAndPending(navigate, { pathname: `/events/${eventShowId}/register`, search: '' });
            if (!cancelled) navigate(`/events/${eventShowId}/register`, { replace: true });
            return;
          }
          console.warn('[PaymentReturn] event verify:', verifyMsg);
        } catch (err) {
          console.warn('[PaymentReturn] event recovery failed:', err?.message || err);
        }
      }

      // Lost pending but URL still has order — try fest register path from referrer/pending fragment
      const orphanFest = parseFestRegisterReturn(pending?.returnPath || '');
      if (orphanFest && token) {
        try {
          if (!cancelled) setMessage('Payment received — finishing your registration…');
          const verifyResult = await verifyPaymentWithRetry(API_BASE_URL, orderId, {
            token,
            kind: 'fest',
            search,
          });
          if (verifyResult.ok && verifyResult.verified) {
            let regId = null;
            if (orphanFest.competitionId) {
              const verifiedFields = buildVerifiedPaymentFields(verifyResult.data, orderId);
              ({ regId } = await finalizeCompetitionAfterPayment({
                competitionId: orphanFest.competitionId,
                verifiedFields,
                token,
                draft: null,
                tryFormSubmit: null,
              }));
            } else {
              regId = await completeFestPayAndRegister({
                festRouteId: orphanFest.festRouteId,
                orderId,
                token,
              });
            }
            saveFestRegistrationSuccess({
              festId: orphanFest.festRouteId,
              competitionId: orphanFest.competitionId || null,
              registrationId: regId,
            });
            clearPendingPayment();
            if (cancelled) return;
            setStatus('success');
            setMessage('Payment successful — registration confirmed!');
            const cleanQuery = new URLSearchParams();
            if (orphanFest.competitionId) cleanQuery.set('competition', orphanFest.competitionId);
            const qs = cleanQuery.toString();
            const target = qs ? `${orphanFest.path}?${qs}` : orphanFest.path;
            window.setTimeout(() => {
              if (cancelled) return;
              navigate(target, {
                replace: true,
                state: {
                  registrationComplete: true,
                  registrationId: regId,
                  competitionId: orphanFest.competitionId || null,
                  fromPaymentReturn: true,
                },
              });
            }, 700);
            return;
          }
        } catch (err) {
          console.warn('[PaymentReturn] orphan fest recovery failed:', err?.message || err);
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

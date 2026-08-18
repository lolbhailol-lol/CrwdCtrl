import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { DetailLoader3DIcon } from '../../components/DetailPageLoader';
import {
  getPendingPayment,
  isStalePendingPayment,
  clearPendingPayment,
  hasCashfreeReturnParams,
  loadOrderReturnContext,
  clearOrderReturnContext,
} from '../../utils/deepLinks';
import {
  loadEventPayDraft,
  loadEventRegistrationDraft,
  completeEventPayAndRegister,
  clearEventPaymentArtifacts,
} from '../../utils/eventPaymentRecovery';
import {
  verifyPaymentWithRetry,
  pollPaymentUntilVerified,
  goToBookings,
  classifyVerifyError,
  clearCashfreeReturnAndPending,
  stripCashfreeReturnParams,
  handoffPaymentToReturnPath,
  PAYMENT_RETURN_MAX_WAIT_MS,
} from '../../utils/paymentNavigation';
import { buildVerifiedPaymentFields } from '../../utils/useCashfree';
import { finalizeCompetitionAfterPayment } from '../../utils/competitionPaymentComplete';
import { saveFestRegistrationSuccess } from '../../utils/registrationDraft';
import { API_BASE_URL } from '../../services/api/client';
import { resolveAuthToken, getBearerAuthHeaders } from '../../utils/authToken';
import { MINDSPARK_FEST_ID } from '../../features/fests/mindspark';

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

function buildFestRegisterTarget({ festId, competitionId }) {
  const festKey = String(festId || MINDSPARK_FEST_ID || '').trim() || MINDSPARK_FEST_ID;
  const path = `/fest/${festKey}/register`;
  const qs = competitionId
    ? `?competition=${encodeURIComponent(String(competitionId))}`
    : '';
  return `${path}${qs}`;
}

const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function resolveFestSuccessIds(festRouteId, recoveryFestId) {
  const route = String(festRouteId || '').trim();
  const fromRecovery = String(recoveryFestId || '').trim();
  const mongo =
    (OBJECT_ID_RE.test(fromRecovery) && fromRecovery)
    || (OBJECT_ID_RE.test(route) && route)
    || ((route.toLowerCase().includes('mindspark') || fromRecovery === MINDSPARK_FEST_ID)
      ? MINDSPARK_FEST_ID
      : '')
    || '';
  return {
    festId: route || fromRecovery || mongo,
    festMongoId: mongo || null,
    festAliases: [route, fromRecovery, mongo, MINDSPARK_FEST_ID, 'mindspark'].filter(Boolean),
  };
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

async function finishFestCompetitionAndNavigate({
  navigate,
  orderId,
  token,
  festRouteId,
  recoveryFestId,
  competitionId,
  verifyData,
  cancelledRef,
  setStatus,
  setMessage,
}) {
  if (!cancelledRef.current) setMessage('Payment received — finishing your registration…');

  let regId = null;
  if (competitionId) {
    const verifiedFields = buildVerifiedPaymentFields(verifyData, orderId);
    ({ regId } = await finalizeCompetitionAfterPayment({
      competitionId,
      verifiedFields,
      token,
      draft: null,
      tryFormSubmit: null,
    }));
  } else if (festRouteId) {
    regId = await completeFestPayAndRegister({
      festRouteId,
      orderId,
      token,
    });
  } else {
    throw new Error('Missing fest/competition for payment recovery');
  }

  const festIds = resolveFestSuccessIds(festRouteId, recoveryFestId);
  saveFestRegistrationSuccess({
    ...festIds,
    competitionId: competitionId || null,
    registrationId: regId,
  });
  clearPendingPayment();
  clearOrderReturnContext(orderId);

  if (cancelledRef.current) return;
  setStatus('success');
  setMessage('Payment successful — registration confirmed!');

  const target = buildFestRegisterTarget({
    festId: festIds.festId || festRouteId,
    competitionId,
  });

  window.setTimeout(() => {
    if (cancelledRef.current) return;
    navigate(target, {
      replace: true,
      state: {
        registrationComplete: true,
        registrationId: regId,
        competitionId: competitionId || null,
        fromPaymentReturn: true,
      },
    });
  }, 250);
}

/**
 * Cashfree redirect checkout lands here (order return_url = /payment/return?order_id=...).
 * Fest/competition must land on WhatsApp success — never dump to My Bookings as the happy path.
 */
export default function PaymentReturn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('confirming'); // confirming | success | redirecting | pending
  const [message, setMessage] = useState('Confirming your payment…');

  useEffect(() => {
    const cancelledRef = { current: false };

    const updateProgress = ({ attempt }) => {
      if (cancelledRef.current) return;
      setMessage(
        attempt <= 2
          ? 'Confirming your payment…'
          : 'Payment received — waiting for bank confirmation…',
      );
    };

    (async () => {
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const params = new URLSearchParams(search);
      const orderIdFromUrl = params.get('order_id') || '';
      const pending = getPendingPayment();
      const orderCtx = loadOrderReturnContext(orderIdFromUrl || pending?.orderId);
      const returnPath =
        (pending?.orderId && !isStalePendingPayment(pending) ? pending.returnPath : null)
        || orderCtx?.returnPath
        || null;
      const festReturn = parseFestRegisterReturn(returnPath);

      if (returnPath && hasCashfreeReturnParams(search)) {
        const orderId = orderIdFromUrl || pending?.orderId || orderCtx?.orderId || '';
        const token = resolveAuthToken();

        if (orderId && !token) {
          const returnUrl = `/payment/return?order_id=${encodeURIComponent(orderId)}`;
          if (!cancelledRef.current) {
            setStatus('redirecting');
            setMessage('Sign in to finish your registration…');
            navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
          }
          return;
        }

        if (orderId && token) {
          try {
            const verifyResult = await pollPaymentUntilVerified(
              API_BASE_URL,
              orderId,
              { token, kind: 'fest', search },
              { maxWaitMs: PAYMENT_RETURN_MAX_WAIT_MS, onProgress: updateProgress },
            );

            if (verifyResult.status === 'cancelled') {
              clearCashfreeReturnAndPending(navigate, { pathname: returnPath.split('?')[0], search: '' });
              if (!cancelledRef.current) {
                setStatus('redirecting');
                const basePath = returnPath.split('?')[0];
                const cleanSearch = stripCashfreeReturnParams(returnPath.includes('?') ? `?${returnPath.split('?')[1]}` : '');
                navigate(`${basePath}${cleanSearch}`, {
                  replace: true,
                  state: { paymentCancelled: true },
                });
              }
              return;
            }

            if (verifyResult.status === 'pending' && !verifyResult.verified) {
              if (!cancelledRef.current) {
                setStatus('redirecting');
                setMessage('Finishing your registration…');
                handoffPaymentToReturnPath(navigate, returnPath);
              }
              return;
            }

            const recovery = verifyResult.data?.recovery || {};
            const competitionId =
              festReturn?.competitionId
              || recovery.competitionId
              || orderCtx?.competitionId
              || '';
            const festRouteId =
              festReturn?.festRouteId
              || recovery.festId
              || orderCtx?.festId
              || '';

            if (verifyResult.ok && verifyResult.verified && (competitionId || festRouteId || festReturn)) {
              try {
                // Already fulfilled (webhook) — still show success UI
                if (recovery.registrationId && (competitionId || festRouteId)) {
                  const festIds = resolveFestSuccessIds(
                    festRouteId || recovery.festId,
                    recovery.festId,
                  );
                  saveFestRegistrationSuccess({
                    ...festIds,
                    competitionId: competitionId || null,
                    registrationId: recovery.registrationId,
                  });
                  clearPendingPayment();
                  clearOrderReturnContext(orderId);
                  if (cancelledRef.current) return;
                  setStatus('success');
                  setMessage('Payment successful — registration confirmed!');
                  const target = buildFestRegisterTarget({
                    festId: festIds.festId || festRouteId || recovery.festId,
                    competitionId,
                  });
                  window.setTimeout(() => {
                    if (cancelledRef.current) return;
                    navigate(target, {
                      replace: true,
                      state: {
                        registrationComplete: true,
                        registrationId: recovery.registrationId,
                        competitionId: competitionId || null,
                        fromPaymentReturn: true,
                      },
                    });
                  }, 250);
                  return;
                }

                await finishFestCompetitionAndNavigate({
                  navigate,
                  orderId,
                  token,
                  festRouteId: festRouteId || festReturn?.festRouteId,
                  recoveryFestId: recovery.festId || festRouteId || festReturn?.festRouteId,
                  competitionId: competitionId || festReturn?.competitionId,
                  verifyData: verifyResult.data,
                  cancelledRef,
                  setStatus,
                  setMessage,
                });
                return;
              } catch (err) {
                console.warn('[PaymentReturn] fest/competition recovery failed:', err?.message || err);
                /* fall through — forward with order_id for page resume */
              }
            }
          } catch {
            /* forward to return path for page-level resume */
          }
        }

        if (!cancelledRef.current) {
          setStatus('redirecting');
          handoffPaymentToReturnPath(navigate, returnPath);
        }
        return;
      }

      const orderId = orderIdFromUrl || pending?.orderId || '';
      if (!orderId) {
        if (!cancelledRef.current) goToBookings(navigate);
        return;
      }

      const draft =
        loadEventPayDraft(orderId)
        || (() => {
          const eventId = (pending?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1]
            || (orderCtx?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1];
          return eventId ? loadEventRegistrationDraft(eventId) : null;
        })();

      const eventShowId = draft?.eventShowId
        || (pending?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1]
        || (orderCtx?.returnPath?.match(/\/events\/([^/]+)\/register/) || [])[1]
        || '';

      const token = resolveAuthToken();
      if (eventShowId && token) {
        try {
          if (!cancelledRef.current) setMessage('Payment received — finishing your registration…');
          const verifyResult = await pollPaymentUntilVerified(
            API_BASE_URL,
            orderId,
            { token, kind: 'fest', search },
            { maxWaitMs: PAYMENT_RETURN_MAX_WAIT_MS, onProgress: updateProgress },
          );

          if (verifyResult.status === 'cancelled') {
            clearCashfreeReturnAndPending(navigate, { pathname: `/events/${eventShowId}/register`, search: '' });
            if (!cancelledRef.current) {
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
            if (cancelledRef.current) return;
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
            }, 300);
            return;
          }

          const { kind, message: verifyMsg } = classifyVerifyError(verifyResult);
          if (kind === 'pending') {
            if (!cancelledRef.current) {
              handoffPaymentToReturnPath(navigate, `/events/${eventShowId}/register`);
            }
            return;
          }
          if (kind === 'cancelled') {
            clearCashfreeReturnAndPending(navigate, { pathname: `/events/${eventShowId}/register`, search: '' });
            if (!cancelledRef.current) navigate(`/events/${eventShowId}/register`, { replace: true });
            return;
          }
          console.warn('[PaymentReturn] event verify:', verifyMsg);
        } catch (err) {
          console.warn('[PaymentReturn] event recovery failed:', err?.message || err);
        }
      }

      // Lost pending: recover fest/competition from order context + verify.recovery
      if (token) {
        try {
          if (!cancelledRef.current) setMessage('Payment received — finishing your registration…');
          const verifyResult = await pollPaymentUntilVerified(
            API_BASE_URL,
            orderId,
            { token, kind: 'fest', search },
            { maxWaitMs: PAYMENT_RETURN_MAX_WAIT_MS, onProgress: updateProgress },
          );

          if (verifyResult.ok && verifyResult.verified) {
            const recovery = verifyResult.data?.recovery || {};
            const entityType = String(recovery.entityType || orderCtx?.entityType || '').toLowerCase();
            const competitionId =
              recovery.competitionId
              || orderCtx?.competitionId
              || (entityType === 'competition' ? recovery.entityId : '')
              || '';
            const festRouteId =
              recovery.festId
              || orderCtx?.festId
              || (entityType === 'fest' ? recovery.entityId : '')
              || (competitionId ? MINDSPARK_FEST_ID : '')
              || '';

            if (competitionId || (festRouteId && entityType !== 'event_show')) {
              if (recovery.registrationId) {
                const festIds = resolveFestSuccessIds(festRouteId, recovery.festId);
                saveFestRegistrationSuccess({
                  ...festIds,
                  competitionId: competitionId || null,
                  registrationId: recovery.registrationId,
                });
                clearPendingPayment();
                clearOrderReturnContext(orderId);
                if (cancelledRef.current) return;
                setStatus('success');
                setMessage('Payment successful — registration confirmed!');
                const target = buildFestRegisterTarget({
                  festId: festIds.festId || festRouteId,
                  competitionId,
                });
                window.setTimeout(() => {
                  if (cancelledRef.current) return;
                  navigate(target, {
                    replace: true,
                    state: {
                      registrationComplete: true,
                      registrationId: recovery.registrationId,
                      competitionId: competitionId || null,
                      fromPaymentReturn: true,
                    },
                  });
                }, 250);
                return;
              }

              await finishFestCompetitionAndNavigate({
                navigate,
                orderId,
                token,
                festRouteId,
                recoveryFestId: recovery.festId || festRouteId,
                competitionId,
                verifyData: verifyResult.data,
                cancelledRef,
                setStatus,
                setMessage,
              });
              return;
            }
          }
        } catch (err) {
          console.warn('[PaymentReturn] order recovery failed:', err?.message || err);
        }
      }

      // Absolute last resort (non-fest flows only)
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

      if (!cancelledRef.current) {
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
      cancelledRef.current = true;
    };
  }, [navigate]);

  return (
    <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex flex-col items-center justify-center px-4">
      {status === 'success' ? (
        <CheckCircle className="w-10 h-10 text-emerald-400 mb-4" />
      ) : (
        <DetailLoader3DIcon variant="payment" size="compact" className="mb-4" />
      )}
      <p className="text-sm text-gray-400 text-center max-w-sm">{message}</p>
    </div>
  );
}

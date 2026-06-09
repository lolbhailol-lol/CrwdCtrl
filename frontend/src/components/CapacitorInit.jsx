import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initCapacitorApp } from '../utils/capacitorApp';
import { initNativePushNavigation } from '../utils/nativePush';
import { verifyPendingCashfreePayment } from '../utils/useCashfree';
import { getPendingPayment, clearPendingPayment, isTrekPaymentPending } from '../utils/deepLinks';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
/**
 * Wires Capacitor back button, deep links, and payment return verification.
 */
export default function CapacitorInit() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let cleanup = () => {};

    initCapacitorApp({
      navigate,
      onBackWhenRoot: () => {
        if (location.pathname !== '/') {
          navigate('/');
        }
      },
    }).then((fn) => {
      cleanup = fn || (() => {});
    });

    const pushCleanup = initNativePushNavigation(navigate);

    return () => {
      cleanup();
      pushCleanup();
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    const pending = getPendingPayment();
    if (!pending?.orderId) return;

    const returnPath = pending.returnPath || '/booking';

    // Trek payments: return to booking form — TrekBookingPage runs trek-verify + register
    if (isTrekPaymentPending(pending)) {
      if (location.pathname !== returnPath) {
        navigate(returnPath, { replace: true });
      }
      return;
    }

    const token = localStorage.getItem('crwdctrl_token');
    verifyPendingCashfreePayment(API, token)
      .then((result) => {
        if (!result?.verifyData?.verified) return;
        clearPendingPayment();
        if (location.pathname !== returnPath) {
          navigate(returnPath, { replace: true, state: { paymentVerified: true } });
        }
      })
      .catch(() => {});
  }, [location.pathname, navigate]);

  return null;
}

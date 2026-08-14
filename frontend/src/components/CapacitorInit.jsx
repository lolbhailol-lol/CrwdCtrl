import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initCapacitorApp } from '../utils/capacitorApp';
import { initNativePushNavigation, initNativePushForegroundRefresh } from '../utils/nativePush';
import { initCashfreeNativeGateway } from '../utils/bootstrapCashfreeNative';
import {
  getPendingPayment,
  shouldResumePendingPayment,
  hasCashfreeReturnParams,
  hasPaymentReturnExpected,
  discardStalePaymentRecovery,
} from '../utils/deepLinks';
import { resolveBrowseBackPath } from '../utils/categoryHubRoutes';
/**
 * Wires Capacitor back button, deep links, and payment return verification.
 */
export default function CapacitorInit() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    initCashfreeNativeGateway().catch(() => {});
  }, []);

  /** Drop abandoned checkout flags on cold app open — prevents random "Confirming payment…" later. */
  useEffect(() => {
    if (location.pathname === '/payment/return') return;
    if (hasCashfreeReturnParams(location.search)) return;
    if (!getPendingPayment() && !hasPaymentReturnExpected()) return;
    discardStalePaymentRecovery({
      pathname: location.pathname,
      search: location.search,
      navigationState: location.state,
    });
  }, []);

  useEffect(() => {
    let cleanup = () => {};

    initCapacitorApp({
      navigate,
      onBack: () => {
        const target = resolveBrowseBackPath(location.pathname);
        if (target) {
          navigate(target, { replace: true });
          return true;
        }
        return false;
      },
      onBackWhenRoot: () => {
        if (location.pathname !== '/') {
          navigate('/');
        }
      },
    }).then((fn) => {
      cleanup = fn || (() => {});
    });

    const pushCleanup = initNativePushNavigation(navigate);
    const pushForegroundCleanup = initNativePushForegroundRefresh();

    return () => {
      cleanup();
      pushCleanup();
      pushForegroundCleanup();
    };
  }, [navigate, location.pathname]);

  useEffect(() => {
    const pending = getPendingPayment();
    if (!pending?.orderId) return;

    const currentPath = location.pathname + location.search;
    const hasReturnSignal =
      hasCashfreeReturnParams(location.search) || hasPaymentReturnExpected();
    if (!hasReturnSignal) return;
    if (!shouldResumePendingPayment(pending, currentPath, location.search)) return;

    const returnPath = pending.returnPath || '/booking';
    const targetPath = returnPath.split('?')[0];
    if (location.pathname !== targetPath) {
      navigate(returnPath, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return null;
}

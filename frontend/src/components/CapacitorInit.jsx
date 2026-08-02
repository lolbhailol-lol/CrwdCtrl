import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { initCapacitorApp } from '../utils/capacitorApp';
import { initNativePushNavigation, initNativePushForegroundRefresh } from '../utils/nativePush';
import { initCashfreeNativeGateway } from '../utils/bootstrapCashfreeNative';
import { getPendingPayment } from '../utils/deepLinks';
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

    const returnPath = pending.returnPath || '/booking';

    // Payment page resumes verify + register — only navigate back here
    const targetPath = returnPath.split('?')[0];
    if (location.pathname !== targetPath) {
      navigate(returnPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

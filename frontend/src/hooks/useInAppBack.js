import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { navigateInAppBack, resolveInAppBackFallback } from '../utils/inAppBack';

export function useInAppBack(explicitFallback) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    navigateInAppBack(
      navigate,
      resolveInAppBackFallback(location.pathname, explicitFallback),
    );
  }, [navigate, location.pathname, explicitFallback]);
}

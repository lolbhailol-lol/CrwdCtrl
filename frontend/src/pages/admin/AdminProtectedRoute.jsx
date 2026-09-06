import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { getAdminToken, clearAdminSession, adminFetch } from '../../services/api/admin.api.js';
import { InlinePageLoader } from '../../components/DetailPageLoader';

function parseAdminToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'admin' || payload.type === 'refresh') return null;
    return payload;
  } catch {
    return null;
  }
}

export default function AdminProtectedRoute({ children }) {
  const { isLoading } = useAuth();
  const [verified, setVerified] = useState(null);
  const hasStoredToken = !!localStorage.getItem('admin_token');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Refreshes an expired token via admin_refresh_token before giving up
      const token = await getAdminToken({ redirectOnFail: false });
      if (!token || !parseAdminToken(token)) {
        if (!cancelled) setVerified(false);
        return;
      }

      try {
        const res = await adminFetch('/admin/verify');
        if (!cancelled) setVerified(res.ok);
      } catch {
        if (!cancelled) setVerified(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  if (isLoading || (hasStoredToken && verified === null)) {
    return <InlinePageLoader label="Loading admin" minHeight className="min-h-screen" />;
  }

  if (verified === false || (!hasStoredToken && verified !== true)) {
    if (verified === false) {
      clearAdminSession();
    }
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

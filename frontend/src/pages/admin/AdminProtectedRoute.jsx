import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';
import { getAdminToken, clearAdminSession, adminFetch } from '../../services/api/admin.api.js';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { INTERN_ADMIN_HOME, INTERN_ADMIN_ROLE, isInternAdminPathAllowed } from '../../utils/adminRole';

function parseJwt(token) {
  try {
    return JSON.parse(atob(String(token).split('.')[1]));
  } catch {
    return null;
  }
}

function parseAdminToken(token) {
  const payload = parseJwt(token);
  if (!payload || !['admin', INTERN_ADMIN_ROLE].includes(payload.role) || payload.type === 'refresh') return null;
  return payload;
}

function parseCampusHuntAdminToken(token) {
  const payload = parseJwt(token);
  if (!payload || payload.type === 'refresh') return null;
  if (payload.role !== 'campus_hunt_admin' && payload.role !== 'admin') return null;
  if (payload.exp && payload.exp * 1000 < Date.now()) return null;
  return payload;
}

/** /admin/campus-hunt/* → /campus-hunt/admin/* for Hunt-only sessions */
function huntAdminMirrorPath(pathname = '') {
  const path = String(pathname || '');
  if (path === '/admin/campus-hunt' || path === '/admin/campus-hunt/') {
    return '/campus-hunt/admin';
  }
  if (path.startsWith('/admin/campus-hunt/')) {
    return `/campus-hunt/admin/${path.slice('/admin/campus-hunt/'.length)}`;
  }
  return null;
}

export default function AdminProtectedRoute({ children }) {
  const { isLoading } = useAuth();
  const location = useLocation();
  const [verified, setVerified] = useState(null);
  const [role, setRole] = useState(null);
  const hasStoredToken = !!localStorage.getItem('admin_token');
  const huntToken = typeof window !== 'undefined'
    ? localStorage.getItem('campus_hunt_admin_token')
    : null;
  const huntMirror = huntAdminMirrorPath(location.pathname);
  const huntOnlySession = Boolean(
    huntMirror
    && parseCampusHuntAdminToken(huntToken)
    && !parseAdminToken(typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null),
  );

  useEffect(() => {
    if (huntOnlySession) return undefined;

    let cancelled = false;

    (async () => {
      // Refreshes an expired token via admin_refresh_token before giving up
      const token = await getAdminToken({ redirectOnFail: false });
      if (!token || !parseAdminToken(token)) {
        if (!cancelled) setVerified(false);
        return;
      }

      const tokenRole = parseAdminToken(token).role;
      try {
        const res = await adminFetch(tokenRole === INTERN_ADMIN_ROLE ? '/admin/college-platform/access' : '/admin/verify');
        if (!cancelled) {
          setRole(tokenRole);
          setVerified(res.ok);
        }
      } catch {
        if (!cancelled) setVerified(false);
      }
    })();

    return () => { cancelled = true; };
  }, [huntOnlySession]);

  // Pasted /admin/campus-hunt link + Hunt-only token → Hunt admin (no main login).
  if (huntOnlySession) {
    return <Navigate to={`${huntMirror}${location.search || ''}`} replace />;
  }

  if (isLoading || (hasStoredToken && verified === null)) {
    return <InlinePageLoader label="Loading admin" minHeight className="min-h-screen" />;
  }

  if (verified === false || (!hasStoredToken && verified !== true)) {
    // Hunt event/admin paste without main admin → Hunt login, not CrwdCtrl /admin/login
    if (huntMirror) {
      return (
        <Navigate
          to="/campus-hunt/admin/login"
          replace
          state={{ from: `${huntMirror}${location.search || ''}` }}
        />
      );
    }
    if (verified === false) {
      clearAdminSession();
    }
    return <Navigate to="/admin/login" replace />;
  }

  if (role === INTERN_ADMIN_ROLE && !isInternAdminPathAllowed(location.pathname)) {
    return <Navigate to={huntMirror ? `${huntMirror}${location.search || ''}` : INTERN_ADMIN_HOME} replace />;
  }

  return children;
}

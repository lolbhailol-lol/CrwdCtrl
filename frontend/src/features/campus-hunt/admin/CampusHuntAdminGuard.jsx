import { Navigate, useLocation } from 'react-router-dom';

function parseJwt(token) {
  try {
    return JSON.parse(atob(String(token).split('.')[1]));
  } catch {
    return null;
  }
}

function hasUsableAdminSession() {
  const hunt = localStorage.getItem('campus_hunt_admin_token');
  const main = localStorage.getItem('admin_token');
  for (const token of [hunt, main]) {
    if (!token) continue;
    const payload = parseJwt(token);
    if (!payload || payload.type === 'refresh') continue;
    if (payload.role !== 'campus_hunt_admin' && payload.role !== 'admin') continue;
    if (payload.exp && payload.exp * 1000 < Date.now()) continue;
    return true;
  }
  return false;
}

/** Hunt control room — accepts Hunt-only or main CrwdCtrl admin token. */
export default function CampusHuntAdminGuard({ children }) {
  const location = useLocation();
  if (!hasUsableAdminSession()) {
    return (
      <Navigate
        to="/campus-hunt/admin/login"
        replace
        state={{ from: `${location.pathname}${location.search || ''}` }}
      />
    );
  }
  return children;
}

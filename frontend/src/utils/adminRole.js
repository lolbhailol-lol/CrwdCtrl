export const INTERN_ADMIN_ROLE = 'intern_admin';
export const INTERN_ADMIN_HOME = '/admin/college-platform';

const INTERN_ADMIN_PATHS = ['/admin/college-platform'];

export function readAdminTokenRole(token) {
  try {
    const payload = JSON.parse(atob(String(token || '').split('.')[1]));
    return payload?.type === 'refresh' ? null : payload?.role || null;
  } catch {
    return null;
  }
}

export function isInternAdminSession() {
  try {
    return readAdminTokenRole(localStorage.getItem('admin_token')) === INTERN_ADMIN_ROLE;
  } catch {
    return false;
  }
}

export function isInternAdminPathAllowed(pathname = '') {
  return INTERN_ADMIN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

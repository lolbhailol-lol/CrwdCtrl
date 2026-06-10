import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function OrganizerProtectedRoute({ children }) {
  const { user, token, isLoading, isAuthenticated } = useAuth();
  const localToken = typeof window !== 'undefined' ? localStorage.getItem('crwdctrl_token') : null;
  const hasAuth = isAuthenticated || !!token || !!localToken;

  let role = user?.role;
  if (!role && typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(localStorage.getItem('crwdctrl_user') || 'null');
      role = saved?.role;
    } catch {
      role = null;
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#161718] text-gray-400">
        Loading...
      </div>
    );
  }

  if (!hasAuth) {
    return <Navigate to="/login" replace state={{ redirect: window.location.pathname }} />;
  }

  if (role !== 'organizer') {
    return (
      <div className="min-h-screen bg-[#161718] text-white flex items-center justify-center px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold">Organizer access only</h1>
          <p className="text-sm text-gray-400">
            This scanner is for fest organizers. Ask CrwdCtrl admin to set your account role to
            organizer and link your fest to your user.
          </p>
        </div>
      </div>
    );
  }

  return children;
}

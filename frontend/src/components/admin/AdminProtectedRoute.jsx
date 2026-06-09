import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

function parseAdminToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role !== 'admin' || payload.type === 'refresh') return null;
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export default function AdminProtectedRoute({ children }) {
  const { isLoading } = useAuth();
  const [verified, setVerified] = useState(null);
  const adminToken = localStorage.getItem('admin_token');

  useEffect(() => {
    if (!adminToken || !parseAdminToken(adminToken)) {
      setVerified(false);
      return;
    }

    let cancelled = false;
    fetch(`${API}/admin/verify`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
      .then((res) => {
        if (!cancelled) setVerified(res.ok);
      })
      .catch(() => {
        if (!cancelled) setVerified(false);
      });

    return () => { cancelled = true; };
  }, [adminToken]);

  if (isLoading || (adminToken && verified === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!adminToken || !parseAdminToken(adminToken) || verified === false) {
    if (adminToken && verified === false) {
      localStorage.removeItem('admin_token');
    }
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStats from './AdminStatsCard';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1]));
    return Date.now() >= (payload.exp * 1000) - (5 * 60 * 1000);
  } catch {
    return true;
  }
}

const QUICK_LINKS = [
  { label: 'Manage Fests', path: '/admin/fests', description: 'Create, edit, and manage fests' },
  { label: 'Competitions', path: '/admin/competitions', description: 'Competition forms, rounds, and QR' },
  { label: 'Home & Sections', path: '/admin/sections', description: 'Carousels, page placement, priorities' },
  { label: 'Registrations', path: '/admin/registrations', description: 'Review fest sign-ups' },
  { label: 'Scanner Access', path: '/admin/scanner-access', description: 'Volunteer scanner codes for events' },
  { label: 'Analytics', path: '/admin/analytics', description: 'Views, signups, and device stats' },
];

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalFests: 0,
    totalCompetitions: 0,
    ongoingFests: 0,
    upcomingFests: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function refreshAdminToken(refreshToken) {
    const response = await fetch(`${API_BASE_URL}/admin/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Token refresh failed');
    }
    const data = await response.json();
    localStorage.setItem('admin_token', data.accessToken);
    if (data.refreshToken) {
      localStorage.setItem('admin_refresh_token', data.refreshToken);
    }
    return data.accessToken;
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let adminToken = localStorage.getItem('admin_token');
        const adminRefreshToken = localStorage.getItem('admin_refresh_token');

        if (!adminToken) {
          setError('No admin token found. Please log in again.');
          setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
          return;
        }

        if (isTokenExpired(adminToken)) {
          if (!adminRefreshToken) {
            setError('Session expired. Please log in again.');
            setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
            return;
          }
          try {
            adminToken = await refreshAdminToken(adminRefreshToken);
          } catch {
            setError('Session expired. Please log in again.');
            setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
            return;
          }
        }

        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_refresh_token');
            setError('Admin session expired. Please log in again.');
            setTimeout(() => { window.location.href = '/admin/login'; }, 1500);
            return;
          }
          throw new Error(`Failed to fetch stats (HTTP ${response.status})`);
        }

        setStats(await response.json());
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400">
        <h3 className="font-semibold mb-2">Error loading dashboard</h3>
        <p>{error}</p>
        {error.includes('log in') && (
          <button
            onClick={() => navigate('/admin/login')}
            className="mt-3 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">Manage fests, competitions, and registrations</p>
      </div>

      <AdminStats stats={stats} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {QUICK_LINKS.map((link) => (
          <button
            key={link.path}
            type="button"
            onClick={() => navigate(link.path)}
            className="text-left bg-[#111213] border border-gray-800 rounded-xl p-5 hover:border-[#0ECCEE]/40 hover:bg-[#0ECCEE]/5 transition-colors"
          >
            <h3 className="font-semibold text-white mb-1">{link.label}</h3>
            <p className="text-sm text-gray-500">{link.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

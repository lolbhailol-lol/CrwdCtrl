import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStats from '../../components/admin/AdminStatsCard';
import { adminFetchJSON } from '../../services/api/admin.api.js';

const QUICK_LINKS = [
  { label: 'Manage Fests', path: '/admin/fests', description: 'Create, edit, and manage fests' },
  { label: 'Competitions', path: '/admin/competitions', description: 'Competition forms, rounds, and QR' },
  { label: 'Run Clubs', path: '/admin/sports', description: 'Run clubs and run events' },
  { label: 'Treks', path: '/admin/treks', description: 'Trek communities and trek listings' },
  { label: 'Events', path: '/admin/events', description: 'Events and show ticketing' },
  { label: 'Home & Sections', path: '/admin/sections', description: 'Carousels, page placement, priorities' },
  { label: 'Page Sections', path: '/admin/page-sections', description: 'Create custom scrolling sections for any page' },
  { label: 'Registrations', path: '/admin/registrations', description: 'Fest, trek, run, and event sign-ups' },
  { label: 'User Logins', path: '/admin/user-logins', description: 'User accounts and login activity' },
  { label: 'Scanner Access', path: '/admin/scanner-access', description: 'Volunteer scanner codes for events' },
  { label: 'Analytics', path: '/admin/analytics', description: 'Revenue, commissions, and sign-ups' },
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

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStats(await adminFetchJSON('/admin/stats'));
        setError(null);
      } catch (err) {
        setError(err.message || 'Failed to load dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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

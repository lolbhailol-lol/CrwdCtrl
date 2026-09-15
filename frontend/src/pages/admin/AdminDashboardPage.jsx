import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStats from '../../components/admin/AdminStatsCard';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { ORGANIZER_LOGIN_MATRIX, publicWebUrl } from '../../utils/publicWebOrigin';

const QUICK_LINKS = [
  { label: 'Manage Fests', path: '/admin/fests', description: 'Create, edit, and manage fests' },
  { label: 'Competitions', path: '/admin/competitions', description: 'Competition forms, rounds, and QR' },
  { label: 'Run Clubs', path: '/admin/sports', description: 'Run clubs and run events' },
  { label: 'Treks', path: '/admin/treks', description: 'Trek communities and trek listings' },
  { label: 'Events', path: '/admin/events', description: 'Events and show ticketing' },
  { label: 'Home & Sections', path: '/admin/sections', description: 'Carousels, page placement, priorities' },
  { label: 'Page Sections', path: '/admin/page-sections', description: 'Create custom scrolling sections for any page' },
  { label: 'App Copy', path: '/admin/app-copy', description: 'Section titles, announcement banner, empty-state text' },
  { label: 'Registrations', path: '/admin/registrations', description: 'Fest, trek, run, and event sign-ups' },
  { label: 'User Logins', path: '/admin/user-logins', description: 'User accounts and login activity' },
  { label: 'User Activity', path: '/admin/user-activity', description: 'Page views, engagement time, and daily stats by email' },
  { label: 'Scanner Access', path: '/admin/scanner-access', description: 'Volunteer scanner codes for events' },
  { label: 'Payments', path: '/admin/payments', description: 'Cashfree collections, 1.6% fee, settlements, and payouts' },
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

      <div className="rounded-xl border border-white/8 bg-[#121316] p-4 space-y-3">
        <div>
          <h2 className="text-lg font-bold text-white">Organizer login URLs</h2>
          <p className="text-xs text-amber-300/90 mt-1">
            Always use <strong>www.crwdctrl.in</strong> — apex <code className="text-amber-200">crwdctrl.in</code> hits the API and shows Railway Not Found.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-gray-500 border-b border-white/6 text-xs uppercase tracking-wider">
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Login URL</th>
                <th className="py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              {ORGANIZER_LOGIN_MATRIX.map((row) => (
                <tr key={row.id} className="border-b border-white/5">
                  <td className="py-2.5 pr-3 text-white font-medium whitespace-nowrap">{row.label}</td>
                  <td className="py-2.5 pr-3">
                    <button
                      type="button"
                      className="text-[#0ECCEE] text-left text-xs break-all hover:underline"
                      onClick={() => {
                        const url = publicWebUrl(row.loginPath);
                        navigator.clipboard?.writeText(url);
                      }}
                      title="Click to copy"
                    >
                      {publicWebUrl(row.loginPath)}
                    </button>
                  </td>
                  <td className="py-2.5 text-gray-500 text-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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

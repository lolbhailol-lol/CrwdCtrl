import { useEffect, useState } from 'react';
import AdminStats from './AdminStatsCard';
import FestTable from './FestTable';
import { API_CONFIG } from '../../config/env'; // 👈 make sure this import exists

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function AdminDashboardPage() {
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
<<<<<<< HEAD
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
          },
        });
=======
        const response = await fetch(
          `${API_CONFIG.BASE_URL}/admin/stats`, // ✅ FIXED HERE
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
            },
          }
        );
>>>>>>> 76bde7798ae97b14cc833cbae29598d602887951

        if (!response.ok) {
          throw new Error(`Failed to fetch stats (${response.status})`);
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching stats:', err);
        setError(err.message);
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
        Error loading dashboard: {error}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-gray-400">
          Manage fests, competitions, and registrations
        </p>
      </div>

      <AdminStats stats={stats} />

      <div className="mt-10">
        <FestTable />
      </div>
    </div>
  );
}

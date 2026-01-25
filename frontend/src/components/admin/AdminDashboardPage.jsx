import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStats from './AdminStatsCard';
import FestTable from './FestTable';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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
        const adminToken = localStorage.getItem('admin_token');
        
        // Check if admin token exists
        if (!adminToken) {
          console.error('No admin token found');
          setError('No admin token found. Please log in again.');
          setTimeout(() => navigate('/login'), 2000);
          return;
        }

        console.log('Fetching admin stats with token:', adminToken.substring(0, 20) + '...');

        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Admin stats response:', response.status, response.statusText);

        if (!response.ok) {
          if (response.status === 401) {
            console.error('Admin token expired or invalid');
            localStorage.removeItem('admin_token');
            setError('Admin session expired. Please log in again.');
            setTimeout(() => navigate('/login'), 2000);
            return;
          }
          throw new Error(`Failed to fetch stats (${response.status})`);
        }

        const data = await response.json();
        console.log('Admin stats data:', data);
        setStats(data);
      } catch (err) {
        console.error('Error fetching admin stats:', err);
        setError(err.message);
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
            onClick={() => navigate('/login')}
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

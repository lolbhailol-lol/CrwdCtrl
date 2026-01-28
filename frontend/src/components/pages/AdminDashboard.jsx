import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function AdminDashboard() {
  const { isAuthenticated, token, apiCall, validateToken } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('🔄 Fetching dashboard data...');
        setLoading(true);

        // Validate token before making the API call
        const isTokenValid = await validateToken();
        if (!isTokenValid) {
          console.error('❌ Token is invalid or expired. Redirecting to login.');
          navigate('/login');
          return;
        }

        // Fetch dashboard data
        const response = await apiCall('/admin/dashboard', {
          method: 'GET',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch dashboard data');
        }

        const data = await response.json();
        console.log('✅ Dashboard data loaded:', data);
        setDashboardData(data);
      } catch (err) {
        console.error('❌ Error loading dashboard data:', err);
        setError(err.message || 'An unexpected error occurred while loading the dashboard.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [apiCall, validateToken, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="text-gray-500">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      {/* Render dashboard data */}
      <pre className="bg-gray-100 p-4 rounded-lg">{JSON.stringify(dashboardData, null, 2)}</pre>
    </div>
  );
}

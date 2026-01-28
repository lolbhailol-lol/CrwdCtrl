import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminStats from './AdminStatsCard';
import FestTable from './FestTable';

// Configure API base URL - Use Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
console.log('🔧 AdminDashboardPage - API_BASE_URL:', API_BASE_URL);

function isTokenExpired(token) {
  if (!token) {
    console.error('❌ [isTokenExpired] No token provided');
    return true;
  }
  try {
    const parts = token.split('.');
    console.log('🔐 [isTokenExpired] Token parts:', parts.length);
    
    if (parts.length !== 3) {
      console.error('❌ [isTokenExpired] Invalid token format - expected 3 parts, got', parts.length);
      return true;
    }

    const payload = JSON.parse(atob(parts[1]));
    console.log('🔐 [isTokenExpired] Decoded payload:', { 
      role: payload.role,
      email: payload.email,
      expTime: new Date(payload.exp * 1000).toISOString(),
      nowTime: new Date().toISOString(),
      expiresIn: (payload.exp * 1000) - Date.now(),
      isExpired: Date.now() >= (payload.exp * 1000) - (5 * 60 * 1000)
    });
    
    // Consider token expired if it expires within the next 5 minutes
    const isExpired = Date.now() >= (payload.exp * 1000) - (5 * 60 * 1000);
    console.log('🔐 [isTokenExpired] Result:', isExpired);
    return isExpired;
  } catch (error) {
    console.error('❌ [isTokenExpired] Error decoding token:', error.message);
    return true;
  }
}

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

  // Helper to refresh admin token
  async function refreshAdminToken(refreshToken) {
    try {
      console.log('🔄 Attempting admin token refresh...');
      const response = await fetch(`${API_BASE_URL}/admin/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      
      console.log('🔄 Refresh response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Token refresh failed:', errorData);
        throw new Error(errorData.message || 'Token refresh failed');
      }
      
      const data = await response.json();
      console.log('✅ Token refreshed successfully');
      
      // Store new access token
      localStorage.setItem('admin_token', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('admin_refresh_token', data.refreshToken);
      }
      
      return data.accessToken;
    } catch (err) {
      console.error('❌ Token refresh error:', err.message);
      // Clear tokens on refresh failure
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_refresh_token');
      throw err;
    }
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        let adminToken = localStorage.getItem('admin_token');
        const adminRefreshToken = localStorage.getItem('admin_refresh_token');
        
        console.log('📋 Token check:', {
          hasToken: !!adminToken,
          hasRefreshToken: !!adminRefreshToken,
          tokenExpired: adminToken ? isTokenExpired(adminToken) : 'N/A'
        });

        // Check if admin token exists
        if (!adminToken) {
          console.warn('⚠️ No admin token found');
          setError('No admin token found. Please log in again.');
          setTimeout(() => {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_refresh_token');
            window.location.href = '/admin/login';
          }, 1500);
          return;
        }

        // If token expired, try to refresh
        if (isTokenExpired(adminToken)) {
          console.warn('⚠️ Admin token expired or expiring soon, attempting refresh...');
          
          if (!adminRefreshToken) {
            console.error('❌ No refresh token available');
            setError('Session expired. Please log in again.');
            setTimeout(() => {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_refresh_token');
              window.location.href = '/admin/login';
            }, 1500);
            return;
          }

          try {
            adminToken = await refreshAdminToken(adminRefreshToken);
          } catch (refreshErr) {
            console.error('❌ Token refresh failed:', refreshErr.message);
            setError('Session expired. Please log in again.');
            setTimeout(() => {
              localStorage.removeItem('admin_token');
              localStorage.removeItem('admin_refresh_token');
              window.location.href = '/admin/login';
            }, 1500);
            return;
          }
        }

        console.log('📡 Fetching admin stats with valid token');
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${adminToken}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('📡 Stats response status:', response.status);

        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            console.error('❌ Unauthorized/Forbidden - token invalid');
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_refresh_token');
            setError('Admin session expired. Please log in again.');
            setTimeout(() => {
              window.location.href = '/admin/login';
            }, 1500);
            return;
          }
          if (response.status === 404) {
            throw new Error('Dashboard stats endpoint not found');
          }
          throw new Error(`Failed to fetch stats (HTTP ${response.status})`);
        }

        const data = await response.json();
        console.log('✅ Stats fetched successfully:', data);
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('❌ Error in fetchStats:', err.message);
        setError(err.message || 'Failed to load dashboard. Please refresh the page.');
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

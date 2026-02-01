import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

interface User {
  id: string;
  email: string;
  name: string;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = (): void => {
      try {
        const token = authService.getToken();
        if (!token) {
          navigate('/login', { replace: true });
          return;
        }

        // Decode JWT to get user info (basic decoding)
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.id,
          email: payload.email,
          name: payload.name || 'User',
        });
      } catch (error) {
        console.error('[Dashboard] Error loading user:', error);
        navigate('/login', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [navigate]);

  const handleLogout = async (): Promise<void> => {
    try {
      await authService.logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('[Dashboard] Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h1>Welcome, {user?.name}</h1>
        <button onClick={handleLogout} className="logout-btn">
          Logout
        </button>
      </div>

      <div className="dashboard-content">
        <div className="user-info">
          <h2>Your Profile</h2>
          <p>Email: {user?.email}</p>
        </div>

        <div className="dashboard-nav">
          <button onClick={() => navigate('/events')} className="nav-btn">
            View Events
          </button>
          <button onClick={() => navigate('/competitions')} className="nav-btn">
            View Competitions
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;

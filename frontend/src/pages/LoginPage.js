import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const LoginPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!email || !password) {
        setError('Email and password are required');
        setLoading(false);
        return;
      }

      console.log('🔧 LoginPage - API_BASE_URL:', API_BASE_URL);
      console.log('🔐 Attempting admin login with email:', email);
      console.log('📍 Environment:', import.meta.env.VITE_APP_ENVIRONMENT);

      const response = await fetch(`${API_BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      console.log('📍 Request sent to:', `${API_BASE_URL}/admin/login`);
      console.log('🔐 Login response status:', response.status, response.statusText);

      const data = await response.json();
      console.log('🔐 Login response data:', { 
        success: data.success, 
        hasAccessToken: !!data.accessToken,
        message: data.message || data.error 
      });

      if (!response.ok) {
        setError(data.message || data.error || 'Login failed');
        console.error('❌ Login failed:', data.message || data.error);
        setLoading(false);
        return;
      }

      if (data.success && data.accessToken) {
        // Store both access and refresh tokens
        localStorage.setItem('admin_token', data.accessToken);
        localStorage.setItem('admin_refresh_token', data.refreshToken || '');
        console.log('✅ Admin tokens stored successfully');
        
        // Use React Router navigate instead of window.location.href
        // This ensures tokens are stored before navigation
        console.log('🔄 Navigating to admin dashboard...');
        navigate('/admin', { replace: true });
      } else {
        setError(data.message || 'Login failed - no token received');
        console.error('❌ Login failed:', data.message);
        setLoading(false);
      }
    } catch (error) {
      console.error('❌ Login error:', error);
      setError(error.message || 'An error occurred during login. Please check your connection.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-white mb-6">Admin Login</h2>
        
        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-400 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-gray-300 text-sm mb-2">Email</label>
            <input
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-gray-300 text-sm mb-2">Password</label>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 text-white rounded focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

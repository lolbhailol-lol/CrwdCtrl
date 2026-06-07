import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminProtectedRoute({ children }) {
  const { isLoading } = useAuth();
  const adminToken = localStorage.getItem('admin_token');

  // Show loading while auth is being processed
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  // Check for admin token first
  if (!adminToken) {
    console.log('❌ No admin token found, redirecting to admin login');
    return <Navigate to="/admin/login" replace />;
  }

  return children;
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import googleAuthService from '../services/googleAuthService';

const GoogleSignInButton: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignIn = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    setError('');

    try {
      const isInstagram = googleAuthService.isInstagram();
      console.log('[GoogleSignIn] Starting sign-in');

      const result = await googleAuthService.signIn();

      if (result) {
        const idToken = await googleAuthService.getIdToken();
        const response = await fetch('/api/auth/google-signin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Type': isInstagram ? 'instagram' : 'mobile',
          },
          credentials: 'include',
          body: JSON.stringify({
            idToken,
            email: result.user.email,
            name: result.user.displayName,
          }),
        });

        if (!response.ok) throw new Error('Backend auth failed');

        const data = await response.json();
        if (isInstagram && data.token) {
          sessionStorage.setItem('authToken', data.token);
        }

        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Sign-in failed';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <div className="google-signin">
      <button onClick={handleSignIn} disabled={loading} type="button">
        {loading ? 'Signing in...' : 'Sign in with Google'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
};

export default GoogleSignInButton;

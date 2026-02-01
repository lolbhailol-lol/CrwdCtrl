import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import googleAuthService from '../services/googleAuthService';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LoginForm } from '../components/LoginForm';

const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async (): Promise<void> => {
      try {
        const oauthIntent = sessionStorage.getItem('oauth_intent');
        const oauthTimestamp = sessionStorage.getItem('oauth_timestamp');

        if (oauthIntent === 'google-signin') {
          const timeSinceIntent = Date.now() - parseInt(oauthTimestamp || '0');

          if (timeSinceIntent < 120000) {
            console.log('[LoginPage] Checking OAuth redirect result');

            const result = await googleAuthService.initializeRedirectResult();

            if (result) {
              sessionStorage.removeItem('oauth_intent');
              sessionStorage.removeItem('oauth_timestamp');

              console.log('[LoginPage] OAuth result found');

              const idToken = await googleAuthService.getIdToken();
              const response = await fetch('/api/auth/google-signin', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Client-Type': googleAuthService.isInstagram() ? 'instagram' : 'mobile',
                },
                credentials: 'include',
                body: JSON.stringify({
                  idToken,
                  email: result.user.email,
                  name: result.user.displayName,
                }),
              });

              if (!response.ok) {
                throw new Error('Backend authentication failed');
              }

              const data = await response.json();
              if (data.token) {
                localStorage.setItem('authToken', data.token);
                sessionStorage.setItem('authToken', data.token);
              }

              navigate('/dashboard', { replace: true });
              return;
            }
          }
        }

        sessionStorage.removeItem('oauth_intent');
        sessionStorage.removeItem('oauth_timestamp');
        setLoading(false);
      } catch (err: any) {
        console.error('[LoginPage] Redirect error:', err.message);
        setError(err.message);
        setLoading(false);
      }
    };

    handleRedirect();
  }, [navigate]);

  if (loading) {
    return (
      <div className="login-page">
        <div className="loading">Processing sign-in...</div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <h1>Login</h1>
      {error && <div className="error-message">{error}</div>}
      <div className="login-container">
        <GoogleSignInButton />
        <div className="divider">OR</div>
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import googleAuthService from '../services/googleAuthService';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { LoginForm } from '../components/LoginForm';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const handleRedirect = async () => {
      try {
        const result = await googleAuthService.initializeRedirectResult();

        if (result) {
          const idToken = await googleAuthService.getIdToken();
          const response = await fetch('/api/auth/google-signin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Type': googleAuthService.isMobile() ? 'mobile' : 'desktop',
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
          if (data.token) {
            localStorage.setItem('authToken', data.token);
            sessionStorage.setItem('authToken', data.token);
          }

          navigate('/dashboard', { replace: true });
        } else {
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    handleRedirect();
  }, [navigate]);

  if (loading) {
    return <div className="login-page"><div className="loading">Processing...</div></div>;
  }

  return (
    <div className="login-page">
      <h1>Login</h1>
      {error && <div className="error">{error}</div>}
      <div className="login-container">
        <GoogleSignInButton />
        <div className="divider">OR</div>
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;

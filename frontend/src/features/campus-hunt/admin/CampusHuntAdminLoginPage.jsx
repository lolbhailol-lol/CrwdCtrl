import { useState } from 'react';
import { getApiBaseCandidates } from '../../../config/apiBase.js';

export default function CampusHuntAdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); setError('');
    for (const base of getApiBaseCandidates()) {
      try {
        const response = await fetch(`${base}/campus-hunt/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) { setError(data.message || 'Invalid username or password'); return; }
        localStorage.setItem('campus_hunt_admin_token', data.accessToken);
        window.location.href = '/admin/campus-hunt';
        return;
      } catch { /* try next configured API base */ }
    }
    setError('Unable to connect. Try again.');
  };
  return <main style={{ maxWidth: 420, margin: '12vh auto', padding: 24 }}>
    <h1>Campus Hunt Admin</h1>
    <p>Sign in to manage Campus Hunt only.</p>
    <form onSubmit={submit}>
      <input aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" required />
      <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required />
      {error && <p role="alert">{error}</p>}
      <button type="submit">Sign in</button>
    </form>
  </main>;
}

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
  return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, background: '#f4f7fb' }}>
    <section style={{ width: '100%', maxWidth: 420, padding: 32, borderRadius: 18, background: '#fff', boxShadow: '0 12px 40px rgba(15,23,42,.12)' }}>
      <h1 style={{ margin: 0 }}>Campus Hunt Admin</h1>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Sign in to manage Campus Hunt only.</p>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Username
          <input aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter username" autoComplete="username" required style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 16 }} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Password
          <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoComplete="current-password" required style={{ padding: 12, border: '1px solid #cbd5e1', borderRadius: 10, fontSize: 16 }} />
        </label>
        {error && <p role="alert" style={{ color: '#dc2626', margin: 0 }}>{error}</p>}
        <button type="submit" style={{ marginTop: 6, padding: 13, border: 0, borderRadius: 10, background: '#2563eb', color: '#fff', fontWeight: 700, fontSize: 16, cursor: 'pointer' }}>Sign in</button>
      </form>
    </section>
  </main>;
}

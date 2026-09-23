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
  return <main className="min-h-dvh bg-[#0f1011] flex items-center justify-center px-4 py-6">
    <section className="w-full max-w-md rounded-2xl border border-gray-800 bg-[#161718] p-6 sm:p-8 shadow-2xl">
      <div className="flex items-center gap-3 mb-6">
        <div className="size-12 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center text-[#0ECCEE] text-2xl">⌁</div>
        <div><h1 className="text-xl sm:text-2xl font-bold text-white">Campus Hunt Admin</h1><p className="text-xs sm:text-sm text-gray-500">Sign in to manage Campus Hunt</p></div>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-xs font-medium text-gray-400">Username
          <input aria-label="Username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" autoComplete="username" required className="mt-1.5 w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE]" />
        </label>
        <label className="block text-xs font-medium text-gray-400">Password
          <input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="current-password" required className="mt-1.5 w-full bg-[#111213] border border-gray-700 rounded-xl px-4 py-3.5 text-white text-base focus:outline-none focus:border-[#0ECCEE]" />
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-900/20 px-3 py-2.5 text-sm text-red-300">{error}</p>}
        <button type="submit" className="w-full min-h-[48px] rounded-xl bg-[#0ECCEE] text-black text-base font-bold hover:opacity-90">Sign in</button>
      </form>
    </section>
  </main>;
}

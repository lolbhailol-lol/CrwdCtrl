import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { volunteerLogin } from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';

export default function VolunteerLoginPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [eventId, setEventId] = useState(params.get('eventId') || '');
  const [code, setCode] = useState(params.get('code') || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await volunteerLogin({ eventId: eventId.trim(), code: code.trim(), password });
      navigate(CAMPUS_HUNT_PATHS.volunteerCheckpoint);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] px-4 text-white">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-[#0ECCEE]">Campus Hunt</p>
          <h1 className="text-3xl font-bold">Volunteer login</h1>
        </div>
        <input
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          placeholder="Event ID"
          className="w-full rounded-xl border border-white/20 bg-[#161718] px-4 py-3"
          required
        />
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Volunteer code"
          className="w-full rounded-xl border border-white/20 bg-[#161718] px-4 py-3 uppercase"
          required
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-xl border border-white/20 bg-[#161718] px-4 py-3"
          required
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#0ECCEE] py-3 font-semibold text-black disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Enter checkpoint'}
        </button>
      </form>
    </div>
  );
}

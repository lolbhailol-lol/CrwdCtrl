import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { enterMysteryTeam } from '../services/mystery.api';
import useMysteryAuth from '../hooks/useMysteryAuth';
import { MYSTERY_PATHS } from '../config';

export default function MysteryTeamEnterPage() {
  const navigate = useNavigate();
  const { persistMysteryAuth } = useMysteryAuth();
  const [teamCode, setTeamCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!teamCode.trim() || !password.trim()) {
      setError('Team code aur password dono chahiye');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await enterMysteryTeam(teamCode.trim().toUpperCase(), password);
      const { team, token } = res.data || res;
      persistMysteryAuth(token, { teamId: team._id, teamCode: team.teamCode, role: 'leader' });
      navigate(MYSTERY_PATHS.play, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0c0d] px-5 text-white">
      <div className="w-full max-w-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">CTRL Mystery access</p>
        <h1 className="mt-2 text-2xl font-bold">Enter your team</h1>
        <div className="mt-6 space-y-3">
          <input
            value={teamCode}
            onChange={(e) => setTeamCode(e.target.value)}
            placeholder="Team code"
            autoCapitalize="characters"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-mono text-white placeholder:text-white/25"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="Team password"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25"
          />
        </div>
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-5 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? 'Entering…' : 'Enter'}
        </button>
      </div>
    </div>
  );
}
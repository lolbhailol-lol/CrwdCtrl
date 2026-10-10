import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { registerMysteryTeam } from '../services/mystery.api';
import useMysteryAuth from '../hooks/useMysteryAuth';
import { MYSTERY_PATHS } from '../config';

export default function MysteryTeamRegisterPage() {
  const { caseId } = useParams();
  const [params] = useSearchParams();
  const eventId = params.get('eventId');
  const navigate = useNavigate();
  const { persistMysteryAuth } = useMysteryAuth();

  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [captainEmail, setCaptainEmail] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!teamName.trim() || !captainName.trim() || !password.trim()) {
      setError('Team name, your name aur password zaroori hain');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await registerMysteryTeam({
        eventId, teamName, password,
        captainName, captainEmail, captainPhone,
      });
      const { team, token } = res.data || res;
      persistMysteryAuth(token, { teamId: team._id, teamCode: team.teamCode, role: 'leader', caseId });
      navigate(MYSTERY_PATHS.play, { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-5 py-10 text-white">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">Register your team</h1>
        <p className="mt-1 text-sm text-white/55">Tum team leader banoge — isi password se baad me login hoga.</p>

        <div className="mt-6 space-y-3">
          <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Team name"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
          <input value={captainName} onChange={(e) => setCaptainName(e.target.value)} placeholder="Your name (captain)"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
          <input value={captainEmail} onChange={(e) => setCaptainEmail(e.target.value)} placeholder="Email (optional)"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
          <input value={captainPhone} onChange={(e) => setCaptainPhone(e.target.value)} placeholder="Phone number"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set team password"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="mt-5 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black disabled:opacity-40"
        >
          {busy ? 'Creating…' : 'Create team & start'}
        </button>
      </div>
    </div>
  );
}
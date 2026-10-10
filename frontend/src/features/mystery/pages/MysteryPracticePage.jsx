import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { startMysteryPractice } from '../services/mystery.api';
import useMysteryAuth from '../hooks/useMysteryAuth';
import { MYSTERY_PATHS } from '../config';

export default function MysteryPracticePage() {
  const { caseId } = useParams();
  const navigate = useNavigate();
  const { persistMysteryAuth } = useMysteryAuth();
  const [playerName, setPlayerName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await startMysteryPractice({ caseId, teamName: 'Solo Investigator', playerName });
      const { team, token } = res.data || res;
      persistMysteryAuth(token, { teamId: team._id, role: 'leader', mode: 'practice' });
      navigate(MYSTERY_PATHS.play, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not start practice');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0b0c0d] px-5 text-white">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold">Solo practice run</h1>
        <p className="mt-2 text-sm text-white/55">Jitni baar chaho khelo — har baar naya attempt.</p>
        <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" className="mt-6 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/25" />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button type="button" disabled={busy} onClick={submit} className="mt-5 w-full rounded-xl bg-[#0ECCEE] py-3.5 text-sm font-bold text-black disabled:opacity-40">
          {busy ? 'Starting…' : 'Start investigating'}
        </button>
      </div>
    </div>
  );
}
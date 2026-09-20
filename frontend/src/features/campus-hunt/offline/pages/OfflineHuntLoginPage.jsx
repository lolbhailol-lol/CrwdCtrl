import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
  saveOfflineSession,
  saveOfflineTeamState,
} from '../offlineDb';
import { hydrateState } from '../offlineEngine';
import { CAMPUS_HUNT_PATHS } from '../../config';
import { armOfflineNetworkGuard } from '../offlineNetworkGuard';

export default function OfflineHuntLoginPage() {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => armOfflineNetworkGuard(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [pack, session] = await Promise.all([
          loadOfflineBundle(),
          loadOfflineSession(),
        ]);
        if (cancelled) return;
        if (!pack) {
          setError('No offline pack on this phone — load a team JSON first.');
          setLoading(false);
          return;
        }
        setBundle(pack);
        if (session?.teamCode === pack.team?.teamCode && session?.memberKey) {
          navigate(CAMPUS_HUNT_PATHS.offlineTeam, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not read offline pack');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const enterAsLeader = async () => {
    if (!bundle || busy) return;
    setBusy(true);
    setError('');
    try {
      const expected = String(bundle?.team?.password || '');
      if (!expected) {
        setError('This pack has no password — re-export from admin after setting team passwords.');
        return;
      }
      if (password.trim() !== expected) {
        setError('Wrong team password');
        return;
      }

      const roster = Array.isArray(bundle?.team?.roster) ? bundle.team.roster : [];
      const leader = roster.find((m) => m.role === 'leader') || roster[0] || {
        memberKey: 'leader',
        role: 'leader',
        slot: 0,
        name: 'Team Leader',
      };

      const teamCode = bundle.team.teamCode;
      let state = await loadOfflineTeamState(teamCode);
      state = hydrateState(bundle, state);
      await saveOfflineTeamState(teamCode, state);
      await saveOfflineSession({
        teamCode,
        memberKey: leader.memberKey || 'leader',
        role: 'leader',
        slot: Number(leader.slot) || 0,
        name: leader.name || 'Team Leader',
        eventId: bundle.event?.id,
        eventSlug: bundle.event?.slug,
        teamName: bundle.team.teamName,
        loggedInAt: new Date().toISOString(),
      });
      navigate(CAMPUS_HUNT_PATHS.offlineTeam);
    } catch (err) {
      setError(err.message || 'Could not start offline session');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading offline pack…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-8 text-white">
      <div className="mx-auto max-w-md">
        <Link to={CAMPUS_HUNT_PATHS.offline} className="text-xs text-white/45 underline">
          ← Change pack
        </Link>
        <h1 className="mt-4 text-xl font-bold">
          {bundle?.team?.teamName || 'Team login'}
        </h1>
        <p className="mt-1 font-mono text-sm text-[#0ECCEE]">{bundle?.team?.teamCode}</p>
        <p className="mt-1 text-xs text-white/50">{bundle?.event?.name}</p>
        <p className="mt-3 text-sm text-white/55">
          One phone only — enter as Team Leader.
        </p>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enterAsLeader();
          }}
          className="mt-6 space-y-3"
        >
          <label className="block text-xs text-white/60">
            Team password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm"
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy ? 'Entering…' : 'Enter as Team Leader'}
          </button>
        </form>
      </div>
    </div>
  );
}

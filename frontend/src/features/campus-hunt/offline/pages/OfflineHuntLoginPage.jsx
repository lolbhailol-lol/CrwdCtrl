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
          setError('No Hunt pack on this phone — open your install link on Wi‑Fi.');
          setLoading(false);
          return;
        }
        setBundle(pack);
        if (session?.teamCode === pack.team?.teamCode && session?.memberKey) {
          navigate(CAMPUS_HUNT_PATHS.offlineTeam, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not read Hunt pack');
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
        setError('This pack has no password — ask the organizer to re-send your link.');
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
      setError(err.message || 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white/60">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-4 py-10 text-white">
      <div className="mx-auto max-w-md">
        <Link to={CAMPUS_HUNT_PATHS.offline} className="text-xs text-white/40">
          ← Welcome
        </Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">
          {bundle?.team?.teamCode || 'Login'}
        </h1>
        {bundle?.team?.teamName ? (
          <p className="mt-1 text-sm text-white/50">{bundle.team.teamName}</p>
        ) : null}
        <p className="mt-4 text-sm text-white/60">
          Enter the team password. One phone only.
        </p>

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enterAsLeader();
          }}
          className="mt-6 space-y-3"
        >
          <label className="block text-xs text-white/55">
            Team password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-2xl border border-white/15 bg-black/40 px-4 py-3.5 text-sm outline-none focus:border-[#0ECCEE]/50"
              autoComplete="off"
              autoFocus
            />
          </label>
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="w-full rounded-2xl bg-[#0ECCEE] py-4 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy ? 'Entering…' : 'Enter Hunt'}
          </button>
        </form>
      </div>
    </div>
  );
}

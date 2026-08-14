import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createInitialTeamState,
  loadOfflineBundle,
  loadOfflineSession,
  loadOfflineTeamState,
  saveOfflineSession,
  saveOfflineTeamState,
} from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';

export default function OfflineHuntLoginPage() {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [password, setPassword] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

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
          navigate(CAMPUS_HUNT_PATHS.offlinePlay, { replace: true });
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not read offline pack');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const roster = useMemo(
    () => (Array.isArray(bundle?.team?.roster) ? bundle.team.roster : []),
    [bundle],
  );

  const tryUnlock = (e) => {
    e.preventDefault();
    setError('');
    const expected = String(bundle?.team?.password || '');
    if (!expected) {
      setError('This pack has no password — re-export from admin after setting team passwords.');
      return;
    }
    if (password.trim() !== expected) {
      setError('Wrong team password');
      return;
    }
    setUnlocked(true);
  };

  const enterAs = async (member) => {
    if (!member || busy) return;
    setBusy(true);
    setError('');
    try {
      const teamCode = bundle.team.teamCode;
      let state = await loadOfflineTeamState(teamCode);
      if (!state) {
        state = createInitialTeamState(bundle);
        await saveOfflineTeamState(teamCode, state);
      }
      const session = {
        teamCode,
        memberKey: member.memberKey,
        role: member.role,
        slot: member.slot,
        name: member.name,
        eventId: bundle.event?.id,
        eventSlug: bundle.event?.slug,
        teamName: bundle.team.teamName,
        loggedInAt: new Date().toISOString(),
      };
      await saveOfflineSession(session);
      setSelected(member);
      navigate(CAMPUS_HUNT_PATHS.offlinePlay);
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

        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

        {!unlocked ? (
          <form onSubmit={tryUnlock} className="mt-6 space-y-3">
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
              className="w-full rounded-xl bg-[#0ECCEE] py-2.5 text-sm font-bold text-black"
            >
              Unlock roster
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-2">
            <p className="text-xs text-white/55">Tap your name to start (offline, no network).</p>
            {roster.map((member) => (
              <button
                key={member.memberKey}
                type="button"
                disabled={busy}
                onClick={() => enterAs(member)}
                className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-left text-sm hover:border-[#0ECCEE]/40 disabled:opacity-50"
              >
                <span className="font-semibold">{member.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-white/45">
                  {member.role === 'leader' ? 'Leader' : `Player ${member.slot}`}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected ? (
          <p className="mt-4 text-xs text-emerald-300">Entering as {selected.name}…</p>
        ) : null}
      </div>
    </div>
  );
}

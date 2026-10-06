import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  HuntPageHeader,
  HuntPageShell,
  HuntPrimaryButton,
  HuntSectionLabel,
  MissionProgress,
} from '../../components/HuntV2Shell';

export default function OfflineHuntLoginPage() {
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cleanup = armOfflineNetworkGuard();
    return cleanup;
  }, []);

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
          navigate(CAMPUS_HUNT_PATHS.offlinePlay, { replace: true });
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
      navigate(CAMPUS_HUNT_PATHS.offlinePlay, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not start');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <HuntPageShell><div className="hunt-v2-page grid place-items-center text-[color:var(--hunt-muted)]">Loading…</div></HuntPageShell>
    );
  }

  return (
    <HuntPageShell>
      <div className="hunt-v2-page">
        <HuntPageHeader title="Join Your Team" backTo={CAMPUS_HUNT_PATHS.offline} />
        <div className="hunt-v2-content">
          <MissionProgress label="Team access" step={7} />
          <HuntSectionLabel>Team access</HuntSectionLabel>
          <section className="hunt-v2-card hunt-v2-card-accent p-4">
            <div className="flex items-center gap-3">
              <img src="/campus-hunt/v2/team-hero.svg" alt="" className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#00828a]">{bundle?.event?.name || 'CTRL Hunt'} • {bundle?.event?.college || 'Campus'}</p>
                <p className="mt-1 text-xs text-[color:var(--hunt-muted)]">Offline leader phone</p>
              </div>
              <span className="rounded-full border border-[#7a59f055] bg-[#7a59f012] px-2 py-1 text-[9px] font-bold text-[#7a59f0]">{bundle?.team?.teamCode || 'TEAM'}</span>
            </div>
          </section>

          <form onSubmit={(event) => { event.preventDefault(); void enterAsLeader(); }} className="mt-4 grid gap-4">
            <label className="hunt-v2-field">Team name
              <input className="hunt-v2-input" value={bundle?.team?.teamName || bundle?.team?.teamCode || ''} readOnly />
            </label>
            <label className="hunt-v2-field">Team password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="hunt-v2-input font-mono text-lg tracking-[.08em]" autoComplete="off" autoFocus />
            </label>
            <div className="hunt-v2-note flex items-center gap-3 p-4 text-sm"><img src="/campus-hunt/v2/team-phone.svg" alt="" className="h-7 w-7" /><span>This phone becomes the active offline game device.</span></div>
            {error ? <p className="hunt-v2-error">{error}</p> : null}
            <HuntPrimaryButton type="submit" disabled={busy || !password.trim()}>{busy ? 'Joining…' : 'Join CTRL Hunt'}</HuntPrimaryButton>
          </form>
        </div>
      </div>
    </HuntPageShell>
  );
}

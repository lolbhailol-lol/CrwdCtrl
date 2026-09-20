import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  enterTeamAsMember,
  fetchEventBySlug,
  fetchMyTeam,
  fetchTeamLoginCard,
  unlockTeamRoster,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import useHuntAuth from '../hooks/useHuntAuth';
import { teamPrimaryLabel, teamSecondaryName } from '../utils/teamLabel';
import { normalizeTeamCode } from '../utils/teamCode';
import { rememberHuntSession } from '../utils/huntSession';
import { readHuntAuthMeta } from '../utils/huntAuth';
import CampusHuntBackLink from './CampusHuntBackLink';

/**
 * Per-team login — password enters as Team Leader (leader-phone-only hunt).
 * Already enrolled on this team → go straight to play (no re-login).
 */
export default function TeamLoginForm({
  slug,
  initialCode = '',
}) {
  const navigate = useNavigate();
  const { isHuntAuthenticated, persistHuntAuth, clearHuntAuth } = useHuntAuth();

  const teamCode = normalizeTeamCode(initialCode);
  const [eventName, setEventName] = useState('');
  const [college, setCollege] = useState('');
  const [password, setPassword] = useState('');
  const [teamCard, setTeamCard] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [sessionCheck, setSessionCheck] = useState('idle');
  const [otherTeamCode, setOtherTeamCode] = useState('');
  const lookupSeq = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetchEventBySlug(slug)
      .then((res) => {
        if (cancelled) return;
        setEventName(res.data?.event?.name || 'Campus Hunt');
        setCollege(res.data?.event?.college || '');
      })
      .catch(() => {
        if (!cancelled) setEventName('Campus Hunt');
      });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!teamCode) {
      setError('Invalid team link');
      setLookingUp(false);
      return;
    }
    const seq = ++lookupSeq.current;
    setLookingUp(true);
    setError('');
    setUnlocked(false);
    setPassword('');
    setOtherTeamCode('');
    (async () => {
      try {
        const res = await fetchTeamLoginCard(slug, teamCode);
        if (seq !== lookupSeq.current) return;
        setTeamCard(res.data);
      } catch (err) {
        if (seq !== lookupSeq.current) return;
        setTeamCard(null);
        setError(err.message || 'Team not found');
      } finally {
        if (seq === lookupSeq.current) setLookingUp(false);
      }
    })();
  }, [slug, teamCode]);

  const playPath = teamCard?.team?.playPath || CAMPUS_HUNT_PATHS.play(slug);
  const eventId = teamCard?.event?.id || teamCard?.event?._id || '';
  const roundLabel = 'Campus Hunt';
  const primary = teamCard?.team
    ? teamPrimaryLabel(teamCard.team)
    : teamCode;
  const secondary = teamCard?.team ? teamSecondaryName(teamCard.team) : '';
  const eventBackPath = CAMPUS_HUNT_PATHS.event(slug);

  const goToPlay = async (knownPayload = null) => {
    rememberHuntSession({
      slug,
      teamCode,
      playPath,
      teamLoginPath: CAMPUS_HUNT_PATHS.teamLogin(slug, teamCode),
    });
    let payload = knownPayload;
    if (!payload && eventId) {
      try {
        const res = await fetchMyTeam(eventId);
        payload = res.data || null;
      } catch {
        payload = null;
      }
    }
    navigate(playPath, { replace: true, state: { huntBootstrap: payload || undefined } });
  };

  // Stay enrolled: same team → rounds hub (or live resume). Keep this screen until ready.
  useEffect(() => {
    if (lookingUp || !teamCode || !eventId) return;
    if (!isHuntAuthenticated) {
      setSessionCheck('ready');
      setOtherTeamCode('');
      return;
    }

    const metaCode = normalizeTeamCode(readHuntAuthMeta()?.teamCode);
    let cancelled = false;
    setSessionCheck('checking');

    (async () => {
      try {
        if (metaCode && metaCode === teamCode) {
          await goToPlay();
          return;
        }
        const res = await fetchMyTeam(eventId);
        if (cancelled) return;
        const myCode = normalizeTeamCode(res.data?.team?.teamCode);
        if (myCode && myCode === teamCode) {
          await goToPlay(res.data);
          return;
        }
        if (myCode && myCode !== teamCode) {
          setOtherTeamCode(myCode);
          setSessionCheck('other');
          return;
        }
        setSessionCheck('ready');
      } catch {
        if (!cancelled) {
          clearHuntAuth();
          setSessionCheck('ready');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isHuntAuthenticated,
    lookingUp,
    eventId,
    teamCode,
    playPath,
    slug,
    navigate,
    clearHuntAuth,
  ]);

  const enterAsLeader = async (member, { keepBusy = false } = {}) => {
    if (!teamCode) {
      setError('Invalid team link');
      return;
    }
    if (!String(password || '').trim()) {
      setError('Enter the team password');
      return;
    }
    if (!member || member.role !== 'leader') {
      setError('Team Leader account is missing — ask your organizer to repair this roster');
      return;
    }

    if (!keepBusy) {
      setBusy(true);
      setError('');
    }
    try {
      const result = await enterTeamAsMember(slug, teamCode, {
        password: String(password).trim(),
        role: 'leader',
        slot: 0,
      });

      if (!result?.success || !result?.token) {
        throw new Error('Login failed');
      }

      const enteredRole = result.team?.role || 'leader';
      if (enteredRole !== 'leader') {
        throw new Error('Leader login only — ask your organizer if this team has no leader seat');
      }

      const myName = result.team?.myName || result.user?.name || member.name || '';
      rememberHuntSession({
        slug,
        teamCode,
        playPath: result.team?.playPath || playPath,
        teamLoginPath: CAMPUS_HUNT_PATHS.teamLogin(slug, teamCode),
      });
      persistHuntAuth(result.token, {
        slug,
        teamCode,
        myName,
        role: enteredRole,
        userId: result.user?.id || result.user?._id || '',
      });
      await goToPlay();
    } catch (err) {
      setError(err.message || 'Wrong password');
      throw err;
    } finally {
      if (!keepBusy) setBusy(false);
    }
  };

  const unlockAndEnterAsLeader = async () => {
    if (!teamCode) {
      setError('Invalid team link');
      return;
    }
    if (!String(password || '').trim()) {
      setError('Enter the team password');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await unlockTeamRoster(slug, teamCode, String(password).trim());
      const list = res.data?.team?.members || [];
      const leaderMember = list.find((m) => m.role === 'leader') || null;
      if (!leaderMember) {
        setError('No Team Leader on this roster — ask your organizer to repair it');
        return;
      }
      // Stay busy through unlock → enter so the form doesn't flash mid-pass
      await enterAsLeader(leaderMember, { keepBusy: true });
    } catch (err) {
      setUnlocked(false);
      setError(err.message || 'Wrong password');
    } finally {
      setBusy(false);
    }
  };

  const switchToThisTeam = () => {
    clearHuntAuth();
    setOtherTeamCode('');
    setSessionCheck('ready');
    setUnlocked(false);
    setPassword('');
    setError('');
  };

  if (!teamCode) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b0c0d] px-4 text-center text-white">
        <h1 className="text-2xl font-bold">Invalid team link</h1>
        <p className="text-white/55">Ask your organizer for your team URL.</p>
        <Link to={eventBackPath} className="text-[#0ECCEE] underline">Campus Hunt</Link>
      </div>
    );
  }

  if (sessionCheck === 'other' && otherTeamCode) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0c0d] px-5 text-center text-white">
        <div className="absolute left-4 top-[max(1rem,var(--safe-top))] z-10">
          <CampusHuntBackLink to={eventBackPath} label="Back" forceTo />
        </div>
        <div className="relative max-w-md space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">
            {roundLabel}
          </p>
          <h1 className="text-2xl font-bold">Wrong team link</h1>
          <p className="text-sm text-white/60">
            This phone is on team{' '}
            <span className="font-mono text-white">{otherTeamCode}</span>.
            This link is{' '}
            <span className="font-mono text-white">{teamCode}</span>.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Link
              to={playPath}
              className="rounded-xl bg-[#0ECCEE] px-4 py-3 text-sm font-bold text-black"
            >
              Continue as {otherTeamCode}
            </Link>
            <button
              type="button"
              disabled={busy}
              onClick={switchToThisTeam}
              className="rounded-xl border border-white/20 px-4 py-3 text-sm text-white/80 disabled:opacity-40"
            >
              Switch person · join {teamCode}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0c0d] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 45% at 50% -5%, #0ECCEE33, transparent 55%), linear-gradient(180deg, #121416 0%, #0b0c0d 70%)',
        }}
      />
      <div className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
        <CampusHuntBackLink
          to={eventBackPath}
          label="Back"
          className="mb-4 self-start"
          forceTo
        />
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#0ECCEE]">
          Campus Hunt access
        </p>
        <h1 className="mt-2 font-mono text-4xl font-bold tracking-tight">
          {lookingUp && !teamCard ? '…' : (primary || teamCode)}
        </h1>
        {secondary ? (
          <p className="mt-1 text-lg text-white/70">{secondary}</p>
        ) : null}
        <p className="mt-2 text-sm text-white/50">
          {eventName}
          {college ? ` · ${college}` : ''}
        </p>
        <p className="mt-3 text-sm text-white/60">
          Enter your team password — you stay in on this phone.
        </p>

        <div className="mt-8">
          <label className="block text-xs font-semibold uppercase tracking-wide text-white/45">
            Team password
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (unlocked) setUnlocked(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void unlockAndEnterAsLeader();
                }
              }}
              placeholder="Password from your organizer"
              autoComplete="current-password"
              autoFocus
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-lg text-white placeholder:text-white/25 focus:border-[#0ECCEE]/50 focus:outline-none"
            />
          </label>
          <button
            type="button"
            disabled={busy || lookingUp || !password.trim()}
            onClick={() => void unlockAndEnterAsLeader()}
            className="mt-3 w-full rounded-xl bg-[#0ECCEE] px-4 py-3.5 text-sm font-bold text-black disabled:opacity-40"
          >
            {busy ? 'Entering…' : 'Enter as Team Leader'}
          </button>
          {lookingUp && !teamCard && (
            <p className="mt-3 text-sm text-white/45">Opening team…</p>
          )}
          {sessionCheck === 'checking' && !lookingUp && (
            <p className="mt-3 text-sm text-white/45">Opening rounds…</p>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/60">
          <p className="font-semibold text-white">One phone · Team Leader</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>Password → enter as Team Leader → done</li>
            <li>Only the leader phone plays and scans</li>
            <li>Refresh or reopen — still in the hunt</li>
            <li>Teammates help in person — no separate logins</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

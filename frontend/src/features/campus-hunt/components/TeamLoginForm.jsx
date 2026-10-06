import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import {
  HuntPageHeader,
  HuntPageShell,
  HuntPrimaryButton,
  HuntSectionLabel,
  MissionProgress,
} from './HuntV2Shell';

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
      <HuntPageShell>
        <div className="hunt-v2-page">
          <HuntPageHeader title="Join Your Team" backTo={eventBackPath} />
          <div className="hunt-v2-content">
            <p className="hunt-v2-error">Invalid team link. Ask your organizer for your team URL.</p>
            <HuntPrimaryButton className="mt-4" onClick={() => navigate(eventBackPath)}>Back to Campus Hunt</HuntPrimaryButton>
          </div>
        </div>
      </HuntPageShell>
    );
  }

  if (sessionCheck === 'other' && otherTeamCode) {
    return (
      <HuntPageShell>
        <div className="hunt-v2-page">
          <HuntPageHeader title="Join Your Team" backTo={eventBackPath} />
          <div className="hunt-v2-content">
            <MissionProgress label="Team access" step={7} />
            <section className="hunt-v2-card mt-4 p-5 text-center">
              <h1 className="text-2xl font-extrabold">Wrong team link</h1>
              <p className="mt-3 text-sm text-[color:var(--hunt-muted)]">This phone is on <b>{otherTeamCode}</b>, but this link belongs to <b>{teamCode}</b>.</p>
              <HuntPrimaryButton className="mt-5" onClick={() => navigate(playPath)}>Continue as {otherTeamCode}</HuntPrimaryButton>
              <button type="button" disabled={busy} onClick={switchToThisTeam} className="hunt-v2-secondary mt-3">Switch phone to {teamCode}</button>
            </section>
          </div>
        </div>
      </HuntPageShell>
    );
  }

  return (
    <HuntPageShell>
      <div className="hunt-v2-page">
        <HuntPageHeader title="Join Your Team" backTo={eventBackPath} />
        <div className="hunt-v2-content">
          <MissionProgress label="Team access" step={7} />
          <HuntSectionLabel>Team access</HuntSectionLabel>

          <section className="hunt-v2-card hunt-v2-card-accent p-4">
            <div className="flex items-center gap-3">
              <img src="/campus-hunt/v2/team-hero.svg" alt="" className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-extrabold text-[#00828a]">{eventName || roundLabel} • {college || 'Campus'}</p>
                <p className="mt-1 text-xs text-[color:var(--hunt-muted)]">Leader phone • live team access</p>
              </div>
              <span className="rounded-full border border-[#7a59f055] bg-[#7a59f012] px-2 py-1 text-[9px] font-bold text-[#7a59f0]">TEAM • {teamCode}</span>
            </div>
          </section>

          <div className="mt-4 grid gap-4">
            <label className="hunt-v2-field">Team name
              <input className="hunt-v2-input" value={lookingUp && !teamCard ? 'Opening team…' : (secondary || primary || teamCode)} readOnly />
            </label>
            <label className="hunt-v2-field">Team password
              <input
                type="password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (unlocked) setUnlocked(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void unlockAndEnterAsLeader();
                  }
                }}
                placeholder="Password from your organizer"
                autoComplete="current-password"
                autoFocus
                className="hunt-v2-input font-mono text-lg tracking-[.08em]"
              />
            </label>
          </div>

          <div className="hunt-v2-note mt-4 flex items-center gap-3 p-4 text-sm">
            <img src="/campus-hunt/v2/team-phone.svg" alt="" className="h-7 w-7" />
            <span>This phone becomes the active game device.</span>
          </div>

          {error ? <p className="hunt-v2-error mt-4">{error}</p> : null}
          {sessionCheck === 'checking' && !lookingUp ? <p className="mt-3 text-sm text-[color:var(--hunt-muted)]">Opening hunt…</p> : null}

          <HuntPrimaryButton
            className="mt-4"
            disabled={busy || lookingUp || !password.trim()}
            onClick={() => void unlockAndEnterAsLeader()}
          >
            {busy ? 'Joining…' : 'Join CTRL Hunt'}
          </HuntPrimaryButton>
        </div>
      </div>
    </HuntPageShell>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
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
import CampusHuntBackLink from './CampusHuntBackLink';

/**
 * Per-team login — password unlocks names → tap who you are.
 * Already enrolled on this team → go straight to play (no re-login).
 */
export default function TeamLoginForm({
  slug,
  initialCode = '',
  preselectRole = null,
  preselectSlot = 0,
}) {
  const navigate = useNavigate();
  const { isHuntAuthenticated, persistHuntAuth, clearHuntAuth } = useHuntAuth();

  const teamCode = normalizeTeamCode(initialCode);
  const [eventName, setEventName] = useState('');
  const [college, setCollege] = useState('');
  const [password, setPassword] = useState('');
  const [teamCard, setTeamCard] = useState(null);
  const [members, setMembers] = useState([]);
  const [unlocked, setUnlocked] = useState(false);
  const [roleTips, setRoleTips] = useState(null);
  const [selected, setSelected] = useState(null);
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
    setMembers([]);
    setSelected(null);
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

  // Stay enrolled: same team → go straight to play (hunt token already stored).
  useEffect(() => {
    if (lookingUp || !teamCode || !eventId) return;
    if (!isHuntAuthenticated) {
      setSessionCheck('ready');
      setOtherTeamCode('');
      return;
    }
    let cancelled = false;
    setSessionCheck('checking');
    (async () => {
      try {
        const res = await fetchMyTeam(eventId);
        if (cancelled) return;
        const myCode = normalizeTeamCode(res.data?.team?.teamCode);
        if (myCode && myCode === teamCode) {
          rememberHuntSession({
            slug,
            teamCode,
            playPath,
            teamLoginPath: CAMPUS_HUNT_PATHS.teamLogin(slug, teamCode),
          });
          navigate(playPath, { replace: true });
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
    return () => { cancelled = true; };
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

  const leader = useMemo(
    () => members.find((m) => m.role === 'leader') || null,
    [members],
  );
  const players = useMemo(
    () => members.filter((m) => m.role === 'scanner'),
    [members],
  );

  const unlockNames = async () => {
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
      setMembers(list);
      setRoleTips(res.data?.team?.roles || null);
      setUnlocked(true);
      if (preselectRole === 'leader') {
        setSelected(list.find((m) => m.role === 'leader') || null);
      } else if (
        (preselectRole === 'scanner' || preselectRole === 'player')
        && preselectSlot
      ) {
        setSelected(
          list.find((m) => m.role === 'scanner' && m.slot === Number(preselectSlot))
            || null,
        );
      } else {
        setSelected(null);
      }
    } catch (err) {
      setUnlocked(false);
      setMembers([]);
      setError(err.message || 'Wrong password');
    } finally {
      setBusy(false);
    }
  };

  const enterAs = async (member) => {
    if (!teamCode) {
      setError('Invalid team link');
      return;
    }
    if (!String(password || '').trim()) {
      setError('Enter the team password');
      return;
    }
    if (!member) {
      setError('Pick who you are');
      return;
    }

    setBusy(true);
    setError('');
    setSelected(member);
    try {
      const role = member.role === 'leader' ? 'leader' : 'player';
      const slot = member.role === 'leader' ? 0 : Number(member.slot || 0);
      const result = await enterTeamAsMember(slug, teamCode, {
        password: String(password).trim(),
        role,
        slot,
      });

      if (!result?.success || !result?.token) {
        throw new Error('Login failed');
      }

      const enteredRole = result.team?.role || role;
      if (enteredRole === 'leader' && role !== 'leader') {
        throw new Error('Login mismatched — try again as player');
      }
      if (enteredRole !== 'leader' && role === 'leader') {
        throw new Error('Login mismatched — try again as leader');
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
      navigate(result.team?.playPath || playPath, { replace: true });
    } catch (err) {
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
    setMembers([]);
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

  if (sessionCheck === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b0c0d] text-white">
        Checking hunt access…
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
                if (unlocked) {
                  setUnlocked(false);
                  setMembers([]);
                  setSelected(null);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void unlockNames();
                }
              }}
              placeholder="Password from your organizer"
              autoComplete="current-password"
              autoFocus
              className="mt-2 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3.5 text-lg text-white placeholder:text-white/25 focus:border-[#0ECCEE]/50 focus:outline-none"
            />
          </label>
          {!unlocked && (
            <button
              type="button"
              disabled={busy || lookingUp || !password.trim()}
              onClick={() => void unlockNames()}
              className="mt-3 w-full rounded-xl bg-[#0ECCEE] px-4 py-3.5 text-sm font-bold text-black disabled:opacity-40"
            >
              {busy ? 'Checking…' : 'Continue → show names'}
            </button>
          )}
          {lookingUp && (
            <p className="mt-3 text-sm text-white/45">Loading team…</p>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

        {unlocked && members.length > 0 && (
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
              Who are you? ({members.length} on this team)
            </p>

            {leader && (
              <button
                type="button"
                disabled={busy}
                onClick={() => enterAs(leader)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left disabled:opacity-50 ${
                  selected?.role === 'leader'
                    ? 'border-amber-300/60 bg-amber-500/20'
                    : 'border-amber-400/35 bg-amber-500/10 hover:bg-amber-500/15'
                }`}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                    Leader
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {leader.name || 'Team Leader'}
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">
                    {roleTips?.leader || 'Starts missions · submits answers · also scans'}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-amber-300 px-3 py-1.5 text-xs font-bold text-black">
                  {busy && selected?.role === 'leader' ? '…' : 'Enter →'}
                </span>
              </button>
            )}

            {players.map((m) => (
              <button
                key={`player-${m.slot}`}
                type="button"
                disabled={busy}
                onClick={() => enterAs(m)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-4 text-left disabled:opacity-50 ${
                  selected?.role === 'scanner' && selected?.slot === m.slot
                    ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/15'
                    : 'border-white/12 bg-white/4 hover:border-white/25'
                }`}
              >
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                    Player {m.slot}
                  </p>
                  <p className="text-lg font-semibold text-white">
                    {m.name || `Player ${m.slot}`}
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">
                    {roleTips?.player || 'Help your leader · scan when Round 1 asks'}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#0ECCEE]">
                  {busy && selected?.slot === m.slot ? '…' : 'Enter →'}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/4 p-4 text-sm text-white/60">
          <p className="font-semibold text-white">Once · stay in</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-4">
            <li>Password → tap your name → done</li>
            <li>Refresh or reopen — still in the hunt</li>
            <li>After login, pick a round from the list</li>
            <li>Leader starts timed steps · players help as instructed</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminRevealTeamAccess,
  adminReleaseTeam,
  adminMarkTeamStartReached,
  adminPlaytestCompleteScan,
  adminPlaytestResetTeam,
  adminRepairTeamRosters,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import { stageLabel } from '../types/stages';
import { teamInlineLabel } from '../utils/teamLabel';

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => onDone?.()).catch(() => {});
}

function stationForTeam(stations, teamCode, keyPrefix) {
  const code = String(teamCode || '').toUpperCase();
  return (stations || []).find((s) => {
    const key = String(s.progressionKey || s.checkpointKey || '');
    const team = String(s.teamCode || '').toUpperCase();
    return team === code && key.startsWith(keyPrefix);
  });
}

const SCAN_CARDS = [
  {
    id: '1',
    label: 'Orange',
    next: '→ Clue 2',
    color: 'border-orange-400/50 bg-orange-500/15',
    btn: 'bg-orange-500 text-white',
    codeClass: 'text-orange-200',
  },
  {
    id: '2',
    label: 'Green',
    next: '→ Clue 3 riddle',
    color: 'border-emerald-400/50 bg-emerald-500/15',
    btn: 'bg-emerald-400 text-black',
    codeClass: 'text-emerald-200',
  },
  {
    id: '3',
    label: 'Blue',
    next: '→ Final',
    color: 'border-blue-400/50 bg-blue-500/15',
    btn: 'bg-blue-500 text-white',
    codeClass: 'text-blue-200',
  },
];

function teamRosterLooksReady(team) {
  return Boolean(
    team?.leaderUserId
    && Array.isArray(team?.memberUserIds)
    && team.memberUserIds.length === 3
    && team.accessPack?.leader?.loginEmail
    && Array.isArray(team.accessPack?.scanners)
    && team.accessPack.scanners.length === 3,
  );
}

/**
 * Cheat desk: pick a team, tap steps in order, skip phone scans.
 */
export default function PlaytestDesk({
  eventId,
  eventSlug,
  teams = [],
  stations = [],
  roundStatus,
  onChanged,
}) {
  const sorted = useMemo(
    () => [...teams].sort((a, b) => String(a.teamCode).localeCompare(String(b.teamCode), undefined, { numeric: true })),
    [teams],
  );
  const [teamId, setTeamId] = useState('');
  const [access, setAccess] = useState(null);
  const [accessLoaded, setAccessLoaded] = useState(false);
  const [revealError, setRevealError] = useState('');
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!teamId && sorted[0]?._id) setTeamId(String(sorted[0]._id));
  }, [sorted, teamId]);

  const team = sorted.find((t) => String(t._id) === String(teamId)) || null;
  const Orange = stationForTeam(stations, team?.teamCode, '1');
  const green = stationForTeam(stations, team?.teamCode, '2');
  const blue = stationForTeam(stations, team?.teamCode, '3');
  const stationByScan = { 1: Orange, 2: green, 3: blue };

  const playPath = eventSlug ? CAMPUS_HUNT_PATHS.play(eventSlug) : '';
  const teamLoginPath = eventSlug && team?.teamCode
    ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, team.teamCode)
    : '';
  const absoluteTeamLogin = teamLoginPath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${teamLoginPath}`
    : '';

  const paste = (station) => station?.pasteHint || (station?.pasteCode ? `CH-${station.pasteCode}` : '');

  const reveal = async (silent = false) => {
    if (!teamId) return false;
    setBusy('reveal');
    if (!silent) setNote('');
    try {
      const res = await adminRevealTeamAccess(teamId);
      const pack = res.data?.access || res.data?.team?.access || null;
      if (pack && res.data?.team?.allMemberNames) {
        pack.allMemberNames = res.data.team.allMemberNames;
      }
      setAccess(pack);
      setRevealError('');
      if (!silent) setNote('Logins ready — copy leader below');
      return Boolean(
        pack?.teamPassword
        || pack?.sharedScannerPassword
        || pack?.leader?.password,
      );
    } catch (err) {
      setAccess(null);
      setRevealError(err.message || 'Could not reveal logins');
      if (!silent) setNote(err.message || 'Could not reveal logins');
      return false;
    } finally {
      setBusy('');
      setAccessLoaded(true);
    }
  };

  const repairRoster = async () => {
    if (!eventId) {
      setNote('Missing event id — refresh the admin page');
      return;
    }
    setBusy('repair');
    setNote('');
    setRevealError('');
    try {
      await adminRepairTeamRosters(eventId);
      await onChanged?.();
      const ok = await reveal(true);
      setNote(
        ok
          ? `${team?.teamCode || 'Team'} roster repaired — password ready below`
          : 'Repair finished but password still missing — tap Refresh password',
      );
    } catch (err) {
      setNote(err.message || 'Could not repair roster');
    } finally {
      setBusy('');
    }
  };

  // Auto-load logins when team changes
  useEffect(() => {
    if (!teamId) return undefined;
    setAccess(null);
    setAccessLoaded(false);
    setRevealError('');
    let cancelled = false;
    (async () => {
      try {
        const res = await adminRevealTeamAccess(teamId);
        if (!cancelled) {
          setAccess(res.data?.access || res.data?.team?.access || null);
          setRevealError('');
        }
      } catch (err) {
        if (!cancelled) {
          setAccess(null);
          setRevealError(err.message || 'Could not reveal logins');
        }
      } finally {
        if (!cancelled) setAccessLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  const releaseNow = async () => {
    if (!teamId) return;
    setBusy('release');
    setNote('');
    try {
      await adminReleaseTeam(teamId, {
        reason: 'Playtest desk — manual early release',
      });
      setNote('Released — Clue 1 unlocked. Open play as leader.');
      await onChanged?.();
    } catch (err) {
      setNote(err.message || 'Release failed — is Round 1 live & schedule locked?');
    } finally {
      setBusy('');
    }
  };

  const completeScan = async (scan) => {
    if (!teamId) return;
    setBusy(`scan-${scan}`);
    setNote('');
    try {
      const res = await adminPlaytestCompleteScan(teamId, {
        scan,
        reason: 'Playtest desk cheat 4/4',
      });
      const labels = (res.data?.scans || []).map((row) => row.label).join(', ');
      const tips = {
        1: 'Orange 4/4 forced — player phones refresh ~1s. Solve Clue 2 on phone (or tap Green next)',
        2: 'Green 4/4 forced — player phones refresh ~1s. Solve Clue 3 on phone, then Blue',
        3: 'Blue 4/4 forced — player phones refresh ~1s. Solve Final, then Mark finish',
        all: 'All scans forced. Keep player screens open — they update fast. Finish missing clues · Mark finish',
      };
      setNote(tips[scan] || `${labels} done`);
      await onChanged?.();
    } catch (err) {
      setNote(err.message || 'Scan cheat failed');
    } finally {
      setBusy('');
    }
  };

  const markFinish = async () => {
    if (!teamId) return;
    setBusy('finish');
    setNote('');
    try {
      await adminMarkTeamStartReached(teamId, {
        reason: 'Playtest desk — marked reached',
      });
      setNote('Finished — score locked');
      await onChanged?.();
    } catch (err) {
      setNote(err.message || 'Could not mark reached');
    } finally {
      setBusy('');
    }
  };

  const startOver = async () => {
    if (!teamId) return;
    if (!window.confirm(
      `Reset ${team?.teamCode || 'this team'} to zero?\nScore → 100 · progress cleared`,
    )) return;
    setBusy('reset');
    setNote('');
    try {
      await adminPlaytestResetTeam(teamId, {
        reason: 'Playtest desk — start from again',
      });
      setNote('Reset done — tap Release again');
      await onChanged?.();
    } catch (err) {
      setNote(err.message || 'Could not reset team');
    } finally {
      setBusy('');
    }
  };

  const teamPass = access?.teamPassword
    || access?.sharedScannerPassword
    || access?.leader?.password
    || '';
  const rosterIncomplete = team && !teamRosterLooksReady(team);
  const needsRepair = accessLoaded && !teamPass && (rosterIncomplete || Boolean(revealError));
  const memberNames = access?.allMemberNames?.length
    ? access.allMemberNames
    : [
      access?.leader?.name,
      ...(access?.scanners || []).map((s) => s.name),
    ].filter(Boolean);

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
            Playtest cheat desk
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">One team · tap in order</h2>
          <p className="mt-1 text-sm text-white/55">
            Release → Orange → Green → Clue 3 on phone → Blue → Final on phone → Finish
          </p>
        </div>
        {roundStatus && (
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/60">
            Round: {roundStatus}
          </span>
        )}
      </div>

      {roundStatus !== 'live' && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Round must be <strong>live</strong> first (Schedule → Lock → Start Round 1).
        </p>
      )}

      {/* Team picker */}
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-white/55">
          Team
          <select
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              setNote('');
            }}
            className="mt-1 block min-w-[14rem] rounded-lg border border-white/15 bg-[#161718] px-3 py-2.5 text-sm text-white"
          >
            {sorted.map((t) => (
              <option key={t._id} value={t._id}>
                {teamInlineLabel(t)} · {stageLabel(t.currentStage)}
              </option>
            ))}
          </select>
        </label>
        {team && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/45">Now</span>
            {' '}
            <span className="font-semibold text-white">{stageLabel(team.currentStage)}</span>
            <span className="mx-2 text-white/25">·</span>
            <span className="font-semibold text-[#0ECCEE]">{team.currentScore ?? 0}</span>
            <span className="text-white/45"> pts</span>
          </div>
        )}
        <button
          type="button"
          disabled={Boolean(busy) || !teamId}
          onClick={startOver}
          className="rounded-lg border border-white/20 px-3 py-2.5 text-sm text-white/80 disabled:opacity-40"
        >
          {busy === 'reset' ? '…' : '↺ Start over'}
        </button>
      </div>

      {/* Setup row */}
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          disabled={Boolean(busy) || !teamId || roundStatus !== 'live'}
          onClick={releaseNow}
          className="rounded-xl bg-emerald-400 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-black/60">Step 1</p>
          <p className="text-sm font-bold text-black">
            {busy === 'release' ? 'Releasing…' : 'Release team'}
          </p>
          <p className="mt-0.5 text-[11px] text-black/55">Unlock Clue 1 now</p>
        </button>

        {teamLoginPath ? (
          <a
            href={teamLoginPath}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 hover:bg-white/10"
          >
            <p className="text-[11px] font-semibold uppercase text-white/40">Step 2</p>
            <p className="text-sm font-bold text-white">Open team link ↗</p>
            <p className="mt-0.5 text-[11px] text-white/45">Password → tap name</p>
          </a>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 opacity-40">
            <p className="text-sm text-white/50">Login link</p>
          </div>
        )}

        {playPath ? (
          <Link
            to={playPath}
            target="_blank"
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 hover:bg-white/10"
          >
            <p className="text-[11px] font-semibold uppercase text-white/40">Step 3</p>
            <p className="text-sm font-bold text-white">Open play ↗</p>
            <p className="mt-0.5 text-[11px] text-white/45">Leader dashboard</p>
          </Link>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 opacity-40">
            <p className="text-sm text-white/50">Play link</p>
          </div>
        )}

        <button
          type="button"
          disabled={Boolean(busy) || !teamId}
          onClick={markFinish}
          className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-rose-200/70">Last</p>
          <p className="text-sm font-bold text-rose-100">
            {busy === 'finish' ? '…' : 'Mark finish'}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-100/50">After Final word</p>
        </button>
      </div>

      {/* Shared team login — one link + one password */}
      <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Team login (all 4 people)
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || !teamId}
            onClick={() => reveal(false)}
            className="text-[11px] text-white/45 underline disabled:opacity-40"
          >
            {busy === 'reveal' ? 'Loading…' : 'Refresh password'}
          </button>
        </div>
        {absoluteTeamLogin && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="max-w-full break-all rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-[11px] text-[#0ECCEE]">
              {absoluteTeamLogin}
            </code>
            <button
              type="button"
              className="rounded-lg bg-[#0ECCEE]/20 px-2.5 py-1.5 text-xs font-semibold text-[#0ECCEE]"
              onClick={() => copyText(absoluteTeamLogin, () => setNote('Team login link copied'))}
            >
              Copy link
            </button>
          </div>
        )}
        {teamPass ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
            <p className="w-full text-[11px] uppercase tracking-wide text-amber-200/70">Password</p>
            <code className="rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-xs text-white/90">
              {teamPass}
            </code>
            <button
              type="button"
              className="rounded-lg bg-amber-400/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100"
              onClick={() => copyText(
                `${absoluteTeamLogin}\nPassword: ${teamPass}\nNames: ${memberNames.join(', ')}`,
                () => setNote('Team access pack copied'),
              )}
            >
              Copy access pack
            </button>
            {memberNames.length > 0 && (
              <p className="w-full text-xs text-white/55">
                Tap names: {memberNames.join(' · ')}
              </p>
            )}
          </div>
        ) : needsRepair ? (
          <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
            <p className="text-xs text-amber-100">
              {revealError || 'No team password — roster accounts are missing or incomplete.'}
            </p>
            <button
              type="button"
              disabled={Boolean(busy) || !eventId}
              onClick={repairRoster}
              className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              {busy === 'repair' ? 'Repairing…' : 'Repair this team roster'}
            </button>
            <p className="text-[11px] text-white/40">
              Provisions leader + 3 player logins, then reveals the shared password here.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/40">Loading password…</p>
        )}
      </div>

      {/* Cheat scans — big colored cards */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Cheat scans (skip phones)
          </p>
          <button
            type="button"
            disabled={Boolean(busy) || !teamId}
            onClick={() => completeScan('all')}
            className="rounded-lg bg-amber-400/90 px-2.5 py-1 text-[11px] font-bold text-black disabled:opacity-40"
          >
            {busy === 'scan-all' ? '…' : 'Do ALL Orange+green+blue'}
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCAN_CARDS.map((card, idx) => {
            const station = stationByScan[card.id];
            const code = paste(station);
            return (
              <div
                key={card.id}
                className={`rounded-xl border p-3 ${card.color}`}
              >
                <p className="text-[11px] font-semibold uppercase text-white/50">
                  Scan {idx + 1}
                </p>
                <p className="text-base font-bold text-white">{card.label}</p>
                <p className="text-[11px] text-white/50">{card.next}</p>
                <button
                  type="button"
                  disabled={!code}
                  onClick={() => copyText(code, () => setNote(`${card.label} code copied`))}
                  className={`mt-2 block w-full break-all rounded-lg bg-black/35 px-2 py-2 text-left font-mono text-xs ${card.codeClass} disabled:opacity-40`}
                  title="Tap to copy"
                >
                  {code || 'No code — save clues / schedule'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy) || !teamId}
                  onClick={() => completeScan(card.id)}
                  className={`mt-2 w-full rounded-lg px-3 py-2.5 text-sm font-bold disabled:opacity-40 ${card.btn}`}
                >
                  {busy === `scan-${card.id}` ? '…' : `${card.label} 4/4 ✓`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Tip: after Green, do Clue 3 on the play page before Blue. After Blue, do Final, then Mark finish.
        </p>
      </div>

      {note && (
        <p className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100">
          {note}
        </p>
      )}
    </section>
  );
}

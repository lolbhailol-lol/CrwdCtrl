import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminRevealTeamAccess,
  adminReleaseFinaleTeam,
  adminStopFinaleTeam,
  adminResumeFinaleTeam,
  adminPlaytestCompleteFinaleMission,
  adminPlaytestAdvanceFinaleMission,
  adminPlaytestResetFinaleTeam,
  adminResetFinaleForRetest,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';

function copyText(text, onDone) {
  if (!text) return;
  navigator.clipboard?.writeText(String(text)).then(() => onDone?.()).catch(() => {});
}

function teamIdOf(entry) {
  return String(entry?.teamId?._id || entry?.teamId || entry?.id || '');
}

function playtestNote(res, fallback) {
  const adv = res?.data?.playtestAdvance;
  if (!adv?.message) return fallback;
  const bits = [adv.message];
  if (adv.accessToken) bits.push(`token ${adv.accessToken}`);
  if (adv.route) bits.push(`route ${adv.route}`);
  if (adv.frequency) bits.push(`freq ${adv.frequency}`);
  if (adv.intel1Fragment) bits.push(`frag1 ${adv.intel1Fragment}`);
  if (adv.intel2Fragment) bits.push(`frag2 ${adv.intel2Fragment}`);
  return bits.join(' · ');
}

/**
 * Finale Live: pick one finalist → Release → open link → cheat missions → Mark finish.
 * Mirrors Round 1 PlaytestDesk for Finals.
 */
export default function FinalePlaytestDesk({
  eventId,
  eventSlug,
  entries = [],
  roundStatus,
  onChanged,
}) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true })),
    [entries],
  );
  const [teamId, setTeamId] = useState('');
  const [access, setAccess] = useState(null);
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!teamId && sorted[0]) setTeamId(teamIdOf(sorted[0]));
  }, [sorted, teamId]);

  const entry = sorted.find((e) => teamIdOf(e) === String(teamId)) || null;
  const completed = entry?.completedMissionIds || [];
  const intelDone = completed.includes('intel_hunt');
  const lockboxDone = completed.includes('lockbox');
  const terminalDone = completed.includes('field_terminal') || completed.includes('borrowed_device');
  const blackoutDone = completed.includes('operation_blackout');

  const teamLoginPath = eventSlug && entry?.teamCode
    ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, entry.teamCode)
    : '';
  const absoluteTeamLogin = teamLoginPath
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${teamLoginPath}`
    : '';
  const playPath = eventSlug ? CAMPUS_HUNT_PATHS.play(eventSlug) : '';

  const reveal = async (silent = false) => {
    if (!teamId) return;
    setBusy('reveal');
    if (!silent) setNote('');
    try {
      const res = await adminRevealTeamAccess(teamId);
      const pack = res.data?.access || res.data?.team?.access || null;
      if (pack && res.data?.team?.allMemberNames) {
        pack.allMemberNames = res.data.team.allMemberNames;
      }
      setAccess(pack);
      if (!silent) setNote('Logins ready — copy password below');
    } catch (err) {
      setNote(err.message || 'Could not reveal logins');
    } finally {
      setBusy('');
    }
  };

  useEffect(() => {
    if (!teamId) return undefined;
    setAccess(null);
    let cancelled = false;
    (async () => {
      try {
        const res = await adminRevealTeamAccess(teamId);
        if (cancelled) return;
        const pack = res.data?.access || res.data?.team?.access || null;
        if (pack && res.data?.team?.allMemberNames) {
          pack.allMemberNames = res.data.team.allMemberNames;
        }
        setAccess(pack);
      } catch {
        /* ignore auto-load errors */
      }
    })();
    return () => { cancelled = true; };
  }, [teamId]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    setNote('');
    try {
      const res = await fn();
      setNote(playtestNote(res, ok) || res?.message || ok);
      await onChanged?.();
    } catch (err) {
      setNote(err.message || 'Action failed');
    } finally {
      setBusy('');
    }
  };

  const runTeam = async (key, fn, ok) => {
    if (!teamId) return;
    return run(key, fn, ok);
  };

  const advance = (key, missionId, task, ok) => runTeam(
    key,
    () => adminPlaytestAdvanceFinaleMission(eventId, teamId, missionId, task),
    ok,
  );

  const teamPass = access?.teamPassword
    || access?.sharedScannerPassword
    || access?.leader?.password
    || '';

  return (
    <section className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0a1218] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
            Finale playtest desk
          </p>
          <h2 className="mt-1 text-lg font-bold text-white">One team · manual ops</h2>
          <p className="mt-1 text-sm text-white/55">
            Select finalist → Release → open link → pass tasks or whole missions → Mark finish
          </p>
        </div>
        {roundStatus && (
          <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-white/60">
            Finals: {roundStatus}
          </span>
        )}
      </div>

      {roundStatus !== 'live' && (
        <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Finals must be <strong>live</strong> first (Schedule → Lock → Start Finals).
        </p>
      )}

      {roundStatus !== 'finalized' && (
        <div className="mt-3 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-100/80">
            Full round reset
          </p>
          <p className="mt-1 text-xs text-white/55">
            Wipes every finalist at once (scores → start · missions cleared). Keeps the 12 teams.
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {roundStatus === 'live' && (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => {
                  if (!window.confirm(
                    'Wipe ALL finalists now?\n\n• Scores back to start\n• Missions cleared\n• Finals stays LIVE\n• Release each team again',
                  )) return;
                  run(
                    'reset-all-live',
                    () => adminResetFinaleForRetest(eventId, { keepLive: true }),
                    'All teams wiped — Finals still live. Release again.',
                  );
                }}
                className="rounded-lg bg-rose-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                {busy === 'reset-all-live' ? '…' : 'Reset all teams (keep live)'}
              </button>
            )}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => {
                if (!window.confirm(
                  'Full Finals reset?\n\n• Round turns OFF\n• All progress cleared\n• Keep 12 finalists\n• Then: Schedule → Generate → Lock → Start',
                )) return;
                run(
                  'reset-round',
                  () => adminResetFinaleForRetest(eventId, { keepLive: false }),
                  'Finals reset — Schedule → Generate → Lock → Start',
                );
              }}
              className="rounded-lg border border-rose-300/50 bg-black/30 px-3 py-2 text-sm font-semibold text-rose-100 disabled:opacity-40"
            >
              {busy === 'reset-round' ? '…' : 'Reset entire Finals round'}
            </button>
          </div>
        </div>
      )}

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
            {sorted.length === 0 && <option value="">No finalists yet</option>}
            {sorted.map((e) => (
              <option key={teamIdOf(e)} value={teamIdOf(e)}>
                {e.teamCode}
                {' · '}
                {e.teamName || '—'}
                {' · '}
                {e.status}
                {' · '}
                {e.finaleScore ?? 0}
                pts
              </option>
            ))}
          </select>
        </label>
        {entry && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
            <span className="text-white/45">Status</span>
            {' '}
            <span className="font-semibold text-white">{entry.status}</span>
            <span className="mx-2 text-white/25">·</span>
            <span className="font-semibold text-[#0ECCEE]">{entry.finaleScore ?? 0}</span>
            <span className="text-white/45"> pts</span>
            {entry.releasedAt ? (
              <span className="ml-2 text-[11px] text-emerald-300">Released</span>
            ) : (
              <span className="ml-2 text-[11px] text-amber-200">Waiting</span>
            )}
          </div>
        )}
        <button
          type="button"
          disabled={Boolean(busy) || !teamId}
          onClick={() => {
            if (!window.confirm(
              `Reset ${entry?.teamCode || 'this team'}?\nScore → 500 · missions cleared · needs Release again`,
            )) return;
            runTeam(
              'reset',
              () => adminPlaytestResetFinaleTeam(eventId, teamId),
              'Reset done — tap Release again',
            );
          }}
          className="rounded-lg border border-white/20 px-3 py-2.5 text-sm text-white/80 disabled:opacity-40"
        >
          {busy === 'reset' ? '…' : '↺ Start over'}
        </button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          disabled={Boolean(busy) || !teamId || roundStatus !== 'live'}
          onClick={() => runTeam(
            'release',
            () => adminReleaseFinaleTeam(eventId, teamId),
            'Released — mission board unlocked',
          )}
          className="rounded-xl bg-emerald-400 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-black/60">Step 1</p>
          <p className="text-sm font-bold text-black">
            {busy === 'release' ? 'Releasing…' : 'Release team'}
          </p>
          <p className="mt-0.5 text-[11px] text-black/55">Unlock Finals board now</p>
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
            <p className="mt-0.5 text-[11px] text-white/45">Password → tap Leader</p>
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
            <p className="mt-0.5 text-[11px] text-white/45">Mission board</p>
          </Link>
        ) : (
          <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 opacity-40">
            <p className="text-sm text-white/50">Play link</p>
          </div>
        )}

        <button
          type="button"
          disabled={Boolean(busy) || !teamId}
          onClick={() => runTeam(
            'finish',
            () => adminStopFinaleTeam(eventId, teamId),
            'Marked finished — team stopped, no new missions',
          )}
          className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-rose-200/70">Last</p>
          <p className="text-sm font-bold text-rose-100">
            {busy === 'finish' ? '…' : 'Mark finish'}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-100/50">Stop team early</p>
        </button>
      </div>

      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
          Pass one task at a time
        </p>
        <p className="mt-1 text-xs text-white/40">
          Starts the mission if needed, then force-passes that step. Token / route / fragment hints show in the note below.
        </p>

        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-orange-400/25 bg-orange-500/10 p-3">
            <p className="text-xs font-bold text-orange-100">Intel Hunt</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['intel-loc1', 'loc1', 'Loc 1'],
                ['intel-loc2', 'loc2', 'Loc 2'],
                ['intel-combine', 'combine', 'Combine'],
              ].map(([key, task, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(busy) || !teamId || intelDone}
                  onClick={() => advance(key, 'intel_hunt', task, `Intel ${label} forced`)}
                  className="rounded-lg border border-orange-300/30 bg-black/25 px-2.5 py-1.5 text-xs font-semibold text-orange-50 disabled:opacity-40"
                >
                  {busy === key ? '…' : label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-amber-400/25 bg-amber-500/10 p-3">
            <p className="text-xs font-bold text-amber-100">Lockbox</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['lb-key', 'key', 'Key'],
                ['lb-code', 'code', 'Code'],
              ].map(([key, task, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(busy) || !teamId || lockboxDone}
                  onClick={() => advance(key, 'lockbox', task, `Lockbox ${label} forced`)}
                  className="rounded-lg border border-amber-300/30 bg-black/25 px-2.5 py-1.5 text-xs font-semibold text-amber-50 disabled:opacity-40"
                >
                  {busy === key ? '…' : label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-violet-400/25 bg-violet-500/10 p-3">
            <p className="text-xs font-bold text-violet-100">Blackout</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[
                ['bo-scout', 'scout', 'Scout'],
                ['bo-cracker', 'cracker', 'Cracker'],
                ['bo-nav', 'navigator', 'Navigator'],
                ['bo-ctrl', 'controller', 'Controller'],
              ].map(([key, task, label]) => (
                <button
                  key={key}
                  type="button"
                  disabled={Boolean(busy) || !teamId || blackoutDone}
                  onClick={() => advance(key, 'operation_blackout', task, `Blackout ${label} forced`)}
                  className="rounded-lg border border-violet-300/30 bg-black/25 px-2.5 py-1.5 text-xs font-semibold text-violet-50 disabled:opacity-40"
                >
                  {busy === key ? '…' : label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
          Or complete whole mission
        </p>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <button
          type="button"
          disabled={Boolean(busy) || !teamId || intelDone}
          onClick={() => runTeam(
            'intel',
            () => adminPlaytestCompleteFinaleMission(eventId, teamId, 'intel_hunt'),
            'Intel Hunt forced complete (+50)',
          )}
          className="rounded-xl border border-orange-400/40 bg-orange-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-orange-200/70">Cheat</p>
          <p className="text-sm font-bold text-orange-50">
            {busy === 'intel' ? '…' : intelDone ? 'Intel done ✓' : 'Complete Intel Hunt'}
          </p>
          <p className="mt-0.5 text-[11px] text-orange-100/50">Skip loc answers · +50</p>
        </button>

        <button
          type="button"
          disabled={Boolean(busy) || !teamId || lockboxDone}
          onClick={() => runTeam(
            'lockbox',
            () => adminPlaytestCompleteFinaleMission(eventId, teamId, 'lockbox'),
            'Lockbox forced complete (+75)',
          )}
          className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-amber-200/70">Cheat</p>
          <p className="text-sm font-bold text-amber-50">
            {busy === 'lockbox' ? '…' : lockboxDone ? 'Lockbox done ✓' : 'Complete Lockbox'}
          </p>
          <p className="mt-0.5 text-[11px] text-amber-100/50">Skip key + code · +75</p>
        </button>

        <button
          type="button"
          disabled={Boolean(busy) || !teamId || terminalDone}
          onClick={() => runTeam(
            'grid',
            () => adminPlaytestCompleteFinaleMission(eventId, teamId, 'field_terminal'),
            'Field Terminal forced complete (+125)',
          )}
          className="rounded-xl border border-blue-400/40 bg-blue-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-blue-200/70">Cheat</p>
          <p className="text-sm font-bold text-blue-50">
            {busy === 'grid' ? '…' : terminalDone ? 'Terminal done ✓' : 'Complete Field Terminal'}
          </p>
          <p className="mt-0.5 text-[11px] text-blue-100/50">Skip grid · +125</p>
        </button>

        <button
          type="button"
          disabled={Boolean(busy) || !teamId || blackoutDone}
          onClick={() => runTeam(
            'blackout',
            () => adminPlaytestCompleteFinaleMission(eventId, teamId, 'operation_blackout'),
            'Blackout forced complete (+200)',
          )}
          className="rounded-xl border border-violet-400/40 bg-violet-500/15 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-violet-200/70">Cheat</p>
          <p className="text-sm font-bold text-violet-50">
            {busy === 'blackout' ? '…' : blackoutDone ? 'Blackout done ✓' : 'Complete Blackout'}
          </p>
          <p className="mt-0.5 text-[11px] text-violet-100/50">Skip ops · +200</p>
        </button>

        <button
          type="button"
          disabled={Boolean(busy) || !teamId || entry?.status !== 'stopped'}
          onClick={() => runTeam(
            'resume',
            () => adminResumeFinaleTeam(eventId, teamId),
            'Team resumed — can play again',
          )}
          className="rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-left disabled:opacity-40"
        >
          <p className="text-[11px] font-semibold uppercase text-white/40">Undo finish</p>
          <p className="text-sm font-bold text-white">
            {busy === 'resume' ? '…' : 'Resume team'}
          </p>
          <p className="mt-0.5 text-[11px] text-white/45">After Mark finish</p>
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/35 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Team login (all members)
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
              className="rounded-lg bg-amber-500/20 px-2.5 py-1.5 text-xs font-semibold text-amber-100"
              onClick={() => copyText(teamPass, () => setNote('Password copied'))}
            >
              Copy password
            </button>
          </div>
        ) : (
          <p className="mt-2 text-xs text-white/40">Select a team to load password.</p>
        )}
      </div>

      {note && (
        <p className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80">
          {note}
        </p>
      )}
    </section>
  );
}

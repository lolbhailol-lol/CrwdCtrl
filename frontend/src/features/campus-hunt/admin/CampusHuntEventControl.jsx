import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  adminGetOverview,
  adminLiveTeams,
  adminLeaderboard,
  adminCheckpointMonitor,
  adminChallengeMonitor,
  adminListIssues,
  adminStartRound,
  adminLockRound,
  adminFinalizeLeaderboard,
  adminUpdateEvent,
  adminListStationQr,
  adminCreateRound,
  adminReopenRound,
  adminUpdateIssue,
  adminSetCheckpointActive,
  adminRotateCheckpointQr,
  adminListAudit,
  adminUpdateCheckpoint,
} from '../services/campusHunt.api';
import { stageLabel } from '../types/stages';
import { formatDurationMs } from '../utils/format';
import { CAMPUS_HUNT_PATHS } from '../config';
import TeamManagerPanel from './TeamManagerPanel';
import StartingSystemPanel from './StartingSystemPanel';
import Clue1VariantManager from './Clue1VariantManager';
import CheckpointManager from './CheckpointManager';
import AdminWorkflowNav from './AdminWorkflowNav';
import AdminSetupGuide from './AdminSetupGuide';
import RouteManagerPanel from './RouteManagerPanel';
import VolunteerSetupPanel from './VolunteerSetupPanel';

export default function CampusHuntEventControl() {
  const { eventId } = useParams();
  const [overview, setOverview] = useState(null);
  const [teams, setTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [checkpointMon, setCheckpointMon] = useState(null);
  const [challengeMon, setChallengeMon] = useState(null);
  const [issues, setIssues] = useState([]);
  const [audit, setAudit] = useState([]);
  const [stations, setStations] = useState([]);
  const [tab, setTab] = useState('overview');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(50);
  const [teamSearch, setTeamSearch] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshError, setRefreshError] = useState('');

  const refresh = useCallback(async () => {
    const [ov, live] = await Promise.all([
      adminGetOverview(eventId),
      adminLiveTeams(eventId),
    ]);
    setOverview(ov.data);
    setTeams(live.data?.teams || []);
    if (tab === 'results') {
      const [lb, ch, auditResult] = await Promise.all([
        adminLeaderboard(eventId),
        adminChallengeMonitor(eventId),
        adminListAudit(eventId),
      ]);
      setLeaderboard(lb.data?.leaderboard || []);
      setChallengeMon(ch.data);
      setAudit(auditResult.data?.logs || []);
    } else if (tab === 'live') {
      const [cp, st, iss] = await Promise.all([
        adminCheckpointMonitor(eventId),
        adminListStationQr(eventId).catch(() => ({ data: { stations: [] } })),
        adminListIssues(eventId),
      ]);
      setCheckpointMon(cp.data);
      setStations(st.data?.stations || []);
      setIssues(iss.data?.issues || []);
    }
    setLastRefresh(new Date());
    setRefreshError('');
  }, [eventId, tab]);

  useEffect(() => {
    refresh().catch((err) => setRefreshError(err.message));
    const id = setInterval(() => {
      refresh().catch((err) => setRefreshError(err.message));
    }, 10000);
    return () => clearInterval(id);
  }, [refresh]);

  const round1 = overview?.rounds?.find((r) => r.roundNumber === 1) || overview?.rounds?.[0];
  const readiness = overview?.readiness;
  const setupReady = Boolean(readiness?.routesReady && readiness?.volunteersConfigured);
  const teamsReady = Boolean(
    readiness?.teamsTotal
    && readiness.teamsReady === readiness.teamsTotal
    && readiness.startAssignmentsReady === readiness.teamsTotal,
  );
  const scheduleReady = Boolean(readiness?.scheduleLocked);
  const workflowStatuses = {
    overview: readiness?.ready ? 'Ready' : 'Needs attention',
    setup: setupReady ? 'Ready' : 'Needs attention',
    teams: teamsReady ? 'Ready' : readiness?.teamsTotal ? 'Needs attention' : 'Not started',
    schedule: scheduleReady ? 'Ready' : 'Not started',
    live: round1?.status === 'live' ? 'Live' : round1?.status === 'locked' ? 'Complete' : 'Not started',
    results: round1?.status === 'finalized' ? 'Complete' : round1?.status === 'locked' ? 'Ready' : 'Not started',
  };
  const checklist = [
    {
      label: 'Routes, checkpoints and volunteers are configured',
      done: setupReady,
      target: 'setup',
    },
    {
      label: 'Every team has four accounts and a route',
      done: Boolean(readiness?.teamsTotal && readiness.teamsReady === readiness.teamsTotal),
      target: 'teams',
    },
    {
      label: 'Every team has a starting point, Clue 1 and first checkpoint',
      done: Boolean(
        readiness?.teamsTotal
        && readiness.startAssignmentsReady === readiness.teamsTotal
      ),
      target: 'teams',
    },
    { label: 'Start schedule is generated, reviewed and locked', done: scheduleReady, target: 'schedule' },
  ];
  const nextStep = checklist.find((item) => !item.done);

  const run = async (fn, label) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(label);
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const startRoundOne = async () => {
    const readiness = overview?.readiness;
    if (round1?.status !== 'live' && readiness && !readiness.ready) {
      setMsg(
        `Cannot launch: ${readiness.teamsReady}/${readiness.teamsTotal} rosters ready, `
        + `${readiness.startAssignmentsReady || 0}/${readiness.teamsTotal} starts assigned, `
        + `schedule ${readiness.scheduleLocked ? 'locked' : 'not locked'}.`,
      );
      return;
    }
    if (round1?.status === 'locked') {
      if (!window.confirm('Reopen Round 1? This resets team progress and checkpoint scans.')) return;
      await run(
        () => adminReopenRound(round1._id, {
          confirm: true,
          resetProgress: true,
          durationMinutes,
          reason: 'Admin reopened Round 1',
        }),
        'Round 1 reopened — regenerate and lock the start schedule before relaunch',
      );
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      let targetRound = round1;
      if (!targetRound) {
        const created = await adminCreateRound(eventId, {
          roundNumber: 1,
          name: 'THE_HUNT',
          status: 'scheduled',
          qualification: {
            topNDirectFinale: 8,
            nextRoundName: 'MAUT_KA_KUVA',
          },
        });
        targetRound = created.data?.round;
      }
      if (!targetRound?._id) throw new Error('Could not create Round 1');
      const alreadyLive = targetRound.status === 'live';
      await adminStartRound(targetRound._id, {
        durationMinutes,
        activateWaitingOnly: alreadyLive,
      });
      setMsg(
        alreadyLive
          ? 'Release status synchronized against server time'
          : 'Round 1 is live — teams release only at their scheduled server time',
      );
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Could not start Round 1');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 p-4 text-white md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to={CAMPUS_HUNT_PATHS.admin} className="text-xs text-white/40 hover:text-white">
            ← All events
          </Link>
          <h1 className="text-2xl font-bold">{overview?.event?.name || 'Campus Hunt'}</h1>
          <p className="text-sm text-white/50">
            {overview?.event?.college} · status {overview?.event?.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-white/10 px-3 py-1.5">
            Round: {round1?.status || 'not created'}
          </span>
          <span className={`rounded-full px-3 py-1.5 ${
            readiness?.ready
              ? 'bg-emerald-500/15 text-emerald-200'
              : 'bg-amber-500/15 text-amber-100'
          }`}>
            {readiness?.ready ? 'Launch ready' : 'Setup incomplete'}
          </span>
        </div>
      </div>

      {tab === 'overview' && overview && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Teams', overview.counts?.teams],
            ['Active', overview.counts?.activeTeams],
            ['Finished', overview.counts?.finishedTeams],
            ['Open issues', overview.counts?.openIssues],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-white/5 px-3 py-3">
              <p className="text-xs text-white/50">{label}</p>
              <p className="text-2xl font-bold">{value ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      {tab === 'overview' && <AdminSetupGuide />}

      {tab === 'overview' && overview?.readiness && (
        <section className={`rounded-xl border p-4 ${
          overview.readiness.ready
            ? 'border-emerald-400/30 bg-emerald-500/10'
            : 'border-amber-400/30 bg-amber-500/10'
        }`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Launch readiness</h2>
              <p className="text-xs text-white/60">
                {overview.readiness.ready ? 'Ready to launch' : 'Complete the missing setup before launch'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => refresh().catch((error) => setRefreshError(error.message))}
              className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
            >
              Refresh
            </button>
          </div>
          {nextStep && (
            <button
              type="button"
              onClick={() => setTab(nextStep.target)}
              className="mt-3 flex w-full items-center justify-between rounded-xl bg-[#0ECCEE] px-4 py-3 text-left text-sm font-semibold text-black"
            >
              <span>Next step: {nextStep.label}</span>
              <span>Open →</span>
            </button>
          )}
          <div className="mt-3 space-y-2">
            {checklist.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => setTab(item.target)}
                className="flex w-full items-center justify-between rounded-lg bg-black/20 px-3 py-2 text-left text-xs"
              >
                <span>{item.done ? '✓' : '○'} {item.label}</span>
                <span className={item.done ? 'text-emerald-300' : 'text-amber-200'}>
                  {item.done ? 'Ready' : 'Fix this'}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {(overview.readiness.routeReadiness || []).map((route) => (
              <div key={route.id} className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-xs">
                <span>
                  Route {route.routeKey}: {route.assignedTeams}/{route.teamSlots} teams ·{' '}
                  {route.challengesConfigured}/4 clues · {route.checkpointsConfigured}/4 checkpoints
                  {route.placeholderLocations ? ` · ${route.placeholderLocations} placeholder locations` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/50">
            Start assignments and release times are controlled from the Starts tab.
          </p>
        </section>
      )}

      {round1 && (
        <p className="text-xs text-white/40">
          Round: {round1.name} · {round1.status}
          {round1.startsAt ? ` · start ${new Date(round1.startsAt).toLocaleString()}` : ''}
          {round1.endsAt ? ` · end ${new Date(round1.endsAt).toLocaleString()}` : ''}
        </p>
      )}

      {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
      <p className="text-xs text-white/40">
        {refreshError ? `Refresh error: ${refreshError}` : `Last refreshed: ${lastRefresh?.toLocaleTimeString() || '—'}`}
      </p>

      <AdminWorkflowNav current={tab} onChange={setTab} statuses={workflowStatuses} />

      {tab === 'setup' && (
        <div className="space-y-5">
          <AdminSetupGuide compact />
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              A. Game paths
            </p>
            <h2 className="mt-1 text-xl font-bold">Routes</h2>
            <p className="mb-3 text-sm text-white/55">
              Routes define the order of clues and checkpoints after a team starts.
            </p>
            <RouteManagerPanel
              eventId={eventId}
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              B. Where teams begin
            </p>
            <h2 className="mt-1 text-xl font-bold">Starting points</h2>
            <p className="mb-3 text-sm text-white/55">
              Add the physical waiting areas. This is not the route teams follow during the hunt.
            </p>
            <StartingSystemPanel
              eventId={eventId}
              roundId={round1?._id}
              mode="setup"
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              C. Where teams are verified
            </p>
            <h2 className="mt-1 text-xl font-bold">Checkpoints</h2>
            <p className="mb-3 text-sm text-white/55">
              Create physical stations before creating Clue 1 variants.
            </p>
            <CheckpointManager
              eventId={eventId}
              roundId={round1?._id}
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              D. Who verifies teams
            </p>
            <h2 className="mt-1 text-xl font-bold">Volunteers</h2>
            <p className="mb-3 text-sm text-white/55">
              Give each checkpoint volunteer a limited station login.
            </p>
            <VolunteerSetupPanel
              eventId={eventId}
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              E. What leaders solve first
            </p>
            <h2 className="mt-1 text-xl font-bold">Clue 1 variants</h2>
            <Clue1VariantManager
              eventId={eventId}
              roundId={round1?._id}
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
        </div>
      )}

      {tab === 'teams' && (
        <TeamManagerPanel
          eventId={eventId}
          roundId={round1?._id}
          onChanged={() => refresh().catch(() => {})}
        />
      )}

      {tab === 'schedule' && (
        <div className="space-y-5">
          <StartingSystemPanel
          eventId={eventId}
          roundId={round1?._id}
            mode="schedule"
          onChanged={() => refresh().catch(() => {})}
        />
          <section className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <h2 className="font-semibold">Final step: start Round 1</h2>
            <p className="mt-1 text-sm text-white/60">
              Starting the round does not release everyone. Each team unlocks only at its
              scheduled server time.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-xs text-white/60">
                Round duration
                <span className="ml-2 inline-flex items-center gap-1">
                  <input
                    type="number"
                    min="5"
                    max="240"
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(Number(event.target.value) || 50)}
                    className="w-20 rounded bg-black/30 px-2 py-1.5"
                  />
                  minutes
                </span>
              </label>
              <button
                type="button"
                disabled={
                  busy
                  || !overview?.event
                  || !readiness?.scheduleLocked
                  || round1?.status === 'finalized'
                }
                onClick={startRoundOne}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                {round1?.status === 'live' ? 'Synchronize due releases' : 'Start Round 1'}
              </button>
            </div>
            {!readiness?.scheduleLocked && (
              <p className="mt-2 text-xs text-amber-100">
                Preview, generate, review, and lock the schedule before this button becomes available.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'live' && (
        <div className="space-y-5">
          <section>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Release desk
            </p>
            <h2 className="mt-1 text-xl font-bold">Starting-point queues</h2>
            <p className="mb-3 text-sm text-white/55">
              Pause releases only for an operational problem. Manual release requires confirmation.
            </p>
            <StartingSystemPanel
              eventId={eventId}
              roundId={round1?._id}
              mode="live"
              onChanged={() => refresh().catch(() => {})}
            />
          </section>
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/3 p-4">
            <div>
              <h2 className="font-semibold">All teams</h2>
              <p className="text-xs text-white/50">Search a team and see its current game stage.</p>
            </div>
          <input
            value={teamSearch}
            onChange={(event) => setTeamSearch(event.target.value)}
            placeholder="Search team code or name"
            className="w-full max-w-sm rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
          />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-2">Code</th>
                <th>Name</th>
                <th>Stage</th>
                <th>Score</th>
                <th>Last CP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.filter((team) => {
                const query = teamSearch.trim().toLowerCase();
                return !query || `${team.teamCode} ${team.teamName}`.toLowerCase().includes(query);
              }).map((t) => (
                <tr key={t._id} className="border-t border-white/5">
                  <td className="py-2 font-mono">{t.teamCode}</td>
                  <td>{t.teamName}</td>
                  <td>{stageLabel(t.currentStage)}</td>
                  <td>{t.currentScore}</td>
                  <td>{t.lastCheckpointNumber ?? '—'}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </section>
        </div>
      )}

      {tab === 'results' && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
            <h2 className="font-semibold">Round and leaderboard controls</h2>
            <p className="mt-1 text-sm text-white/55">
              Stop and lock freezes scores. Finalize only after paper records and issues are reconciled.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !overview?.event}
                onClick={() => run(
                  () => adminUpdateEvent(eventId, {
                    publicLeaderboardLive: !overview.event.publicLeaderboardLive,
                  }),
                  overview.event.publicLeaderboardLive
                    ? 'Public live leaderboard hidden'
                    : 'Public live leaderboard enabled',
                )}
                className="rounded-lg bg-white/10 px-3 py-2 text-sm disabled:opacity-40"
              >
                {overview?.event?.publicLeaderboardLive
                  ? 'Hide public live scores'
                  : 'Show public live scores'}
              </button>
              <button
                type="button"
                disabled={busy || !round1 || round1.status !== 'live'}
                onClick={() => {
                  if (!window.confirm('Stop Round 1 and freeze every score?')) return;
                  run(() => adminLockRound(round1._id, {
                    reason: 'Event control stopped and locked Round 1',
                  }), 'Round stopped; scores are locked');
                }}
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                Stop event and lock scores
              </button>
              <button
                type="button"
                disabled={busy || !round1 || round1.status !== 'locked'}
                onClick={() => {
                  if (!window.confirm('Finalize the leaderboard? This cannot be reopened.')) return;
                  run(
                    () => adminFinalizeLeaderboard(round1._id, {
                      reason: 'Results reviewed and finalized',
                    }),
                    'Leaderboard finalized',
                  );
                }}
                className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
              >
                Finalize results
              </button>
            </div>
          </section>
          <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
            <h2 className="mb-3 font-semibold">Full admin leaderboard</h2>
            <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-2">Rank</th>
                <th>Team</th>
                <th>Score</th>
                <th>Time</th>
                <th>Hints</th>
                <th>Fails</th>
                <th>Qualify</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => (
                <tr key={row.teamId} className="border-t border-white/5">
                  <td className="py-2">{row.rank}</td>
                  <td>
                    {row.teamCode} · {row.teamName}
                  </td>
                  <td>{row.score}</td>
                  <td>{formatDurationMs(row.totalCompletionMs)}</td>
                  <td>{row.hintsUsed}</td>
                  <td>{row.failedAttempts}</td>
                  <td className="text-xs">{row.qualification}</td>
                </tr>
              ))}
            </tbody>
          </table>
            </div>
          </section>
        </div>
      )}

      {tab === 'live' && (
        <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <summary className="cursor-pointer font-semibold">Station QR operations</summary>
        <div className="mt-3 space-y-3 text-sm">
          <p className="text-xs text-white/50">
            Station paste codes (production camera fallback). Print under each QR — treat as secret.
          </p>
          {stations.map((s) => (
            <div key={s.checkpointId} className="rounded-lg bg-white/5 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    CP {s.checkpointKey} · {s.locationName}
                  </p>
                  <p className="mt-1 font-mono text-lg tracking-widest text-[#0ECCEE]">
                    {s.pasteHint || `CH-${s.pasteCode}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const code = s.pasteHint || `CH-${s.pasteCode}`;
                    navigator.clipboard?.writeText(code);
                    setMsg(`Copied ${code}`);
                  }}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
                >
                  Copy code
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('Disable this checkpoint and compensate eligible teams?')) return;
                    run(
                      () => adminSetCheckpointActive(s.checkpointId, false, {
                        compensate: true,
                        reason: 'Disabled from live operations',
                      }),
                      'Checkpoint disabled; eligible teams compensated',
                    );
                  }}
                  className="rounded-lg bg-amber-500/20 px-3 py-1.5 text-xs text-amber-200"
                >
                  Disable + compensate
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('Rotate this station QR and paste code? Reprint the poster afterwards.')) return;
                    run(
                      () => adminRotateCheckpointQr(s.checkpointId, 'Admin rotated leaked station code'),
                      'Station code rotated — refresh and reprint',
                    );
                  }}
                  className="rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-200"
                >
                  Rotate leaked QR
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const locationName = window.prompt('Physical checkpoint location', s.locationName);
                    if (!locationName?.trim()) return;
                    run(
                      () => adminUpdateCheckpoint(s.checkpointId, { locationName: locationName.trim() }),
                      'Checkpoint location updated',
                    );
                  }}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs"
                >
                  Edit location
                </button>
              </div>
            </div>
          ))}
          {!stations.length && (checkpointMon?.checkpoints || []).map((c) => (
            <div key={c._id} className="rounded-lg bg-white/5 px-3 py-2">
              {c.checkpointKey} · {c.locationName} · {c.active ? 'active' : 'DISABLED'}
            </div>
          ))}
          <p className="pt-2 text-xs text-white/40">
            Verification aggregates: {(checkpointMon?.verifications || []).length} groups
          </p>
        </div>
        </details>
      )}

      {tab === 'results' && (
        <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <summary className="cursor-pointer font-semibold">Challenge progress totals</summary>
        <div className="mt-3 space-y-2 text-sm">
          {(challengeMon?.progress || []).map((p) => (
            <div key={`${p._id.challengeNumber}-${p._id.state}`} className="rounded-lg bg-white/5 px-3 py-2">
              Clue {p._id.challengeNumber} · {p._id.state}: {p.count}
            </div>
          ))}
        </div>
        </details>
      )}

      {tab === 'live' && (
        <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <h2 className="font-semibold">Operational issues</h2>
          <p className="mb-3 text-xs text-white/50">
            Acknowledge when someone owns the issue; resolve only after the fix is complete.
          </p>
        <div className="space-y-2 text-sm">
          {issues.map((issue) => (
            <div key={issue._id} className="rounded-lg bg-white/5 px-3 py-2">
              <p className="font-semibold">{issue.category}</p>
              <p className="text-white/60">{issue.notes || '—'}</p>
              <p className="text-xs text-white/40">
                {issue.volunteerLabel} · {issue.status}
              </p>
              <div className="mt-2 flex gap-2">
                {issue.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => run(
                      () => adminUpdateIssue(issue._id, { status: 'acknowledged' }),
                      'Issue acknowledged',
                    )}
                    className="rounded bg-amber-500/20 px-2 py-1 text-xs"
                  >
                    Acknowledge
                  </button>
                )}
                {issue.status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={() => run(
                      () => adminUpdateIssue(issue._id, { status: 'resolved' }),
                      'Issue resolved',
                    )}
                    className="rounded bg-emerald-500/20 px-2 py-1 text-xs"
                  >
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}
          {!issues.length && <p className="text-white/50">No issues</p>}
        </div>
        </section>
      )}

      {tab === 'results' && (
        <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <summary className="cursor-pointer font-semibold">Operations and audit history</summary>
        <div className="mt-3 space-y-2 text-sm">
          {audit.map((entry) => (
            <div key={entry._id} className="rounded-lg bg-white/5 px-3 py-2">
              <p className="font-semibold">{entry.action}</p>
              <p className="text-xs text-white/50">
                {entry.actorLabel || entry.actorId} · {new Date(entry.createdAt).toLocaleString()}
              </p>
              {entry.reason && <p className="mt-1 text-xs text-white/70">{entry.reason}</p>}
            </div>
          ))}
          {!audit.length && <p className="text-white/50">No audit entries</p>}
        </div>
        </details>
      )}
    </div>
  );
}

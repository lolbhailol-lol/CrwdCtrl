import { useCallback, useEffect, useMemo, useState } from 'react';
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

/** Playtest/dry-run: at least one roster ready (schedule lock optional for offline). */
function canStartRoundOnePlaytest(readiness) {
  if ((readiness?.teamsReady || 0) < 1) return false;
  return true;
}
import TeamManagerPanel from './TeamManagerPanel';
import DemoScalePanel from './DemoScalePanel';
import StartingSystemPanel from './StartingSystemPanel';
import AdminWorkflowNav from './AdminWorkflowNav';
import AdminSetupGuide from './AdminSetupGuide';
import PlaytestPanel from './PlaytestPanel';
import Round1ClueFormat from './Round1ClueFormat';
import FinishReturnBoard from './FinishReturnBoard';
import LiveOpsTools from './LiveOpsTools';
import CampusHuntRoundsHub from './CampusHuntRoundsHub';
import SendLinksPanel from './SendLinksPanel';
import { deriveCompetitionFormat } from './competitionFormat';
import { applyRound1Scale } from './applyRound1Scale';
import { suggestHuntLayout } from './campusHuntFormat';

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
  /** null = event hub; 'round1' only (Survival/Finale hidden) */
  const [activeRound, setActiveRound] = useState(null);
  const [tab, setTab] = useState('locations');
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

    if (activeRound === 'round1' && tab === 'results') {
      const [lb, ch, auditResult] = await Promise.all([
        adminLeaderboard(eventId),
        adminChallengeMonitor(eventId),
        adminListAudit(eventId),
      ]);
      setLeaderboard(lb.data?.leaderboard || []);
      setChallengeMon(ch.data);
      setAudit(auditResult.data?.logs || []);
    } else if (activeRound === 'round1' && tab === 'live') {
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
  }, [eventId, tab, activeRound]);

  useEffect(() => {
    refresh().catch((err) => setRefreshError(err.message));
    // Poll often only on Live / Results. Setup tabs don't need constant refresh.
    const pollMs = (tab === 'live' || tab === 'results') ? 10000 : 45000;
    const id = setInterval(() => {
      refresh().catch((err) => setRefreshError(err.message));
    }, pollMs);
    return () => clearInterval(id);
  }, [refresh, tab]);

  const round1 = overview?.rounds?.find((r) => r.roundNumber === 1) || overview?.rounds?.[0];
  const competitionFormat = deriveCompetitionFormat({
    teamCapacity: overview?.event?.teamCapacity,
    teamSize: overview?.event?.teamSize,
  });
  const huntLayoutMeta = useMemo(() => ({
    ...(overview?.event || {}),
    campusStations: overview?.campusStations,
    campusStarts: overview?.campusStarts,
    stationCount: overview?.stationCount ?? overview?.event?.stationCount,
    startCount: overview?.startCount ?? overview?.event?.startCount,
  }), [overview]);
  const readiness = overview?.readiness;
  const cluesReady = Boolean(readiness?.routesReady);
  const locationsReady = Boolean(readiness?.startingPointsReady);
  const teamsReady = Boolean(
    readiness?.teamsTotal
    && readiness.teamsReady === readiness.teamsTotal,
  );
  const linksReady = Boolean(teamsReady && cluesReady && locationsReady);
  const workflowStatuses = {
    locations: locationsReady ? 'Ready' : 'Needs attention',
    clues: cluesReady ? 'Ready' : 'Needs attention',
    teams: teamsReady ? 'Ready' : readiness?.teamsTotal ? 'Needs attention' : 'Not started',
    links: linksReady ? 'Ready' : 'Not started',
    playtest: round1?.status === 'live' ? 'Live' : linksReady && teamsReady ? 'Ready' : 'Not started',
    live: round1?.status === 'live' ? 'Live' : round1?.status === 'locked' ? 'Complete' : 'Not started',
    results: round1?.status === 'finalized' ? 'Complete' : round1?.status === 'locked' ? 'Ready' : 'Not started',
  };

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

  const playtestStartOk = canStartRoundOnePlaytest(readiness);

  const startRoundOne = async () => {
    if (
      round1?.status !== 'live'
      && readiness
      && !readiness.ready
      && !playtestStartOk
    ) {
      setMsg(
        `Cannot launch: ${readiness.teamsReady}/${readiness.teamsTotal} rosters ready, `
        + `${readiness.startAssignmentsReady || 0}/${readiness.teamsTotal} starts assigned, `
        + `schedule ${readiness.scheduleLocked ? 'locked' : 'not locked'}. `
        + 'Repair at least one team roster on the Teams tab.',
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
          qualification: competitionFormat.qualification,
        });
        targetRound = created.data?.round;
      }
      if (!targetRound?._id) throw new Error('Could not create Round 1');
      const alreadyLive = targetRound.status === 'live';
      await adminStartRound(targetRound._id, {
        durationMinutes,
        // Keep releasing waiting teams, and always refresh endsAt from duration.
        activateWaitingOnly: alreadyLive,
      });
      setMsg(
        alreadyLive
          ? `Synced releases and extended play window by ${durationMinutes} min from now/start`
          : 'Round 1 is live — teams release only at their scheduled server time',
      );
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Could not start Round 1');
    } finally {
      setBusy(false);
    }
  };

  /** Full soft reset: lock if live → reopen → clear progress/scans. */
  const resetRoundToZero = async () => {
    if (!round1?._id) {
      setMsg('Create Round 1 first');
      return;
    }
    if (round1.status === 'finalized') {
      setMsg('Finalized rounds cannot be reset. Seed a new pilot event instead.');
      return;
    }
    if (round1.status === 'scheduled') {
      setMsg(
        'Round is already scheduled (not live). Use Schedule → Generate and confirm '
        + 'force-reset if any teams still show progress.',
      );
      return;
    }
    if (!window.confirm(
      'Reset Round 1 to zero?\n\n'
      + '• Clears all team progress and scans\n'
      + '• Teams go back to WAITING\n'
      + '• You must Preview → Generate → Lock → Start again\n\n'
      + 'Continue?',
    )) return;

    setBusy(true);
    setMsg('');
    try {
      if (round1.status === 'live') {
        await adminLockRound(round1._id, {
          reason: 'Prep for full reset to zero',
        });
      }
      await adminReopenRound(round1._id, {
        confirm: true,
        resetProgress: true,
        reason: 'Admin reset Round 1 to zero',
      });
      setMsg('Round reset to zero. Next: Live → start Round 1, or Send links again if packs changed.');
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Could not reset Round 1');
    } finally {
      setBusy(false);
    }
  };

  const layoutTeams = useMemo(
    () => [...teams]
      .sort((a, b) => String(a.teamCode).localeCompare(String(b.teamCode), undefined, { numeric: true }))
      .slice(0, competitionFormat.teamCapacity),
    [teams, competitionFormat.teamCapacity],
  );
  const filteredTeams = layoutTeams.filter((team) => {
    const query = teamSearch.trim().toLowerCase();
    return !query || `${team.teamCode} ${team.teamName}`.toLowerCase().includes(query);
  });
  const layoutLeaderboard = useMemo(
    () => (leaderboard || []).slice(0, competitionFormat.teamCapacity),
    [leaderboard, competitionFormat.teamCapacity],
  );

  return (
    <div className="space-y-5 p-4 text-white md:p-6">
      {(!activeRound || activeRound === 'round1') && (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link to={CAMPUS_HUNT_PATHS.admin} className="text-xs text-white/40 hover:text-white">
                ← All events
              </Link>
              <h1 className="text-2xl font-bold uppercase tracking-wide">{overview?.event?.name || 'Campus Hunt'}</h1>
              <p className="text-sm uppercase tracking-wide text-white/50">
                {overview?.event?.college} · {overview?.event?.slug || overview?.event?.status}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                Round 1: {round1?.status || 'not created'}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                Teams {Math.min(
                  overview?.counts?.teams ?? teams.length,
                  competitionFormat.teamCapacity,
                )}/{competitionFormat.teamCapacity}
                {(overview?.counts?.teams ?? teams.length) > competitionFormat.teamCapacity
                  ? ` (+${(overview?.counts?.teams ?? teams.length) - competitionFormat.teamCapacity} extra)`
                  : ''}
                {' · '}
                {competitionFormat.teamSize}/team
              </span>
              <span className={`rounded-full px-3 py-1.5 ${
                readiness?.ready
                  ? 'bg-emerald-500/15 text-emerald-200'
                  : 'bg-amber-500/15 text-amber-100'
              }`}>
                {readiness?.ready ? 'Ready to launch' : 'Setup incomplete'}
              </span>
            </div>
          </div>

          {msg && <p className="text-sm text-[#0ECCEE]">{msg}</p>}
          <p className="text-xs text-white/40">
            {refreshError
              ? `Refresh error: ${refreshError}`
              : `Last refreshed: ${lastRefresh?.toLocaleTimeString() || '—'}`}
          </p>
        </>
      )}

      {!activeRound && (
        <CampusHuntRoundsHub
          round1Status={round1?.status}
          teamCapacity={competitionFormat.teamCapacity}
          teamSize={competitionFormat.teamSize}
          startCount={overview?.startCount ?? overview?.event?.startCount}
          stationCount={overview?.stationCount ?? overview?.event?.stationCount}
          roundPlan={overview?.event?.roundPlan || overview?.roundPlan}
          busy={busy}
          onSaveFormat={async ({ teamCapacity, teamSize, startCount, stationCount, createDemoTeams = true }) => {
            setBusy(true);
            setMsg('');
            try {
              const result = await applyRound1Scale(eventId, {
                teamCapacity,
                teamSize,
                startCount,
                stationCount,
                createDemoTeams,
                existingStations: overview?.campusStationsCatalog
                  || overview?.campusStations
                  || overview?.event?.campusStations,
                existingStarts: overview?.campusStartsCatalog
                  || overview?.campusStarts
                  || overview?.event?.campusStarts,
              });
              setMsg(result.message);
              await refresh();
            } catch (err) {
              setMsg(err.message || 'Could not update Round 1 scale');
            } finally {
              setBusy(false);
            }
          }}
          onOpenRound={(roundId) => {
            setActiveRound(roundId);
            if (roundId === 'round1') setTab('locations');
          }}
        />
      )}

      {activeRound === 'round1' && (
        <>
          <button
            type="button"
            onClick={() => setActiveRound(null)}
            className="text-xs text-white/50 hover:text-white"
          >
            ← Event hub
          </button>

          <div className="rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/8 px-3 py-2 text-xs text-white/70">
            Scale drives every tab:
            {' '}
            <strong className="text-white">
              {competitionFormat.teamCapacity} teams × {competitionFormat.teamSize}
            </strong>
            {' · '}
            {overview?.startCount ?? overview?.event?.startCount
              ?? suggestHuntLayout(competitionFormat.teamCapacity).startCount}
            {' '}
            start(s) ·
            {' '}
            {overview?.stationCount ?? overview?.event?.stationCount
              ?? suggestHuntLayout(competitionFormat.teamCapacity).stationCount}
            {' '}
            place(s). Change size on the hub anytime — Locations, Teams, Send links, Playtest, Live & Results follow.
          </div>

          <AdminSetupGuide compact />

          <AdminWorkflowNav
            current={tab}
            onChange={setTab}
            statuses={workflowStatuses}
          />

          {tab === 'playtest' && (
            <PlaytestPanel
              eventId={eventId}
              eventSlug={overview?.event?.slug}
              teams={layoutTeams}
              stations={stations}
              teamSize={competitionFormat.teamSize}
              teamCapacity={competitionFormat.teamCapacity}
              roundStatus={round1?.status}
              durationMinutes={durationMinutes}
              onDurationChange={setDurationMinutes}
              onStartRound={startRoundOne}
              busy={busy}
              canStart={Boolean(overview?.event) && round1?.status !== 'finalized'}
              overview={overview}
              competitionFormat={competitionFormat}
              onChanged={() => refresh().catch(() => {})}
              onGoTab={setTab}
            />
          )}

          {tab === 'clues' && (
            <Round1ClueFormat
              eventId={eventId}
              roundId={round1?._id}
              campusStations={overview?.campusStations || overview?.event?.campusStations}
              campusStationsCatalog={overview?.campusStationsCatalog || overview?.event?.campusStations}
              campusStarts={overview?.campusStarts || overview?.event?.campusStarts}
              startCount={overview?.startCount ?? overview?.event?.startCount}
              stationCount={overview?.stationCount ?? overview?.event?.stationCount}
              teamCapacity={competitionFormat.teamCapacity}
              teamSize={competitionFormat.teamSize}
              onChanged={() => refresh().catch(() => {})}
            />
          )}

          {tab === 'locations' && (
            <div className="space-y-5">
              <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 1 · Locations
                </p>
                <h2 className="mt-1 text-xl font-bold">Starts & gather points</h2>
                <p className="mb-3 text-sm text-white/55">
                  Sized for
                  {' '}
                  <strong className="text-white">{competitionFormat.teamCapacity} teams</strong>
                  {' · '}
                  {huntLayoutMeta.startCount || '—'} start(s) · {huntLayoutMeta.stationCount || '—'} hunt place(s).
                  Rename under Clues anytime. Hunt posters live at campus places, not starts.
                </p>
                <StartingSystemPanel
                  eventId={eventId}
                  roundId={round1?._id}
                  mode="setup"
                  eventMeta={huntLayoutMeta}
                  onChanged={() => refresh().catch(() => {})}
                />
              </section>
            </div>
          )}

          {tab === 'teams' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 3 · Teams
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  {overview?.event?.teamCapacity || 40} teams & passwords
                </h2>
                <p className="text-sm text-white/55">
                  Set passwords and names. Then open <strong className="text-white">Send links</strong>
                  {' '}for one WhatsApp install link per team (leader phone · {overview?.event?.teamSize || 4} people walk together).
                </p>
              </div>
              <DemoScalePanel
                eventId={eventId}
                eventMeta={{
                  ...(overview?.event || {}),
                  campusStations: overview?.campusStations || overview?.event?.campusStations,
                  campusStationsCatalog: overview?.campusStationsCatalog,
                  campusStarts: overview?.campusStarts || overview?.event?.campusStarts,
                  campusStartsCatalog: overview?.campusStartsCatalog,
                }}
                teamCount={overview?.counts?.teams ?? teams.length}
                onChanged={() => refresh().catch(() => {})}
              />
              <TeamManagerPanel
                eventId={eventId}
                roundId={round1?._id}
                readiness={readiness}
                eventMeta={overview?.event}
                onChanged={() => refresh().catch(() => {})}
              />
            </div>
          )}

          {tab === 'links' && (
            <SendLinksPanel
              eventId={eventId}
              teamCapacity={competitionFormat.teamCapacity}
              teamSize={competitionFormat.teamSize}
            />
          )}

          {tab === 'live' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 5 · Live
                </p>
                <h2 className="mt-1 text-xl font-bold">Operate the hunt</h2>
                <p className="text-sm text-white/55">
                  {competitionFormat.teamCapacity} teams · {competitionFormat.teamSize}/team
                  {' · '}start Round 1 · board · mark finish when teams return
                </p>
              </div>

              <section className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-5">
                <h2 className="text-lg font-bold text-emerald-100">Start Round 1</h2>
                <p className="mt-1 text-sm text-white/70">
                  After Send links, start the round here. Optional staggered schedule is below.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="text-xs text-white/60">
                    Duration (minutes)
                    <input
                      type="number"
                      min="5"
                      max="240"
                      value={durationMinutes}
                      onChange={(event) => setDurationMinutes(Number(event.target.value) || 50)}
                      className="ml-2 w-20 rounded bg-black/30 px-2 py-1.5"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !overview?.event || round1?.status === 'finalized'}
                    onClick={startRoundOne}
                    className="rounded-xl bg-emerald-400 px-6 py-3 text-base font-bold text-black disabled:opacity-40"
                  >
                    {round1?.status === 'locked'
                      ? 'Reopen Round 1'
                      : round1?.status === 'live'
                        ? 'Sync due releases'
                        : 'Start Round 1'}
                  </button>
                </div>
              </section>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white/70">
                  Optional · staggered start schedule
                </summary>
                <div className="mt-3">
                  <StartingSystemPanel
                    eventId={eventId}
                    roundId={round1?._id}
                    mode="schedule"
                    eventMeta={huntLayoutMeta}
                    onChanged={() => refresh().catch(() => {})}
                  />
                </div>
              </details>

              <p className="rounded-xl border border-white/10 bg-white/4 px-3 py-2 text-xs text-white/55">
                Dry-run tools live under the
                {' '}
                <button
                  type="button"
                  onClick={() => setTab('playtest')}
                  className="font-semibold text-[#0ECCEE] hover:underline"
                >
                  Playtest
                </button>
                {' '}
                tab (checklist · cheat desk · plant sheet).
              </p>

              <section>
                <StartingSystemPanel
                  eventId={eventId}
                  roundId={round1?._id}
                  mode="live"
                  eventMeta={huntLayoutMeta}
                  onChanged={() => refresh().catch(() => {})}
                />
              </section>

              <section className="rounded-2xl border border-rose-400/25 bg-[#120a0a] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-rose-200/80">
                  Finish desk
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">Mark reached at start</h3>
                <p className="mb-3 mt-1 text-sm text-white/55">
                  {competitionFormat.teamCapacity} teams ·{' '}
                  {overview?.startCount ?? overview?.event?.startCount ?? 4} start
                  {Number(overview?.startCount ?? overview?.event?.startCount ?? 4) === 1 ? '' : 's'}
                  {' '}· {competitionFormat.teamSize}/team.
                  Team returns with their number → tap Mark reached → score locks.
                </p>
                <FinishReturnBoard
                  eventId={eventId}
                  eventMeta={huntLayoutMeta}
                  reloadKey={lastRefresh || 0}
                  onChanged={() => refresh().catch(() => {})}
                />
              </section>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold text-white/80">
                  Team status table
                </summary>
                <div className="mt-3 space-y-3">
                  <input
                    value={teamSearch}
                    onChange={(event) => setTeamSearch(event.target.value)}
                    placeholder="Search team code or name"
                    className="w-full max-w-sm rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-white/50">
                        <tr>
                          <th className="py-2">Code</th>
                          <th>Name</th>
                          <th>Stage</th>
                          <th>Score</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredTeams.map((t) => (
                          <tr key={t._id} className="border-t border-white/5">
                            <td className="py-2 font-mono">{t.teamCode}</td>
                            <td>{t.teamName}</td>
                            <td>{stageLabel(t.currentStage)}</td>
                            <td>{t.currentScore}</td>
                            <td>{t.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold">
                  Ops tools · penalty & paper reconcile
                </summary>
                <div className="mt-3">
                  <LiveOpsTools
                    eventId={eventId}
                    teams={layoutTeams}
                    stations={stations}
                    onChanged={() => refresh().catch(() => {})}
                  />
                </div>
              </details>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold">
                  Issues ({issues.filter((i) => i.status !== 'resolved').length} open)
                </summary>
                <div className="mt-3 space-y-2 text-sm">
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
                  {!issues.length && <p className="text-white/50">No issues reported</p>}
                </div>
              </details>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold">
                  Emergency · station codes / disable / rotate
                </summary>
                <p className="mt-2 text-xs text-white/50">
                  For desk testing without posters: Copy a team’s CH- code → player phone →
                  “Submit station code”. Need all {competitionFormat.teamSize} members
                  (or enable local Dev cheats).
                </p>
                <div className="mt-3 space-y-2">
                  {stations
                    .filter((s) => String(s.progressionKey || s.checkpointKey || '').toUpperCase() !== 'FINISH')
                    .map((s) => (
                      <div key={s.checkpointId} className="rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {s.progressionKey || s.checkpointKey} · {s.locationName}
                              {s.teamCode ? ` · ${s.teamCode}` : ''}
                            </p>
                            <p className="mt-1 font-mono text-xs tracking-widest text-[#0ECCEE]">
                              {s.pasteHint || `CH-${s.pasteCode}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                const code = s.pasteHint || `CH-${s.pasteCode}`;
                                navigator.clipboard?.writeText(code);
                                setMsg(`Copied ${code}`);
                              }}
                              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs"
                            >
                              Copy
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
                                  'Checkpoint disabled',
                                );
                              }}
                              className="rounded-lg bg-amber-500/20 px-2.5 py-1 text-xs text-amber-200"
                            >
                              Disable
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                if (!window.confirm('Rotate QR / paste code? Reprint afterwards.')) return;
                                run(
                                  () => adminRotateCheckpointQr(
                                    s.checkpointId,
                                    'Admin rotated leaked station code',
                                  ),
                                  'Station code rotated',
                                );
                              }}
                              className="rounded-lg bg-red-500/20 px-2.5 py-1 text-xs text-red-200"
                            >
                              Rotate
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                const locationName = window.prompt('Location name', s.locationName);
                                if (!locationName?.trim()) return;
                                run(
                                  () => adminUpdateCheckpoint(s.checkpointId, {
                                    locationName: locationName.trim(),
                                  }),
                                  'Location updated',
                                );
                              }}
                              className="rounded-lg bg-white/10 px-2.5 py-1 text-xs"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  {!stations.length && (
                    <p className="text-xs text-white/45">
                      No station codes loaded.
                      {(checkpointMon?.verifications || []).length
                        ? ` ${checkpointMon.verifications.length} verification groups tracked.`
                        : ''}
                    </p>
                  )}
                </div>
              </details>
            </div>
          )}

          {tab === 'results' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 6 · Results
                </p>
                <h2 className="mt-1 text-xl font-bold">Lock & finalize</h2>
                <p className="text-sm text-white/55">
                  {competitionFormat.teamCapacity} teams · {competitionFormat.teamSize} per team · Round 1 offline.
                  Stop when the hunt ends; finalize after finish desk looks correct.
                </p>
              </div>

              <section className="rounded-2xl border border-white/10 bg-white/4 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
                  Profile visibility
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !overview?.event}
                    onClick={() => run(
                      () => adminUpdateEvent(eventId, {
                        publicLoginLive: !overview.event.publicLoginLive,
                      }),
                      overview.event.publicLoginLive
                        ? 'Campus Hunt login hidden from Profile'
                        : 'Campus Hunt login shown on Profile',
                    )}
                    className={`rounded-lg px-3 py-2 text-sm disabled:opacity-40 ${
                      overview?.event?.publicLoginLive
                        ? 'bg-sky-400 font-semibold text-black'
                        : 'bg-white/10'
                    }`}
                  >
                    {overview?.event?.publicLoginLive
                      ? 'Login on Profile · ON'
                      : 'Login on Profile · OFF'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !overview?.event}
                    onClick={() => run(
                      () => adminUpdateEvent(eventId, {
                        publicLeaderboardLive: !overview.event.publicLeaderboardLive,
                      }),
                      overview.event.publicLeaderboardLive
                        ? 'Leaderboard hidden from Profile'
                        : 'Leaderboard shown on Profile',
                    )}
                    className={`rounded-lg px-3 py-2 text-sm disabled:opacity-40 ${
                      overview?.event?.publicLeaderboardLive
                        ? 'bg-emerald-500 font-semibold text-black'
                        : 'bg-white/10'
                    }`}
                  >
                    {overview?.event?.publicLeaderboardLive
                      ? 'Leaderboard on Profile · ON'
                      : 'Leaderboard on Profile · OFF'}
                  </button>
                  <button
                    type="button"
                    disabled={busy || !round1 || !['live', 'locked'].includes(round1.status)}
                    onClick={resetRoundToZero}
                    className="rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-semibold text-rose-100 disabled:opacity-40"
                  >
                    Reset Round 1 to zero
                  </button>
                  <button
                    type="button"
                    disabled={busy || !round1 || round1.status !== 'live'}
                    onClick={() => {
                      if (!window.confirm('Stop Round 1 and freeze every score?')) return;
                      run(() => adminLockRound(round1._id, {
                        reason: 'Event control stopped and locked Round 1',
                      }), 'Scores locked');
                    }}
                    className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    Stop & lock scores
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
                <p className="mt-3 text-xs text-white/45">
                  Testing again? Use <strong className="text-white/70">Reset Round 1 to zero</strong>,
                  then Schedule Preview → Generate → Lock → Start. Do not Finalize until the real event ends.
                </p>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <h3 className="mb-1 font-semibold">Leaderboard</h3>
                <p className="mb-3 text-xs text-white/45">
                  Round 1 field: {competitionFormat.teamCapacity} teams × {competitionFormat.teamSize} players.
                </p>
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
                      </tr>
                    </thead>
                    <tbody>
                      {layoutLeaderboard.map((row) => (
                        <tr key={row.teamId} className="border-t border-white/5">
                          <td className="py-2">{row.rank}</td>
                          <td>{row.teamCode} · {row.teamName}</td>
                          <td>{row.score}</td>
                          <td>{formatDurationMs(row.totalCompletionMs)}</td>
                          <td>{row.hintsUsed}</td>
                          <td>{row.failedAttempts}</td>
                        </tr>
                      ))}
                      {!layoutLeaderboard.length && (
                        <tr>
                          <td colSpan={6} className="py-4 text-white/45">No scores yet</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold">Clue progress totals</summary>
                <div className="mt-3 space-y-2 text-sm">
                  {(challengeMon?.progress || []).map((p) => (
                    <div
                      key={`${p._id.challengeNumber}-${p._id.state}`}
                      className="rounded-lg bg-white/5 px-3 py-2"
                    >
                      Clue {p._id.challengeNumber} · {p._id.state}: {p.count}
                    </div>
                  ))}
                  {!challengeMon?.progress?.length && (
                    <p className="text-white/50">No challenge progress yet</p>
                  )}
                </div>
              </details>

              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer font-semibold">Audit log</summary>
                <div className="mt-3 space-y-2 text-sm">
                  {audit.map((entry) => (
                    <div key={entry._id} className="rounded-lg bg-white/5 px-3 py-2">
                      <p className="font-semibold">{entry.action}</p>
                      <p className="text-xs text-white/50">
                        {entry.actorLabel || entry.actorId} ·{' '}
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      {entry.reason && (
                        <p className="mt-1 text-xs text-white/70">{entry.reason}</p>
                      )}
                    </div>
                  ))}
                  {!audit.length && <p className="text-white/50">No audit entries</p>}
                </div>
              </details>
            </div>
          )}
        </>
      )}
    </div>
  );
}

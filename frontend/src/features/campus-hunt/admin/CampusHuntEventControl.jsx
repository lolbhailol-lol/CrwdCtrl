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
import AdminWorkflowNav from './AdminWorkflowNav';
import AdminSetupGuide from './AdminSetupGuide';
import RouteManagerPanel from './RouteManagerPanel';
import PlaytestDesk from './PlaytestDesk';
import VolunteerSetupPanel from './VolunteerSetupPanel';
import Round1ClueFormat from './Round1ClueFormat';
import FinishReturnBoard from './FinishReturnBoard';
import LiveOpsTools from './LiveOpsTools';
import { formatQualificationLabel, CAMPUS_HUNT_STAGES } from './CampusHuntStageProgress';
import CampusHuntRoundsHub, { CampusHuntRoundLocked, ROUND_META } from './CampusHuntRoundsHub';
import FinaleControlPanel from './FinaleControlPanel';

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
  /** null = overall format hub; 'round1' | 'survival' | 'finale' */
  const [activeRound, setActiveRound] = useState(null);
  const [tab, setTab] = useState('clues');
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
  const finaleRound = overview?.rounds?.find((r) => r.name === 'FINALE');
  const round1Finalized = round1?.status === 'finalized' || round1?.status === 'locked';
  const readiness = overview?.readiness;
  const cluesReady = Boolean(readiness?.routesReady);
  const locationsReady = Boolean(readiness?.startingPointsReady);
  const teamsReady = Boolean(
    readiness?.teamsTotal
    && readiness.teamsReady === readiness.teamsTotal,
  );
  const scheduleReady = Boolean(readiness?.scheduleLocked);
  const workflowStatuses = {
    clues: cluesReady ? 'Ready' : 'Needs attention',
    locations: locationsReady ? 'Ready' : 'Needs attention',
    teams: teamsReady ? 'Ready' : readiness?.teamsTotal ? 'Needs attention' : 'Not started',
    schedule: scheduleReady ? 'Ready' : 'Not started',
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

  const startRoundOne = async () => {
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
            topNDirectFinale: 5,
            nextRoundName: 'SURVIVAL_STAGE',
            lastChanceTeams: 0,
            finaleTeams: 12,
            survivalTeams: 35,
          },
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
      setMsg('Round reset to zero — scores back to 100. Next: Schedule → Preview → Generate → Lock → Start.');
      await refresh();
    } catch (err) {
      setMsg(err.message || 'Could not reset Round 1');
    } finally {
      setBusy(false);
    }
  };

  const lockedStage = CAMPUS_HUNT_STAGES.find((stage) => stage.id === activeRound);
  const filteredTeams = teams.filter((team) => {
    const query = teamSearch.trim().toLowerCase();
    return !query || `${team.teamCode} ${team.teamName}`.toLowerCase().includes(query);
  });

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
                Teams {overview?.counts?.teams ?? teams.length}/{overview?.event?.teamCapacity || 40}
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
          finaleStatus={finaleRound?.status}
          teamCapacity={overview?.event?.teamCapacity || 40}
          counts={overview?.counts || {}}
          playerRoundAccess={overview?.event?.playerRoundAccess}
          busy={busy}
          onTogglePlayerRound={(roundId, open) => {
            const current = {
              round1: overview?.event?.playerRoundAccess?.round1 !== false,
              survival: overview?.event?.playerRoundAccess?.survival === true,
              finale: overview?.event?.playerRoundAccess?.finale === true,
            };
            run(
              () => adminUpdateEvent(eventId, {
                playerRoundAccess: { ...current, [roundId]: open },
              }),
              open
                ? `Players can open ${roundId}`
                : `Players locked out of ${roundId}`,
            );
          }}
          onOpenRound={(roundId) => {
            setActiveRound(roundId);
            if (roundId === 'round1') setTab('clues');
          }}
        />
      )}

      {activeRound === 'survival' && lockedStage && (
        <CampusHuntRoundLocked
          roundId={lockedStage.subtitle}
          title={lockedStage.label}
          teams={lockedStage.teams}
          message={ROUND_META[activeRound]?.lockedHint || 'This round is not opened yet.'}
          onBack={() => setActiveRound(null)}
        />
      )}

      {activeRound === 'finale' && (
        <>
          <button
            type="button"
            onClick={() => setActiveRound(null)}
            className="text-xs text-white/50 hover:text-white"
          >
            ← All rounds
          </button>
          <FinaleControlPanel
            eventId={eventId}
            eventSlug={overview?.event?.slug}
            round1Finalized={round1Finalized}
            publicFinaleLive={overview?.event?.publicFinaleLeaderboardLive}
            onRefreshOverview={refresh}
          />
        </>
      )}

      {activeRound && activeRound !== 'round1' && activeRound !== 'finale' && activeRound !== 'survival' && lockedStage && (
        <CampusHuntRoundLocked
          roundId={lockedStage.subtitle}
          title={lockedStage.label}
          teams={lockedStage.teams}
          message={ROUND_META[activeRound]?.lockedHint || 'This round is not opened yet.'}
          onBack={() => setActiveRound(null)}
        />
      )}

      {activeRound === 'round1' && (
        <>
          <button
            type="button"
            onClick={() => setActiveRound(null)}
            className="text-xs text-white/50 hover:text-white"
          >
            ← All rounds
          </button>

          <AdminSetupGuide compact />

          <AdminWorkflowNav
            current={tab}
            onChange={setTab}
            statuses={workflowStatuses}
          />

          {tab === 'clues' && (
            <Round1ClueFormat
              eventId={eventId}
              roundId={round1?._id}
              campusStations={overview?.campusStations || overview?.event?.campusStations}
              onChanged={() => refresh().catch(() => {})}
            />
          )}

          {tab === 'locations' && (
            <div className="space-y-5">
              <section>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 2 · Locations
                </p>
                <h2 className="mt-1 text-xl font-bold">4 starting points</h2>
                <p className="mb-3 text-sm text-white/55">
                  Teams gather here before release. Hunt QR cards live at separate campus places
                  (set under Clues).
                </p>
                <StartingSystemPanel
                  eventId={eventId}
                  roundId={round1?._id}
                  mode="setup"
                  onChanged={() => refresh().catch(() => {})}
                />
              </section>
              <details className="rounded-2xl border border-white/10 bg-white/3 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-white/70">
                  Optional · routes & volunteer logins
                </summary>
                <p className="mt-2 text-xs text-white/45">
                  Not required for player-scan events. Only open if you staff physical gates.
                </p>
                <div className="mt-4 space-y-5">
                  <RouteManagerPanel
                    eventId={eventId}
                    onChanged={() => refresh().catch(() => {})}
                  />
                  <VolunteerSetupPanel
                    eventId={eventId}
                    onChanged={() => refresh().catch(() => {})}
                  />
                </div>
              </details>
            </div>
          )}

          {tab === 'teams' && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 3 · Teams
                </p>
                <h2 className="mt-1 text-xl font-bold">40 teams & login links</h2>
                <p className="text-sm text-white/55">
                  One link per team. Players open it, type the shared password, tap their name.
                </p>
              </div>
              <TeamManagerPanel
                eventId={eventId}
                roundId={round1?._id}
                readiness={readiness}
                onChanged={() => refresh().catch(() => {})}
              />
            </div>
          )}

          {tab === 'schedule' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 4 · Schedule
                </p>
                <h2 className="mt-1 text-xl font-bold">Staggered releases</h2>
                <p className="mb-3 text-sm text-white/55">
                  Big buttons below: Preview → Generate → Lock → Start Round 1.
                </p>
              </div>

              {!round1?._id && (
                <section className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-4">
                  <h2 className="font-semibold text-amber-100">Round 1 is missing</h2>
                  <p className="mt-1 text-sm text-white/65">
                    Create Round 1 first, then Preview / Generate / Lock will unlock.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(
                      async () => {
                        await adminCreateRound(eventId, {
                          roundNumber: 1,
                          name: 'THE_HUNT',
                          status: 'scheduled',
                          qualification: {
                            topNDirectFinale: 5,
                            nextRoundName: 'SURVIVAL_STAGE',
                            lastChanceTeams: 0,
                            finaleTeams: 12,
                            survivalTeams: 35,
                          },
                        });
                      },
                      'Round 1 created — continue with Preview below',
                    )}
                    className="mt-3 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-40"
                  >
                    Create Round 1
                  </button>
                </section>
              )}

              <StartingSystemPanel
                eventId={eventId}
                roundId={round1?._id}
                mode="schedule"
                onChanged={() => refresh().catch(() => {})}
              />

              <section className="rounded-2xl border-2 border-emerald-400/50 bg-emerald-500/15 p-5">
                <h2 className="text-lg font-bold text-emerald-100">4. Start Round 1</h2>
                <p className="mt-1 text-sm text-white/70">
                  After Lock, tap this to open the competition. Teams still only release at their
                  scheduled time.
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
                    disabled={
                      busy
                      || !overview?.event
                      || (round1?.status !== 'locked' && !readiness?.scheduleLocked)
                      || round1?.status === 'finalized'
                    }
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
                {!readiness?.scheduleLocked && round1?.status !== 'locked' ? (
                  <p className="mt-3 text-sm text-amber-100">
                    Locked out until you finish: <strong>1 Preview → 2 Generate → 3 Lock</strong> above.
                  </p>
                ) : round1?.status === 'locked' ? (
                  <p className="mt-3 text-sm text-amber-100">
                    Scores are locked. Tap <strong>Reopen Round 1</strong> (or Results → Reset to zero)
                    to clear progress, then Generate → Lock → Start again.
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-emerald-200">
                    Schedule is locked. You can start now.
                  </p>
                )}
                {readiness && !readiness.ready && readiness.scheduleLocked && (
                  <p className="mt-2 text-xs text-amber-100">
                    Setup still incomplete ({readiness.teamsReady}/{readiness.teamsTotal} rosters,
                    {' '}{readiness.startAssignmentsReady || 0}/{readiness.teamsTotal} full bindings).
                    {readiness.rostersIncomplete > 0 ? (
                      <>
                        {' '}Teams tab → <strong>Repair rosters</strong> — demo teams need leader + 3 player accounts.
                      </>
                    ) : (
                      <> Start may still be blocked — finish Clues + Teams first.</>
                    )}
                  </p>
                )}
              </section>
            </div>
          )}

          {tab === 'live' && (
            <div className="space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Step 5 · Live
                </p>
                <h2 className="mt-1 text-xl font-bold">Operate the hunt</h2>
                <p className="text-sm text-white/55">
                  Playtest one team · release starts · mark finish when teams return
                </p>
              </div>

              <PlaytestDesk
                eventSlug={overview?.event?.slug}
                teams={teams}
                stations={stations}
                roundStatus={round1?.status}
                onChanged={() => refresh().catch(() => {})}
              />

              <section>
                <StartingSystemPanel
                  eventId={eventId}
                  roundId={round1?._id}
                  mode="live"
                  onChanged={() => refresh().catch(() => {})}
                />
              </section>

              <section className="rounded-2xl border border-rose-400/25 bg-[#120a0a] p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-rose-200/80">
                  Finish desk
                </p>
                <h3 className="mt-1 text-lg font-bold text-white">Mark reached at start</h3>
                <p className="mb-3 mt-1 text-sm text-white/55">
                  Team returns with their number → tap Mark reached → score locks.
                </p>
                <FinishReturnBoard
                  eventId={eventId}
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
                    teams={teams}
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
                  “Submit station code”. Need all 4 members (or enable local Dev cheats).
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
                  Stop when the hunt ends. Finalize only after finish desk and issues look correct.
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
                  Top 5 → Finale · ranks 6–40 → Survival
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
                        <th>Qualify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboard.map((row) => (
                        <tr key={row.teamId} className="border-t border-white/5">
                          <td className="py-2">{row.rank}</td>
                          <td>{row.teamCode} · {row.teamName}</td>
                          <td>{row.score}</td>
                          <td>{formatDurationMs(row.totalCompletionMs)}</td>
                          <td>{row.hintsUsed}</td>
                          <td>{row.failedAttempts}</td>
                          <td className="text-xs">{formatQualificationLabel(row.qualification)}</td>
                        </tr>
                      ))}
                      {!leaderboard.length && (
                        <tr>
                          <td colSpan={7} className="py-4 text-white/45">No scores yet</td>
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

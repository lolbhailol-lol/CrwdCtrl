import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminBootstrapFinale,
  adminGetFinaleConfig,
  adminPatchFinaleConfig,
  adminPromoteFinaleAuto,
  adminPromoteFinaleManual,
  adminPromoteFinaleDemo,
  adminGetFinaleEntries,
  adminGetFinaleCandidates,
  adminGetFinaleLeaderboard,
  adminGetFinaleGridSessions,
  adminGetFinaleMissionAssignments,
  adminLockFinaleRound,
  adminFinalizeFinaleLeaderboard,
  adminUpdateEvent,
  adminResetFinaleForRetest,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
import { formatQualificationLabel } from './CampusHuntStageProgress';
import FinaleTestGuide from './FinaleTestGuide';
import FinaleWorkflowNav from './FinaleWorkflowNav';
import FinaleMissionAssignments from './FinaleMissionAssignments';
import FinaleReleaseDesk from './FinaleReleaseDesk';
import FinalePlaytestDesk from './FinalePlaytestDesk';
import { deriveCompetitionFormat } from './competitionFormat';

function demoTeamCode(slot) {
  return `CC${String(slot).padStart(3, '0')}`;
}

function buildDirectTeamSlots(entries, candidates, { demoFallback = true, directCount = 5 } = {}) {
  const promoted = entries
    .filter((e) => e.promotionSource === 'direct_r1')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));

  const preview = (candidates || [])
    .filter((c) => c.qualification === 'DIRECT_FINALE')
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .slice(0, directCount);

  return Array.from({ length: directCount }, (_, index) => {
    const slot = index + 1;
    const team = promoted[index] || null;
    let pending = !team ? preview[index] : null;
    if (!team && !pending && demoFallback) {
      pending = {
        teamCode: demoTeamCode(slot),
        teamName: `Demo Team ${slot}`,
        rank: slot,
        demo: true,
      };
    }
    return {
      slot,
      label: `Team ${slot}`,
      group: 'direct',
      team,
      pending,
      filled: Boolean(team),
      isDemo: Boolean(pending?.demo),
    };
  });
}

function buildSurvivalTeamSlots(entries, candidates, { demoFallback = true, manualPick = 7, directCount = 5 } = {}) {
  const promoted = entries
    .filter((e) => e.promotionSource === 'manual_pick')
    .sort((a, b) => (a.r1Rank ?? 9999) - (b.r1Rank ?? 9999));

  const preview = (candidates || [])
    .filter((c) => c.qualification !== 'DIRECT_FINALE' && !c.inFinale)
    .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
    .slice(0, manualPick);

  return Array.from({ length: manualPick }, (_, index) => {
    const slot = directCount + index + 1;
    const team = promoted[index] || null;
    let pending = !team ? preview[index] : null;
    if (!team && !pending && demoFallback) {
      pending = {
        teamCode: demoTeamCode(slot),
        teamName: `Demo Team ${slot}`,
        rank: slot,
        demo: true,
      };
    }
    return {
      slot,
      label: `Team ${slot}`,
      group: 'survival',
      team,
      pending,
      filled: Boolean(team),
      isDemo: Boolean(pending?.demo),
    };
  });
}

function buildAllFinaleTeamSlots(entries, candidates, options) {
  return [
    ...buildDirectTeamSlots(entries, candidates, options),
    ...buildSurvivalTeamSlots(entries, candidates, options),
  ];
}

function FinaleTeamSlotRow({ slotInfo, eventSlug, compact = false }) {
  const { label, team, pending, filled, isDemo } = slotInfo;
  const code = team?.teamCode || pending?.teamCode;
  const name = team?.teamName || pending?.teamName;
  const r1Rank = team?.r1Rank ?? pending?.rank;
  const r1Score = team?.r1Score ?? pending?.score;
  const loginPath = code && eventSlug ? CAMPUS_HUNT_PATHS.teamLogin(eventSlug, code) : null;

  const inner = (
    <>
      <span className="w-16 shrink-0 font-semibold text-white/80">{label}</span>
      {code ? (
        <>
          <span className="font-mono text-[#0ECCEE]">{code}</span>
          {!compact && name && (
            <span className="min-w-0 flex-1 truncate text-white/60">{name}</span>
          )}
          <span className="ml-auto shrink-0 text-xs text-white/45">
            {filled ? 'Finalist' : isDemo ? 'Demo slot' : 'Preview'}
            {r1Rank != null && ` · R1 #${r1Rank}`}
            {r1Score != null && ` · ${r1Score}`}
          </span>
          {loginPath && (
            <span className="text-[10px] uppercase tracking-wide text-white/35">Open ↗</span>
          )}
        </>
      ) : (
        <span className="text-white/35">— empty slot —</span>
      )}
    </>
  );

  const className = `flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'} ${
    loginPath ? 'rounded-lg px-2 py-1.5 transition hover:bg-white/10' : ''
  }`;

  if (loginPath) {
    return (
      <Link to={loginPath} target="_blank" rel="noreferrer" className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}

function Field({ label, value, onChange, multiline = false }) {
  return (
    <label className="block text-xs uppercase tracking-wide text-white/50">
      {label}
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
        />
      )}
    </label>
  );
}

export default function FinaleControlPanel({
  eventId,
  eventSlug,
  round1Finalized,
  publicFinaleLive,
  onRefreshOverview,
  teamCapacity = 40,
  teamSize = 4,
  directFromR1,
  finaleTeams,
}) {
  const [tab, setTab] = useState('setup');
  const [config, setConfig] = useState(null);
  const [round, setRound] = useState(null);
  const [entries, setEntries] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [gridSessions, setGridSessions] = useState([]);
  const [missionAssignments, setMissionAssignments] = useState(null);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadConfig = useCallback(async () => {
    const res = await adminGetFinaleConfig(eventId);
    setConfig(res.data?.config);
    setRound(res.data?.round);
  }, [eventId]);

  const loadMissionAssignments = useCallback(async () => {
    setAssignmentsLoading(true);
    try {
      const res = await adminGetFinaleMissionAssignments(eventId);
      setMissionAssignments(res.data || null);
    } catch (err) {
      setMsg(err.message || 'Failed to load mission assignments');
    } finally {
      setAssignmentsLoading(false);
    }
  }, [eventId]);

  const loadFinalists = useCallback(async () => {
    const [ent, cand] = await Promise.all([
      adminGetFinaleEntries(eventId),
      adminGetFinaleCandidates(eventId),
    ]);
    setEntries(ent.data?.entries || []);
    setCandidates(cand.data?.candidates || []);
    if (ent.data?.round) setRound(ent.data.round);
  }, [eventId]);

  const loadLive = useCallback(async () => {
    const [cfg, lb, ent, grid] = await Promise.all([
      adminGetFinaleConfig(eventId),
      adminGetFinaleLeaderboard(eventId),
      adminGetFinaleEntries(eventId),
      adminGetFinaleGridSessions(eventId),
    ]);
    setRound(cfg.data?.round);
    setLeaderboard(lb.data?.leaderboard || []);
    setEntries(ent.data?.entries || []);
    setGridSessions(grid.data?.sessions || []);
  }, [eventId]);

  useEffect(() => {
    loadConfig().catch((err) => setMsg(err.message));
  }, [loadConfig]);

  useEffect(() => {
    if (tab === 'setup' || tab === 'teams' || tab === 'schedule' || tab === 'missions') {
      loadFinalists().catch((err) => setMsg(err.message));
    }
    if (tab === 'missions') {
      loadMissionAssignments().catch((err) => setMsg(err.message));
    }
    if (tab === 'live' || tab === 'results') loadLive().catch((err) => setMsg(err.message));
  }, [tab, loadFinalists, loadLive, loadMissionAssignments]);

  const run = async (fn, label) => {
    setBusy(true);
    setMsg('');
    try {
      await fn();
      setMsg(label || 'Done');
      await loadConfig();
      if (tab === 'teams' || tab === 'schedule') await loadFinalists();
      if (tab === 'missions') {
        await loadFinalists();
        await loadMissionAssignments();
      }
      if (tab === 'live' || tab === 'results') await loadLive();
      await onRefreshOverview?.();
    } catch (err) {
      setMsg(err.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  const intel = config?.intelHunt || {};
  const locationPool = intel.locationPool || [];

  const toggleCandidate = (teamId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  const directCount = entries.filter((e) => e.promotionSource === 'direct_r1').length;
  const manualCount = entries.filter((e) => e.promotionSource === 'manual_pick').length;
  const format = deriveCompetitionFormat({
    teamCapacity,
    teamSize,
    directFromR1: directFromR1 ?? round?.qualification?.topNDirectFinale,
    finaleTeams: finaleTeams ?? round?.qualification?.finaleTeams,
  });
  const slotOpts = {
    directCount: format.directFromR1,
    manualPick: format.manualPick,
  };
  const teamsReady = entries.length >= format.finaleTeams;
  const missionsReady = locationPool.length >= Math.max(12, format.finaleTeams)
    && locationPool.every((l) => l.name && l.fragment)
    && Boolean(String(config?.lockbox?.clue || '').trim())
    && (
      (Array.isArray(config?.lockbox?.codePool) && config.lockbox.codePool.length >= Math.min(12, format.finaleTeams))
      || (Array.isArray(config?.lockbox?.acceptedCodes) && config.lockbox.acceptedCodes.some(Boolean))
    )
    && Array.isArray(config?.lockbox?.keyPool)
    && config.lockbox.keyPool.length >= Math.min(12, format.finaleTeams)
    && Boolean(String(config?.blackout?.scout?.clue || '').trim())
    && Array.isArray(config?.blackout?.scout?.acceptedAnswers)
    && config.blackout.scout.acceptedAnswers.some(Boolean);
  const scheduleReady = round?.status === 'scheduled' || round?.status === 'live' || round?.status === 'locked';

  const directTeamSlots = useMemo(
    () => buildDirectTeamSlots(entries, candidates, slotOpts),
    [entries, candidates, format.directFromR1],
  );
  const survivalTeamSlots = useMemo(
    () => buildSurvivalTeamSlots(entries, candidates, slotOpts),
    [entries, candidates, format.manualPick, format.directFromR1],
  );
  const allFinaleTeamSlots = useMemo(
    () => buildAllFinaleTeamSlots(entries, candidates, slotOpts),
    [entries, candidates, format.directFromR1, format.manualPick],
  );
  const topFiveTeams = useMemo(
    () => directTeamSlots.filter((s) => s.filled).map((s) => s.team),
    [directTeamSlots],
  );
  const nextSevenTeams = useMemo(
    () => survivalTeamSlots.filter((s) => s.filled).map((s) => s.team),
    [survivalTeamSlots],
  );

  const workflowStatuses = useMemo(() => ({
    setup: round ? 'Ready' : 'Not started',
    missions: missionsReady ? 'Ready' : config ? 'Needs attention' : 'Not started',
    teams: teamsReady ? 'Ready' : entries.length > 0 ? 'Needs attention' : 'Not started',
    schedule: round?.status === 'live' ? 'Live' : scheduleReady ? 'Ready' : 'Not started',
    live: round?.status === 'live' ? 'Live' : round?.status === 'locked' ? 'Complete' : 'Not started',
    results: round?.status === 'finalized' ? 'Complete' : round?.status === 'locked' ? 'Ready' : 'Not started',
  }), [round, config, missionsReady, teamsReady, entries.length, scheduleReady]);

  const saveSetupRules = () => run(
    () => adminPatchFinaleConfig(eventId, {
      missionDurationMinutes: config.missionDurationMinutes,
      intelHunt: {
        maxAttemptsPerStep: config.intelHunt?.maxAttemptsPerStep,
      },
    }),
    'Rules saved',
  );

  const saveMissionConfig = () => run(
    () => adminPatchFinaleConfig(eventId, {
      missionDurationMinutes: config.missionDurationMinutes,
      intelHunt: config.intelHunt,
      lockbox: config.lockbox,
      fieldTerminal: config.fieldTerminal || config.borrowedDevice,
      blackout: config.blackout,
      missions: config.missions,
    }),
    'Mission config saved',
  );

  const toggleMissionEnabled = (missionId, enabled) => {
    const existing = Array.isArray(config?.missions) ? [...config.missions] : [];
    const idx = existing.findIndex((m) => (
      m.id === missionId
      || (missionId === 'field_terminal' && m.id === 'borrowed_device')
    ));
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], id: missionId, enabled };
    } else {
      existing.push({ id: missionId, enabled });
    }
    setConfig((prev) => ({ ...prev, missions: existing }));
    return run(
      () => adminPatchFinaleConfig(eventId, { missions: existing }),
      enabled ? `${missionId} turned ON` : `${missionId} turned OFF`,
    );
  };

  const fillDemoFinalists = async () => {
    let entRes = await adminGetFinaleEntries(eventId);
    let currentDirect = (entRes.data?.entries || [])
      .filter((e) => e.promotionSource === 'direct_r1').length;
    if (currentDirect < format.directFromR1) {
      await adminPromoteFinaleAuto(eventId);
      entRes = await adminGetFinaleEntries(eventId);
    }
    const currentManual = (entRes.data?.entries || [])
      .filter((e) => e.promotionSource === 'manual_pick').length;
    const need = format.manualPick - currentManual;
    if (need > 0) {
      const candRes = await adminGetFinaleCandidates(eventId);
      const teamIds = (candRes.data?.candidates || [])
        .filter((c) => c.selectable)
        .sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999))
        .slice(0, need)
        .map((c) => c.teamId);
      if (teamIds.length > 0) {
        await adminPromoteFinaleManual(eventId, teamIds);
      }
    }
  };

  return (
    <div className="space-y-4">
      <FinaleWorkflowNav
        current={tab}
        onChange={setTab}
        statuses={workflowStatuses}
        finaleTeams={format.finaleTeams}
      />

      {msg && (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80">
          {msg}
        </p>
      )}

      {tab === 'setup' && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Step 0 · Setup
            </p>
            <h2 className="mt-1 text-xl font-bold">Bootstrap & global rules</h2>
            <p className="text-sm text-white/55">
              {format.finaleTeams} teams × {format.teamSize} players · 500 start pts · 45 min free-choice mission board.
            </p>
          </div>

          {!round && (
            <button
              type="button"
              disabled={busy}
              onClick={() => run(() => adminBootstrapFinale(eventId), 'Finale bootstrapped')}
              className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
            >
              Bootstrap Finale round
            </button>
          )}

          {round && (
            <p className="text-sm text-white/60">
              Round {round.roundNumber} · {round.status}
              {!round1Finalized && ' · Promote finalists after R1 is finalized'}
            </p>
          )}

          {config && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="Per-mission timer (minutes)"
                value={String(config.missionDurationMinutes ?? 10)}
                onChange={(v) => setConfig((p) => ({ ...p, missionDurationMinutes: Number(v) || 10 }))}
              />
              <Field
                label="Intel attempts per step"
                value={String(intel.maxAttemptsPerStep ?? 2)}
                onChange={(v) => setConfig((p) => ({
                  ...p,
                  intelHunt: { ...p.intelHunt, maxAttemptsPerStep: Number(v) || 2 },
                }))}
              />
              <p className="col-span-full text-xs text-white/45">
                Finale duration is fixed at 45 minutes. Mission content lives under the Missions tab.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={saveSetupRules}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
              >
                Save rules
              </button>
            </div>
          )}

          <details className="rounded-xl border border-white/10 bg-black/20">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-white/70">
              Test guide (pilot flow)
            </summary>
            <div className="border-t border-white/10 p-4">
              <FinaleTestGuide eventSlug={eventSlug} entries={entries} />
            </div>
          </details>
        </section>
      )}

      {tab === 'missions' && config && (
        <FinaleMissionAssignments
          assignments={missionAssignments}
          eventSlug={eventSlug}
          loading={assignmentsLoading}
          config={config}
          setConfig={setConfig}
          onSave={saveMissionConfig}
          busy={busy}
          hasRound={Boolean(round)}
          demoBusy={busy}
          onToggleMissionEnabled={toggleMissionEnabled}
          onPromoteDemo={() => run(
            () => adminPromoteFinaleDemo(eventId),
            'Demo finalists ready — first finalist slots filled',
          )}
        />
      )}

      {tab === 'teams' && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Step 2 · Teams
            </p>
            <h2 className="mt-1 text-xl font-bold">{format.finaleTeams} finalists</h2>
            <p className="text-sm text-white/55">
              Team 1–{format.directFromR1} direct from R1 · Team {format.directFromR1 + 1}–{format.finaleTeams} from Survival.
              Click any team to open their play link.
            </p>
          </div>

          {teamsReady && (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              All {format.finaleTeams} finalists are set. Click a team below to test the finale mission board.
            </p>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                  Finale field · Team 1 → Team {format.finaleTeams}
                </p>
                <p className="mt-1 text-sm font-bold">
                  {entries.length}/{format.finaleTeams} promoted
                </p>
              </div>
              <p className="text-xs text-white/45">
                Demo slots use CC001–CC{String(format.finaleTeams).padStart(3, '0')} until promoted
              </p>
            </div>
            <div className="mt-3 divide-y divide-white/10 rounded-xl border border-white/10">
              {allFinaleTeamSlots.map((slot) => (
                <div key={slot.slot} className="px-3 py-2">
                  <FinaleTeamSlotRow slotInfo={slot} eventSlug={eventSlug} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                Top {format.directFromR1} · Direct R1
              </p>
              <p className="mt-1 text-xs text-white/45">Team 1 → Team {format.directFromR1}</p>
              <div className="mt-2 text-sm font-bold">
                {topFiveTeams.length}/{format.directFromR1} promoted
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
                Next {format.manualPick} · Survival picks
              </p>
              <p className="mt-1 text-xs text-white/45">
                Team {format.directFromR1 + 1} → Team {format.finaleTeams}
              </p>
              <div className="mt-2 text-sm font-bold">
                {nextSevenTeams.length}/{format.manualPick} promoted
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !round}
              onClick={() => run(
                () => adminPromoteFinaleDemo(eventId),
                `Demo finalists ready — first ${format.finaleTeams} teams (no R1 finalize needed)`,
              )}
              className="rounded-xl bg-emerald-500/25 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40"
            >
              Testing: make first {format.finaleTeams} finalists
            </button>
            <button
              type="button"
              disabled={busy || !round}
              onClick={() => run(fillDemoFinalists, `Demo: all ${format.finaleTeams} finalists promoted`)}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-40"
            >
              Demo: fill all {format.finaleTeams} ({entries.length}/{format.finaleTeams})
            </button>
            <button
              type="button"
              disabled={busy || !round1Finalized}
              onClick={() => run(
                () => adminPromoteFinaleAuto(eventId),
                `Top ${format.directFromR1} promoted`,
              )}
              className="rounded-xl bg-[#0ECCEE] px-4 py-2 text-sm font-bold text-black disabled:opacity-40"
            >
              Auto-promote top {format.directFromR1} ({directCount}/{format.directFromR1})
            </button>
            <button
              type="button"
              disabled={busy || selected.size === 0 || directCount < format.directFromR1}
              onClick={() => run(
                () => adminPromoteFinaleManual(eventId, [...selected]),
                `Promoted ${selected.size} teams`,
              )}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Manual pick selected ({manualCount}/{format.manualPick})
            </button>
          </div>
          <p className="text-[11px] text-white/40">
            Testing shortcut does not need Round 1 finalized. Auto / Manual picks do.
          </p>

          <p className="text-xs text-white/50">
            {entries.length}/{format.finaleTeams} finalists · Direct: {directCount} · Manual: {manualCount}
          </p>

          {entries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase text-white/45">
                    <th className="py-2">#</th>
                    <th>Team</th>
                    <th>Score</th>
                    <th>Source</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-white/10">
                      <td className="py-2">{e.rank}</td>
                      <td>
                        {eventSlug ? (
                          <Link
                            to={CAMPUS_HUNT_PATHS.teamLogin(eventSlug, e.teamCode)}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[#0ECCEE] hover:underline"
                          >
                            {e.teamCode}
                          </Link>
                        ) : (
                          e.teamCode
                        )}
                        {' · '}
                        {e.teamName}
                      </td>
                      <td>{e.finaleScore}</td>
                      <td>{e.promotionSource === 'direct_r1' ? 'Direct R1' : 'Manual'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">Pick 7 from Survival pool</h3>
          <div className="max-h-64 overflow-y-auto divide-y divide-white/10 rounded-xl border border-white/10">
            {candidates.filter((c) => c.selectable).map((c) => (
              <label
                key={c.teamId}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-white/5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.teamId)}
                  onChange={() => toggleCandidate(c.teamId)}
                />
                <span className="font-mono text-[#0ECCEE]">{c.teamCode}</span>
                <span className="flex-1 truncate">{c.teamName}</span>
                <span className="text-xs text-white/45">{formatQualificationLabel(c.qualification)}</span>
                <span className="tabular-nums">{c.score}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      {tab === 'schedule' && round && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <ul className="mb-4 space-y-2 text-sm">
            <li className={`flex items-center gap-2 ${round1Finalized ? 'text-emerald-300' : 'text-white/50'}`}>
              {round1Finalized ? '✓' : '○'} Round 1 finalized
            </li>
            <li className={`flex items-center gap-2 ${teamsReady ? 'text-emerald-300' : 'text-white/50'}`}>
              {teamsReady ? '✓' : '○'} {format.finaleTeams} finalists promoted ({entries.length}/{format.finaleTeams})
            </li>
            <li className={`flex items-center gap-2 ${missionsReady ? 'text-emerald-300' : 'text-white/50'}`}>
              {missionsReady ? '✓' : '○'} Mission config saved ({locationPool.length}/12 locations)
            </li>
          </ul>
          <FinaleReleaseDesk
            eventId={eventId}
            eventSlug={eventSlug}
            round={round}
            entriesCount={entries.length}
            requiredFinaleTeams={format.finaleTeams}
            mode="schedule"
            onChanged={() => {
              loadConfig();
              loadFinalists();
              onRefreshOverview?.();
            }}
          />
        </section>
      )}

      {tab === 'live' && round && (
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Step 5 · Live
            </p>
            <h2 className="mt-1 text-xl font-bold">Operate Finals</h2>
            <p className="text-sm text-white/55">
              Playtest one team · release waves · mark finish when done
            </p>
          </div>

          <FinalePlaytestDesk
            eventId={eventId}
            eventSlug={eventSlug}
            entries={entries}
            roundStatus={round?.status}
            onChanged={() => {
              loadLive();
              onRefreshOverview?.();
            }}
          />

          <FinaleReleaseDesk
            eventId={eventId}
            eventSlug={eventSlug}
            round={round}
            entriesCount={entries.length}
            requiredFinaleTeams={format.finaleTeams}
            mode="live"
            onChanged={() => {
              loadLive();
              onRefreshOverview?.();
            }}
          />

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex flex-wrap gap-2">
              {round.status === 'live' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => adminLockFinaleRound(round._id || round.id), 'Finale locked')}
                  className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-100"
                >
                  Force lock Finals now
                </button>
              )}
              {round.status === 'live' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(
                      'Wipe ALL finalists?\n\nScores → start · missions cleared · Finals stays LIVE · Release again',
                    )) return;
                    run(
                      () => adminResetFinaleForRetest(eventId, { keepLive: true }),
                      'All teams wiped — Finals still live',
                    );
                  }}
                  className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Reset all teams (keep live)
                </button>
              )}
              {round.status !== 'finalized' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(
                      `Reset Finals for retest?\n\n• Round → scheduled (off)\n• All team progress cleared\n• Keep the ${format.finaleTeams} finalists\n• Re-generate schedule & Start again`,
                    )) return;
                    run(
                      () => adminResetFinaleForRetest(eventId, { keepLive: false }),
                      'Finals reset — Schedule → Generate → Lock → Start',
                    );
                  }}
                  className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100"
                >
                  Reset entire Finals round
                </button>
              )}
            </div>

            {gridSessions.length > 0 && (
              <div className="mt-4 rounded-xl border border-[#0ECCEE]/20 bg-[#0ECCEE]/5 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
                  CrwdCtrl Grid sessions
                </p>
                <div className="mt-3 divide-y divide-white/10 rounded-lg border border-white/10">
                  {gridSessions.map((s) => (
                    <div key={s.accessCode} className="flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-mono font-semibold text-[#0ECCEE]">{s.teamCode}</span>
                      <span className="font-mono tracking-wider text-white/70">{s.accessCode}</span>
                      <span className="text-white/45">
                        L{s.levelsCompleted}/{s.totalLevels}
                        {typeof s.score === 'number' && ` · ${s.score} pts`}
                        {s.status === 'completed' && ' · done'}
                        {s.completionCodeUsed && ' · claimed'}
                      </span>
                      {s.completionCode && (
                        <span className="font-mono text-emerald-300">{s.completionCode}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 divide-y divide-white/10 rounded-xl border border-white/10">
              {leaderboard.map((row) => (
                <div key={row.teamId} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-6 font-bold text-[#0ECCEE]">{row.rank}</span>
                  <span className="flex-1 truncate">{row.teamCode} · {row.teamName}</span>
                  <span className="font-bold tabular-nums">{row.finaleScore}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {tab === 'results' && round && (
        <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[#0ECCEE]">
              Step 5 · Results
            </p>
            <h2 className="mt-1 text-xl font-bold">Finale leaderboard</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => run(
                () => adminFinalizeFinaleLeaderboard(round._id || round.id, true),
                'Finale leaderboard finalized',
              )}
              className="rounded-xl bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-100"
            >
              Finalize results
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(
                () => adminUpdateEvent(eventId, { publicFinaleLeaderboardLive: !publicFinaleLive }),
                publicFinaleLive ? 'Public finale board hidden' : 'Public finale board live',
              )}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold"
            >
              {publicFinaleLive ? 'Hide public finale board' : 'Show public finale board'}
            </button>
            {round.status !== 'finalized' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(
                    'Reset Finals for retest?\n\nKeeps finalists, clears progress, turns round off.',
                  )) return;
                  run(
                    () => adminResetFinaleForRetest(eventId, { keepLive: false }),
                    'Finals reset — ready to schedule again',
                  );
                }}
                className="rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100"
              >
                Reset Finals for retest
              </button>
            )}
          </div>

          {leaderboard[0] && (
            <p className="text-lg font-bold text-[#0ECCEE]">
              Winner: {leaderboard[0].teamCode} · {leaderboard[0].finaleScore} pts
            </p>
          )}

          <div className="divide-y divide-white/10 rounded-xl border border-white/10">
            {leaderboard.map((row) => (
              <div key={row.teamId} className="flex items-center gap-3 px-3 py-2">
                <span className="w-6 font-bold">{row.rank}</span>
                <span className="flex-1">{row.teamName}</span>
                <span className="tabular-nums">{row.finalScore ?? row.finaleScore}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

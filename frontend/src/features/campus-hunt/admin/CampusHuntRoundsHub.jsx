import { useEffect, useState } from 'react';
import { buildStagesFromFormat, deriveCompetitionFormat } from './competitionFormat';

function buildRoundMeta(format) {
  return {
    round1: {
      opensWhen: 'Available now — setup, teams, schedule, live ops, results.',
      lockedHint: '',
    },
    survival: {
      opensWhen: 'Opens after Round 1 is locked / finalized.',
      lockedHint:
        `Survival Stage is not opened yet. Finish Round 1 first `
        + `(top ${format.survivalTeams} advance; top ${format.directFromR1} go direct to Finale).`,
    },
    finale: {
      opensWhen:
        `Opens after Round 1 is finalized. Promote ${format.finaleTeams} finalists, `
        + 'configure missions, start 45-min timer.',
      lockedHint: 'Finale opens after Round 1 is finalized. Bootstrap the Finale round from Setup.',
    },
  };
}

function roundOpenState(stageId, round1Status, finaleStatus) {
  const status = String(round1Status || 'not_created').toLowerCase();
  const finale = String(finaleStatus || 'not_created').toLowerCase();
  if (stageId === 'round1') {
    if (status === 'finalized' || status === 'locked') return 'complete';
    if (status === 'live') return 'live';
    if (status === 'scheduled') return 'ready';
    return 'ready';
  }
  if (stageId === 'survival') {
    return 'not_opened';
  }
  if (stageId === 'finale') {
    const r1Done = status === 'finalized' || status === 'locked';
    if (!r1Done && (!finale || finale === 'not_created')) return 'not_opened';
    if (finale === 'finalized' || finale === 'locked') return 'complete';
    if (finale === 'live') return 'live';
    return 'ready';
  }
  return 'not_opened';
}

const BADGE = {
  live: { label: 'LIVE', className: 'bg-[#0ECCEE]/20 text-[#0ECCEE]' },
  complete: { label: 'COMPLETED', className: 'bg-emerald-500/20 text-emerald-200' },
  ready: { label: 'OPEN', className: 'bg-white/10 text-white/80' },
  not_opened: { label: 'NOT OPENED YET', className: 'bg-amber-500/15 text-amber-100' },
};

/**
 * Event hub: overall competition format, then clickable rounds.
 * Includes player-facing open/lock toggles for the post-login hub.
 */
export default function CampusHuntRoundsHub({
  round1Status,
  finaleStatus,
  teamCapacity = 40,
  teamSize = 4,
  directFromR1,
  finaleTeams,
  counts = {},
  onOpenRound,
  playerRoundAccess,
  onTogglePlayerRound,
  onSaveFormat,
  busy = false,
}) {
  const savedFormat = deriveCompetitionFormat({
    teamCapacity,
    teamSize,
    directFromR1,
    finaleTeams,
  });
  const [draftCapacity, setDraftCapacity] = useState(String(savedFormat.teamCapacity));
  const [draftTeamSize, setDraftTeamSize] = useState(String(savedFormat.teamSize));

  useEffect(() => {
    setDraftCapacity(String(savedFormat.teamCapacity));
    setDraftTeamSize(String(savedFormat.teamSize));
  }, [teamCapacity, teamSize]);

  const previewFormat = deriveCompetitionFormat({
    teamCapacity: draftCapacity,
    teamSize: draftTeamSize,
    directFromR1,
    finaleTeams,
  });
  const stages = buildStagesFromFormat(previewFormat);
  const ROUND_META = buildRoundMeta(previewFormat);
  const access = {
    round1: playerRoundAccess?.round1 !== false,
    survival: playerRoundAccess?.survival === true,
    finale: playerRoundAccess?.finale === true,
  };
  const formatDirty = Number(draftCapacity) !== savedFormat.teamCapacity
    || Number(draftTeamSize) !== savedFormat.teamSize;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-bold uppercase tracking-wide">Overall format</h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Set overall teams and people per team. Round 1, Survival, and Finale counts update from that.
        </p>

        {typeof onSaveFormat === 'function' && (
          <div className="mt-4 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
              Competition size
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-white/50">
                Overall teams
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={draftCapacity}
                  onChange={(e) => setDraftCapacity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/50">
                People per team
                <input
                  type="number"
                  min={2}
                  max={8}
                  value={draftTeamSize}
                  onChange={(e) => setDraftTeamSize(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  disabled={busy || !formatDirty}
                  onClick={() => onSaveFormat({
                    teamCapacity: previewFormat.teamCapacity,
                    teamSize: previewFormat.teamSize,
                  })}
                  className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Save size'}
                </button>
                <p className="mt-1 text-[11px] text-white/45">
                  {previewFormat.totalPlayers} total players
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-semibold uppercase tracking-wide text-white/70">
          <span className="rounded-lg bg-black/30 px-3 py-1.5">
            <strong className="text-[#0ECCEE]">{previewFormat.round1Teams}</strong> → Round 1
          </span>
          <span className="text-white/30">→</span>
          <span className="rounded-lg bg-black/30 px-3 py-1.5">
            <strong className="text-[#0ECCEE]">{previewFormat.survivalTeams}</strong> Survival
          </span>
          <span className="text-white/30">→</span>
          <span className="rounded-lg bg-black/30 px-3 py-1.5">
            <strong className="text-[#0ECCEE]">{previewFormat.finaleTeams}</strong> Finale
            <span className="ml-1 text-[11px] tracking-wide text-white/40">
              (+{previewFormat.directFromR1} direct)
            </span>
          </span>
          <span className="rounded-lg bg-black/30 px-3 py-1.5 text-[11px] normal-case tracking-wide text-white/50">
            {previewFormat.teamSize} / team
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            ['Teams', counts.teams],
            ['Active', counts.activeTeams],
            ['Finished', counts.finishedTeams],
            ['Open issues', counts.openIssues],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-black/25 px-3 py-3">
              <p className="text-xs text-white/50">{label}</p>
              <p className="text-2xl font-bold">{value ?? 0}</p>
            </div>
          ))}
        </div>
      </section>

      {typeof onTogglePlayerRound === 'function' && (
        <section className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0ECCEE]">
            Player round locks
          </h2>
          <p className="mt-1 text-xs text-white/55">
            After login, teams see all three rounds. Locked = visible but cannot open.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ['round1', 'Round 1'],
              ['survival', 'Survival'],
              ['finale', 'Finals'],
            ].map(([id, label]) => {
              const open = access[id];
              return (
                <button
                  key={id}
                  type="button"
                  disabled={busy}
                  onClick={() => onTogglePlayerRound(id, !open)}
                  className={`rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 ${
                    open
                      ? 'bg-emerald-400 text-black'
                      : 'bg-white/10 text-white/70'
                  }`}
                >
                  {label} · {open ? 'OPEN' : 'LOCKED'}
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-white/45">
          All rounds
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          {stages.map((stage, index) => {
            const openState = roundOpenState(stage.id, round1Status, finaleStatus);
            const badge = BADGE[openState];
            const meta = ROUND_META[stage.id];
            const canEnter = stage.id === 'round1' || openState !== 'not_opened';

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => onOpenRound?.(stage.id)}
                className={`rounded-2xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ECCEE] ${
                  openState === 'not_opened'
                    ? 'border-white/10 bg-black/25 hover:border-white/20'
                    : openState === 'live'
                      ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10 hover:border-[#0ECCEE]/60'
                      : openState === 'complete'
                        ? 'border-emerald-400/30 bg-emerald-500/10 hover:border-emerald-400/50'
                        : 'border-white/15 bg-white/5 hover:border-[#0ECCEE]/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                      Round {index + 1} · {stage.subtitle}
                    </p>
                    <h3 className="mt-1 text-xl font-bold uppercase tracking-wide text-white">{stage.label}</h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold tabular-nums text-[#0ECCEE]">
                  {stage.teams}
                  <span className="ml-1 text-xs font-medium text-white/45">teams</span>
                </p>
                <p className="mt-2 text-xs leading-relaxed text-white/50">{stage.detail}</p>
                {stage.id === 'finale' && (
                  <p className="mt-2 text-[11px] text-white/40">
                    Path A: {previewFormat.directFromR1} direct from Round 1 · Path B: Survival top{' '}
                    {previewFormat.manualPick}
                  </p>
                )}
                <p className="mt-2 text-[11px] font-medium text-white/55">
                  Players: {access[stage.id] ? 'can open' : 'locked on hub'}
                </p>
                <p className="mt-3 text-xs font-medium text-white/70">
                  {canEnter && stage.id === 'round1'
                    ? 'Open Round 1 →'
                    : openState === 'not_opened'
                      ? meta.lockedHint
                      : meta.opensWhen}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function CampusHuntRoundLocked({
  roundId,
  title,
  teams,
  message,
  onBack,
}) {
  return (
    <section className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-6 text-center">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 text-xs text-white/50 hover:text-white"
      >
        ← All rounds
      </button>
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-100/80">
        {roundId}
      </p>
      <h2 className="text-xl font-bold uppercase tracking-wide text-white">{title}</h2>
      <p className="mt-1 text-sm uppercase tracking-wide text-white/60">{teams} teams when this round opens</p>
      <p className="mx-auto mt-4 max-w-md rounded-xl bg-black/25 px-4 py-3 text-sm font-semibold uppercase tracking-wide text-amber-50">
        Not opened yet
      </p>
      <p className="mx-auto mt-3 max-w-lg text-sm text-white/55">{message}</p>
    </section>
  );
}

export const ROUND_META = buildRoundMeta(deriveCompetitionFormat({ teamCapacity: 40, teamSize: 4 }));
export { roundOpenState };

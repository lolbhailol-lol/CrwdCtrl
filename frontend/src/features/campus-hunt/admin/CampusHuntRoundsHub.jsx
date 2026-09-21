import { useEffect, useMemo, useState } from 'react';
import { deriveCompetitionFormat } from './competitionFormat';
import { deriveClueGeometry, suggestHuntLayout } from './campusHuntFormat';

/**
 * Event hub — single game (no Survival / Finals).
 * Competition size drives recommended starts + campus places.
 */
export default function CampusHuntRoundsHub({
  round1Status,
  teamCapacity = 20,
  teamSize = 10,
  startCount: savedStartCount,
  stationCount: savedStationCount,
  roundPlan: roundPlanProp,
  onOpenRound,
  onSaveFormat,
  busy = false,
}) {
  const savedFormat = deriveCompetitionFormat({ teamCapacity, teamSize, roundPlan: roundPlanProp });
  const plan = savedFormat.roundPlan;
  const [draftCapacity, setDraftCapacity] = useState(String(savedFormat.teamCapacity));
  const [draftTeamSize, setDraftTeamSize] = useState(String(savedFormat.teamSize));

  useEffect(() => {
    setDraftCapacity(String(savedFormat.teamCapacity));
    setDraftTeamSize(String(savedFormat.teamSize));
  }, [teamCapacity, teamSize, savedFormat.teamCapacity, savedFormat.teamSize]);

  const previewFormat = deriveCompetitionFormat({
    teamCapacity: draftCapacity,
    teamSize: draftTeamSize,
  });

  const suggested = useMemo(
    () => suggestHuntLayout(previewFormat.teamCapacity),
    [previewFormat.teamCapacity],
  );

  const previewLayout = useMemo(
    () => deriveClueGeometry(
      previewFormat.teamCapacity,
      previewFormat.teamSize,
      {
        startCount: suggested.startCount,
        stationCount: suggested.stationCount,
      },
    ),
    [previewFormat.teamCapacity, previewFormat.teamSize, suggested.startCount, suggested.stationCount],
  );

  const formatDirty = Number(draftCapacity) !== savedFormat.teamCapacity
    || Number(draftTeamSize) !== savedFormat.teamSize
    || Number(savedStartCount || 0) !== previewLayout.startCount
    || Number(savedStationCount || 0) !== previewLayout.stationCount;

  const status = String(round1Status || 'not_created').toLowerCase();
  const badge = status === 'live'
    ? { label: 'LIVE', className: 'bg-[#0ECCEE]/20 text-[#0ECCEE]' }
    : (status === 'finalized' || status === 'locked')
      ? { label: 'COMPLETED', className: 'bg-emerald-500/20 text-emerald-200' }
      : { label: 'OPEN', className: 'bg-white/10 text-white/80' };

  const save = (createDemoTeams = true) => {
    onSaveFormat?.({
      teamCapacity: previewFormat.teamCapacity,
      teamSize: previewFormat.teamSize,
      startCount: previewLayout.startCount,
      stationCount: previewLayout.stationCount,
      createDemoTeams,
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-bold uppercase tracking-wide">
          The Hunt · {plan?.round1Name || 'Campus Hunt'}
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-white/55">
          Set teams + people per team, save, then open the hunt.
        </p>

        {typeof onSaveFormat === 'function' && (
          <div className="mt-4 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">
              Size
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-white/50">
                Teams
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
                People / team
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={draftTeamSize}
                  onChange={(e) => setDraftTeamSize(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2 text-sm text-white"
                />
              </label>
              <div className="flex flex-col justify-end gap-2">
                <button
                  type="button"
                  disabled={busy || !formatDirty}
                  onClick={() => save(true)}
                  className="rounded-lg bg-[#0ECCEE] px-3 py-2 text-sm font-semibold text-black disabled:opacity-40"
                >
                  {busy ? 'Saving…' : 'Save size + ready Links'}
                </button>
                <p className="text-[11px] text-white/45">
                  {previewLayout.startCount} start · {previewLayout.stationCount} places · {previewFormat.totalPlayers} players
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section>
        <button
          type="button"
          onClick={() => onOpenRound?.('round1')}
          className="w-full rounded-2xl border border-[#0ECCEE]/40 bg-[#0ECCEE]/10 p-5 text-left transition hover:border-[#0ECCEE]/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ECCEE]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                The Hunt · {plan?.round1Name || 'Campus Hunt'}
              </p>
              <h3 className="mt-1 text-2xl font-bold uppercase tracking-wide text-white">
                Open the hunt
              </h3>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-2 text-sm text-white/60">
            {previewFormat.round1Teams} teams · {previewFormat.teamSize}/team ·
            {' '}
            Places → Clues → Teams → Links → Live
          </p>
          <p className="mt-3 text-sm font-medium text-[#0ECCEE]">
            Open →
          </p>
        </button>
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
        ← Back
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

export const ROUND_META = {
  round1: {
    opensWhen: 'Available now',
    lockedHint: '',
  },
};

export function roundOpenState(stageId, round1Status) {
  const status = String(round1Status || 'not_created').toLowerCase();
  if (stageId === 'round1') {
    if (status === 'finalized' || status === 'locked') return 'complete';
    if (status === 'live') return 'live';
    return 'ready';
  }
  return 'not_opened';
}

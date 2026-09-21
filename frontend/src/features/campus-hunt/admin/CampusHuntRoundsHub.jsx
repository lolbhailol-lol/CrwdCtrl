import { useEffect, useState } from 'react';
import { deriveCompetitionFormat } from './competitionFormat';

/**
 * Event hub — set teams × people, save, open the hunt.
 */
export default function CampusHuntRoundsHub({
  round1Status,
  teamCapacity = 20,
  teamSize = 10,
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

  const dirty = previewFormat.teamCapacity !== savedFormat.teamCapacity
    || previewFormat.teamSize !== savedFormat.teamSize;

  const status = String(round1Status || 'not_created').toLowerCase();
  const badge = status === 'live'
    ? { label: 'LIVE', className: 'bg-[#0ECCEE]/20 text-[#0ECCEE]' }
    : (status === 'finalized' || status === 'locked')
      ? { label: 'COMPLETED', className: 'bg-emerald-500/20 text-emerald-200' }
      : { label: 'OPEN', className: 'bg-white/10 text-white/80' };

  const save = () => {
    onSaveFormat?.({
      teamCapacity: previewFormat.teamCapacity,
      teamSize: previewFormat.teamSize,
    });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-bold uppercase tracking-wide">
          {plan?.round1Name || 'Campus Hunt'}
        </h2>
        <p className="mt-1 text-sm text-white/55">
          Set how many teams and people per team, then Save.
        </p>

        {typeof onSaveFormat === 'function' && (
          <div className="mt-4 space-y-3 rounded-xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/5 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-white/50">
                Teams
                <input
                  type="number"
                  min={2}
                  max={200}
                  value={draftCapacity}
                  onChange={(e) => setDraftCapacity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2.5 text-base text-white"
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
                  className="mt-1 w-full rounded-lg border border-white/20 bg-[#161718] px-3 py-2.5 text-base text-white"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy || !dirty}
              onClick={save}
              className="w-full rounded-xl bg-[#0ECCEE] px-4 py-3 text-sm font-bold text-black disabled:opacity-40"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
            <p className="text-center text-xs text-white/45">
              {previewFormat.teamCapacity} teams · {previewFormat.teamSize}/team · {previewFormat.totalPlayers} players
            </p>
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
                Next
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

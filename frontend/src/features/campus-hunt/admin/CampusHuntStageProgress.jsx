/**
 * Competition ladder — team counts derived from overall capacity / people per team.
 * Baseline (40): top 5 direct → Finale; 35 Survival; Finale field 12 (5+7).
 */

import {
  buildStagesFromFormat,
  deriveCompetitionFormat,
} from './competitionFormat';

export const CAMPUS_HUNT_STAGES = buildStagesFromFormat({ teamCapacity: 40, teamSize: 4 });

function stageState(stageId, round1Status) {
  const status = String(round1Status || 'not_created').toLowerCase();
  const round1Done = status === 'locked' || status === 'finalized';
  const round1Live = status === 'live';

  if (stageId === 'round1') {
    if (round1Done) return 'complete';
    if (round1Live) return 'active';
    if (status === 'scheduled') return 'ready';
    return 'upcoming';
  }
  return 'locked';
}

const STATE_STYLES = {
  active: 'border-[#0ECCEE]/55 bg-[#0ECCEE]/12',
  complete: 'border-emerald-400/40 bg-emerald-500/10',
  ready: 'border-white/20 bg-white/6',
  upcoming: 'border-white/12 bg-white/4',
  locked: 'border-white/10 bg-black/20 opacity-80',
};

const STATE_BADGE = {
  active: 'Live',
  complete: 'Done',
  ready: 'Ready',
  upcoming: 'Upcoming',
  locked: 'Locked',
};

export default function CampusHuntStageProgress({
  round1Status,
  teamCapacity = 40,
  teamSize = 4,
  directFromR1,
  finaleTeams,
  compact = false,
  className = '',
}) {
  const format = deriveCompetitionFormat({
    teamCapacity,
    teamSize,
    directFromR1,
    finaleTeams,
  });
  const stages = buildStagesFromFormat(format);

  return (
    <section
      className={`rounded-2xl border border-white/10 bg-white/5 p-4 ${className}`}
      aria-label="Competition stages"
    >
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white">Competition format</h2>
          {!compact && (
            <p className="mt-1 max-w-2xl text-xs text-white/50">
              Round 1 starts with {format.round1Teams} teams ({format.teamSize} people each):
              top {format.directFromR1} go direct to Finale; the other {format.survivalTeams} enter
              Survival. Survival top {format.manualPick} join them in Finale ({format.finaleTeams} teams).
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {stages.map((stage, index) => {
          const state = stageState(stage.id, round1Status);
          return (
            <article
              key={stage.id}
              className={`relative rounded-xl border px-3 py-3 ${STATE_STYLES[state]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                  {index + 1}. {stage.subtitle}
                </p>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] text-white/70">
                  {STATE_BADGE[state]}
                </span>
              </div>
              <h3 className="mt-1 text-base font-bold uppercase tracking-wide text-white">{stage.label}</h3>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#0ECCEE]">
                {stage.teams}
                <span className="ml-1 text-xs font-medium text-white/45">teams</span>
              </p>
              {!compact && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/50">{stage.detail}</p>
              )}
              {stage.id === 'finale' && !compact && (
                <p className="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-white/55">
                  Path A: {format.directFromR1} direct from Round 1 · Path B: top {format.manualPick} from
                  Survival · Finale field: {format.finaleTeams}
                </p>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Friendly Round 1 leaderboard qualify labels */
export function formatQualificationLabel(raw, directFromR1 = 5) {
  const key = String(raw || '').toUpperCase();
  if (key === 'GRAND_FINALE' || key === 'DIRECT_FINALE' || key.includes('FINALE')) {
    return `DIRECT FINALE (top ${directFromR1})`;
  }
  if (key === 'MAUT_KA_KUVA' || key === 'SURVIVAL_STAGE' || key.includes('SURVIVAL')) {
    return 'SURVIVAL STAGE';
  }
  if (key.includes('LAST')) return 'LAST CHANCE';
  return raw || '—';
}

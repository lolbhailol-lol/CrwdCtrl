/**
 * Competition ladder shown after a college hunt is created.
 * Round 1: top 5 go direct to Finale; remaining 35 enter Survival Stage.
 * Survival top 7 join the 5 directs → Finale field of 12.
 */

export const CAMPUS_HUNT_STAGES = [
  {
    id: 'round1',
    label: 'ROUND 1',
    subtitle: 'CAMPUS HUNT',
    teams: 40,
    detail: 'All registered teams compete.',
  },
  {
    id: 'survival',
    label: 'SURVIVAL STAGE',
    subtitle: 'ROUND 2',
    teams: 35,
    detail: 'Teams ranked 6–40 after Round 1.',
  },
  {
    id: 'finale',
    label: 'FINALE',
    subtitle: 'FINAL ROUND',
    teams: 12,
    detail: '5 direct from Round 1 + 7 from Survival.',
  },
];

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
  // Later rounds stay locked until Round 1 workflows exist for them
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
  compact = false,
  className = '',
}) {
  const capacity = Number(teamCapacity) || 40;

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
              After you create the college hunt, teams move through three stages.
              Round 1 starts with {capacity} teams: top 5 go direct to Finale;
              the other 35 enter Survival Stage. Survival top 7 join them in Finale (12 teams).
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {CAMPUS_HUNT_STAGES.map((stage, index) => {
          const state = stageState(stage.id, round1Status);
          const teamCount = stage.id === 'round1' ? capacity : stage.teams;
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
                {teamCount}
                <span className="ml-1 text-xs font-medium text-white/45">teams</span>
              </p>
              {!compact && (
                <p className="mt-2 text-[11px] leading-relaxed text-white/50">{stage.detail}</p>
              )}
              {stage.id === 'finale' && !compact && (
                <p className="mt-2 rounded-lg bg-black/25 px-2 py-1.5 text-[10px] leading-relaxed text-white/55">
                  Path A: 5 direct from Round 1 · Path B: top 7 from Survival · Finale field: 12
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
export function formatQualificationLabel(raw) {
  const key = String(raw || '').toUpperCase();
  if (key === 'GRAND_FINALE' || key === 'DIRECT_FINALE' || key.includes('FINALE')) {
    return 'DIRECT FINALE (top 5)';
  }
  if (key === 'MAUT_KA_KUVA' || key === 'SURVIVAL_STAGE' || key.includes('SURVIVAL')) {
    return 'SURVIVAL STAGE';
  }
  if (key.includes('LAST')) return 'LAST CHANCE';
  return raw || '—';
}

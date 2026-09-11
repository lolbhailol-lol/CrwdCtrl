import { useMemo, useState } from 'react';
import { analyzeHuntPaths } from './campusHuntFormat';

/**
 * Shows every team's Orange→Green→Blue→Purple path and flags clashes / loops.
 */
export default function TeamPathsPanel({
  campusStations,
  campusStarts,
  teamsPerWait,
  teamCapacity,
}) {
  const [open, setOpen] = useState(true);
  const audit = useMemo(
    () => analyzeHuntPaths(campusStations, teamsPerWait, campusStarts),
    [campusStations, teamsPerWait, campusStarts],
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-white/15 bg-white/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
            Team paths · no clashes
          </p>
          <p className="mt-0.5 text-sm text-white/80">
            {audit.ok ? (
              <>
                <span className="font-semibold text-emerald-300">
                  {audit.uniquePaths}/{audit.teamCount} unique routes
                </span>
                {' '}· no shared paths · no place loops
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-200">
                  {audit.clashGroups.length} path clash
                  {audit.clashGroups.length === 1 ? '' : 'es'}
                </span>
                {audit.loopTeams.length > 0
                  ? ` · ${audit.loopTeams.length} team(s) revisit a place`
                  : ''}
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-white/40">
            {teamCapacity || audit.teamCount} teams · each gets a different 4-stop sequence.
            Start A walks +1 through places; Start B uses a different stride so routes never copy.
          </p>
        </div>
        <span className="shrink-0 text-sm text-white/50">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/10 px-4 py-3">
          {!audit.ok && (
            <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              Tap <span className="font-semibold">Bootstrap all clues</span> (or Update on each clue)
              so saved variants match these paths.
            </p>
          )}

          <div className="max-h-72 overflow-auto rounded-xl border border-white/10">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead className="sticky top-0 bg-[#121314] text-[10px] uppercase tracking-wide text-white/45">
                <tr>
                  <th className="px-3 py-2 font-medium">Team</th>
                  <th className="px-3 py-2 font-medium">Start</th>
                  <th className="px-3 py-2 font-medium text-orange-300/90">1 Orange</th>
                  <th className="px-3 py-2 font-medium text-emerald-300/90">2 Green</th>
                  <th className="px-3 py-2 font-medium text-sky-300/90">3 Blue</th>
                  <th className="px-3 py-2 font-medium text-violet-300/90">4 Purple</th>
                </tr>
              </thead>
              <tbody>
                {audit.rows.map((row) => {
                  const clash = audit.clashGroups.some((g) => g.pathKey === row.pathKey);
                  return (
                    <tr
                      key={`${row.startCode}-${row.localTeamNumber}`}
                      className={`border-t border-white/5 ${
                        row.loop || clash ? 'bg-amber-500/10' : ''
                      }`}
                    >
                      <td className="px-3 py-1.5 font-medium text-white">
                        #{row.teamNumber}
                        <span className="ml-1 text-white/35">{row.waveId}</span>
                      </td>
                      <td className="px-3 py-1.5 text-white/70">
                        {row.startCode} · {row.startName}
                      </td>
                      {row.pathLabels.map((name, i) => (
                        <td key={`${row.pathKey}-${i}`} className="px-3 py-1.5 text-white/80">
                          {name}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

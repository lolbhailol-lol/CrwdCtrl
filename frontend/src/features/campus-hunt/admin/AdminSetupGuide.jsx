const TERMS = [
  ['Starting point', 'The physical holding area where a group of teams waits before release.'],
  ['Route', 'The ordered game path a team follows after it starts.'],
  ['Checkpoint', 'A staffed physical destination where all four team members are verified.'],
  ['Clue 1 variant', 'A leader-only first clue assigned to a team. It points to that team’s first checkpoint.'],
  ['Start schedule', 'The server-controlled release time for every team. Preview, generate, review, then lock it.'],
  ['Leader and scanners', 'The leader sees and answers clues. The other three accounts verify attendance at checkpoints.'],
];

export default function AdminSetupGuide({ compact = false }) {
  return (
    <details className="rounded-xl border border-white/10 bg-white/4 p-4" open={!compact}>
      <summary className="cursor-pointer list-none font-semibold">
        How Campus Hunt setup works
        <span className="ml-2 text-xs font-normal text-white/45">Open guide</span>
      </summary>
      <p className="mt-2 max-w-3xl text-sm text-white/60">
        Complete the numbered sections in order. Configuration controls how the game works;
        Live event contains only event-day actions.
      </p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {TERMS.map(([name, description]) => (
          <div key={name} className="rounded-lg bg-black/25 p-3">
            <p className="text-sm font-semibold text-[#0ECCEE]">{name}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/55">{description}</p>
          </div>
        ))}
      </div>
    </details>
  );
}

const FINALE_STEPS = [
  { id: 'setup', label: 'Setup', short: 'Bootstrap & rules' },
  { id: 'missions', label: 'Missions', short: 'Intel · Grid · M3/4' },
  { id: 'teams', label: 'Teams', short: '12 finalists' },
  { id: 'schedule', label: 'Schedule', short: 'Staggered releases' },
  { id: 'live', label: 'Live', short: 'Playtest · release' },
  { id: 'results', label: 'Results', short: 'Leaderboard' },
];

const STATUS_CLASS = {
  Ready: 'bg-emerald-500/15 text-emerald-200',
  Live: 'bg-cyan-400/15 text-cyan-200',
  'Needs attention': 'bg-amber-500/15 text-amber-100',
  'Not started': 'bg-white/10 text-white/50',
  Complete: 'bg-emerald-500/15 text-emerald-200',
};

export default function FinaleWorkflowNav({ current, onChange, statuses = {} }) {
  return (
    <nav aria-label="Finale workflow" className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-6">
        {FINALE_STEPS.map((step) => {
          const status = statuses[step.id] || 'Not started';
          const active = current === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onChange(step.id)}
              aria-current={active ? 'step' : undefined}
              className={`min-w-36 rounded-xl border px-3 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ECCEE] ${
                active
                  ? 'border-[#0ECCEE]/70 bg-[#0ECCEE]/10'
                  : 'border-white/10 bg-white/4 hover:border-white/25'
              }`}
            >
              <span className="block text-sm font-semibold">{step.label}</span>
              <span className="mt-0.5 block text-[11px] text-white/45">{step.short}</span>
              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] ${
                STATUS_CLASS[status] || STATUS_CLASS['Not started']
              }`}>
                {status}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { FINALE_STEPS };

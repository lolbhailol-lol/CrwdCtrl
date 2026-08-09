const STEPS = [
  { id: 'overview', label: 'Overview', short: 'Event status' },
  { id: 'setup', label: '1. Game setup', short: 'Routes, starts, clues' },
  { id: 'teams', label: '2. Teams', short: 'Players and access' },
  { id: 'schedule', label: '3. Start schedule', short: 'Assign and lock' },
  { id: 'live', label: '4. Live event', short: 'Operate the hunt' },
  { id: 'results', label: '5. Results', short: 'Rank and finalize' },
];

const STATUS_CLASS = {
  Ready: 'bg-emerald-500/15 text-emerald-200',
  Live: 'bg-cyan-400/15 text-cyan-200',
  'Needs attention': 'bg-amber-500/15 text-amber-100',
  'Not started': 'bg-white/10 text-white/50',
  Complete: 'bg-emerald-500/15 text-emerald-200',
};

export default function AdminWorkflowNav({ current, onChange, statuses = {} }) {
  return (
    <nav aria-label="Campus Hunt setup workflow" className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-6">
        {STEPS.map((step) => {
          const status = statuses[step.id] || 'Not started';
          const active = current === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onChange(step.id)}
              aria-current={active ? 'step' : undefined}
              className={`min-w-36 rounded-xl border px-3 py-3 text-left transition ${
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

export { STEPS as ADMIN_WORKFLOW_STEPS };

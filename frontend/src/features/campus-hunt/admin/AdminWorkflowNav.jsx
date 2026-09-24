const STEPS = [
  { id: 'locations', label: '1 · Places' },
  { id: 'clues', label: '2 · Clues' },
  { id: 'teams', label: '3 · Teams' },
  { id: 'links', label: '4 · Links' },
  { id: 'playtest', label: 'Dry run' },
  { id: 'live', label: '5 · Live' },
  { id: 'results', label: '6 · Results' },
];

const STATUS_DOT = {
  Ready: 'bg-emerald-400',
  Live: 'bg-cyan-400',
  'Needs attention': 'bg-amber-400',
  'Not started': 'bg-white/25',
  Complete: 'bg-emerald-400',
};

export default function AdminWorkflowNav({ current, onChange, statuses = {} }) {
  return (
    <nav aria-label="Campus Hunt workflow" className="overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1.5">
        {STEPS.map((step) => {
          const status = statuses[step.id] || 'Not started';
          const active = current === step.id;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onChange(step.id)}
              aria-current={active ? 'step' : undefined}
              title={status}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ECCEE] ${
                active
                  ? 'border-[#0ECCEE]/70 bg-[#0ECCEE]/15 text-white'
                  : 'border-white/10 bg-white/4 text-white/70 hover:border-white/25 hover:text-white'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] || STATUS_DOT['Not started']}`}
                aria-hidden
              />
              {step.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { STEPS as ADMIN_WORKFLOW_STEPS };

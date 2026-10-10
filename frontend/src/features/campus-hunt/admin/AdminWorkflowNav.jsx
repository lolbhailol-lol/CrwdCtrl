const STEPS = [
  { id: 'locations', number: '1', label: 'Places' },
  { id: 'clues', number: '2', label: 'Clues' },
  { id: 'teams', number: '3', label: 'Teams' },
  { id: 'links', number: '4', label: 'Links' },
  { id: 'playtest', number: 'T', label: 'Test' },
  { id: 'live', number: '5', label: 'Live' },
  { id: 'results', number: '6', label: 'Results' },
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
    <nav
      aria-label="Campus Hunt workflow"
      className="sticky top-0 z-20 -mx-4 overflow-x-auto border-y border-white/10 bg-[#0b0c0d]/95 px-4 py-2 shadow-lg shadow-black/20 backdrop-blur md:static md:mx-0 md:rounded-xl md:border md:px-2"
    >
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
              aria-label={`${step.label}: ${status}`}
              title={status}
              className={`flex min-h-11 items-center gap-2 rounded-xl border px-2.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0ECCEE] ${
                active
                  ? 'border-[#0ECCEE]/70 bg-[#0ECCEE]/15 text-white shadow-[0_0_18px_rgba(14,204,238,0.12)]'
                  : 'border-transparent bg-white/5 text-white/65 hover:border-white/20 hover:text-white'
              }`}
            >
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[11px] font-black ${active ? 'bg-[#0ECCEE] text-[#051014]' : 'bg-white/8 text-white/70'}`}>
                {step.number}
              </span>
              <span>{step.label}</span>
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[status] || STATUS_DOT['Not started']}`} aria-hidden />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export { STEPS as ADMIN_WORKFLOW_STEPS };

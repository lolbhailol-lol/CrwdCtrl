export default function MysteryBranchPicker({ branch, onChoose, busy }) {
  if (!branch) return null;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0ECCEE]">Investigation lead</p>
      <h3 className="mt-1 font-semibold text-white">{branch.question || 'Which lead do you follow?'}</h3>
      <div className="mt-3 grid gap-2">
        {(branch.leads || []).map((lead) => (
          <button
            key={lead.id}
            type="button"
            disabled={busy}
            onClick={() => onChoose(branch._id || branch.id, lead.id)}
            className="rounded-xl border border-white/15 px-4 py-3 text-left text-sm text-white hover:border-[#0ECCEE]/60 disabled:opacity-40"
          >
            <span className="font-semibold">{lead.label}</span>
            {lead.description && <p className="mt-0.5 text-white/55">{lead.description}</p>}
          </button>
        ))}
      </div>
    </div>
  );
}
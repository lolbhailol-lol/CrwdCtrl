import { GitFork } from 'lucide-react';

const LEAD_COLORS = ['#22D3EE', '#F472B6', '#FBBF24', '#A78BFA'];

export default function MysteryBranchPicker({ branch, onChoose, busy }) {
  if (!branch) return null;
  return (
    <div className="rounded-2xl border border-fuchsia-400/30 bg-gradient-to-br from-fuchsia-500/15 via-violet-500/10 to-transparent p-4">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-fuchsia-300">
        <GitFork size={14} /> Choose your lead
      </p>
      <h3 className="mt-1 text-lg font-bold text-white">{branch.prompt || branch.question || 'Which lead do you follow?'}</h3>
      <p className="mt-0.5 text-xs text-white/50">You can only follow one — choose carefully.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(branch.leads || []).map((lead, i) => {
          const color = LEAD_COLORS[i % LEAD_COLORS.length];
          return (
            <button
              key={lead.id}
              type="button"
              disabled={busy}
              onClick={() => onChoose(branch._id || branch.id, lead.id)}
              style={{ borderColor: `${color}66`, background: `linear-gradient(135deg, ${color}22, transparent 70%)` }}
              className="rounded-xl border px-4 py-3 text-left text-sm text-white transition hover:brightness-125 disabled:opacity-40"
            >
              <span className="font-bold" style={{ color }}>{lead.label}</span>
              {lead.description && <p className="mt-0.5 text-white/65">{lead.description}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

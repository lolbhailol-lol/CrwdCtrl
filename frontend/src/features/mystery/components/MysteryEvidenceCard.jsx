const WORLD_COLOR = { physical: '#0ECCEE', digital: '#A78BFA', human: '#FB923C', logic: '#34D399' };

export default function MysteryEvidenceCard({ evidence, onOpen, locked = false }) {
  const color = WORLD_COLOR[evidence.world] || '#0ECCEE';
  const body = evidence.description || evidence.summary;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onOpen?.(evidence)}
      className={`w-full rounded-xl border bg-white/5 p-4 text-left transition hover:border-white/25 disabled:opacity-40 ${evidence.invalidated ? 'border-rose-400/40' : 'border-white/10'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
            {evidence.world}
          </span>
          {evidence.code && <span className="font-mono text-[10px] text-white/35">{evidence.code}</span>}
          {evidence.invalidated && <span className="rounded-full bg-rose-400/15 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-300">Compromised</span>}
        </div>
        <span className="text-xs text-white/40">{evidence.points ?? 0} pts</span>
      </div>
      <h3 className={`mt-2 font-semibold text-white ${evidence.invalidated ? 'line-through decoration-rose-400/60' : ''}`}>{locked ? 'Locked evidence' : evidence.title}</h3>
      {!locked && evidence.timestampLabel && <p className="mt-0.5 font-mono text-xs text-white/40">{evidence.timestampLabel}</p>}
      {!locked && body && <p className="mt-1 text-sm text-white/60">{body}</p>}
    </button>
  );
}

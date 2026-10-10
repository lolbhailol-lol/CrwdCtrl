const WORLD_COLOR = { physical: '#0ECCEE', digital: '#A78BFA', human: '#FB923C', logic: '#34D399' };

export default function MysteryEvidenceCard({ evidence, onOpen, locked = false }) {
  const color = WORLD_COLOR[evidence.world] || '#0ECCEE';
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onOpen?.(evidence)}
      className="w-full rounded-xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-white/25 disabled:opacity-40"
    >
      <div className="flex items-center justify-between">
        <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
          {evidence.world}
        </span>
        <span className="text-xs text-white/40">{evidence.points ?? 0} pts</span>
      </div>
      <h3 className="mt-2 font-semibold text-white">{locked ? 'Locked evidence' : evidence.title}</h3>
      {!locked && evidence.summary && <p className="mt-1 text-sm text-white/60">{evidence.summary}</p>}
    </button>
  );
}
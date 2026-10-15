import { Lock } from 'lucide-react';
import { worldSurface, worldTheme } from '../worldTheme';

const COMPROMISED = '#FB7185';

export default function MysteryEvidenceCard({ evidence, onOpen, locked = false, trusted, isNew = false }) {
  const theme = worldTheme(evidence.world);
  const color = evidence.invalidated ? COMPROMISED : theme.color;
  const { Icon } = theme;
  const body = evidence.description || evidence.summary;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={() => onOpen?.(evidence)}
      style={locked ? undefined : { ...worldSurface(color), boxShadow: isNew ? `0 0 0 2px ${color}, 0 0 28px ${color}55` : undefined }}
      className={`relative w-full overflow-hidden rounded-2xl border p-4 pl-5 text-left transition hover:brightness-110 disabled:opacity-50 ${locked ? 'border-white/10 bg-white/[0.03] backdrop-blur' : ''}`}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: locked ? 'rgba(255,255,255,0.12)' : color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `${color}2e`, color }}>
            {locked ? <Lock size={17} /> : <Icon size={18} />}
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{theme.label}</span>
              {evidence.code && <span className="font-mono text-[10px] text-white/40">{evidence.code}</span>}
            </div>
            {!locked && evidence.timestampLabel && <p className="font-mono text-xs text-white/50">{evidence.timestampLabel}</p>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="rounded-full px-2 py-0.5 font-mono text-xs font-bold" style={{ background: `${color}24`, color }}>+{evidence.points ?? 0}</span>
          {isNew && !evidence.invalidated && <span className="animate-pulse rounded-full bg-white px-2 py-0.5 text-[10px] font-black uppercase text-black">New</span>}
        </div>
      </div>

      <h3 className={`mt-3 text-base font-bold text-white ${evidence.invalidated ? 'line-through decoration-rose-400/70' : ''}`}>
        {locked ? 'Locked evidence' : evidence.title}
      </h3>
      {!locked && body && <p className={`mt-1 text-sm leading-relaxed ${evidence.invalidated ? 'text-white/45' : 'text-white/75'}`}>{body}</p>}

      {!locked && (evidence.invalidated || trusted !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {evidence.invalidated && <span className="rounded-full bg-rose-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-300">Compromised</span>}
          {trusted === true && <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">You trust this</span>}
          {trusted === false && <span className="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">You doubt this</span>}
        </div>
      )}
    </button>
  );
}

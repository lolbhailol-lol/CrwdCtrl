import { useNavigate } from 'react-router-dom';
import { STAT_TONES } from './organizerTheme';

export function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#161718]/95 backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatTile({ label, value, tone = 'default', icon: Icon, onClick, to, hint, compact }) {
  const navigate = useNavigate();
  const t = STAT_TONES[tone] || STAT_TONES.default;
  const interactive = Boolean(onClick || to);
  const className = `group relative overflow-hidden rounded-2xl border p-4 ${compact ? 'min-h-[84px]' : 'min-h-[100px]'} text-left transition-all duration-200 ${t.card} ${
    interactive ? 'hover:border-[#0ECCEE]/45 active:scale-[0.985] cursor-pointer' : ''
  }`;
  const inner = (
    <div className="relative flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium">{label}</p>
        <p className={`${compact ? 'text-xl' : 'text-[1.65rem]'} leading-none font-semibold mt-2 tabular-nums tracking-tight ${t.value}`}>
          {value}
        </p>
        {hint ? <p className="text-[11px] text-gray-500 mt-2 leading-snug">{hint}</p> : null}
      </div>
      {Icon ? (
        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${t.icon}`}>
          <Icon size={16} strokeWidth={2.25} />
        </div>
      ) : null}
    </div>
  );
  if (to) {
    return (
      <button type="button" onClick={() => navigate(to)} className={className}>
        {inner}
      </button>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {inner}
      </button>
    );
  }
  return <div className={className}>{inner}</div>;
}

/** Capacity fill bar — seatsFilled / capacity / seatsRemaining */
export function CapacityBar({ filled = 0, capacity = 0, remaining = null, className = '' }) {
  const cap = Number(capacity) || 0;
  const fill = Number(filled) || 0;
  const rem = remaining != null ? Number(remaining) : (cap > 0 ? Math.max(0, cap - fill) : null);
  const pct = cap > 0 ? Math.min(100, Math.round((fill / cap) * 100)) : 0;
  const unlimited = !(cap > 0);

  return (
    <div className={`space-y-2.5 ${className}`}>
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-[0.08em] text-gray-500 font-medium">Capacity</p>
          <p className="text-sm text-white mt-1">
            {unlimited ? (
              <>
                <span className="font-semibold tabular-nums">{fill}</span>
                <span className="text-gray-500"> booked · unlimited seats</span>
              </>
            ) : (
              <>
                <span className="font-semibold tabular-nums">{fill}</span>
                <span className="text-gray-500"> / {cap} seats</span>
                {rem != null ? (
                  <span className="text-gray-500"> · {rem} left</span>
                ) : null}
              </>
            )}
          </p>
        </div>
        {!unlimited ? (
          <p className="text-lg font-semibold tabular-nums text-[#0ECCEE]">{pct}%</p>
        ) : null}
      </div>
      {!unlimited ? (
        <div className="h-2.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
          <div
            className="h-full rounded-full bg-linear-to-r from-[#053780] to-[#0ECCEE] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : (
        <div className="h-1.5 rounded-full bg-[#0ECCEE]/20 overflow-hidden">
          <div className="h-full w-1/3 rounded-full bg-[#0ECCEE]/50" />
        </div>
      )}
    </div>
  );
}

export function ProgressBar({ pct = 0, tone = 'emerald', label, sublabel }) {
  const bar =
    tone === 'cyan'
      ? 'from-[#053780] to-[#0ECCEE]'
      : 'from-emerald-500 to-emerald-300';
  const valueColor = tone === 'cyan' ? 'text-[#0ECCEE]' : 'text-emerald-300';
  return (
    <div className="space-y-2.5">
      {(label || sublabel) ? (
        <div className="flex items-center justify-between gap-2">
          <div>
            {label ? <p className="text-sm font-semibold text-white">{label}</p> : null}
            {sublabel ? <p className="text-[11px] text-gray-500">{sublabel}</p> : null}
          </div>
          <p className={`text-lg font-semibold tabular-nums ${valueColor}`}>{Math.round(pct)}%</p>
        </div>
      ) : null}
      <div className="h-2.5 rounded-full bg-black/40 overflow-hidden border border-white/5">
        <div
          className={`h-full rounded-full bg-linear-to-r ${bar} transition-all duration-500`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

export function ActionRail({ actions = [] }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-linear-to-br from-[#1a1b1d] to-[#141516] px-2 py-3.5 min-h-[72px] hover:border-[#0ECCEE]/40 active:scale-[0.97] transition-all disabled:opacity-50"
        >
          {action.icon ? (
            <div className="size-9 rounded-xl bg-[#0ECCEE]/12 text-[#0ECCEE] flex items-center justify-center">
              <action.icon size={16} />
            </div>
          ) : null}
          <span className="text-[10px] font-semibold text-gray-300 text-center leading-tight">{action.label}</span>
        </button>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-[#161718] animate-pulse ${className}`}>
      <div className="h-24 bg-white/5" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-2/3 rounded bg-white/10" />
        <div className="h-3 w-1/2 rounded bg-white/5" />
      </div>
    </div>
  );
}

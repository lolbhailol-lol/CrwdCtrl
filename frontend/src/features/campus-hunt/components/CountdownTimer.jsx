import { useEffect, useRef } from 'react';
import { useServerCountdown } from '../hooks/useServerCountdown';
import { formatCountdown, formatUnlockDateTime, countdownParts } from '../utils/format';

function Part({ value, label }) {
  return (
    <div className="min-w-[3.25rem] flex-1 rounded-xl bg-black/30 px-2 py-2">
      <p className="font-mono text-2xl font-semibold tabular-nums leading-none text-white">
        {String(value).padStart(2, '0')}
      </p>
      <p className="mt-1 text-[10px] font-sans uppercase tracking-wide text-white/45">
        {label}
      </p>
    </div>
  );
}

export default function CountdownTimer({
  expiresAt,
  serverTime,
  label = 'Time left',
  expiredLabel,
  onComplete,
  className = '',
  showTargetDate = false,
  /** Long waits: show Days / Hours / Mins / Secs boxes */
  longForm = false,
}) {
  const remainingMs = useServerCountdown(expiresAt, serverTime);
  const completedFor = useRef('');
  useEffect(() => {
    if (remainingMs !== 0 || !onComplete || completedFor.current === expiresAt) return;
    completedFor.current = expiresAt;
    onComplete();
  }, [expiresAt, onComplete, remainingMs]);
  if (remainingMs == null) return null;
  const urgent = remainingMs <= 30000 && !longForm;
  const targetLabel = showTargetDate ? formatUnlockDateTime(expiresAt) : '';
  const parts = longForm ? countdownParts(remainingMs) : null;

  return (
    <div
      className={`rounded-xl px-4 py-3 text-center ${
        urgent ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white'
      } ${className}`}
    >
      <div className="mb-2 text-xs font-sans uppercase tracking-wide opacity-70">{label}</div>

      {remainingMs === 0 && expiredLabel ? (
        <div className="font-mono text-2xl tracking-wider">{expiredLabel}</div>
      ) : longForm && parts ? (
        <div className="flex justify-center gap-2">
          <Part value={parts.days} label={parts.days === 1 ? 'Day' : 'Days'} />
          <Part value={parts.hours} label={parts.hours === 1 ? 'Hour' : 'Hours'} />
          <Part value={parts.minutes} label="Mins" />
          <Part value={parts.seconds} label="Secs" />
        </div>
      ) : (
        <div className="font-mono text-2xl tracking-wider">
          {formatCountdown(remainingMs)}
        </div>
      )}

      {targetLabel && remainingMs > 0 && (
        <p className="mt-2 font-sans text-sm font-medium normal-case tracking-normal text-white/75">
          {targetLabel}
        </p>
      )}
    </div>
  );
}

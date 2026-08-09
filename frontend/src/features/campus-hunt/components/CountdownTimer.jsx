import { useEffect, useRef } from 'react';
import { useServerCountdown } from '../hooks/useServerCountdown';
import { formatCountdown } from '../utils/format';

export default function CountdownTimer({
  expiresAt,
  serverTime,
  label = 'Time left',
  expiredLabel,
  onComplete,
  className = '',
}) {
  const remainingMs = useServerCountdown(expiresAt, serverTime);
  const completedFor = useRef('');
  useEffect(() => {
    if (remainingMs !== 0 || !onComplete || completedFor.current === expiresAt) return;
    completedFor.current = expiresAt;
    onComplete();
  }, [expiresAt, onComplete, remainingMs]);
  if (remainingMs == null) return null;
  const urgent = remainingMs <= 30000;

  return (
    <div
      className={`rounded-xl px-4 py-3 text-center font-mono text-2xl tracking-wider ${
        urgent ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-white'
      } ${className}`}
    >
      <div className="mb-1 text-xs font-sans uppercase tracking-wide opacity-70">{label}</div>
      {remainingMs === 0 && expiredLabel ? expiredLabel : formatCountdown(remainingMs)}
    </div>
  );
}

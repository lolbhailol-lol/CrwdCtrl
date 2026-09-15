export function formatCountdown(ms) {
  if (ms == null || ms < 0) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${m}m`;
  }
  if (hours > 0) {
    return `${hours}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Broken-out units for long waits (release / unlock). */
export function countdownParts(ms) {
  if (ms == null || ms < 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  }
  const totalSec = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/** e.g. Saturday, 22 August 2026 · 4:00 PM */
export function formatUnlockDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const dayDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${dayDate} · ${time}`;
}

export function formatDurationMs(ms) {
  if (ms == null) return '—';
  const totalSec = Math.floor(Number(ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s}s`;
}

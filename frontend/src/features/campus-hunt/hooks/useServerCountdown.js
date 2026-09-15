import { useEffect, useState } from 'react';

/**
 * Countdown from server expiresAt, corrected by serverTime skew.
 */
export function useServerCountdown(expiresAt, serverTime) {
  const [remainingMs, setRemainingMs] = useState(null);

  useEffect(() => {
    if (!expiresAt) {
      setRemainingMs(null);
      return undefined;
    }

    const serverMs = serverTime ? new Date(serverTime).getTime() : Date.now();
    const skew = serverMs - Date.now();
    const end = new Date(expiresAt).getTime();

    const tick = () => {
      const now = Date.now() + skew;
      setRemainingMs(Math.max(0, end - now));
    };

    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [expiresAt, serverTime]);

  return remainingMs;
}

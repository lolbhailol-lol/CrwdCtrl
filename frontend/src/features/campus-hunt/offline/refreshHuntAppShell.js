/**
 * On shared install links: pull the newest service-worker shell when online
 * so leaders get UX fixes without reinstalling the home-screen icon.
 */

export async function refreshHuntAppShell() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return { checked: false, waiting: false };
  }
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    let waiting = false;
    await Promise.all(
      regs.map(async (reg) => {
        try {
          await reg.update();
        } catch { /* ignore */ }
        if (reg.waiting) waiting = true;
      }),
    );
    return { checked: true, waiting };
  } catch {
    return { checked: false, waiting: false };
  }
}

/** Activate a waiting SW, then reload once — only call from an explicit user tap. */
export async function applyWaitingHuntUpdate() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  const regs = await navigator.serviceWorker.getRegistrations();
  let activated = false;
  for (const reg of regs) {
    if (reg.waiting) {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      activated = true;
    }
  }
  if (activated) {
    window.setTimeout(() => {
      window.location.reload();
    }, 400);
  }
  return activated;
}

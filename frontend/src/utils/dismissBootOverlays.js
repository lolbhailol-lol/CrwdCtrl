/** Remove static HTML boot layers so they never block taps (common on iOS Safari). */
export function dismissBootOverlays() {
  if (typeof document === 'undefined') return;

  try {
    const splash = document.getElementById('boot-splash');
    if (splash) {
      splash.classList.add('boot-splash-out');
      splash.style.pointerEvents = 'none';
      splash.remove();
    }
  } catch {
    /* ignore */
  }

  try {
    const fallback = document.getElementById('boot-fallback');
    if (fallback) {
      fallback.hidden = true;
      fallback.setAttribute('aria-hidden', 'true');
      fallback.style.pointerEvents = 'none';
      fallback.remove();
    }
  } catch {
    /* ignore */
  }

  try {
    document.documentElement.classList.remove('short-boot-splash');
  } catch {
    /* ignore */
  }
}

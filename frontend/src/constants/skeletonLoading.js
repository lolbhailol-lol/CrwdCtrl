/** Minimum skeleton / route-transition duration app-wide */
export const SKELETON_LOADING_MS = 120;

/** Safety cap so loading overlays never stick if a timer is missed */
export const SKELETON_LOADING_SAFETY_MS = SKELETON_LOADING_MS + 280;

/** Cold-path brief pause (direct URL / no cache). Prefer 0 — artificial demo delay felt like lag. */
export const COMPETITION_DEMO_LOAD_MS = 0;

/** Submit / success UI minimum visible time */
export const PROCESS_UI_MIN_MS = 350;
export const SUCCESS_REVEAL_MIN_MS = 350;

/** Delay before navigate when data is already cached or skipDemoLoad is set */
export function warmNavDelayMs({ skipDemoLoad = false, hasWarmData = false } = {}) {
  if (skipDemoLoad || hasWarmData) return 0;
  return COMPETITION_DEMO_LOAD_MS;
}

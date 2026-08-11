/**
 * Mission 2 (Zip Grid) is laptop / desktop only.
 * Event-day barrier — not cryptographic. Pairs with ops DQ rules.
 *
 * “Request Desktop Site” spoofs User-Agent but usually keeps:
 * - device screen size (max-device-width)
 * - touch / coarse pointer / hover:none
 * Send those signals to the API so the backend can reject too.
 */

const MOBILE_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i;

/** Shown on blocked screens + Field Terminal — event rules for teams. */
export const LAPTOP_ONLY_RULE =
  'Event rule: phones and tablets are not allowed for this puzzle. '
  + 'Using “Desktop site” / “Request desktop website” to bypass the block is cheating and can get your team disqualified.';

export function isMobileUserAgent(ua = '') {
  return MOBILE_UA.test(String(ua || ''));
}

function mq(query) {
  try {
    return Boolean(window.matchMedia?.(query)?.matches);
  } catch {
    return false;
  }
}

/** Collect signals used by FE gate + API headers. */
export function collectDeviceSignals() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      shortSide: 0,
      longSide: 0,
      touchPoints: 0,
      coarse: false,
      hoverNone: false,
      fineHover: false,
      maxDeviceNarrow: false,
      uaMobile: false,
      chMobile: false,
    };
  }

  const ua = navigator.userAgent || '';
  const touchPoints = Number(navigator.maxTouchPoints) || 0;
  const sw = Number(window.screen?.width) || 0;
  const sh = Number(window.screen?.height) || 0;
  const shortSide = Math.min(sw, sh) || 0;
  const longSide = Math.max(sw, sh) || 0;

  return {
    shortSide,
    longSide,
    touchPoints,
    coarse: mq('(pointer: coarse)'),
    hoverNone: mq('(hover: none)'),
    fineHover: mq('(hover: hover) and (pointer: fine)'),
    // Survives “Desktop site” — uses device screen, not layout viewport
    maxDeviceNarrow: mq('(max-device-width: 900px)'),
    uaMobile: isMobileUserAgent(ua),
    chMobile: navigator.userAgentData?.mobile === true,
    iPadAsMac: /Macintosh/i.test(ua) && touchPoints > 1,
  };
}

/**
 * True when the client looks like a phone / tablet (should not play Zip Grid).
 * Tuned to catch Desktop-site spoofing without blocking real laptops (incl. touch Surfaces with mouse).
 */
export function isPhoneOrTabletClient() {
  const s = collectDeviceSignals();

  if (s.chMobile || s.uaMobile || s.iPadAsMac) return true;

  // Phone/tablet hardware even when UA says desktop
  if (s.maxDeviceNarrow && (s.touchPoints > 0 || s.coarse || s.hoverNone)) {
    return true;
  }

  // Small physical screen + touch, no real mouse hover
  if (s.shortSide > 0 && s.shortSide <= 600 && s.touchPoints > 0 && !s.fineHover) {
    return true;
  }

  // Compact tablets / large phones
  if (s.shortSide > 0 && s.shortSide <= 820 && s.touchPoints > 1 && (s.coarse || s.hoverNone) && !s.fineHover) {
    return true;
  }

  // Narrow CSS viewport + coarse (fallback)
  if (s.coarse && mq('(max-width: 900px)') && s.touchPoints > 0) {
    return true;
  }

  return false;
}

/** Headers for grid API — backend rejects phone signals even if UA is spoofed. */
export function gridClientHeaders() {
  const phone = isPhoneOrTabletClient();
  const s = collectDeviceSignals();
  return {
    'X-Campus-Hunt-Client': phone ? 'phone' : 'laptop',
    'X-Campus-Hunt-Device': [
      `sw=${s.shortSide}`,
      `sh=${s.longSide}`,
      `tp=${s.touchPoints}`,
      `coarse=${s.coarse ? 1 : 0}`,
      `hover=${s.hoverNone ? 0 : 1}`,
      `dmax=${s.maxDeviceNarrow ? 1 : 0}`,
    ].join(';'),
  };
}

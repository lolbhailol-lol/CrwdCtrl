/**
 * Mission 3 Field Terminal (Zip Grid) is laptop / desktop only.
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

  const platform = `${navigator.platform || ''} ${navigator.userAgentData?.platform || ''}`;

  return {
    shortSide,
    longSide,
    touchPoints,
    coarse: mq('(pointer: coarse)') || mq('(any-pointer: coarse)'),
    hoverNone: mq('(hover: none)') || mq('(any-hover: none)'),
    fineHover: mq('(hover: hover) and (pointer: fine)'),
    realMouse: mq('(any-hover: hover) and (any-pointer: fine)'),
    // Either edge — rotation makes device-width the long side
    phoneEdge: mq('(max-device-width: 540px), (max-device-height: 540px)'),
    portrait: mq('(orientation: portrait)'),
    // Mobile browsers keep this in “Desktop site”; laptops do not
    hasOrientation: typeof window.orientation === 'number',
    uaMobile: isMobileUserAgent(ua),
    chMobile: navigator.userAgentData?.mobile === true,
    iPadAsMac: /Macintosh/i.test(ua) && touchPoints > 1,
    mobilePlatform: /Android|iPhone|iPad|iPod/i.test(platform),
  };
}

/**
 * True when the client looks like a phone / tablet (should not play Zip Grid).
 * Tuned to catch Desktop-site spoofing without blocking real laptops (incl. touch Surfaces with mouse).
 */
export function isPhoneOrTabletClient() {
  const s = collectDeviceSignals();
  const touch = s.touchPoints > 0 || s.coarse || s.hoverNone;

  if (s.chMobile || s.uaMobile || s.iPadAsMac || s.mobilePlatform) return true;

  // Phone-sized edge survives rotate + “Desktop site” (viewport is faked, screen is not)
  if (s.phoneEdge && touch) return true;
  if (s.shortSide > 0 && s.shortSide <= 540 && touch) return true;

  // No real mouse/trackpad — desktop mode does not add one
  if (touch && !s.realMouse) return true;

  // window.orientation stays on phones after a desktop-UA spoof
  if (s.hasOrientation && touch) return true;

  // Portrait + touch is a phone/tablet, including landscape-to-portrait
  if (s.portrait && touch && s.shortSide > 0 && s.shortSide <= 900) return true;

  // Tablets that report a fine pointer but still have a compact screen
  if (s.shortSide > 0 && s.shortSide <= 900 && s.touchPoints > 1 && !s.realMouse) return true;

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
      `mouse=${s.realMouse ? 1 : 0}`,
      `dmin=${s.phoneEdge ? 1 : 0}`,
      `orient=${s.hasOrientation ? 1 : 0}`,
      `portrait=${s.portrait ? 1 : 0}`,
    ].join(';'),
  };
}

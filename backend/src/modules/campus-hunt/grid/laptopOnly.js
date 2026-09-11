function isMobileUserAgent(ua = '') {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
    String(ua || ''),
  );
}

const LAPTOP_ONLY_MESSAGE =
  'This puzzle is laptop-only. Phones and tablets are blocked — '
  + 'including “Desktop site”. Open the link on a real computer. '
  + 'Bypassing this rule can get your team disqualified.';

function laptopOnlyError() {
  const err = new Error(LAPTOP_ONLY_MESSAGE);
  err.status = 403;
  err.code = 'LAPTOP_ONLY';
  return err;
}

function parseDeviceSignals(raw = '') {
  const out = {
    shortSide: 0,
    longSide: 0,
    touchPoints: 0,
    coarse: false,
    hover: true,
    deviceNarrow: false,
  };
  String(raw || '').split(';').forEach((part) => {
    const [k, v] = String(part).split('=');
    if (!k) return;
    const key = k.trim();
    const val = String(v || '').trim();
    if (key === 'sw') out.shortSide = Number(val) || 0;
    if (key === 'sh') out.longSide = Number(val) || 0;
    if (key === 'tp') out.touchPoints = Number(val) || 0;
    if (key === 'coarse') out.coarse = val === '1';
    if (key === 'hover') out.hover = val !== '0';
    if (key === 'dmax') out.deviceNarrow = val === '1';
  });
  return out;
}

function looksLikePhoneFromSignals(signals) {
  if (!signals) return false;
  const { shortSide, touchPoints, coarse, hover, deviceNarrow } = signals;

  if (deviceNarrow && (touchPoints > 0 || coarse || !hover)) return true;
  if (shortSide > 0 && shortSide <= 600 && touchPoints > 0 && !hover) return true;
  if (shortSide > 0 && shortSide <= 820 && touchPoints > 1 && (coarse || !hover)) return true;
  return false;
}

/**
 * Reject Zip Grid joins/actions from phone / tablet clients.
 * Uses UA, Client Hints, and FE-reported device signals (Desktop-site resistant).
 * Event barrier — headers can be forged; ops rules still apply.
 */
function assertLaptopClient(req) {
  const ua = req.get('user-agent') || '';
  const chMobile = String(req.get('sec-ch-ua-mobile') || '').trim();
  const clientKind = String(req.get('x-campus-hunt-client') || '').trim().toLowerCase();
  const signals = parseDeviceSignals(req.get('x-campus-hunt-device') || '');

  if (isMobileUserAgent(ua)) throw laptopOnlyError();
  if (chMobile === '?1' || chMobile === '1' || chMobile === 'true') throw laptopOnlyError();
  if (clientKind === 'phone' || clientKind === 'mobile' || clientKind === 'tablet') {
    throw laptopOnlyError();
  }
  if (looksLikePhoneFromSignals(signals)) throw laptopOnlyError();
}

module.exports = {
  isMobileUserAgent,
  parseDeviceSignals,
  looksLikePhoneFromSignals,
  assertLaptopClient,
  LAPTOP_ONLY_MESSAGE,
};

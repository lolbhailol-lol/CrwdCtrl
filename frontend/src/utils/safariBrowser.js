/** iOS Safari + desktop Safari (excludes Chrome/Firefox on iOS). */
export function isSafariBrowser(ua = typeof navigator !== 'undefined' ? navigator.userAgent : '') {
  const s = String(ua || '');
  const isIOS = /iPhone|iPad|iPod/i.test(s);
  const isSafariUA = /Safari/i.test(s) && !/Chrome|CriOS|FxiOS|EdgiOS|OPiOS|mercury/i.test(s);
  return isIOS || isSafariUA;
}

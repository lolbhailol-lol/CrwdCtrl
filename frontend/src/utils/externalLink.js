import { isNativeApp } from './capacitorPlatform';

/**
 * Open an external URL.
 * - Native (Capacitor): uses @capacitor/browser so the link actually opens
 *   (window.open('_blank') is a no-op inside the Android WebView).
 * - Web: standard new tab.
 */
export async function openExternalUrl(url) {
  if (!url) return;
  const canUseNativeBrowser = isNativeApp()
    && typeof window !== 'undefined'
    && Boolean(window.Capacitor?.isNativePlatform?.() || window.webkit?.messageHandlers?.bridge);
  if (canUseNativeBrowser) {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.open({ url });
      return;
    } catch (err) {
      console.warn('[externalLink] Browser.open failed, falling back:', err);
    }
  }
  try {
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    window.location.href = url;
  }
}

/**
 * Share content via the OS share sheet.
 * - Native (Capacitor): uses @capacitor/share (navigator.share is unreliable in the WebView).
 * - Web: navigator.share when available, else copies the link to the clipboard.
 * Returns: true (shared), 'copied' (link copied as fallback), or false (nothing happened).
 */
async function buildShareFileFromImageUrl(imageUrl) {
  const src = String(imageUrl || '').trim();
  if (!src || typeof fetch === 'undefined') return null;
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    const mime = blob.type || 'image/jpeg';
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
    const file = new File([blob], `event-share.${ext}`, { type: mime });
    return file;
  } catch {
    return null;
  }
}

export async function shareContent({ title, text, url, imageUrl } = {}) {
  // Only touch Capacitor Share when the native bridge is actually present.
  // Checking isNativeApp() alone is not enough in some WebViews where
  // window.webkit exists but messageHandlers is undefined.
  const canUseNativeShare = isNativeApp()
    && typeof window !== 'undefined'
    && Boolean(window.Capacitor?.isNativePlatform?.() || window.webkit?.messageHandlers?.bridge);

  if (canUseNativeShare) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title,
        text,
        url,
        dialogTitle: title || 'Share',
      });
      return true;
    } catch (err) {
      // User cancelled, bridge gone, or plugin missing — soft fallback.
      console.warn('[externalLink] Share.share failed, falling back:', err);
    }
  } else if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      // Prefer sharing an actual image file when possible so apps like WhatsApp
      // display the event poster directly instead of plain link text.
      if (imageUrl && typeof navigator.canShare === 'function' && typeof File !== 'undefined') {
        const imageFile = await buildShareFileFromImageUrl(imageUrl);
        if (imageFile && navigator.canShare({ files: [imageFile] })) {
          await navigator.share({ title, text, url, files: [imageFile] });
          return true;
        }
      }
      await navigator.share({ title, text, url });
      return true;
    } catch {
      return false;
    }
  }

  const copyTarget = url || text || title || '';
  if (copyTarget && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(copyTarget);
      return 'copied';
    } catch {
      return false;
    }
  }
  return false;
}

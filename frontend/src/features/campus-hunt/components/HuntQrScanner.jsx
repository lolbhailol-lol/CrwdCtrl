import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import jsQR from 'jsqr';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { isNativeApp } from '../../../utils/capacitorPlatform';

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Session-lived web camera — first Allow sticks across remounts / stage changes. */
let sessionStream = null;
let nativePermGranted = false;

async function acquireCameraStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera not supported on this device');
  }
  const attempts = [
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: true, audio: false },
  ];
  let lastError;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Could not open camera');
}

function streamIsLive(stream) {
  return Boolean(stream?.getTracks?.().some((t) => t.readyState === 'live'));
}

async function getSessionStream({ forceNew = false } = {}) {
  if (!forceNew && streamIsLive(sessionStream)) {
    return sessionStream;
  }
  if (sessionStream) {
    sessionStream.getTracks().forEach((t) => t.stop());
    sessionStream = null;
  }
  sessionStream = await acquireCameraStream();
  return sessionStream;
}

/** Fully release camera tracks (call when leaving the play route). */
export function releaseHuntCameraSession() {
  if (sessionStream) {
    sessionStream.getTracks().forEach((t) => t.stop());
    sessionStream = null;
  }
}

async function ensureNativeCameraPermission() {
  if (nativePermGranted) return true;
  const perm = await BarcodeScanner.requestPermissions();
  nativePermGranted = perm?.camera === 'granted';
  return nativePermGranted;
}

/**
 * Lightweight QR scanner for Campus Hunt (team code / member payload).
 * Keeps one MediaStream for the browser session so iOS does not re-prompt
 * Allow on every scan. Decode pauses when inactive; tracks stop only on
 * leave-play (`releaseHuntCameraSession`) or Retry.
 */
export default function HuntQrScanner({
  onScan,
  onClose,
  active = true,
  accentHex = '#0ECCEE',
  /** When true (default), unmount only pauses decode — does not stop tracks. */
  keepSessionOnUnmount = true,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastPayloadRef = useRef('');
  const onScanRef = useRef(onScan);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const pauseDecode = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
  }, []);

  const detachVideo = useCallback(() => {
    if (videoRef.current) videoRef.current.srcObject = null;
    streamRef.current = null;
  }, []);

  const hardStop = useCallback(() => {
    pauseDecode();
    detachVideo();
    releaseHuntCameraSession();
  }, [pauseDecode, detachVideo]);

  const emit = useCallback((raw) => {
    const value = String(raw || '').trim();
    if (!value) return;
    if (value === lastPayloadRef.current) return;
    lastPayloadRef.current = value;
    onScanRef.current?.(value);
    setTimeout(() => {
      if (lastPayloadRef.current === value) lastPayloadRef.current = '';
    }, 1600);
  }, []);

  const startDecodeLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const tick = () => {
      if (!video.videoWidth) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(image.data, image.width, image.height, {
        inversionAttempts: 'dontInvert',
      });
      if (code?.data) emit(code.data);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [emit]);

  const startWeb = useCallback(async ({ forceNew = false } = {}) => {
    setError('');
    pauseDecode();
    try {
      const stream = await getSessionStream({ forceNew });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setRunning(true);
      startDecodeLoop();
    } catch (err) {
      setError(err.message || 'Camera failed');
      setRunning(false);
    }
  }, [pauseDecode, startDecodeLoop]);

  const startNative = useCallback(async () => {
    setError('');
    try {
      const granted = await ensureNativeCameraPermission();
      if (!granted) {
        setError('Camera permission denied — enable it in Settings');
        return;
      }
      const { barcodes } = await BarcodeScanner.scan();
      const raw = barcodes?.[0]?.rawValue;
      if (raw) emit(raw);
    } catch (err) {
      setError(err.message || 'Native scan failed');
    }
  }, [emit]);

  const startWebRef = useRef(startWeb);
  const startNativeRef = useRef(startNative);
  useEffect(() => {
    startWebRef.current = startWeb;
    startNativeRef.current = startNative;
  }, [startWeb, startNative]);

  useEffect(() => {
    if (!active) {
      pauseDecode();
      return undefined;
    }
    if (isNativeApp()) {
      startNativeRef.current();
      return undefined;
    }
    startWebRef.current();
    return () => {
      pauseDecode();
      if (!keepSessionOnUnmount) {
        hardStop();
      } else {
        detachVideo();
      }
    };
  }, [active, keepSessionOnUnmount, pauseDecode, hardStop, detachVideo]);

  const handleClose = () => {
    // Soft close: keep session stream so next scan does not re-prompt Allow
    pauseDecode();
    detachVideo();
    onClose?.();
  };

  return (
    <div
      className="relative overflow-hidden rounded-2xl border bg-black"
      style={{ borderColor: `${accentHex}88` }}
    >
      <div className="flex items-center justify-between px-3 py-2" style={{ background: `${accentHex}22` }}>
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: accentHex }}>
          <Camera size={16} /> Scan station QR
        </p>
        {onClose && (
          <button type="button" onClick={handleClose} className="text-white/60">
            <X size={18} />
          </button>
        )}
      </div>
      {!isNativeApp() && (
        <div className="relative aspect-[3/4] w-full bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />
          <div
            className="pointer-events-none absolute inset-[18%] rounded-xl border-2"
            style={{ borderColor: accentHex, boxShadow: `0 0 0 9999px rgba(0,0,0,0.35)` }}
          />
          {!running && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
              Starting camera…
            </div>
          )}
        </div>
      )}
      {isNativeApp() && (
        <button
          type="button"
          onClick={startNative}
          className="m-3 w-[calc(100%-1.5rem)] rounded-xl py-3 font-semibold text-black"
          style={{ background: accentHex }}
        >
          Open scanner
        </button>
      )}
      {error && <p className="px-3 pb-3 text-sm text-red-300">{error}</p>}
      {!isNativeApp() && error && (
        <button
          type="button"
          onClick={() => {
            hardStop();
            waitMs(50).then(() => startWeb({ forceNew: true }));
          }}
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-xl border border-white/20 py-2 text-sm"
        >
          Retry camera
        </button>
      )}
    </div>
  );
}

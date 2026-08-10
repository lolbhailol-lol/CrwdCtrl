import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import jsQR from 'jsqr';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { isNativeApp } from '../../../utils/capacitorPlatform';

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

/**
 * Lightweight QR scanner for Campus Hunt (team code / member payload).
 * Reuses the same camera + jsQR / Capacitor ML Kit approach as CheckinScannerPage,
 * without fest check-in coupling.
 */
export default function HuntQrScanner({ onScan, onClose, active = true, accentHex = '#0ECCEE' }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const lastPayloadRef = useRef('');
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setRunning(false);
  }, []);

  const emit = useCallback(
    (raw) => {
      const value = String(raw || '').trim();
      if (!value) return;
      if (value === lastPayloadRef.current) return;
      lastPayloadRef.current = value;
      onScan?.(value);
      setTimeout(() => {
        if (lastPayloadRef.current === value) lastPayloadRef.current = '';
      }, 2500);
    },
    [onScan],
  );

  const startWeb = useCallback(async () => {
    setError('');
    try {
      const stream = await acquireCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      setRunning(true);

      const canvas = canvasRef.current;
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
    } catch (err) {
      setError(err.message || 'Camera failed');
      setRunning(false);
    }
  }, [emit]);

  const startNative = useCallback(async () => {
    setError('');
    try {
      const { barcodes } = await BarcodeScanner.scan();
      const raw = barcodes?.[0]?.rawValue;
      if (raw) emit(raw);
    } catch (err) {
      setError(err.message || 'Native scan failed');
    }
  }, [emit]);

  useEffect(() => {
    if (!active) {
      stop();
      return undefined;
    }
    if (isNativeApp()) {
      startNative();
      return undefined;
    }
    startWeb();
    return () => stop();
  }, [active, startNative, startWeb, stop]);

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
          <button type="button" onClick={() => { stop(); onClose(); }} className="text-white/60">
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
          onClick={() => { stop(); waitMs(50).then(startWeb); }}
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-xl border border-white/20 py-2 text-sm"
        >
          Retry camera
        </button>
      )}
    </div>
  );
}

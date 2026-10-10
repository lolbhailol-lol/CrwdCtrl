import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import jsQR from 'jsqr';

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let mysterySessionStream = null;

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
  if (!forceNew && streamIsLive(mysterySessionStream)) return mysterySessionStream;
  if (mysterySessionStream) {
    mysterySessionStream.getTracks().forEach((t) => t.stop());
    mysterySessionStream = null;
  }
  mysterySessionStream = await acquireCameraStream();
  return mysterySessionStream;
}

export function releaseMysteryCameraSession() {
  if (mysterySessionStream) {
    mysterySessionStream.getTracks().forEach((t) => t.stop());
    mysterySessionStream = null;
  }
}

/** QR scanner for CTRL Mystery evidence unlock — web-only (no native app yet). */
export default function MysteryQrScanner({
  onScan,
  onClose,
  active = true,
  accentHex = '#0ECCEE',
  keepSessionOnUnmount = true,
}) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastPayloadRef = useRef('');
  const onScanRef = useRef(onScan);
  const [error, setError] = useState('');
  const [running, setRunning] = useState(false);

  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  const pauseDecode = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setRunning(false);
  }, []);

  const detachVideo = useCallback(() => {
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const hardStop = useCallback(() => {
    pauseDecode();
    detachVideo();
    releaseMysteryCameraSession();
  }, [pauseDecode, detachVideo]);

  const emit = useCallback((raw) => {
    const value = String(raw || '').trim();
    if (!value || value === lastPayloadRef.current) return;
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
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
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
      const video = videoRef.current;
      if (!video) return;
      if (video.srcObject !== stream) video.srcObject = stream;
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

  useEffect(() => {
    if (!active) { pauseDecode(); return undefined; }
    startWeb();
    return () => {
      pauseDecode();
      if (!keepSessionOnUnmount) hardStop();
      else detachVideo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const handleClose = () => {
    pauseDecode();
    detachVideo();
    onClose?.();
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-black" style={{ borderColor: `${accentHex}88` }}>
      <div className="flex items-center justify-between px-3 py-2" style={{ background: `${accentHex}22` }}>
        <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: accentHex }}>
          <Camera size={16} /> Scan evidence QR
        </p>
        {onClose && (
          <button type="button" onClick={handleClose} className="text-white/60">
            <X size={18} />
          </button>
        )}
      </div>
      <div className="relative aspect-[3/4] w-full bg-black">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        <div
          className="pointer-events-none absolute inset-[18%] rounded-xl border-2"
          style={{ borderColor: accentHex, boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)' }}
        />
        {!running && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white/50">
            Starting camera…
          </div>
        )}
      </div>
      {error && <p className="px-3 pb-3 text-sm text-red-300">{error}</p>}
      {error && (
        <button
          type="button"
          onClick={() => { hardStop(); waitMs(50).then(() => startWeb({ forceNew: true })); }}
          className="mx-3 mb-3 w-[calc(100%-1.5rem)] rounded-xl border border-white/20 py-2 text-sm text-white"
        >
          Retry camera
        </button>
      )}
    </div>
  );
}
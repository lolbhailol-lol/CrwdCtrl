import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, CheckCircle, AlertTriangle, XCircle, RefreshCw, QrCode, Upload } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import jsQR from 'jsqr';
import { isNativeApp } from '../../utils/capacitorPlatform';
import { extractCheckinHash } from '../../utils/qrCheckin';
import { getApiBaseUrl } from '../../config/apiBase';

const getDefaultAdminToken = () => localStorage.getItem('admin_token');
const getDefaultUserToken = () =>
  localStorage.getItem('crwdctrl_token') || localStorage.getItem('token');
const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const acquireCameraStream = async () => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera not supported. Use Photo of QR or manual entry.');
  }

  const attempts = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: 'environment' }, audio: false },
    { video: { facingMode: 'user' }, audio: false },
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
};

const bindVideoStream = async (video, stream) => {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute('playsinline', 'true');
  video.setAttribute('webkit-playsinline', 'true');

  await new Promise((resolve) => {
    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      resolve();
      return;
    }
    const onReady = () => {
      video.removeEventListener('loadedmetadata', onReady);
      resolve();
    };
    video.addEventListener('loadedmetadata', onReady);
    setTimeout(resolve, 2500);
  });

  for (let i = 0; i < 4; i += 1) {
    try {
      await video.play();
      if (video.videoWidth > 0) return;
    } catch {
      /* retry */
    }
    await waitMs(150);
  }

  if (video.videoWidth === 0) {
    throw new Error('Camera preview failed to start. Tap Open Camera again.');
  }
};

export default function CheckinScannerPage({
  mode = 'admin',
  festId = null,
  trekId = null,
  sportEventId = null,
  festName = '',
  getAuthToken,
  checkinUrl,
  title,
  subtitle,
  showStats = false,
  statsUrl = null,
  exportUrl = null,
  embedded = false,
  showSheetStatus = true,
  sessionExpiredMessage = null,
  authErrorMessage = null,
}) {
  const isVolunteerScanner =
    mode === 'scanner' || mode === 'trek_scanner' || mode === 'sport_scanner';
  const resolvedGetToken =
    getAuthToken ||
    (isVolunteerScanner
      ? null
      : mode === 'organizer'
        ? getDefaultUserToken
        : getDefaultAdminToken);
  const resolvedCheckinUrl =
    checkinUrl ||
    (mode === 'sport_scanner' && sportEventId
      ? `${getApiBaseUrl()}/scanner/sport/${sportEventId}/checkin`
      : mode === 'trek_scanner' && trekId
        ? `${getApiBaseUrl()}/scanner/trek/${trekId}/checkin`
        : mode === 'scanner' && festId
          ? `${getApiBaseUrl()}/scanner/${festId}/checkin`
          : mode === 'organizer' && festId
            ? `${getApiBaseUrl()}/organizer/fests/${festId}/checkin`
            : `${getApiBaseUrl()}/qr/checkin`);
  const resolvedStatsUrl =
    statsUrl ||
    (mode === 'sport_scanner' && sportEventId
      ? `${getApiBaseUrl()}/scanner/sport/${sportEventId}/stats`
      : mode === 'trek_scanner' && trekId
        ? `${getApiBaseUrl()}/scanner/trek/${trekId}/stats`
        : mode === 'scanner' && festId
          ? `${getApiBaseUrl()}/scanner/${festId}/stats`
          : mode === 'organizer' && festId
            ? `${getApiBaseUrl()}/organizer/fests/${festId}/checkin-stats`
            : null);
  const resolvedTitle =
    title ||
    (mode === 'sport_scanner'
      ? 'Sports Check-in'
      : mode === 'trek_scanner'
        ? 'Trek Check-in'
        : mode === 'scanner'
          ? 'Scan Tickets'
          : mode === 'organizer'
            ? 'Fest Check-in'
            : 'Check-in Scanner');
  const resolvedSubtitle =
    subtitle ||
    (mode === 'sport_scanner'
      ? `Scan sports/run club tickets for ${festName || 'your event'} — check-ins log to Google Sheets`
      : mode === 'trek_scanner'
        ? `Scan trek tickets for ${festName || 'your trek'} — check-ins log to Google Sheets`
        : mode === 'scanner'
          ? 'Scan attendee QR codes — check-ins save to Google Sheets'
          : mode === 'organizer'
            ? `Scan tickets for ${festName || 'your fest'} — check-ins log to Google Sheets`
            : 'Scan ticket QR from My Bookings — allow camera when prompted');
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [nativeScanAvailable, setNativeScanAvailable] = useState(false);
  const [scannerHint, setScannerHint] = useState('');
  const [scanSession, setScanSession] = useState(0);
  const [checkinStats, setCheckinStats] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const pendingStreamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanLockRef = useRef(false);
  const nativeListenerRef = useRef(null);
  const mountedRef = useRef(true);
  const videoWatchdogRef = useRef(null);

  const useNativeScanner = isNativeApp() && nativeScanAvailable;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const clearNativeListener = useCallback(async () => {
    if (nativeListenerRef.current) {
      try {
        await nativeListenerRef.current.remove();
      } catch {
        /* ignore */
      }
      nativeListenerRef.current = null;
    }
    try {
      await BarcodeScanner.stopScan();
    } catch {
      /* ignore */
    }
    document.body.classList.remove('barcode-scanner-active');
    document.documentElement.classList.remove('barcode-scanner-active');
  }, []);

  const releaseCamera = useCallback(async () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (videoWatchdogRef.current) {
      clearTimeout(videoWatchdogRef.current);
      videoWatchdogRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    pendingStreamRef.current = null;

    await clearNativeListener();
    scanLockRef.current = false;
    await waitMs(300);
  }, [clearNativeListener]);

  const stopWebScanning = useCallback(async () => {
    await releaseCamera();
    if (mountedRef.current) {
      setIsScanning(false);
      setScannerHint('');
    }
  }, [releaseCamera]);

  useEffect(() => {
    if (!isNativeApp()) return undefined;

    BarcodeScanner.isSupported()
      .then(({ supported }) => setNativeScanAvailable(!!supported))
      .catch(() => setNativeScanAvailable(false));

    return () => {
      releaseCamera();
    };
  }, [releaseCamera]);

  const fetchCheckinStats = useCallback(async () => {
    if (!showStats || (!festId && !trekId && !sportEventId && !statsUrl)) return;
    const token = resolvedGetToken();
    if (!token) return;
    try {
      const res = await fetch(resolvedStatsUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCheckinStats(data);
      }
    } catch {
      /* ignore */
    }
  }, [showStats, festId, trekId, sportEventId, statsUrl, resolvedGetToken, resolvedStatsUrl]);

  useEffect(() => {
    fetchCheckinStats();
  }, [fetchCheckinStats]);

  const verifyQrPayload = useCallback(async (rawData) => {
    const trimmed = String(rawData || '').trim();
    if (!trimmed) {
      setScanResult({ status: 'error', message: 'Empty QR code' });
      return;
    }

    const token = resolvedGetToken();
    if (!token) {
      setScanResult({
        status: 'error',
        message:
          sessionExpiredMessage ||
          (isVolunteerScanner
            ? 'Scanner session expired — log in again at /organizer/login'
            : mode === 'organizer'
              ? 'Session expired — log in again to use the scanner.'
              : 'Admin session expired — log in again at /admin/login'),
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(resolvedCheckinUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({ qrData: trimmed }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 403) {
        setScanResult({
          status: 'error',
          message: authErrorMessage || data.error || data.message || 'Session expired — please sign in again',
        });
        return;
      }

      setScanResult({
        status: data.status || (data.success ? 'checked_in' : 'error'),
        message: data.message || data.error || 'Check-in failed',
        data: data.data,
      });
      if (data.status === 'checked_in' || data.status === 'already_checked_in') {
        fetchCheckinStats();
      }
    } catch (err) {
      setScanResult({
        status: 'error',
        message: `Cannot reach server: ${err.message}. Check internet / API URL.`,
      });
    } finally {
      setIsProcessing(false);
      scanLockRef.current = false;
    }
  }, [resolvedGetToken, resolvedCheckinUrl, mode, fetchCheckinStats]);

  const handleQRData = useCallback(async (rawData) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    await clearNativeListener();
    setIsScanning(false);
    await verifyQrPayload(rawData);
    await releaseCamera();
  }, [verifyQrPayload, clearNativeListener, releaseCamera]);

  const decodeFrame = useCallback(async (video) => {
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;

    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          return barcodes[0].rawValue || barcodes[0].displayValue || null;
        }
      } catch {
        /* jsQR fallback */
      }
    }

    const canvas = canvasRef.current;
    if (!canvas) return null;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data || null;
  }, []);

  const startScanLoop = useCallback(() => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (scanLockRef.current || !videoRef.current) return;
      try {
        const raw = await decodeFrame(videoRef.current);
        if (raw) await handleQRData(raw);
      } catch {
        /* keep scanning */
      }
    }, 200);
  }, [decodeFrame, handleQRData]);

  const attachVideoRef = useCallback(async (el) => {
    videoRef.current = el;
    if (!el) return;
    if (!pendingStreamRef.current || scanLockRef.current) return;

    try {
      await bindVideoStream(el, pendingStreamRef.current);
      if (!mountedRef.current) return;

      setScannerHint('Hold the ticket QR inside the frame');
      startScanLoop();

      if (videoWatchdogRef.current) clearTimeout(videoWatchdogRef.current);
      videoWatchdogRef.current = setTimeout(() => {
        if (!videoRef.current || videoRef.current.videoWidth > 0 || scanLockRef.current) return;
        stopWebScanning();
        setScanResult({
          status: 'error',
          message: 'Camera opened but preview is blank. Allow camera for crwdctrl.in in browser settings, then retry.',
        });
      }, 4000);
    } catch (err) {
      await stopWebScanning();
      setScanResult({
        status: 'error',
        message: err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Allow camera permission for this site in phone settings, then retry.'
          : `Camera error: ${err.message}`,
      });
    }
  }, [startScanLoop, stopWebScanning]);

  useEffect(() => {
    if (!isScanning || useNativeScanner) return undefined;
    return () => {
      releaseCamera();
    };
  }, [isScanning, useNativeScanner, releaseCamera]);

  const startNativeOneShotScan = async () => {
    setScanResult(null);
    scanLockRef.current = false;
    setScannerHint('Opening scanner...');

    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        setScanResult({ status: 'error', message: 'Camera permission denied in app settings' });
        return;
      }

      try {
        const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await BarcodeScanner.installGoogleBarcodeScannerModule();
          setScannerHint('Installing scanner module… try again in a few seconds');
          return;
        }
      } catch {
        /* iOS or older API — continue */
      }

      document.body.classList.add('barcode-scanner-active');
      const { barcodes } = await BarcodeScanner.scan({ formats: ['QR_CODE'] });
      document.body.classList.remove('barcode-scanner-active');

      if (barcodes?.length > 0) {
        scanLockRef.current = true;
        await verifyQrPayload(barcodes[0].rawValue || barcodes[0].displayValue);
      }
    } catch (err) {
      document.body.classList.remove('barcode-scanner-active');
      const msg = String(err?.message || '');
      if (msg.includes('cancel') || msg.includes('Cancel')) return;
      setScanResult({ status: 'error', message: msg || 'Native scan failed' });
      scanLockRef.current = false;
    } finally {
      setScannerHint('');
    }
  };

  const startNativeContinuousScan = async () => {
    setScanResult(null);
    scanLockRef.current = false;
    setIsScanning(true);
    setScannerHint('Opening camera...');

    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        setIsScanning(false);
        setScanResult({ status: 'error', message: 'Camera permission denied in app settings' });
        return;
      }

      await clearNativeListener();
      document.body.classList.add('barcode-scanner-active');
      document.documentElement.classList.add('barcode-scanner-active');

      nativeListenerRef.current = await BarcodeScanner.addListener('barcodesScanned', async (event) => {
        const barcode = event.barcodes?.[0];
        if (!barcode || scanLockRef.current) return;
        await handleQRData(barcode.rawValue || barcode.displayValue);
      });

      await BarcodeScanner.startScan({ formats: ['QR_CODE'] });
      setScannerHint('Point at ticket QR code');
    } catch {
      await clearNativeListener();
      setIsScanning(false);
      await startNativeOneShotScan();
    }
  };

  const startNativeScan = async () => {
    if (isNativeApp()) {
      await startNativeContinuousScan();
    } else {
      await startNativeOneShotScan();
    }
  };

  const startWebScanning = async () => {
    setScanResult(null);
    scanLockRef.current = false;
    setScannerHint('Opening camera...');

    try {
      await releaseCamera();
      const stream = await acquireCameraStream();
      pendingStreamRef.current = stream;
      streamRef.current = stream;
      setScanSession((n) => n + 1);
      setIsScanning(true);
    } catch (err) {
      setIsScanning(false);
      setScannerHint('');
      setScanResult({
        status: 'error',
        message: err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Allow camera permission for this site in phone settings, then retry.'
          : `Camera error: ${err.message}`,
      });
    }
  };

  const startScanning = async () => {
    if (useNativeScanner) {
      await startNativeScan();
    } else {
      await startWebScanning();
    }
  };

  const scanAnother = async () => {
    setScanResult(null);
    setManualHash('');
    scanLockRef.current = false;
    await releaseCamera();
    await startScanning();
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    const raw = manualHash.trim();
    if (!raw) return;
    verifyQrPayload(raw);
  };

  const decodeImageFile = async (file) => {
    const bitmap = await createImageBitmap(file);
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return code?.data || null;
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    await stopWebScanning();
    setIsProcessing(true);
    setScanResult(null);
    try {
      const raw = await decodeImageFile(file);
      if (!raw) {
        setScanResult({ status: 'error', message: 'No QR code found in that image' });
        return;
      }
      await verifyQrPayload(raw);
    } catch (err) {
      setScanResult({ status: 'error', message: `Could not read image: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  };

  const showStartPanel = !isScanning && !scanResult && !isProcessing;
  const showWebCamera = isScanning && !useNativeScanner;

  const webCameraOverlay = showWebCamera
    ? createPortal(
        <div className="fixed inset-0 z-9999 bg-black flex flex-col">
          <div className="relative flex-1 min-h-0 w-full">
            <video
              key={`camera-${scanSession}`}
              ref={attachVideoRef}
              className="absolute inset-0 w-full h-full object-cover transform-gpu"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-[#0ECCEE] rounded-2xl opacity-80" />
            </div>
          </div>
          <button
            type="button"
            onClick={stopWebScanning}
            className="absolute top-4 right-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium z-10"
          >
            Stop
          </button>
          {scannerHint && (
            <div className="absolute bottom-6 left-4 right-4 bg-black/80 text-gray-100 text-sm rounded-lg px-4 py-3 text-center z-10">
              {scannerHint}
            </div>
          )}
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <style>{`
        body.barcode-scanner-active,
        html.barcode-scanner-active {
          background: transparent !important;
        }
        body.barcode-scanner-active #root {
          background: transparent !important;
        }
      `}</style>

      {webCameraOverlay}

      <div className={`mx-auto space-y-4 sm:space-y-5 pb-8 ${embedded ? 'w-full' : 'max-w-2xl'}`}>
        {!embedded && (
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white">{resolvedTitle}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {useNativeScanner ? 'Using phone camera scanner (app mode)' : resolvedSubtitle}
            </p>
            {festName && mode === 'organizer' && (
              <p className="text-sm text-[#0ECCEE] mt-1 font-medium">{festName}</p>
            )}
          </div>
        )}

        {embedded && (
          <p className="text-sm text-gray-400 text-center">
            {useNativeScanner ? 'App camera mode' : resolvedSubtitle}
          </p>
        )}

        {checkinStats && (
          <div className="rounded-xl border border-gray-800 bg-[#111213] p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Check-ins today</p>
                <p className="text-lg font-bold text-white mt-0.5">
                  {checkinStats.totalCheckedIn}
                  <span className="text-gray-500 font-normal text-sm">
                    {' '}
                    / {checkinStats.totalRegistered}
                  </span>
                </p>
              </div>
              {checkinStats.totalRegistered > 0 && (
                <span className="text-sm font-semibold text-[#0ECCEE]">
                  {checkinStats.checkinRate ?? Math.round((checkinStats.totalCheckedIn / checkinStats.totalRegistered) * 100)}%
                </span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full bg-[#0ECCEE] rounded-full transition-all duration-500"
                style={{
                  width: `${
                    checkinStats.totalRegistered > 0
                      ? Math.min(100, (checkinStats.totalCheckedIn / checkinStats.totalRegistered) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 text-xs text-gray-500">
              {showSheetStatus ? (
              <span>
                {checkinStats.hasGoogleSheet ? (
                  <span className="text-green-400">● Sheets connected</span>
                ) : (
                  <span className="text-amber-400">● No sheet URL</span>
                )}
              </span>
              ) : null}
              {exportUrl && (
                <button
                  type="button"
                  className="text-[#0ECCEE] hover:underline"
                  onClick={async () => {
                    const authToken = resolvedGetToken();
                    if (!authToken) return;
                    try {
                      const res = await fetch(exportUrl, {
                        headers: { Authorization: `Bearer ${authToken}` },
                      });
                      if (!res.ok) return;
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `${festName || 'event'}_checkins.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Download CSV
                </button>
              )}
            </div>
          </div>
        )}

        {!embedded && checkinStats && !exportUrl && (
          <p className="text-xs text-gray-500">
            {checkinStats.hasGoogleSheet
              ? 'Check-ins log to Google Sheets automatically.'
              : 'Add a Google Sheet URL in Admin → Scanner Access.'}
          </p>
        )}

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="bg-[#111213] rounded-2xl border border-gray-800 p-5 sm:p-6">
          {showStartPanel && (
            <div className="text-center py-6 sm:py-10">
              <div className="w-20 h-20 rounded-2xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 flex items-center justify-center mx-auto mb-5">
                <QrCode size={36} className="text-[#0ECCEE]" />
              </div>
              <p className="text-gray-300 font-medium mb-1">
                {embedded ? 'Ready to scan' : 'Check-in scanner'}
              </p>
              <p className="text-gray-500 mb-8 text-sm px-2 max-w-xs mx-auto">
                Point at the ticket QR from My Bookings, or upload a photo
              </p>
              <div className="flex flex-col gap-3 max-w-sm mx-auto">
                <button
                  type="button"
                  onClick={startScanning}
                  className="inline-flex items-center justify-center gap-2 px-6 py-4 bg-[#0ECCEE] text-black rounded-xl font-semibold hover:opacity-90 transition-opacity text-base"
                >
                  <Camera size={20} />
                  {useNativeScanner ? 'Scan QR Code' : 'Open Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-gray-700 text-gray-300 rounded-xl font-medium hover:bg-gray-800/80 transition-colors"
                >
                  <Upload size={18} />
                  Upload QR photo
                </button>
              </div>
            </div>
          )}

          {showWebCamera && (
            <div className="text-center py-10">
              <RefreshCw className="animate-spin text-[#0ECCEE] mx-auto mb-3" size={32} />
              <p className="text-gray-300">{scannerHint || 'Camera active — point at ticket QR'}</p>
              <button
                type="button"
                onClick={stopWebScanning}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
              >
                Stop Camera
              </button>
            </div>
          )}

          {isScanning && useNativeScanner && !isProcessing && (
            <div className="text-center py-10">
              <RefreshCw className="animate-spin text-[#0ECCEE] mx-auto mb-3" size={32} />
              <p className="text-gray-300">{scannerHint || 'Camera active — scan a ticket'}</p>
              <button
                type="button"
                onClick={stopWebScanning}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
              >
                Cancel Scan
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <RefreshCw className="animate-spin text-[#0ECCEE] mx-auto mb-3" size={32} />
              <p className="text-gray-400">Verifying check-in...</p>
            </div>
          )}

          {scanResult && !isProcessing && (
            <div
              className={`rounded-2xl p-6 sm:p-8 text-center ${
                scanResult.status === 'checked_in'
                  ? 'bg-green-500/10 border border-green-500/25'
                  : scanResult.status === 'already_checked_in'
                    ? 'bg-amber-500/10 border border-amber-500/25'
                    : 'bg-red-500/10 border border-red-500/25'
              }`}
            >
              <div className="mb-3">
                {scanResult.status === 'checked_in' && (
                  <CheckCircle size={48} className="text-green-400 mx-auto" />
                )}
                {scanResult.status === 'already_checked_in' && (
                  <AlertTriangle size={48} className="text-yellow-400 mx-auto" />
                )}
                {(scanResult.status === 'invalid' || scanResult.status === 'error') && (
                  <XCircle size={48} className="text-red-400 mx-auto" />
                )}
              </div>

              <h3
                className={`text-base sm:text-lg font-bold mb-1 ${
                  scanResult.status === 'checked_in'
                    ? 'text-green-400'
                    : scanResult.status === 'already_checked_in'
                      ? 'text-yellow-400'
                      : 'text-red-400'
                }`}
              >
                {scanResult.message}
              </h3>

              {scanResult.data && (
                <div className="mt-3 space-y-1 text-sm">
                  {scanResult.data.userName && (
                    <p className="text-white font-medium">{scanResult.data.userName}</p>
                  )}
                  {(scanResult.data.trekName || scanResult.data.festName) && (
                    <p className="text-gray-400">{scanResult.data.trekName || scanResult.data.festName}</p>
                  )}
                  {scanResult.data.competitionName && (
                    <p className="text-gray-400">{scanResult.data.competitionName}</p>
                  )}
                  {Number(scanResult.data.people) > 1 && (
                    <p className="text-[#0ECCEE] font-medium">{scanResult.data.people} people on this ticket</p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={scanAnother}
                className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0ECCEE] text-black rounded-xl text-sm font-semibold hover:opacity-90"
              >
                <RefreshCw size={16} />
                Scan next ticket
              </button>
            </div>
          )}
        </div>

        {isVolunteerScanner ? (
          <details className="group bg-[#111213] rounded-xl border border-gray-800">
            <summary className="px-4 py-3 text-xs text-gray-500 cursor-pointer hover:text-gray-400 list-none flex items-center justify-between">
              Manual entry (if camera fails)
              <span className="text-gray-600 group-open:rotate-180 transition-transform">▾</span>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-gray-800">
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-2">
                <input
                  type="text"
                  value={manualHash}
                  onChange={(e) => setManualHash(e.target.value)}
                  placeholder="Paste QR data or hash"
                  className="w-full bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]"
                />
                <button
                  type="submit"
                  disabled={!manualHash.trim() || isProcessing}
                  className="px-4 py-2.5 bg-gray-800 text-gray-200 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-gray-700"
                >
                  Verify manually
                </button>
              </form>
            </div>
          </details>
        ) : (
          <div className="bg-[#111213] rounded-xl border border-gray-800 p-4 sm:p-5">
            <h3 className="font-semibold text-white mb-1 text-sm">Manual check-in</h3>
            <p className="text-xs text-gray-500 mb-3">Paste QR JSON or hash if the camera fails</p>
            <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={manualHash}
                onChange={(e) => setManualHash(e.target.value)}
                placeholder='{"hash":"..."}'
                className="flex-1 bg-[#1D1E20] border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]"
              />
              <button
                type="submit"
                disabled={!manualHash.trim() || isProcessing}
                className="px-5 py-3 bg-[#0ECCEE] text-black rounded-lg font-medium text-sm disabled:opacity-50"
              >
                Verify
              </button>
            </form>
            {manualHash && extractCheckinHash(manualHash) && (
              <p className="text-xs text-gray-500 mt-2">
                Hash: {extractCheckinHash(manualHash).slice(0, 8)}…
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

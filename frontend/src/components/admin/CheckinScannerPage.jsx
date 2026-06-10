import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, AlertTriangle, XCircle, RefreshCw, QrCode, Upload } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import jsQR from 'jsqr';
import { isNativeApp } from '../../utils/capacitorPlatform';
import { extractCheckinHash } from '../../utils/qrCheckin';
import { getApiBaseUrl } from '../../config/apiBase';

const getAdminToken = () => localStorage.getItem('admin_token');
const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isMobileDevice = () =>
  typeof window !== 'undefined' &&
  (window.innerWidth < 768 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent));

export default function CheckinScannerPage() {
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [nativeScanAvailable, setNativeScanAvailable] = useState(false);
  const [scannerHint, setScannerHint] = useState('');
  const [scanSession, setScanSession] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const scanLockRef = useRef(false);
  const nativeListenerRef = useRef(null);
  const mountedRef = useRef(true);

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

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

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

  const verifyQrPayload = useCallback(async (rawData) => {
    const trimmed = String(rawData || '').trim();
    if (!trimmed) {
      setScanResult({ status: 'error', message: 'Empty QR code' });
      return;
    }

    const token = getAdminToken();
    if (!token) {
      setScanResult({
        status: 'error',
        message: 'Admin session expired — log in again at /admin/login',
      });
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/qr/checkin`, {
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
          message: data.error || 'Admin login expired — open /admin/login again',
        });
        return;
      }

      setScanResult({
        status: data.status || (data.success ? 'checked_in' : 'error'),
        message: data.message || data.error || 'Check-in failed',
        data: data.data,
      });
    } catch (err) {
      setScanResult({
        status: 'error',
        message: `Cannot reach server: ${err.message}. Check internet / API URL.`,
      });
    } finally {
      setIsProcessing(false);
      scanLockRef.current = false;
    }
  }, []);

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

  useEffect(() => {
    if (!isScanning || useNativeScanner) return undefined;

    let cancelled = false;

    const bootCamera = async () => {
      setScannerHint('Opening camera...');

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera not supported. Use Upload QR Image or manual entry.');
        }

        let stream;
        const mobile = isMobileDevice();
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: mobile ? { ideal: 'environment' } : 'environment',
              width: { ideal: mobile ? 1280 : 1280 },
              height: { ideal: mobile ? 720 : 720 },
            },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        let video = videoRef.current;
        for (let i = 0; i < 8 && !video; i += 1) {
          await waitMs(50);
          video = videoRef.current;
        }
        if (!video) throw new Error('Camera preview failed. Tap Open Camera again.');

        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('webkit-playsinline', 'true');

        await new Promise((resolve, reject) => {
          const onReady = () => {
            video.removeEventListener('loadedmetadata', onReady);
            resolve();
          };
          video.addEventListener('loadedmetadata', onReady);
          video.play().catch(reject);
        });

        if (cancelled) return;

        setScannerHint('Hold the ticket QR inside the frame');
        startScanLoop();
      } catch (err) {
        if (cancelled) return;
        await stopWebScanning();
        setScanResult({
          status: 'error',
          message: err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
            ? 'Allow camera permission for this site in phone settings, then retry.'
            : `Camera error: ${err.message}`,
        });
      }
    };

    bootCamera();
    return () => {
      cancelled = true;
    };
  }, [isScanning, scanSession, startScanLoop, stopWebScanning, useNativeScanner]);

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
    await stopWebScanning();
    setScanResult(null);
    scanLockRef.current = false;
    setScanSession((n) => n + 1);
    setIsScanning(true);
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

      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6 pb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Check-in Scanner</h1>
          <p className="text-sm text-gray-400 mt-1">
            {useNativeScanner
              ? 'Using phone camera scanner (app mode)'
              : 'Scan ticket QR from My Bookings'}
          </p>
        </div>

        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleImageUpload}
        />

        <div className="bg-[#111213] rounded-xl border border-gray-800 p-4 sm:p-5">
          {showStartPanel && (
            <div className="text-center py-8 sm:py-12">
              <QrCode size={48} className="text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 mb-6 text-sm px-2">
                Scan attendee ticket QR, or take a photo of the QR code
              </p>
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={startScanning}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0ECCEE] text-black rounded-lg font-medium hover:bg-[#0ECCEE]/90 transition-colors"
                >
                  <Camera size={18} />
                  {useNativeScanner ? 'Scan QR Code' : 'Open Camera'}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 border border-gray-600 text-gray-200 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                >
                  <Upload size={18} />
                  Photo of QR
                </button>
              </div>
            </div>
          )}

          {showWebCamera && (
            <div
              className={
                isMobileDevice()
                  ? 'fixed inset-0 z-50 bg-black flex flex-col'
                  : 'relative'
              }
            >
              <video
                key={`camera-${scanSession}`}
                ref={videoRef}
                className={
                  isMobileDevice()
                    ? 'flex-1 w-full object-cover'
                    : 'w-full min-h-[320px] rounded-lg bg-black object-cover'
                }
                playsInline
                muted
                autoPlay
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-[#0ECCEE] rounded-2xl opacity-80" />
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
              className={`rounded-xl p-5 sm:p-6 text-center ${
                scanResult.status === 'checked_in'
                  ? 'bg-green-500/10 border border-green-500/30'
                  : scanResult.status === 'already_checked_in'
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
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
                </div>
              )}

              <button
                type="button"
                onClick={scanAnother}
                className="mt-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#0ECCEE] text-black rounded-lg text-sm font-semibold hover:opacity-90"
              >
                <RefreshCw size={14} />
                Scan Another
              </button>
            </div>
          )}
        </div>

        <div className="bg-[#111213] rounded-xl border border-gray-800 p-4 sm:p-5">
          <h3 className="font-semibold text-white mb-2">Manual Check-in</h3>
          <p className="text-xs text-gray-500 mb-3">
            Paste QR JSON or hash if camera fails
          </p>
          <form onSubmit={handleManualSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={manualHash}
              onChange={(e) => setManualHash(e.target.value)}
              placeholder='{"hash":"..."}'
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]"
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
      </div>
    </>
  );
}

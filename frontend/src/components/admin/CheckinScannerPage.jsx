import { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, CheckCircle, AlertTriangle, XCircle, RefreshCw, QrCode } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { isNativeApp } from '../../utils/capacitorPlatform';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const getAdminToken = () => localStorage.getItem('admin_token');

export default function CheckinScannerPage() {
  const [scanResult, setScanResult] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [nativeScanAvailable, setNativeScanAvailable] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (isNativeApp()) {
      BarcodeScanner.isSupported()
        .then(({ supported }) => setNativeScanAvailable(!!supported))
        .catch(() => setNativeScanAvailable(false));
    }
    return () => {
      stopWebScanning();
    };
  }, []);

  const stopWebScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  const verifyHash = useCallback(async (hash) => {
    setIsProcessing(true);
    try {
      const token = getAdminToken();
      const res = await fetch(`${API_BASE_URL}/qr/checkin/${hash}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
      });

      const data = await res.json();
      setScanResult({
        status: data.status || (data.success ? 'checked_in' : 'error'),
        message: data.message,
        data: data.data,
      });
    } catch (err) {
      setScanResult({ status: 'error', message: `Network error: ${err.message}` });
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleQRData = useCallback(async (rawData) => {
    stopWebScanning();
    setIsProcessing(true);

    try {
      let parsed;
      try {
        parsed = JSON.parse(rawData);
      } catch {
        parsed = { hash: rawData };
      }

      const hash = parsed.hash;
      if (!hash) {
        setScanResult({ status: 'error', message: 'Invalid QR code format' });
        return;
      }

      await verifyHash(hash);
    } catch (err) {
      setScanResult({ status: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  }, [verifyHash]);

  const startNativeScan = async () => {
    try {
      setScanResult(null);
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        setScanResult({ status: 'error', message: 'Camera permission denied' });
        return;
      }

      document.body.classList.add('barcode-scanner-active');
      const { barcodes } = await BarcodeScanner.scan({
        formats: ['QR_CODE'],
      });
      document.body.classList.remove('barcode-scanner-active');

      if (barcodes?.length > 0) {
        await handleQRData(barcodes[0].rawValue || barcodes[0].displayValue);
      }
    } catch (err) {
      document.body.classList.remove('barcode-scanner-active');
      if (err.message?.includes('cancel')) return;
      setScanResult({ status: 'error', message: err.message || 'Scan failed' });
    }
  };

  const startWebScanning = async () => {
    try {
      setScanResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsScanning(true);

      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              await handleQRData(barcodes[0].rawValue);
            }
          } catch {
            /* scanning */
          }
        }, 500);
      }
    } catch (err) {
      setScanResult({
        status: 'error',
        message: `Camera access denied: ${err.message}`,
      });
    }
  };

  const startScanning = () => {
    if (isNativeApp() && nativeScanAvailable) {
      startNativeScan();
    } else {
      startWebScanning();
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setManualHash('');
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualHash.trim()) {
      verifyHash(manualHash.trim());
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Check-in Scanner</h1>
        <p className="text-sm text-gray-400 mt-1">Scan QR codes to check in attendees</p>
      </div>

      <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
        {!isScanning && !scanResult && (
          <div className="text-center py-12">
            <QrCode size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-6">Point your camera at a QR code to check in an attendee</p>
            <button
              type="button"
              onClick={startScanning}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-medium hover:bg-[#0ECCEE]/90 transition-colors"
            >
              <Camera size={18} />
              {isNativeApp() && nativeScanAvailable ? 'Scan with Camera' : 'Start Scanning'}
            </button>
          </div>
        )}

        {isScanning && (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full rounded-lg bg-black"
              playsInline
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-[#0ECCEE] rounded-2xl opacity-70" />
            </div>
            <button
              type="button"
              onClick={stopWebScanning}
              className="absolute top-3 right-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Stop
            </button>
            {!('BarcodeDetector' in window) && (
              <div className="absolute bottom-3 left-3 right-3 bg-yellow-500/90 text-black text-xs rounded-lg px-3 py-2 text-center">
                Auto-scan unavailable — use manual entry below.
              </div>
            )}
          </div>
        )}

        {isProcessing && (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin text-[#0ECCEE] mx-auto mb-3" size={32} />
            <p className="text-gray-400">Verifying check-in...</p>
          </div>
        )}

        {scanResult && !isProcessing && (
          <div className={`rounded-xl p-6 text-center ${
            scanResult.status === 'checked_in' ? 'bg-green-500/10 border border-green-500/30' :
            scanResult.status === 'already_checked_in' ? 'bg-yellow-500/10 border border-yellow-500/30' :
            'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="mb-3">
              {scanResult.status === 'checked_in' && <CheckCircle size={48} className="text-green-400 mx-auto" />}
              {scanResult.status === 'already_checked_in' && <AlertTriangle size={48} className="text-yellow-400 mx-auto" />}
              {(scanResult.status === 'invalid' || scanResult.status === 'error') && <XCircle size={48} className="text-red-400 mx-auto" />}
            </div>

            <h3 className={`text-lg font-bold mb-1 ${
              scanResult.status === 'checked_in' ? 'text-green-400' :
              scanResult.status === 'already_checked_in' ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {scanResult.message}
            </h3>

            {scanResult.data && (
              <div className="mt-3 space-y-1 text-sm">
                {scanResult.data.userName && (
                  <p className="text-white font-medium">{scanResult.data.userName}</p>
                )}
                {scanResult.data.festName && (
                  <p className="text-gray-400">{scanResult.data.festName}</p>
                )}
                {scanResult.data.competitionName && (
                  <p className="text-gray-400">{scanResult.data.competitionName}</p>
                )}
                {scanResult.data.checkedInAt && (
                  <p className="text-gray-500 text-xs mt-2">
                    {new Date(scanResult.data.checkedInAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={resetScanner}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <RefreshCw size={14} />
              Scan Another
            </button>
          </div>
        )}
      </div>

      <div className="bg-[#111213] rounded-xl border border-gray-800 p-5">
        <h3 className="font-semibold text-white mb-3">Manual Check-in</h3>
        <form onSubmit={handleManualSubmit} className="flex gap-3">
          <input
            type="text"
            value={manualHash}
            onChange={(e) => setManualHash(e.target.value)}
            placeholder="Enter QR hash code..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]"
          />
          <button
            type="submit"
            disabled={!manualHash.trim() || isProcessing}
            className="px-5 py-2.5 bg-[#0ECCEE] text-black rounded-lg font-medium text-sm hover:bg-[#0ECCEE]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verify
          </button>
        </form>
      </div>
    </div>
  );
}

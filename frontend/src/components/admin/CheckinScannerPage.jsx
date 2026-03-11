import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, AlertTriangle, XCircle, RefreshCw, QrCode } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const getAdminToken = () => localStorage.getItem('admin_token');

export default function CheckinScannerPage() {
  const [scanResult, setScanResult] = useState(null); // { status, data, message }
  const [isScanning, setIsScanning] = useState(false);
  const [manualHash, setManualHash] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanIntervalRef = useRef(null);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, []);

  const startScanning = async () => {
    try {
      setScanResult(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsScanning(true);

      // Poll for QR codes using BarcodeDetector API (available in modern browsers)
      if ('BarcodeDetector' in window) {
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        scanIntervalRef.current = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const rawData = barcodes[0].rawValue;
              handleQRData(rawData);
            }
          } catch (_) { /* scanning... */ }
        }, 500);
      }
    } catch (err) {
      setScanResult({
        status: 'error',
        message: `Camera access denied: ${err.message}`,
      });
    }
  };

  const stopScanning = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setIsScanning(false);
  };

  const handleQRData = async (rawData) => {
    // Stop scanning while processing
    stopScanning();
    setIsProcessing(true);

    try {
      // Parse QR data
      let parsed;
      try {
        parsed = JSON.parse(rawData);
      } catch (_) {
        // Might be just a hash string
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
  };

  const verifyHash = async (hash) => {
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
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualHash.trim()) {
      verifyHash(manualHash.trim());
    }
  };

  const resetScanner = () => {
    setScanResult(null);
    setManualHash('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Check-in Scanner</h1>
        <p className="text-sm text-gray-400 mt-1">Scan QR codes to check in attendees</p>
      </div>

      {/* Scanner Area */}
      <div className="bg-[#1B1C1E] rounded-xl border border-gray-800 p-5">
        {!isScanning && !scanResult && (
          <div className="text-center py-12">
            <QrCode size={48} className="text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-6">Point your camera at a QR code to check in an attendee</p>
            <button
              onClick={startScanning}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#0ECCEE] text-black rounded-lg font-medium hover:bg-[#0ECCEE]/90 transition-colors"
            >
              <Camera size={18} />
              Start Scanning
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
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-2 border-[#0ECCEE] rounded-2xl opacity-70" />
            </div>
            <button
              onClick={stopScanning}
              className="absolute top-3 right-3 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium"
            >
              Stop
            </button>
            {!('BarcodeDetector' in window) && (
              <div className="absolute bottom-3 left-3 right-3 bg-yellow-500/90 text-black text-xs rounded-lg px-3 py-2 text-center">
                Your browser doesn't support auto-scanning. Use manual entry below.
              </div>
            )}
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="text-center py-8">
            <RefreshCw className="animate-spin text-[#0ECCEE] mx-auto mb-3" size={32} />
            <p className="text-gray-400">Verifying check-in...</p>
          </div>
        )}

        {/* Scan Result */}
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
              onClick={resetScanner}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
            >
              <RefreshCw size={14} />
              Scan Another
            </button>
          </div>
        )}
      </div>

      {/* Manual Entry */}
      <div className="bg-[#1B1C1E] rounded-xl border border-gray-800 p-5">
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

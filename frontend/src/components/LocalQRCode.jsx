import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useDarkMode } from '../context/DarkModeContext';

export default function LocalQRCode({ data, size = 200, className = '', printSafe = false }) {
  const { isDark } = useDarkMode();
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const payload = data == null || data === ''
      ? ''
      : (typeof data === 'string' ? data : JSON.stringify(data));
    if (!payload) {
      setSrc('');
      return undefined;
    }
    const usePrint = printSafe || !isDark;

    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      color: usePrint
        ? { dark: '#111213', light: '#ffffff' }
        : { dark: '#ffffff', light: '#111213' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => { cancelled = true; };
  }, [data, size, isDark, printSafe]);

  if (!src) {
    return (
      <div
        className={`animate-pulse rounded-lg ${isDark ? 'bg-gray-800' : 'bg-gray-200'} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <img
      src={src}
      alt="QR Code"
      width={size}
      height={size}
      className={`rounded-lg ${className}`}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

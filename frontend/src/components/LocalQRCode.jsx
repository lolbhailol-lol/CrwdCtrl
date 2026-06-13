import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useDarkMode } from '../context/DarkModeContext';

export default function LocalQRCode({ data, size = 200, className = '' }) {
  const { isDark } = useDarkMode();
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);

    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      color: isDark
        ? { dark: '#ffffff', light: '#111213' }
        : { dark: '#111213', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => { cancelled = true; };
  }, [data, size, isDark]);

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

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function LocalQRCode({ data, size = 200, className = '' }) {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let cancelled = false;
    const payload = typeof data === 'string' ? data : JSON.stringify(data);

    QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      color: { dark: '#ffffff', light: '#111213' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc('');
      });

    return () => { cancelled = true; };
  }, [data, size]);

  if (!src) {
    return (
      <div
        className={`bg-gray-800 animate-pulse rounded-lg ${className}`}
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

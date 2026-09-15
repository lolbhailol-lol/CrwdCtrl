import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export default function OfflineQrCard({
  value,
  title,
  hint,
  accent = '#0ECCEE',
}) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setSrc('');
      return undefined;
    }
    QRCode.toDataURL(value, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0b0c0d', light: '#ffffff' },
    })
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not draw QR');
      });
    return () => { cancelled = true; };
  }, [value]);

  if (!value) return null;

  return (
    <div className="rounded-2xl border border-white/12 bg-white px-4 py-4 text-center text-black">
      {title ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: accent }}>
          {title}
        </p>
      ) : null}
      {src ? (
        <img src={src} alt={title || 'QR'} className="mx-auto mt-2 h-56 w-56" />
      ) : (
        <p className="py-16 text-sm text-black/50">Drawing QR…</p>
      )}
      {hint ? <p className="mt-2 text-xs text-black/60">{hint}</p> : null}
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

/** Sample edge pixels for a matching letterbox colour fallback. */
function sampleEdgeColor(img) {
  try {
    const w = Math.min(img.naturalWidth || 0, 64);
    const h = Math.min(img.naturalHeight || 0, 80);
    if (w < 4 || h < 4) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    const push = (x, y) => {
      const i = (y * w + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      n += 1;
    };
    for (let y = 0; y < h; y += 2) {
      push(0, y);
      push(w - 1, y);
    }
    for (let x = 0; x < w; x += 2) {
      push(x, 0);
      push(x, h - 1);
    }
    if (!n) return null;
    return `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  } catch {
    return null;
  }
}

/**
 * Full vertical poster. Cloudinary colour-matched pads fill blank sides;
 * falls back to contain + sampled edge colour.
 */
export default function PosterFitImage({
  src,
  alt = '',
  /** Prefer *Pad presets so sides match poster colours */
  preset = 'cardPortraitPad',
  className = '',
  imgClassName = '',
  loading = 'lazy',
  fetchPriority,
  fallbackW = 160,
  fallbackH = 208,
  fallbackBg = '#1A1B1D',
  onError,
  onLoad,
}) {
  const [bg, setBg] = useState(fallbackBg);
  const [useFitFallback, setUseFitFallback] = useState(false);

  useEffect(() => {
    setUseFitFallback(false);
    setBg(fallbackBg);
  }, [src, preset, fallbackBg]);

  if (!src) return null;

  const padPreset = preset.includes('Pad')
    ? preset
    : preset === 'eventHeroFit'
      ? 'eventHeroPad'
      : 'cardPortraitPad';
  const fitPreset = padPreset === 'eventHeroPad' ? 'eventHeroFit' : 'cardPortraitFit';

  const padUrl = getImageUrl(src, { preset: padPreset }) || src;
  const fitUrl = getImageUrl(src, { preset: fitPreset }) || src;
  const url = useFitFallback ? fitUrl : padUrl;
  // Padded image already fills the frame; fit fallback uses contain + colour bg
  const fitClass = useFitFallback ? 'object-contain' : 'object-cover';

  return (
    <div
      className={`absolute inset-0 overflow-hidden ${className}`}
      style={{ backgroundColor: bg }}
    >
      <img
        src={url}
        alt={alt}
        crossOrigin="anonymous"
        className={`absolute inset-0 w-full h-full ${fitClass} object-center pointer-events-none select-none ${imgClassName}`}
        draggable={false}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        onLoad={(e) => {
          const sampled = sampleEdgeColor(e.currentTarget);
          if (sampled) setBg(sampled);
          onLoad?.(e);
        }}
        onError={(e) => {
          if (!useFitFallback) {
            setUseFitFallback(true);
            return;
          }
          onError?.(e);
          handleImageErrorWithFallback(e, fallbackW, fallbackH, fallbackBg, alt || 'Event');
        }}
      />
    </div>
  );
}

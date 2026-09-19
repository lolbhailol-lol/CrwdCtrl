import { useLayoutEffect, useRef, useState } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { DetailLoader3DIcon } from './DetailPageLoader';
import PosterFitImage from './PosterFitImage';

/**
 * Competition thumbnail / hero.
 * placeholder: 'trophy' (default hero) | 'muted' (quiet cards, no 3D flash) | 'none'
 * Pass fillBox to pad+cover any aspect into the frame (hero boxes).
 */
export default function CompetitionCoverImage({
  src,
  alt = 'Competition',
  preset = 'cardSm',
  className = 'absolute inset-0 w-full h-full object-cover',
  containerClassName = '',
  loaderSize = 'compact',
  eager = false,
  placeholder = 'trophy',
  /** Colour-matched pad so the image always fills the hero box */
  fillBox = false,
}) {
  const imageUrl = src && !fillBox ? getImageUrl(src, { preset }) : '';
  const imgRef = useRef(null);
  const [status, setStatus] = useState(() => (src ? 'loading' : 'empty'));

  useLayoutEffect(() => {
    if (!src) {
      setStatus('empty');
      return undefined;
    }
    if (fillBox) {
      setStatus('loaded');
      return undefined;
    }
    setStatus('loading');
    const id = window.requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setStatus('loaded');
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [src, imageUrl, fillBox]);

  const showTrophy =
    placeholder === 'trophy' && (status === 'loading' || status === 'error' || status === 'empty');
  const showMuted =
    placeholder === 'muted' && (status === 'loading' || status === 'error' || status === 'empty');

  return (
    <div className={`relative overflow-hidden bg-[#1A1B1D] ${containerClassName}`.trim()}>
      {showTrophy ? (
        <div className="absolute inset-0 z-0 flex items-center justify-center">
          <DetailLoader3DIcon variant="competition" size={loaderSize} tone="dark" />
        </div>
      ) : null}
      {showMuted ? (
        <div className="absolute inset-0 z-0 bg-[#1A1B1D]" aria-hidden="true" />
      ) : null}
      {src && fillBox ? (
        <PosterFitImage
          src={src}
          alt={alt}
          preset={preset.includes('Pad') || preset.includes('Fit') ? preset : 'eventHeroPad'}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          fallbackBg="#1A1B1D"
          className={`z-10 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${
            placeholder === 'muted' ? '' : 'transition-opacity duration-200'
          }`}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
      {imageUrl ? (
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          className={`z-10 ${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${
            placeholder === 'muted' ? '' : 'transition-opacity duration-200'
          }`}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
    </div>
  );
}

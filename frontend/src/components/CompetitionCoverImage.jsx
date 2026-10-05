import { useLayoutEffect, useRef, useState } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { DetailLoader3DIcon } from './DetailPageLoader';

/**
 * Competition thumbnail / hero.
 * placeholder: 'trophy' (default hero) | 'muted' (quiet cards, no 3D flash) | 'none'
 * Cover stays under overlays (favorite) — no z-index fight, no pointer steal.
 */
export default function CompetitionCoverImage({
  src,
  alt = 'Competition',
  preset = 'cardSm',
  className = 'absolute inset-0 w-full h-full object-cover object-center',
  containerClassName = '',
  loaderSize = 'compact',
  eager = false,
  placeholder = 'trophy',
}) {
  const imageUrl = src ? getImageUrl(src, { preset }) : '';
  const imgRef = useRef(null);
  const [status, setStatus] = useState(() => (imageUrl ? 'loading' : 'empty'));

  useLayoutEffect(() => {
    if (!imageUrl) {
      setStatus('empty');
      return undefined;
    }
    setStatus('loading');
    // Cached images often finish before onLoad binds — sync from the DOM node.
    const id = window.requestAnimationFrame(() => {
      const img = imgRef.current;
      if (img?.complete && img.naturalWidth > 0) {
        setStatus('loaded');
      }
    });
    return () => window.cancelAnimationFrame(id);
  }, [imageUrl]);

  const showTrophy =
    placeholder === 'trophy' && (status === 'loading' || status === 'error' || status === 'empty');
  const showMuted =
    placeholder === 'muted' && (status === 'loading' || status === 'error' || status === 'empty');

  return (
    <div className={`relative z-0 overflow-hidden bg-[#1A1B1D] ${containerClassName}`.trim()}>
      {showTrophy ? (
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <DetailLoader3DIcon variant="competition" size={loaderSize} tone="dark" />
        </div>
      ) : null}
      {showMuted ? (
        <div className="absolute inset-0 z-0 bg-[#1A1B1D] pointer-events-none" aria-hidden="true" />
      ) : null}
      {imageUrl ? (
        <img
          ref={imgRef}
          src={imageUrl}
          alt={alt}
          className={`z-0 pointer-events-none select-none ${className} ${
            status === 'loaded' ? 'opacity-100' : 'opacity-0'
          } ${placeholder === 'muted' ? '' : 'transition-opacity duration-200'}`}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          draggable={false}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
        />
      ) : null}
    </div>
  );
}

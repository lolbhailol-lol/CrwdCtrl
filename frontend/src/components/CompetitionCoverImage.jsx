import { useEffect, useState } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { DetailLoader3DIcon } from './DetailPageLoader';

/**
 * Competition thumbnail / hero.
 * placeholder: 'trophy' (default hero) | 'muted' (quiet cards, no 3D flash) | 'none'
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
}) {
  const imageUrl = src ? getImageUrl(src, { preset }) : '';
  const [status, setStatus] = useState(() => (imageUrl ? 'loading' : 'empty'));

  useEffect(() => {
    setStatus(imageUrl ? 'loading' : 'empty');
  }, [imageUrl]);

  const showTrophy =
    placeholder === 'trophy' && (status === 'loading' || status === 'error' || status === 'empty');
  const showMuted =
    placeholder === 'muted' && (status === 'loading' || status === 'error' || status === 'empty');

  return (
    <div className={`relative overflow-hidden bg-[#1A1B1D] ${containerClassName}`.trim()}>
      {showTrophy ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <DetailLoader3DIcon variant="competition" size={loaderSize} tone="dark" />
        </div>
      ) : null}
      {showMuted ? (
        <div className="absolute inset-0 bg-[#1A1B1D]" aria-hidden="true" />
      ) : null}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={`${className} ${status === 'loaded' ? 'opacity-100' : 'opacity-0'} ${
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

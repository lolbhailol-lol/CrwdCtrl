import { useEffect, useState } from 'react';
import { getImageUrl } from '../utils/imageImports';
import { DetailLoader3DIcon } from './DetailPageLoader';

/**
 * Competition thumbnail / hero — shows 3D trophy loader while fetching or on missing/broken cover.
 */
export default function CompetitionCoverImage({
  src,
  alt = 'Competition',
  preset = 'cardSm',
  className = 'absolute inset-0 w-full h-full object-cover',
  containerClassName = '',
  loaderSize = 'compact',
  eager = false,
}) {
  const imageUrl = src ? getImageUrl(src, { preset }) : '';
  const [status, setStatus] = useState(() => (imageUrl ? 'loading' : 'error'));

  useEffect(() => {
    setStatus(imageUrl ? 'loading' : 'error');
  }, [imageUrl]);

  return (
    <div className={`relative overflow-hidden bg-[#1A1B1D] ${containerClassName}`.trim()}>
      {(status === 'loading' || status === 'error') && (
        <div className="absolute inset-0 flex items-center justify-center">
          <DetailLoader3DIcon variant="competition" size={loaderSize} tone="dark" />
        </div>
      )}
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt}
          className={`${className} transition-opacity duration-300 ${status === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
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

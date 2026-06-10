import { Heart } from 'lucide-react';

/** Glass circle on cards — only the heart turns red when favourited. */
export default function CardFavoriteButton({
    isFavorite = false,
    onClick,
    className = '',
}) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.(e);
            }}
            aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
            aria-pressed={isFavorite}
            className={`card-fav-btn overlay-fav-btn overlay-fav-btn--tr ${className}`}
        >
            <span className="card-fav-btn__circle overlay-fav-btn__icon">
                <Heart
                    size={17}
                    strokeWidth={2.25}
                    className={`crisp-icon-svg ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
                    aria-hidden
                />
            </span>
        </button>
    );
}

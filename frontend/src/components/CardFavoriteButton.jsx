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
            className={`w-9 h-9 rounded-full bg-black/45 backdrop-blur-xl border border-white/30 hover:bg-black/75 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.5)] flex items-center justify-center text-white transition-all shadow-xl hover:scale-110 active:scale-95 ${className}`}
        >
            <Heart
                size={16}
                strokeWidth={2.25}
                className={`crisp-icon-svg transition-colors ${isFavorite ? 'fill-red-500 text-red-500' : 'text-white'}`}
                aria-hidden
            />
        </button>
    );
}

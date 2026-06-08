import { Heart } from 'lucide-react';
import ContentImage from './ContentImage';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';

export default function TrendingCard({ event, isDark, isFavorite, onToggleFavorite, onViewDetails }) {
    const handleFav = (e) => {
        e.stopPropagation();
        onToggleFavorite?.();
    };

    return (
        <div
            className={`card-carousel-sm rounded-2xl overflow-hidden cursor-pointer
                        transition-all duration-200 active:scale-95
                        ${isDark
                            ? 'bg-[#111213] shadow-lg shadow-black/30'
                            : 'bg-white shadow-md'
                        }`}
            onClick={onViewDetails}
        >
            {/* Image */}
            <div className="relative aspect-[11/8] overflow-hidden">
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset="cardSm"
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(e, 220, 160, '#6366f1', event.title || 'Event')}
                />
                {/* Status badge */}
                {event.status && event.status !== 'completed' && (
                    <div className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[10px] font-bold capitalize
                        ${event.status === 'ongoing'
                            ? 'bg-green-500 text-white'
                            : 'bg-orange-500 text-white'
                        }`}>
                        {event.status}
                    </div>
                )}
                {/* Heart button */}
                <button
                    onClick={handleFav}
                    className={`card-icon-btn absolute top-1.5 right-1.5 rounded-full
                                transition-all duration-200 active:scale-90
                                ${isFavorite
                                    ? 'bg-red-500/90 border border-red-400'
                                    : 'bg-black/40 backdrop-blur-sm border border-white/20'
                                }`}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                    <Heart
                        size={14}
                        className={isFavorite ? 'text-white fill-white' : 'text-white'}
                    />
                </button>
            </div>

            {/* Content */}
            <div className="p-3">
                <h3 className={`text-fluid-sm font-bold leading-tight mb-1 line-clamp-1
                                ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {event.title}
                </h3>
                {event.subtitle && (
                    <p className={`text-[11px] mb-3 line-clamp-1
                                  ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {event.subtitle}
                    </p>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails?.(); }}
                    className={`w-full min-h-[var(--touch-min)] py-2 rounded-lg text-fluid-xs font-bold transition-colors
                                ${isDark
                                    ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30 hover:bg-[#0ECCEE]/20'
                                    : 'bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100'
                                }`}
                >
                    Details
                </button>
            </div>
        </div>
    );
}

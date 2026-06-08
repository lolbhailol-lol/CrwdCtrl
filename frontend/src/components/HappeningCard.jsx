import ContentImage from './ContentImage';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import { Share2 } from 'lucide-react';

export default function HappeningCard({ event, _isDark, onViewDetails }) {
    const handleShare = (e) => {
        e.stopPropagation();
        if (navigator.share) {
            navigator.share({
                title: event.title,
                text: `Check out ${event.title}`,
                url: `${window.location.origin}/view-details/${event.id}`,
            }).catch(() => {});
        }
    };

    return (
        <div
            className="shrink-0 w-[260px] sm:w-[280px] cursor-pointer active:scale-95 transition-all duration-200"
            onClick={onViewDetails}
        >
            {/* Image card */}
            <div className="relative h-[180px] sm:h-[190px] rounded-2xl overflow-hidden">
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset="card"
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(e, 280, 190, '#111213', event.title || 'Event')}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

                {/* Share button — top right */}
                <button
                    onClick={handleShare}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center
                               bg-black/40 backdrop-blur-sm border border-white/20 transition-all duration-200 active:scale-90"
                    aria-label={`Share ${event.title}`}
                >
                    <Share2 size={16} className="text-white" />
                </button>

                {/* Event name — bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white font-bold text-sm leading-tight line-clamp-1">
                        {event.title}
                    </p>
                </div>
            </div>

        </div>
    );
}

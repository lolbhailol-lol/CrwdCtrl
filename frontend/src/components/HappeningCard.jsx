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
            className="card-carousel cursor-pointer active:scale-95 transition-all duration-200"
            onClick={onViewDetails}
        >
            {/* Image card */}
            <div className="relative aspect-[14/9] rounded-2xl overflow-hidden">
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
                    className="card-icon-btn absolute top-1.5 right-1.5 rounded-full
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

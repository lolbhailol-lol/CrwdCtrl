import ContentImage from './ContentImage';
import { toCardText } from '../utils/cardText';
import { handleImageErrorWithFallback } from '../utils/fallbackImageGenerator';
import CardShareButton from './CardShareButton';
import { AnimatedCard } from '../motion';

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
        <AnimatedCard
            className="card-carousel cursor-pointer"
            onClick={onViewDetails}
        >
            {/* Image card */}
            <div className="card-surface relative aspect-[14/9] rounded-2xl overflow-hidden">
                <ContentImage
                    src={event.image}
                    alt={event.title}
                    preset="card"
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(e, 280, 190, '#111213', event.title || 'Event')}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent" />

                <CardShareButton
                    onClick={handleShare}
                    overlay
                    className="card-share-btn--overlay"
                />

                {/* Event name — bottom overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="card-event-title text-white line-clamp-1">
                        {toCardText(event.title)}
                    </p>
                </div>
            </div>

        </AnimatedCard>
    );
}

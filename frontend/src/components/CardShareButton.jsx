import { Share2 } from 'lucide-react';

/** Share icon on cards — no background circle, icon only. */
export default function CardShareButton({
    onClick,
    className = '',
    overlay = false,
    isDark = false,
    size = 20,
}) {
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation();
                onClick?.(e);
            }}
            aria-label="Share"
            className={`card-share-btn ${className}`}
        >
            <Share2
                size={size}
                strokeWidth={2.25}
                className={`crisp-icon-svg ${
                    overlay ? 'text-white' : isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
            />
        </button>
    );
}

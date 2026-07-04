import { Users } from 'lucide-react';
import { openExternalUrl } from '../utils/externalLink';

/**
 * Opens the community WhatsApp / Telegram group link when configured.
 */
export default function JoinCommunityButton({
    groupLink,
    label = 'Join Community',
    className = '',
    compact = false,
}) {
    const url = String(groupLink || '').trim();
    if (!url) return null;

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openExternalUrl(url);
    };

    if (compact) {
        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClick}
                className={`inline-flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm font-semibold transition active:scale-[0.98] ${className}`}
            >
                <Users size={16} className="shrink-0" />
                {label}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={handleClick}
            className={`w-full flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-bold transition active:scale-[0.98] ${className}`}
        >
            <Users size={18} className="shrink-0" />
            {label}
        </button>
    );
}

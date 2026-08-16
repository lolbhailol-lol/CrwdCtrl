import { Check, Loader, MessageCircle } from 'lucide-react';

/**
 * Small organizer tick: mark whether an entry joined the competition WhatsApp group.
 * Tap once to mark in; tap again to clear.
 */
export default function WhatsAppGroupToggle({
    joined = false,
    busy = false,
    onToggle,
    size = 'md',
    showLabel = true,
    className = '',
}) {
    const compact = size === 'sm';
    return (
        <button
            type="button"
            disabled={busy || !onToggle}
            onClick={(e) => {
                e.stopPropagation();
                onToggle?.(!joined);
            }}
            title={joined
                ? 'In competition WhatsApp group — tap to undo'
                : 'Not marked in WhatsApp group — tap when they join'}
            aria-pressed={joined}
            aria-label={joined ? 'In WhatsApp group' : 'Mark WhatsApp group joined'}
            className={`inline-flex items-center gap-1.5 rounded-xl border transition disabled:opacity-50 ${
                compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
            } ${
                joined
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 bg-white/4 text-gray-400 hover:border-emerald-400/30 hover:text-emerald-200'
            } ${className}`}
        >
            {busy ? (
                <Loader className="animate-spin shrink-0" size={compact ? 12 : 14} />
            ) : joined ? (
                <span className={`inline-flex items-center justify-center rounded-full bg-emerald-500 text-black shrink-0 ${
                    compact ? 'size-3.5' : 'size-4'
                }`}
                >
                    <Check size={compact ? 9 : 11} strokeWidth={3} />
                </span>
            ) : (
                <span className={`inline-flex items-center justify-center rounded-full border border-dashed border-gray-500 shrink-0 ${
                    compact ? 'size-3.5' : 'size-4'
                }`}
                >
                    <MessageCircle size={compact ? 8 : 10} className="opacity-70" />
                </span>
            )}
            {showLabel ? (
                <span className={`font-medium leading-none ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                    {joined ? 'In WA group' : 'WA group?'}
                </span>
            ) : null}
        </button>
    );
}

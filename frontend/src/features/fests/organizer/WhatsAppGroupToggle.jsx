import { Check, Loader, MessageCircle } from 'lucide-react';

/**
 * Organizer tick: mark whether an entry joined the competition WhatsApp group.
 * `box` variant = tall control for the front of each participant row.
 */
export default function WhatsAppGroupToggle({
    joined = false,
    busy = false,
    onToggle,
    size = 'md',
    showLabel = true,
    variant = 'chip',
    className = '',
}) {
    const compact = size === 'sm';
    const isBox = variant === 'box';

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
                : 'Not in WhatsApp group — tap when they join'}
            aria-pressed={joined}
            aria-label={joined ? 'In WhatsApp group' : 'Mark WhatsApp group joined'}
            className={`inline-flex items-center justify-center gap-1 transition disabled:opacity-50 ${
                isBox
                    ? `flex-col shrink-0 w-[4.25rem] min-h-[4.25rem] rounded-2xl border px-1.5 py-2 ${
                        joined
                            ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                            : 'border-dashed border-white/20 bg-white/4 text-gray-400 hover:border-emerald-400/35 hover:text-emerald-200'
                    }`
                    : `rounded-xl border ${compact ? 'px-2 py-1' : 'px-2.5 py-1.5'} ${
                        joined
                            ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-300'
                            : 'border-white/10 bg-white/4 text-gray-400 hover:border-emerald-400/30 hover:text-emerald-200'
                    }`
            } ${className}`}
        >
            {busy ? (
                <Loader className="animate-spin shrink-0" size={isBox ? 18 : compact ? 12 : 14} />
            ) : joined ? (
                <span className={`inline-flex items-center justify-center rounded-full bg-emerald-500 text-black shrink-0 ${
                    isBox ? 'size-6' : compact ? 'size-3.5' : 'size-4'
                }`}
                >
                    <Check size={isBox ? 14 : compact ? 9 : 11} strokeWidth={3} />
                </span>
            ) : (
                <span className={`inline-flex items-center justify-center rounded-full border border-dashed border-gray-500 shrink-0 ${
                    isBox ? 'size-6' : compact ? 'size-3.5' : 'size-4'
                }`}
                >
                    <MessageCircle size={isBox ? 14 : compact ? 8 : 10} className="opacity-70" />
                </span>
            )}
            {showLabel ? (
                <span className={`font-semibold leading-tight text-center ${
                    isBox ? 'text-[9px] uppercase tracking-wide mt-1' : compact ? 'text-[10px]' : 'text-[11px]'
                }`}
                >
                    {joined ? (isBox ? 'In WA' : 'In WA group') : (isBox ? 'WA?' : 'WA group?')}
                </span>
            ) : null}
        </button>
    );
}

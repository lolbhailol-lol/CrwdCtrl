import { Check } from 'lucide-react';
import { CARD_SIZE_OPTIONS, getCardSizeProps } from '../../utils/homeCardSize';

function TrendingPreview({ selected }) {
    return (
        <div className={`mx-auto w-11 transition-transform ${selected ? 'scale-105' : ''}`}>
            <div className={`rounded-2xl overflow-hidden border ${selected ? 'border-[#0ECCEE]' : 'border-white/12'}`}>
                <div className="aspect-11/10 bg-linear-to-br from-indigo-500/40 to-[#0D0E10] relative">
                    <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-white/20" />
                </div>
                <div className="px-2 py-2 space-y-1 bg-[#0D0E10]">
                    <div className={`h-1.5 rounded-full w-4/5 ${selected ? 'bg-[#0ECCEE]/40' : 'bg-white/25'}`} />
                    <div className="h-1 rounded-full w-3/5 bg-white/10" />
                </div>
            </div>
        </div>
    );
}

function HeroBannerPreview({ selected }) {
    return (
        <div className={`mx-auto w-full max-w-22 transition-transform ${selected ? 'scale-105' : ''}`}>
            <div className={`rounded-xl overflow-hidden border aspect-2/1 relative ${selected ? 'border-[#0ECCEE]' : 'border-white/12'}`}>
                <div className="absolute inset-0 bg-linear-to-br from-[#0ECCEE]/30 via-purple-600/20 to-[#0D0E10]" />
                <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-1 left-1.5 right-6">
                    <div className={`h-1 rounded-full w-3/4 mb-0.5 ${selected ? 'bg-white/80' : 'bg-white/50'}`} />
                    <div className="h-0.5 rounded-full w-1/2 bg-white/30" />
                </div>
                <div className="absolute top-1 right-1 rounded-full bg-black/40 px-1 py-px text-[5px] text-white">CTA</div>
            </div>
        </div>
    );
}

function WeekendPlanPreview({ selected }) {
    return (
        <div className={`mx-auto w-19 transition-transform ${selected ? 'scale-105' : ''}`}>
            <div className={`rounded-2xl overflow-hidden border ${selected ? 'border-[#0ECCEE]' : 'border-white/12'}`}>
                <div className="aspect-10/7 bg-linear-to-br from-cyan-500/30 to-[#0D0E10] relative">
                    <div className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-white/20" />
                </div>
                <div className="px-2 py-1.5 space-y-1 bg-[#0D0E10]">
                    <div className={`h-1 rounded-full w-4/5 ${selected ? 'bg-[#0ECCEE]/40' : 'bg-white/20'}`} />
                    <div className="h-0.5 rounded-full w-1/2 bg-white/10" />
                </div>
            </div>
        </div>
    );
}

function PortraitPreview({ selected, variant }) {
    return (
        <div className={`mx-auto w-10 transition-transform ${selected ? 'scale-105' : ''}`}>
            <div className={`rounded-2xl overflow-hidden border ${selected ? 'border-[#0ECCEE]' : 'border-white/12'}`}>
                <div className={`aspect-3/4 relative ${variant === 'runclub' ? 'bg-linear-to-br from-emerald-600/40 to-[#0D0E10]' : 'bg-linear-to-br from-green-800/40 to-[#0D0E10]'}`}>
                    <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-white/20" />
                    {variant === 'runclub' && (
                        <span className="absolute inset-0 flex items-center justify-center text-sm opacity-60">🏃</span>
                    )}
                </div>
            </div>
            <div className="mt-1 space-y-0.5 px-0.5">
                <div className={`h-1 rounded-full w-full ${selected ? 'bg-[#0ECCEE]/35' : 'bg-white/20'}`} />
                <div className="h-0.5 rounded-full w-2/3 bg-white/10" />
            </div>
        </div>
    );
}

function CardPreview({ cardSize, selected }) {
    switch (cardSize) {
        case 'trending':
            return <TrendingPreview selected={selected} />;
        case 'hero':
            return <HeroBannerPreview selected={selected} />;
        case 'wide':
            return <WeekendPlanPreview selected={selected} />;
        case 'explore':
            return <PortraitPreview selected={selected} variant="community" />;
        case 'runclub':
            return <PortraitPreview selected={selected} variant="runclub" />;
        default: {
            const { tallCard, wideCard, portraitCard } = getCardSizeProps(cardSize);
            if (portraitCard) return <PortraitPreview selected={selected} variant="community" />;
            if (wideCard) return <WeekendPlanPreview selected={selected} />;
            if (tallCard) return <TrendingPreview selected={selected} />;
            return <WeekendPlanPreview selected={selected} />;
        }
    }
}

function StepLabel({ step, title, hint }) {
    return (
        <div className="flex items-start gap-3 mb-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0ECCEE]/15 text-[11px] font-bold text-[#0ECCEE] ring-1 ring-[#0ECCEE]/25">
                {step}
            </span>
            <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                {hint && <p className="text-[11px] text-gray-500 mt-0.5">{hint}</p>}
            </div>
        </div>
    );
}

export default function CardSizePicker({ value, onChange }) {
    return (
        <div className="rounded-xl border border-white/6 bg-[#0D0E10]/60 p-4">
            <StepLabel
                step={2}
                title="Card size"
                hint="Pick the same style as an existing section on the site."
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {CARD_SIZE_OPTIONS.map((option) => {
                    const selected = value === option.value;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={`group relative rounded-2xl border p-3 text-left transition-all duration-200 min-h-[140px] flex flex-col ${
                                selected
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.35)]'
                                    : 'border-white/8 bg-[#121316] hover:border-white/18 hover:bg-white/3'
                            }`}
                        >
                            {selected && (
                                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0ECCEE] text-black z-10">
                                    <Check size={12} strokeWidth={3} />
                                </span>
                            )}
                            <div className="flex-1 flex items-center justify-center py-1">
                                <CardPreview cardSize={option.value} selected={selected} />
                            </div>
                            <p className={`mt-2 text-[11px] font-bold leading-tight text-center ${selected ? 'text-[#0ECCEE]' : 'text-white'}`}>
                                {option.shortLabel}
                            </p>
                            <p className="text-[9px] text-gray-500 mt-1 leading-snug text-center line-clamp-2">
                                {option.description}
                            </p>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

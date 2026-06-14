import { Check, Home, Calendar, Mountain, Dumbbell, Theater, Palette, Cpu, Trophy } from 'lucide-react';
import { TARGET_PAGE_OPTIONS } from '../../utils/pageSections';

const PAGE_ICONS = {
    home: Home,
    fests: Calendar,
    'cultural-fest': Palette,
    'tech-fest': Cpu,
    'sports-fest': Trophy,
    treks: Mountain,
    sports: Dumbbell,
    events: Theater,
};

const PAGE_GROUPS = [
    {
        label: 'Main pages',
        pages: ['home', 'fests', 'treks', 'sports', 'events'],
    },
    {
        label: 'Fest categories',
        pages: ['cultural-fest', 'tech-fest', 'sports-fest'],
    },
];

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

function PageButton({ page, selected, onSelect }) {
    const Icon = PAGE_ICONS[page.value] || Calendar;
    return (
        <button
            type="button"
            onClick={onSelect}
            className={`group relative rounded-2xl border p-3 text-left transition-all duration-200 ${
                selected
                    ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.35)]'
                    : 'border-white/8 bg-[#121316] hover:border-white/18 hover:bg-white/3'
            }`}
        >
            {selected && (
                <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#0ECCEE] text-black">
                    <Check size={12} strokeWidth={3} />
                </span>
            )}
            <span
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition-colors ${
                    selected ? 'bg-[#0ECCEE]/20 text-[#0ECCEE]' : 'bg-white/5 text-gray-400 group-hover:text-gray-300'
                }`}
            >
                <Icon size={18} />
            </span>
            <p className={`mt-2.5 text-xs font-bold leading-tight ${selected ? 'text-[#0ECCEE]' : 'text-white'}`}>
                {page.label}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5 font-mono">{page.route}</p>
        </button>
    );
}

export default function TargetPagePicker({ value, onChange }) {
    const pageMap = Object.fromEntries(TARGET_PAGE_OPTIONS.map((p) => [p.value, p]));

    return (
        <div className="rounded-xl border border-white/6 bg-[#0D0E10]/60 p-4">
            <StepLabel
                step={3}
                title="Target page"
                hint="Where visitors will see this scrolling section."
            />
            <div className="space-y-4">
                {PAGE_GROUPS.map((group) => (
                    <div key={group.label}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-600 mb-2 px-0.5">
                            {group.label}
                        </p>
                        <div className={`grid gap-2.5 ${
                            group.pages.length === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                        }`}>
                            {group.pages.map((pageKey) => {
                                const page = pageMap[pageKey];
                                if (!page) return null;
                                return (
                                    <PageButton
                                        key={page.value}
                                        page={page}
                                        selected={value === page.value}
                                        onSelect={() => onChange(page.value)}
                                    />
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

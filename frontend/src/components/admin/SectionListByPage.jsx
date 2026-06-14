import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle, ArrowRight, Check, ExternalLink, Eye, EyeOff,
    GripVertical, Layers, Loader2, Trash2,
} from 'lucide-react';
import { getCardSizeProps, getCardSizeShortLabel } from '../../utils/homeCardSize';
import { TARGET_PAGE_OPTIONS, groupSectionsByPage } from '../../utils/pageSections';
import { buildPageCarouselItems } from '../../utils/homeCarouselItems';

const PAGE_TAB_ICONS = {
    home: '🏠',
    fests: '🎪',
    'cultural-fest': '🎭',
    'tech-fest': '💻',
    'sports-fest': '⚽',
    treks: '🏔️',
    sports: '🏃',
    events: '🎬',
};

function SaveDot({ state }) {
    if (state === 'saving') return <Loader2 size={11} className="animate-spin text-[#0ECCEE] shrink-0" />;
    if (state === 'saved') return <Check size={11} className="text-emerald-400 shrink-0" />;
    if (state === 'error') return <AlertCircle size={11} className="text-red-400 shrink-0" />;
    return null;
}

function MiniCardPreview({ cardSize }) {
    const { tallCard, wideCard, miniCard, portraitCard, heroCard } = getCardSizeProps(cardSize);
    const w = portraitCard ? 'w-7' : heroCard || wideCard ? 'w-10' : miniCard ? 'w-8' : tallCard ? 'w-8' : 'w-9';
    const aspect = portraitCard ? 'aspect-3/4' : heroCard ? 'aspect-2/1' : tallCard && !wideCard ? 'aspect-11/10' : wideCard ? 'aspect-10/7' : 'aspect-4/3';
    return (
        <div className={`${w} rounded-md overflow-hidden border border-white/10 bg-[#0D0E10] shrink-0`}>
            <div className={`${aspect} bg-linear-to-br from-[#0ECCEE]/25 to-white/5`} />
        </div>
    );
}

function useDragDrop(items, onReorder) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [overIndex, setOverIndex] = useState(null);

    return {
        draggedIndex,
        overIndex,
        setOverIndex,
        handleDragStart: (e, index) => {
            setDraggedIndex(index);
            e.dataTransfer.effectAllowed = 'move';
        },
        handleDragOver: (e) => e.preventDefault(),
        handleDrop: (e, index) => {
            e.preventDefault();
            if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
            setDraggedIndex(null);
            setOverIndex(null);
        },
        handleDragEnd: () => {
            setDraggedIndex(null);
            setOverIndex(null);
        },
    };
}

function getAssignTab(targetPage) {
    if (targetPage === 'home') return 'fests';
    if (targetPage === 'treks') return 'treks';
    if (targetPage === 'sports') return 'runs';
    return 'fests';
}

export default function SectionListByPage({
    sections,
    fests,
    treks,
    comms,
    sports,
    runClubs,
    saving,
    onUpdate,
    onTitleDraft,
    onDelete,
    onReorder,
}) {
    const grouped = groupSectionsByPage(sections);
    const pagesWithSections = useMemo(
        () => TARGET_PAGE_OPTIONS.filter((p) => (grouped[p.value] || []).length > 0),
        [grouped],
    );
    const [openPage, setOpenPage] = useState(pagesWithSections[0]?.value || 'home');

    const activePage = pagesWithSections.some((p) => p.value === openPage)
        ? openPage
        : (pagesWithSections[0]?.value || 'home');

    const pageSections = (grouped[activePage] || [])
        .slice()
        .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
    const dnd = useDragDrop(pageSections, (from, to) => onReorder(activePage, from, to));

    if (!sections.length) {
        return (
            <div className="rounded-2xl border border-dashed border-white/12 bg-[#121316]/80 px-6 py-14 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-2xl">
                    <Layers size={24} className="text-gray-500" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No sections yet</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                    Use the wizard above to create your first scrolling section. Then assign cards in Home &amp; Sections.
                </p>
            </div>
        );
    }

    const totalCards = sections.reduce((sum, section) => {
        const count = buildPageCarouselItems(
            fests, treks, comms, section.targetPage || 'home', section.slug, sports, runClubs,
        ).length;
        return sum + count;
    }, 0);

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                    <h2 className="text-base font-bold text-white">Your sections</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {sections.length} section{sections.length !== 1 ? 's' : ''} · {totalCards} assigned card{totalCards !== 1 ? 's' : ''}
                    </p>
                </div>
                <Link
                    to="/admin/sections"
                    className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-[#0ECCEE] hover:text-[#5ee0f7]"
                >
                    Open content manager <ArrowRight size={13} />
                </Link>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {pagesWithSections.map((page) => {
                    const count = (grouped[page.value] || []).length;
                    const active = activePage === page.value;
                    return (
                        <button
                            key={page.value}
                            type="button"
                            onClick={() => setOpenPage(page.value)}
                            className={`flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all ${
                                active
                                    ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/15 text-[#0ECCEE]'
                                    : 'border-white/8 bg-[#121316] text-gray-400 hover:border-white/15 hover:text-white'
                            }`}
                        >
                            <span>{PAGE_TAB_ICONS[page.value] || '📄'}</span>
                            {page.label}
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? 'bg-black/20' : 'bg-white/8'}`}>
                                {count}
                            </span>
                        </button>
                    );
                })}
            </div>

            <div className="space-y-2.5">
                {pageSections.map((section, index) => {
                    const items = buildPageCarouselItems(
                        fests, treks, comms, section.targetPage || 'home', section.slug, sports, runClubs,
                    );
                    const isDragging = dnd.draggedIndex === index;
                    const isOver = dnd.overIndex === index && dnd.draggedIndex !== index;
                    const pageOpt = TARGET_PAGE_OPTIONS.find((p) => p.value === section.targetPage);
                    const isHidden = section.enabled === false;
                    const needsContent = items.length === 0;

                    return (
                        <div
                            key={section._id}
                            draggable
                            onDragStart={(e) => dnd.handleDragStart(e, index)}
                            onDragOver={dnd.handleDragOver}
                            onDragEnter={() => dnd.setOverIndex(index)}
                            onDragLeave={() => dnd.setOverIndex(null)}
                            onDrop={(e) => dnd.handleDrop(e, index)}
                            onDragEnd={dnd.handleDragEnd}
                            className={`rounded-2xl border transition-all duration-200 ${
                                isOver
                                    ? 'border-[#0ECCEE]/50 bg-[#0ECCEE]/8 scale-[1.01]'
                                    : 'border-white/8 bg-[#121316]'
                            } ${isDragging ? 'opacity-40' : ''} ${isHidden ? 'opacity-60' : ''}`}
                        >
                            <div className="flex items-stretch gap-0">
                                <div className={`w-1 shrink-0 rounded-l-2xl ${isHidden ? 'bg-gray-600' : 'bg-[#0ECCEE]'}`} />
                                <div className="flex flex-1 items-start gap-3 p-4 min-w-0">
                                    <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                                        <GripVertical size={14} className="text-gray-600 cursor-grab active:cursor-grabbing" />
                                        <span className="text-[10px] font-bold text-gray-600">#{index + 1}</span>
                                    </div>

                                    <MiniCardPreview cardSize={section.cardSize} />

                                    <div className="flex-1 min-w-0 space-y-2.5">
                                        <input
                                            value={section.title}
                                            onChange={(e) => onTitleDraft(section._id, e.target.value)}
                                            onBlur={() => {
                                                if (section.title?.trim()) onUpdate(section._id, { title: section.title.trim() });
                                            }}
                                            className="w-full bg-transparent text-sm font-bold text-white focus:outline-none border-b border-transparent focus:border-[#0ECCEE]/40 pb-0.5"
                                        />

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-medium text-gray-300">
                                                {getCardSizeShortLabel(section.cardSize)}
                                            </span>
                                            <span className={`text-[10px] font-medium ${needsContent ? 'text-amber-400/90' : 'text-gray-500'}`}>
                                                {items.length} card{items.length !== 1 ? 's' : ''}
                                                {needsContent ? ' · needs content' : ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => onUpdate(section._id, { enabled: !section.enabled })}
                                                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${
                                                    isHidden
                                                        ? 'bg-gray-700/40 text-gray-400 hover:bg-gray-700/60'
                                                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                                }`}
                                            >
                                                {isHidden ? <EyeOff size={10} /> : <Eye size={10} />}
                                                {isHidden ? 'Hidden' : 'Live'}
                                            </button>
                                            <SaveDot state={saving[`section-${section._id}`]} />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Link
                                                to={`/admin/sections?mode=assign&tab=${getAssignTab(section.targetPage)}`}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0ECCEE] px-3 py-1.5 text-[10px] font-bold text-black hover:bg-[#3dd8f5] transition-colors"
                                            >
                                                Assign content <ArrowRight size={11} />
                                            </Link>
                                            {pageOpt?.route && (
                                                <a
                                                    href={pageOpt.route}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-medium text-gray-400 hover:border-white/20 hover:text-white transition-colors"
                                                >
                                                    <ExternalLink size={11} /> Preview
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => onDelete(section._id)}
                                        className="rounded-xl p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-colors shrink-0"
                                        title="Delete section"
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

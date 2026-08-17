import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, ExternalLink, GripVertical, LayoutGrid, Layers, Loader2, RefreshCw, Search, Flag, Mountain, Users, Dumbbell, Footprints, Theater } from 'lucide-react';
import { buildHomeCarouselItems, normalizeHomeCarouselItem } from '../../utils/homeCarouselItems';
import { getCardSizeLabel } from '../../utils/homeCardSize';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import {
    getTargetPageLabel,
    getCustomPageAssignmentKeys,
    toggleCustomPageAssignment,
    getHomeAssignmentSlugs,
    applyHomeAssignmentSlugs,
    isOnHomeHero,
} from '../../utils/pageSections';
import { EVENTS_PAGE_CHECK_OPTS } from '../../constants/eventsPage';
import { adminFetch, adminFetchJSON } from '../../services/api/admin.api.js';
import { notifyAdminDataUpdated } from '../../utils/notifyAdminDataUpdated';

// ── Section options ────────────────────────────────────────────────────────────
const HOME_CHECK_OPTS = [
    { value: 'trending', label: 'Ongoing Events' },
    { value: 'happening', label: 'Happening Near You' },
];
const FEST_PAGE_OPTS = [
    { value: 'ongoing', label: '⭐ Featured' },
    { value: 'upcoming', label: '📋 Listed' },
    { value: 'beyondcampus', label: '🌍 Beyond Campus' },
    { value: 'lastyearhit', label: '🏆 Last Year Hit' },
    { value: 'completed', label: '✅ Completed' },
];
const TREK_PAGE_CHECK_OPTS = [
    { value: 'hero', label: 'Coming Soon' },
    { value: 'weekend', label: 'Weekend Plans' },
    { value: 'beginner', label: 'Beginner Friendly' },
];
const COMM_PAGE_CHECK_OPTS = [
    { value: 'communities', label: 'Explore Communities' },
    { value: 'comingSoon', label: 'Coming Soon' },
];
const RUN_CLUB_PAGE_OPTS = [
    { value: 'run_clubs', label: '👟 Explore Run Clubs' },
    { value: 'hidden', label: '🚫 Hidden' },
];
const RUN_PAGE_OPTS = [
    { value: 'upcoming', label: '🏃 Upcoming Activities' },
    { value: 'hidden', label: '🚫 Hidden from Page' },
];

const FEST_CUSTOM_PAGES = ['fests', 'cultural-fest', 'tech-fest', 'sports-fest', 'events'];
const TREK_CUSTOM_PAGES = ['treks', 'events'];
const SPORTS_CUSTOM_PAGES = ['sports', 'events'];
const EVENTS_CUSTOM_PAGES = ['events'];

function parseCustomPageValue(val) {
    if (!val || !val.includes(':')) return null;
    const [page, ...rest] = val.split(':');
    return { page, sectionSlug: rest.join(':') };
}

function buildCustomPageCheckOpts(sections, pages) {
    return (sections || [])
        .filter((s) => s.enabled !== false && pages.includes(s.targetPage || 'home'))
        .map((s) => ({
            value: `${s.targetPage}:${s.slug}`,
            label: `${getTargetPageLabel(s.targetPage)} — ${s.title}`,
        }));
}

function buildHomeCheckOpts(customSections) {
    const custom = (customSections || [])
        .filter((s) => s.enabled !== false && (s.targetPage || 'home') === 'home')
        .map((s) => ({ value: s.slug, label: `✨ ${s.title}` }));
    return [...HOME_CHECK_OPTS, ...custom];
}

function getTrekPageChecks(featured) {
    if (featured === 'both') return ['hero', 'weekend'];
    if (featured === 'hero' || featured === 'weekend' || featured === 'beginner') return [featured];
    return [];
}

function toTrekFeaturedSection(checks) {
    const set = new Set(checks || []);
    const hasH = set.has('hero');
    const hasW = set.has('weekend');
    const hasB = set.has('beginner');
    if (hasB && !hasH && !hasW) return 'beginner';
    if (hasH && hasW) return 'both';
    if (hasH) return 'hero';
    if (hasW) return 'weekend';
    if (hasB) return 'beginner';
    return null;
}

function getCommPageChecks(c) {
    if (c.showOnTreks === false) return [];
    const sec = c.trekPageSection || 'communities';
    if (sec === 'both') return ['communities', 'comingSoon'];
    if (sec === 'comingSoon') return ['comingSoon'];
    return ['communities'];
}

function toCommPageSection(checks) {
    const set = new Set(checks || []);
    if (set.has('communities') && set.has('comingSoon')) return 'both';
    if (set.has('comingSoon')) return 'comingSoon';
    if (set.has('communities')) return 'communities';
    return null;
}

// ── Shared UI helpers ──────────────────────────────────────────────────────────
const sel = 'flex-1 min-w-0 bg-transparent text-white text-xs focus:outline-none cursor-pointer';
const opt = 'bg-[#0D0E10] text-white';

function SaveDot({ state }) {
    if (state === 'saving') return <Loader2 size={11} className="animate-spin text-[#0ECCEE] shrink-0" />;
    if (state === 'saved')  return <Check    size={11} className="text-emerald-400 shrink-0" />;
    if (state === 'error')  return <AlertCircle size={11} className="text-red-400 shrink-0" />;
    return <span className="w-3 shrink-0" />;
}

/** Multi-select checkboxes — one item can sit in many sections. */
function AssignCheckGroup({ label, options, selected = [], onToggle, saveKey, saving, emptyHint }) {
    const selectedSet = useMemo(() => new Set(selected), [selected]);
    const count = selected.filter(Boolean).length;
    return (
        <div className={`rounded-xl border px-2.5 py-2 min-w-[11rem] max-w-[16rem] ${
            count > 0 ? 'bg-[#0ECCEE]/8 border-[#0ECCEE]/30 shadow-[inset_0_0_0_1px_rgba(14,204,238,0.08)]' : 'bg-[#0D0E10] border-white/8'
        }`}>
            <div className="flex items-center justify-between gap-2 mb-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</p>
                <div className="flex items-center gap-1.5">
                    {count > 0 && (
                        <span className="text-[9px] font-bold text-[#0ECCEE]/80 bg-[#0ECCEE]/10 px-1.5 py-0.5 rounded-full">
                            {count}
                        </span>
                    )}
                    <SaveDot state={saving?.[saveKey]} />
                </div>
            </div>
            {!options.length ? (
                <div className="text-[10px] text-gray-600 leading-snug">{emptyHint || 'No sections yet'}</div>
            ) : (
                <div className="space-y-0.5 max-h-36 overflow-y-auto pr-0.5">
                    {options.map((o) => {
                        const checked = selectedSet.has(o.value);
                        return (
                            <label
                                key={o.value}
                                className={`flex items-start gap-2 cursor-pointer rounded-lg px-1.5 py-1.5 transition-colors ${
                                    checked ? 'bg-[#0ECCEE]/10' : 'hover:bg-white/5'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) => onToggle(o.value, e.target.checked)}
                                    className="mt-0.5 rounded border-gray-600 text-[#0ECCEE] focus:ring-[#0ECCEE]/40"
                                />
                                <span className={`text-[11px] leading-snug ${checked ? 'text-[#0ECCEE] font-medium' : 'text-gray-400'}`}>
                                    {o.label}
                                </span>
                            </label>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function MetaChip({ children, tone = 'neutral' }) {
    const tones = {
        neutral: 'bg-white/5 text-gray-400 border-white/10',
        sky: 'bg-sky-500/15 text-sky-300 border-sky-500/25',
        emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
        amber: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    };
    return (
        <span className={`inline-flex items-center gap-1 max-w-full truncate text-[10px] font-semibold px-2 py-0.5 rounded-full border ${tones[tone] || tones.neutral}`}>
            {children}
        </span>
    );
}

/** Shared assign-mode row shell */
function AssignEntityRow({ children, className = '' }) {
    return (
        <div className={`flex items-start gap-3 px-3.5 py-3 mx-2 my-1.5 rounded-xl border border-white/6 bg-[#121314] hover:border-white/12 hover:bg-[#151618] transition-colors flex-wrap ${className}`}>
            {children}
        </div>
    );
}

/* Single-select — status / hide fields only */
function AssignPill({ selectValue, selectOpts, onSelect, saveKey, saving }) {
    const isSet = selectValue && selectValue !== '';
    return (
        <div className={`flex items-center gap-1.5 rounded-xl px-2 py-2 border transition-colors min-w-44 ${isSet ? 'bg-[#0ECCEE]/5 border-[#0ECCEE]/25' : 'bg-[#0D0E10] border-white/8'}`}>
            <select value={selectValue} onChange={(e) => onSelect(e.target.value)}
                className={`${sel} ${isSet ? 'text-[#0ECCEE]' : 'text-gray-400'}`}>
                {selectOpts.map((o) => <option key={o.value} value={o.value} className={opt}>{o.label}</option>)}
            </select>
            <SaveDot state={saving[saveKey]} />
        </div>
    );
}

// ── Editable home carousel headings ─────────────────────────────────────────────
const HOME_HEADING_FIELDS = [
    { key: 'ongoing',   label: 'Ongoing Events section',     placeholder: 'Ongoing Events' },
    { key: 'happening', label: 'Happening Near You section', placeholder: 'Happening near you' },
];

function HomeHeadingsEditor() {
    const [labels, setLabels] = useState({});
    const [initial, setInitial] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        (async () => {
            try {
                const data = await adminFetchJSON('/admin/site-settings/home-section-labels');
                if (!active) return;
                const l = data?.labels || {};
                setLabels(l);
                setInitial(l);
            } catch (_) {
                if (active) setError('Could not load headings');
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => { active = false; };
    }, []);

    const update = (k, v) => { setLabels((p) => ({ ...p, [k]: v })); setSaved(false); };
    const dirty = HOME_HEADING_FIELDS.some((f) => (labels[f.key] || '') !== (initial[f.key] || ''));

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = {};
            HOME_HEADING_FIELDS.forEach((f) => {
                payload[f.key] = (labels[f.key] || '').trim() || f.placeholder;
            });
            const data = await adminFetchJSON('/admin/site-settings/home-section-labels', {
                method: 'PUT',
                body: JSON.stringify({ labels: payload }),
            });
            const l = data?.labels || payload;
            setLabels(l);
            setInitial(l);
            setSaved(true);
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(err.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-white/8 bg-[#17181A] px-5 py-4">
            <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                    <h2 className="text-sm font-bold text-white">Home Section Headings</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Rename the fixed carousels shown on the home page</p>
                </div>
                <button
                    type="button"
                    onClick={save}
                    disabled={saving || loading || !dirty}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0ECCEE] hover:bg-[#3dd8f5] rounded-xl text-xs font-bold text-black transition-colors disabled:opacity-40"
                >
                    {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
                    {saving ? 'Saving' : saved ? 'Saved' : 'Save'}
                </button>
            </div>
            {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
                {HOME_HEADING_FIELDS.map((f) => (
                    <div key={f.key}>
                        <label className="block text-xs text-gray-400 mb-1">{f.label}</label>
                        <input
                            type="text"
                            value={labels[f.key] ?? ''}
                            onChange={(e) => update(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            disabled={loading}
                            className="w-full bg-[#0D0E10] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ECCEE] disabled:opacity-50"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}

const MODES = [
    {
        id: 'reorder',
        label: 'Card order',
        description: 'Drag cards left-to-right within each carousel on the website',
        icon: GripVertical,
    },
    {
        id: 'assign',
        label: 'Assign cards',
        description: 'Choose which home page and page sections each item appears in',
        icon: Layers,
    },
];

const REORDER_TABS = [
    { id: 'home', label: 'Home', icon: LayoutGrid },
    { id: 'fests', label: 'Fests', icon: Flag },
    { id: 'treks', label: 'Treks', icon: Mountain },
    { id: 'sports', label: 'Sports', icon: Dumbbell },
    { id: 'events', label: 'Events', icon: Theater },
];

const ASSIGN_TABS = [
    { id: 'fests', label: 'Fests', icon: Flag },
    { id: 'treks', label: 'Treks', icon: Mountain },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'runclubs', label: 'Run Clubs', icon: Footprints },
    { id: 'runs', label: 'Runs', icon: Dumbbell },
    { id: 'events', label: 'Events', icon: Theater },
];

function ModeSwitcher({ mode, onChange }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {MODES.map((m) => {
                const active = mode === m.id;
                const Icon = m.icon;
                return (
                    <button
                        key={m.id}
                        type="button"
                        onClick={() => onChange(m.id)}
                        className={`rounded-2xl border px-4 py-4 text-left transition-all ${
                            active
                                ? 'border-[#0ECCEE]/40 bg-[#0ECCEE]/10 ring-1 ring-[#0ECCEE]/30'
                                : 'border-white/8 bg-[#17181A] hover:border-white/15 hover:bg-white/2'
                        }`}
                    >
                        <div className="flex items-start gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-[#0ECCEE]/20 text-[#0ECCEE]' : 'bg-white/5 text-gray-500'}`}>
                                <Icon size={18} />
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-bold ${active ? 'text-white' : 'text-gray-300'}`}>{m.label}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{m.description}</p>
                            </div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

function PreviewLink({ type, id }) {
    const url = PREVIEW_URL[type]?.(id);
    if (!url) return null;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" title="Preview on site"
            className="shrink-0 p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-[#0ECCEE] hover:border-[#0ECCEE]/30 transition-colors">
            <ExternalLink size={12} />
        </a>
    );
}

function Thumb({ src, icon }) {
    return (
        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 bg-[#1A1B1D] flex items-center justify-center">
            {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : icon ? createElement(icon, { size: 16, className: 'text-gray-600' }) : null}
        </div>
    );
}

function EmptyState({ label }) {
    return (
        <div className="flex items-center justify-center py-16 text-sm text-gray-600">{label}</div>
    );
}

const PREVIEW_URL = {
    fest: (id) => `/view-details/${id}`,
    trek: (id) => `/trek/${id}`,
    community: (id) => `/treks/community/${id}`,
    sport: (id) => `/sports/run/${id}`,
    runclub: (id) => `/sports/run-club/${id}`,
    events: () => '/events',
};

const FEST_PAGE_SECTIONS = [
    { key: 'ongoing', label: '⭐ Featured (Ongoing)' },
    { key: 'upcoming', label: '📋 Listed (Upcoming)' },
    { key: 'beyondcampus', label: '🌍 Beyond Campus' },
    { key: 'lastyearhit', label: '🏆 Last Year Hit' },
];

const TREK_PAGE_SECTIONS = [
    { key: 'hero', label: '🎬 Coming Soon' },
    { key: 'weekend', label: '🏕️ Weekend Plans' },
    { key: 'beginner', label: '🌿 Beginner Friendly' },
];

/** Trek communities on /treks — separate from individual trek carousels */
const TREK_COMMUNITY_PAGE_SECTIONS = [
    { key: 'communities', label: '🧭 Explore Communities' },
    { key: 'comingSoon', label: '✨ Coming Soon (Communities)' },
];

const EVENTS_PAGE_SECTIONS = [
    { key: 'hero', label: '🎬 Hero Banner' },
    { key: 'spotlight', label: '✨ In the Spotlight' },
    { key: 'upcoming', label: '🎭 Upcoming Shows' },
    { key: 'community', label: '🤝 Community Events' },
];

const TYPE_BADGE = {
    fest: { label: 'Fest', cls: 'bg-violet-500/20 text-violet-300' },
    trek: { label: 'Trek', cls: 'bg-emerald-500/20 text-emerald-300' },
    community: { label: 'Community', cls: 'bg-sky-500/20 text-sky-300' },
    sport: { label: 'Sport', cls: 'bg-orange-500/20 text-orange-300' },
    runclub: { label: 'Run Club', cls: 'bg-cyan-500/20 text-cyan-300' },
    events: { label: 'Event', cls: 'bg-fuchsia-500/20 text-fuchsia-300' },
};

function useCarouselDragDrop(items, onReorder) {
    const [draggedIndex, setDraggedIndex] = useState(null);
    const [overIndex, setOverIndex] = useState(null);

    const handleDragStart = (e, index) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };

    const handleDragOver = (e) => e.preventDefault();

    const handleDrop = (e, index) => {
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
        setDraggedIndex(null);
        setOverIndex(null);
    };

    return { draggedIndex, overIndex, setOverIndex, handleDragStart, handleDragOver, handleDrop, handleDragEnd: () => { setDraggedIndex(null); setOverIndex(null); } };
}

function HomeCarouselPanel({ title, subtitle, items, onReorder, isReordering }) {
    const dnd = useCarouselDragDrop(items, onReorder);

    return (
        <div className="rounded-2xl border border-white/8 bg-[#121316] overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                <h2 className="text-sm font-bold text-white">{title}</h2>
                <p className="text-[11px] text-gray-500 mt-0.5">{subtitle} · {items.length} card{items.length !== 1 ? 's' : ''}</p>
            </div>
            {items.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-gray-600">No cards assigned — use the tabs below to add items</div>
            ) : (
                <div className="divide-y divide-white/4 max-h-[320px] overflow-y-auto">
                    {items.map((item, index) => {
                        const badge = TYPE_BADGE[item._type];
                        const isDragging = dnd.draggedIndex === index;
                        const isOver = dnd.overIndex === index && dnd.draggedIndex !== index;
                        return (
                            <div
                                key={`${item._type}-${item._id}`}
                                draggable={!isReordering}
                                onDragStart={(e) => dnd.handleDragStart(e, index)}
                                onDragOver={dnd.handleDragOver}
                                onDragEnter={() => dnd.setOverIndex(index)}
                                onDragLeave={() => dnd.setOverIndex(null)}
                                onDrop={(e) => dnd.handleDrop(e, index)}
                                onDragEnd={dnd.handleDragEnd}
                                className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${isDragging ? 'opacity-40' : ''} ${isOver ? 'bg-[#0ECCEE]/8' : 'hover:bg-white/2'}`}
                            >
                                <div className="flex items-center gap-2 shrink-0 w-14">
                                    <GripVertical size={14} className="text-gray-600 cursor-grab active:cursor-grabbing" />
                                    <span className="w-6 h-6 rounded-lg bg-[#0ECCEE]/15 text-[#0ECCEE] text-[11px] font-bold flex items-center justify-center">
                                        {index + 1}
                                    </span>
                                </div>
                                <Thumb src={item._image} icon={item._type === 'fest' ? Flag : item._type === 'trek' ? Mountain : item._type === 'sport' ? Dumbbell : Users} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{item._title}</p>
                                    <p className="text-[11px] text-gray-600 truncate">{item._subtitle || '—'}</p>
                                </div>
                                <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                                <span className="shrink-0 text-[10px] text-gray-500 w-8 text-right" title="Home priority">P{item._priority !== 999 ? item._priority : '—'}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SectionManager() {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialMode = searchParams.get('mode') === 'assign' ? 'assign' : 'reorder';
    const initialTab = searchParams.get('tab');
    const [mode, setMode] = useState(initialMode);
    const [tab, setTab] = useState(() => {
        const tabs = initialMode === 'assign' ? ASSIGN_TABS : REORDER_TABS;
        if (initialTab && tabs.some((t) => t.id === initialTab)) return initialTab;
        return initialMode === 'assign' ? 'fests' : 'home';
    });
    const [fests, setFests]     = useState([]);
    const [treks, setTreks]     = useState([]);
    const [comms, setComms]     = useState([]);
    const [sports, setSports]   = useState([]);
    const [runClubs, setRunClubs] = useState([]);
    const [eventShows, setEventShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors]   = useState({});
    const [saving, setSaving]   = useState({});
    const [search, setSearch]   = useState('');
    const [reordering, setReordering] = useState(false);
    const [customSections, setCustomSections] = useState([]);

    const communityById = useMemo(() => {
        const map = new Map();
        for (const c of comms) {
            if (c?._id) map.set(String(c._id), c);
            if (c?.id) map.set(String(c.id), c);
        }
        return map;
    }, [comms]);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true); setErrors({});

        const safe = async (path, label) => {
            try {
                return await adminFetchJSON(path);
            } catch (e) {
                setErrors((prev) => ({ ...prev, [label]: e.message }));
                return null;
            }
        };

        const [fd, td, cd, sd, rcd, thd, sectionData] = await Promise.all([
            safe('/admin/fests?limit=500', 'fests'),
            safe('/admin/treks?limit=500', 'treks'),
            safe('/admin/trek-communities?limit=500', 'communities'),
            safe('/admin/sports?limit=500', 'sports'),
            safe('/admin/run-clubs?limit=500', 'runclubs'),
            safe('/admin/events?limit=500', 'events'),
            safe('/admin/homepage-sections', 'sections'),
        ]);
        if (fd) setFests(Array.isArray(fd.fests)       ? fd.fests       : []);
        if (td) setTreks(Array.isArray(td.treks)       ? td.treks       : []);
        if (cd) setComms(Array.isArray(cd.communities) ? cd.communities : []);
        if (sd) setSports(Array.isArray(sd.events)     ? sd.events      : []);
        if (rcd) setRunClubs(Array.isArray(rcd.clubs) ? rcd.clubs : []);
        if (thd) setEventShows(Array.isArray(thd.shows) ? thd.shows : []);
        if (sectionData) setCustomSections(Array.isArray(sectionData.sections) ? sectionData.sections : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Pick up newly created Page Sections without a full manual refresh
    const refreshCustomSections = useCallback(() => {
        adminFetchJSON('/admin/homepage-sections')
            .then((sectionData) => {
                if (sectionData) setCustomSections(Array.isArray(sectionData.sections) ? sectionData.sections : []);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const onStorage = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) fetchAll();
        };
        const onAdminUpdated = () => refreshCustomSections();
        const onFocus = () => refreshCustomSections();
        const onVisibility = () => {
            if (document.visibilityState === 'visible') refreshCustomSections();
        };
        window.addEventListener('storage', onStorage);
        window.addEventListener('admin_data_updated', onAdminUpdated);
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('admin_data_updated', onAdminUpdated);
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [fetchAll, refreshCustomSections]);

    const syncUrl = useCallback((nextMode, nextTab) => {
        setSearchParams({ mode: nextMode, tab: nextTab }, { replace: true });
    }, [setSearchParams]);

    const handleModeChange = useCallback((nextMode) => {
        setMode(nextMode);
        setSearch('');
        if (nextMode === 'assign') refreshCustomSections();
        const tabs = nextMode === 'assign' ? ASSIGN_TABS : REORDER_TABS;
        setTab((prev) => {
            const nextTab = tabs.some((t) => t.id === prev)
                ? prev
                : (nextMode === 'assign' ? 'fests' : 'home');
            syncUrl(nextMode, nextTab);
            return nextTab;
        });
    }, [syncUrl, refreshCustomSections]);

    const handleTabChange = useCallback((nextTab) => {
        setTab(nextTab);
        setSearch('');
        syncUrl(mode, nextTab);
    }, [mode, syncUrl]);

    // ── Save helpers ─────────────────────────────────────────────────────────
    const flash = useCallback((key) => {
        setSaving(s => ({ ...s, [key]: 'saved' }));
        setTimeout(() => setSaving(s => { const n = { ...s }; delete n[key]; return n; }), 1400);
    }, []);

    const patch = useCallback(async (url, key, body, applyLocal) => {
        setSaving(s => ({ ...s, [key]: 'saving' }));
        try {
            await adminFetch(url, { method: 'PUT', body: JSON.stringify(body) });
            applyLocal?.();
            flash(key);
            // Clear server-side cache so the public site reflects the change instantly
            try { await adminFetch('/admin/clear-cache', { method: 'POST' }); } catch (_) { /* non-fatal */ }
            notifyAdminDataUpdated();
        } catch (e) {
            setSaving(s => ({ ...s, [key]: 'error' }));
            setErrors(prev => ({ ...prev, save: e.message }));
        }
    }, [flash]);

    const saveFest = useCallback((id, fields) => {
        const fid = id;
        Object.entries(fields).forEach(([k, v]) => {
            patch(`/admin/fests/${fid}`, `fest-${fid}-${k}`, { [k]: v },
                () => setFests(prev => prev.map(f => (f._id === fid || f.id === fid) ? { ...f, [k]: v } : f)));
        });
    }, [patch]);

    const patchCustomSections = useCallback((entityType, id, body, saveSuffix = 'custom') => {
        if (entityType === 'fest') {
            patch(`/admin/fests/${id}`, `fest-${id}-${saveSuffix}`, body,
                () => setFests((prev) => prev.map((f) => ((f._id || f.id) === id ? { ...f, ...body } : f))));
        } else if (entityType === 'trek') {
            patch(`/admin/treks/${id}`, `trek-${id}-${saveSuffix}`, body,
                () => setTreks((prev) => prev.map((t) => (t._id === id ? { ...t, ...body } : t))));
        } else if (entityType === 'community') {
            patch(`/admin/trek-communities/${id}`, `comm-${id}-${saveSuffix}`, body,
                () => setComms((prev) => prev.map((c) => (c._id === id ? { ...c, ...body } : c))));
        } else if (entityType === 'sport') {
            patch(`/admin/sports/${id}`, `sports-${id}-${saveSuffix}`, body,
                () => setSports((prev) => prev.map((s) => (s._id === id ? { ...s, ...body } : s))));
        } else if (entityType === 'runclub') {
            patch(`/admin/run-clubs/${id}`, `runclub-${id}-${saveSuffix}`, body,
                () => setRunClubs((prev) => prev.map((c) => (c._id === id ? { ...c, ...body } : c))));
        } else if (entityType === 'events') {
            patch(`/admin/events/${id}`, `events-${id}-${saveSuffix}`, body,
                () => setEventShows((prev) => prev.map((s) => (s._id === id ? { ...s, ...body } : s))));
        }
    }, [patch]);

    const saveEntityHomeMulti = useCallback((entityType, id, entity, slug, checked) => {
        const current = new Set(getHomeAssignmentSlugs(entity));
        if (isOnHomeHero(entity)) current.add('movingSlide');
        if (slug === 'movingSlide') {
            const withoutSlide = [...current].filter((s) => s !== 'movingSlide');
            const fields = applyHomeAssignmentSlugs(entity, withoutSlide, { showOnHomeSlide: checked });
            patchCustomSections(entityType, id, fields, 'home');
            return;
        }
        if (checked) current.add(slug);
        else current.delete(slug);
        const slide = current.has('movingSlide');
        const slugs = [...current].filter((s) => s !== 'movingSlide');
        const fields = applyHomeAssignmentSlugs(entity, slugs, { showOnHomeSlide: slide });
        patchCustomSections(entityType, id, fields, 'home');
    }, [patchCustomSections]);

    const saveEntityCustomToggle = useCallback((entityType, id, entity, pages, key, checked, priorityField) => {
        const parsed = parseCustomPageValue(key);
        if (!parsed || !pages.includes(parsed.page)) return;
        const priority = priorityField ? (entity[priorityField] ?? 999) : 999;
        const next = toggleCustomPageAssignment(entity, parsed.page, parsed.sectionSlug, checked, priority);
        patchCustomSections(entityType, id, { customPageSections: next }, 'custom');
    }, [patchCustomSections]);

    const homeSelected = (entity) => {
        const slugs = getHomeAssignmentSlugs(entity);
        if (isOnHomeHero(entity)) return [...slugs, 'movingSlide'];
        return slugs;
    };

    const saveTrek = useCallback((id, fields) => {
        patch(`/admin/treks/${id}`, `trek-${id}-${Object.keys(fields)[0]}`, fields,
            () => setTreks(prev => prev.map(t => t._id === id ? { ...t, ...fields } : t)));
    }, [patch]);

    const saveComm = useCallback((id, fields) => {
        const body = fields.pageSection === 'hidden'
            ? { showOnTreks: false }
            : fields.pageSection
                ? { showOnTreks: true, trekPageSection: fields.pageSection }
                : fields;
        patch(`/admin/trek-communities/${id}`, `comm-${id}-${Object.keys(fields)[0]}`, body,
            () => setComms(prev => prev.map(c => c._id === id ? { ...c, ...body, ...fields } : c)));
    }, [patch]);

    const saveRunClub = useCallback((id, fields) => {
        const body = fields.pageSection === 'hidden'
            ? { showOnSportsPage: false, showInRunClubs: false }
            : fields.pageSection === 'run_clubs'
                ? { showOnSportsPage: true, showInRunClubs: true }
                : fields;
        patch(`/admin/run-clubs/${id}`, `runclub-${id}-${Object.keys(fields)[0]}`, body,
            () => setRunClubs(prev => prev.map(c => c._id === id ? { ...c, ...body, ...fields } : c)));
    }, [patch]);

    const saveSports = useCallback((id, fields) => {
        patch(`/admin/sports/${id}`, `sports-${id}-${Object.keys(fields)[0]}`, fields,
            () => setSports(prev => prev.map(s => s._id === id ? { ...s, ...fields } : s)));
    }, [patch]);

    const saveEventShow = useCallback((id, fields) => {
        patch(`/admin/events/${id}`, `events-${id}-${Object.keys(fields)[0]}`, fields,
            () => setEventShows(prev => prev.map(s => s._id === id ? { ...s, ...fields } : s)));
    }, [patch]);

    const saveRunPage = useCallback((id, val) => {
        if (val === 'hidden') {
            saveSports(id, { showOnSportsPage: false, showInUpcoming: false, showInRunClubs: false, featuredSection: null });
            return;
        }
        saveSports(id, {
            showOnSportsPage: true,
            featuredSection: 'upcoming',
            showInUpcoming: true,
            showInRunClubs: false,
        });
    }, [saveSports]);

    const trendingCarousel = useMemo(
        () => buildHomeCarouselItems(fests, treks, comms, 'trending', sports, runClubs, eventShows),
        [fests, treks, comms, sports, runClubs, eventShows],
    );
    const happeningCarousel = useMemo(
        () => buildHomeCarouselItems(fests, treks, comms, 'happening', sports, runClubs, eventShows),
        [fests, treks, comms, sports, runClubs, eventShows],
    );

    const homeCheckOpts = useMemo(
        () => [{ value: 'movingSlide', label: 'Hero Banner' }, ...buildHomeCheckOpts(customSections)],
        [customSections],
    );
    const festCustomPageOpts = useMemo(
        () => buildCustomPageCheckOpts(customSections, FEST_CUSTOM_PAGES),
        [customSections],
    );
    const trekCustomPageOpts = useMemo(
        () => buildCustomPageCheckOpts(customSections, TREK_CUSTOM_PAGES),
        [customSections],
    );
    const sportsCustomPageOpts = useMemo(
        () => buildCustomPageCheckOpts(customSections, SPORTS_CUSTOM_PAGES),
        [customSections],
    );
    const eventsCustomPageOpts = useMemo(
        () => buildCustomPageCheckOpts(customSections, EVENTS_CUSTOM_PAGES),
        [customSections],
    );

    const customCarousels = useMemo(
        () => customSections
            .filter((s) => (s.targetPage || 'home') === 'home')
            .map((section) => ({
                section,
                items: buildHomeCarouselItems(fests, treks, comms, section.slug, sports, runClubs, eventShows),
            })),
        [customSections, fests, treks, comms, sports, runClubs, eventShows],
    );

    const applyLocalCarouselOrder = useCallback((section, orderedItems) => {
        const applyPriority = (prev, id, field, priority, extra = {}) =>
            prev.map((row) => ((row._id || row.id) === id ? { ...row, [field]: priority, ...extra } : row));

        orderedItems.forEach((item, index) => {
            const priority = index + 1;
            if (item._type === 'fest') {
                const extra = !item.homeSection && !item.showOnHomeSlide ? { homeSection: section } : {};
                setFests((prev) => applyPriority(prev, item._id, 'homePriority', priority, extra));
            } else if (item._type === 'trek') {
                setTreks((prev) => applyPriority(prev, item._id, 'priority', priority));
            } else if (item._type === 'sport') {
                setSports((prev) => applyPriority(prev, item._id, 'homePriority', priority, { homeSection: section }));
            } else if (item._type === 'runclub') {
                setRunClubs((prev) => applyPriority(prev, item._id, 'priority', priority, { homeSection: section }));
            } else if (item._type === 'events') {
                setEventShows((prev) => applyPriority(prev, item._id, 'homePriority', priority, { homeSection: section }));
            } else {
                setComms((prev) => applyPriority(prev, item._id, 'priority', priority));
            }
        });
    }, []);

    const batchReorder = useCallback(async (updates, applyLocal) => {
        if (!updates.length) return;
        setReordering(true);
        try {
            await adminFetch('/admin/sections/reorder', {
                method: 'POST',
                body: JSON.stringify({ updates }),
            });
            applyLocal?.();
            notifyAdminDataUpdated();
        } catch (e) {
            setErrors((prev) => ({ ...prev, save: e.message }));
        } finally {
            setReordering(false);
        }
    }, []);

    const persistCarouselOrder = useCallback(async (section, orderedItems) => {
        const updates = orderedItems.map((item, index) => {
            const priority = index + 1;
            if (item._type === 'fest') {
                const fields = { homePriority: priority };
                if (!item.homeSection && !item.showOnHomeSlide) fields.homeSection = section;
                return { type: 'fest', id: item._id, fields };
            }
            if (item._type === 'trek') return { type: 'trek', id: item._id, fields: { priority } };
            if (item._type === 'sport') return { type: 'sport', id: item._id, fields: { homePriority: priority, homeSection: section } };
            if (item._type === 'runclub') return { type: 'runclub', id: item._id, fields: { priority, homeSection: section } };
            if (item._type === 'events') return { type: 'events', id: item._id, fields: { homePriority: priority, homeSection: section } };
            return { type: 'community', id: item._id, fields: { priority } };
        });
        applyLocalCarouselOrder(section, orderedItems);
        await batchReorder(updates);
    }, [applyLocalCarouselOrder, batchReorder]);

    const getCarouselBySection = useCallback((section) => {
        if (section === 'trending') return trendingCarousel;
        if (section === 'happening') return happeningCarousel;
        return buildHomeCarouselItems(fests, treks, comms, section, sports, runClubs, eventShows);
    }, [trendingCarousel, happeningCarousel, fests, treks, comms, sports, runClubs, eventShows]);

    const handleCarouselReorder = useCallback((section, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const source = getCarouselBySection(section);
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        applyLocalCarouselOrder(section, next);
        persistCarouselOrder(section, next);
    }, [getCarouselBySection, applyLocalCarouselOrder, persistCarouselOrder, reordering]);

    const movingSlideFests = useMemo(
        () => fests.filter((f) => isOnHomeHero(f)).map((f) => normalizeHomeCarouselItem('fest', f))
            .sort((a, b) => a._priority - b._priority),
        [fests],
    );

    const movingSlideEvents = useMemo(
        () => eventShows.filter((s) => isOnHomeHero(s)).map((s) => normalizeHomeCarouselItem('events', s))
            .sort((a, b) => a._priority - b._priority),
        [eventShows],
    );

    const movingSlideRunClubs = useMemo(
        () => runClubs.filter((c) => isOnHomeHero(c)).map((c) => normalizeHomeCarouselItem('runclub', c))
            .sort((a, b) => a._priority - b._priority),
        [runClubs],
    );

    const movingSlideTreks = useMemo(
        () => treks.filter((t) => isOnHomeHero(t)).map((t) => normalizeHomeCarouselItem('trek', t, { communitiesById: communityById }))
            .sort((a, b) => a._priority - b._priority),
        [treks, communityById],
    );

    const movingSlideComms = useMemo(
        () => comms.filter((c) => isOnHomeHero(c)).map((c) => normalizeHomeCarouselItem('community', c))
            .sort((a, b) => a._priority - b._priority),
        [comms],
    );

    const movingSlideSports = useMemo(
        () => sports.filter((s) => isOnHomeHero(s)).map((s) => normalizeHomeCarouselItem('sport', s))
            .sort((a, b) => a._priority - b._priority),
        [sports],
    );

    const movingSlideItems = useMemo(
        () => [
            ...movingSlideFests,
            ...movingSlideEvents,
            ...movingSlideRunClubs,
            ...movingSlideTreks,
            ...movingSlideComms,
            ...movingSlideSports,
        ].sort((a, b) => a._priority - b._priority),
        [movingSlideFests, movingSlideEvents, movingSlideRunClubs, movingSlideTreks, movingSlideComms, movingSlideSports],
    );

    const trekPageCarousels = useMemo(() => {
        const norm = (t) => ({ ...normalizeHomeCarouselItem('trek', t, { communitiesById: communityById }), _priority: t.trekPagePriority ?? 999 });
        const inSection = (key) => treks.filter((t) => t.featuredSection === key || t.featuredSection === 'both').map(norm)
            .sort((a, b) => a._priority - b._priority);

        const normComm = (c) => ({
            ...normalizeHomeCarouselItem('community', c),
            _priority: c.trekPagePriority ?? 999,
        });
        const inCommSection = (key) => comms
            .filter((c) => {
                if (c.status === 'draft') return false;
                if (c.showOnTreks === false) return false;
                const sec = c.trekPageSection || 'communities';
                return sec === key || sec === 'both';
            })
            .map(normComm)
            .sort((a, b) => a._priority - b._priority);

        return {
            hero: inSection('hero'),
            weekend: inSection('weekend'),
            beginner: inSection('beginner'),
            communities: inCommSection('communities'),
            comingSoon: inCommSection('comingSoon'),
        };
    }, [treks, comms, communityById]);

    const festPageCarousels = useMemo(() => {
        const out = {};
        FEST_PAGE_SECTIONS.forEach(({ key }) => {
            out[key] = fests
                .filter((f) => f.status === key)
                .map((f) => ({ ...normalizeHomeCarouselItem('fest', f), _priority: f.priority ?? 999 }))
                .sort((a, b) => a._priority - b._priority);
        });
        return out;
    }, [fests]);

    const sportsPageCarousels = useMemo(() => {
        const norm = (s, pri) => ({ ...normalizeHomeCarouselItem('sport', s), _priority: pri });
        const upcoming = sports
            .filter((s) => s.runClubId && s.showOnSportsPage !== false && (s.showInUpcoming !== false || s.featuredSection === 'upcoming' || s.featuredSection === 'both'))
            .map((s) => norm(s, s.upcomingPriority ?? s.priority ?? 999))
            .sort((a, b) => a._priority - b._priority);
        const runClubCarousel = runClubs
            .filter((c) => c.showOnSportsPage !== false && c.showInRunClubs !== false && c.listingHub !== 'events')
            .map((c) => ({ ...normalizeHomeCarouselItem('runclub', c), _priority: c.runClubPriority ?? 999 }))
            .sort((a, b) => a._priority - b._priority);
        return { upcoming, run_clubs: runClubCarousel };
    }, [sports, runClubs]);

    const eventsPageCarousels = useMemo(() => {
        const norm = (s) => ({ ...normalizeHomeCarouselItem('events', s), _priority: s.pagePriority ?? 999 });
        const inSection = (key) => eventShows
            .filter((s) => s.pageSection === key)
            .map(norm)
            .sort((a, b) => a._priority - b._priority);
        return {
            hero: inSection('hero'),
            spotlight: inSection('spotlight'),
            upcoming: inSection('upcoming'),
            community: inSection('community'),
        };
    }, [eventShows]);

    const applyLocalFestPageOrder = useCallback((status, ordered) => {
        ordered.forEach((item, index) => {
            const priority = index + 1;
            setFests((prev) => prev.map((f) => ((f._id || f.id) === item._id ? { ...f, priority } : f)));
        });
    }, []);

    const applyLocalTrekPageOrder = useCallback((ordered) => {
        ordered.forEach((item, index) => {
            setTreks((prev) => prev.map((t) => (t._id === item._id ? { ...t, trekPagePriority: index + 1 } : t)));
        });
    }, []);

    const applyLocalCommPageOrder = useCallback((ordered) => {
        ordered.forEach((item, index) => {
            setComms((prev) => prev.map((c) => (c._id === item._id ? { ...c, trekPagePriority: index + 1 } : c)));
        });
    }, []);

    const applyLocalSportsPageOrder = useCallback((section, ordered) => {
        ordered.forEach((item, index) => {
            const pri = index + 1;
            if (section === 'run_clubs') {
                setRunClubs((prev) => prev.map((c) => (c._id === item._id ? { ...c, runClubPriority: pri } : c)));
            } else {
                setSports((prev) => prev.map((s) => (s._id === item._id ? { ...s, upcomingPriority: pri, priority: pri } : s)));
            }
        });
    }, []);

    const applyLocalEventsPageOrder = useCallback((ordered) => {
        ordered.forEach((item, index) => {
            setEventShows((prev) => prev.map((s) => (s._id === item._id ? { ...s, pagePriority: index + 1 } : s)));
        });
    }, []);

    const handleFestPageReorder = useCallback((status, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const source = festPageCarousels[status] || [];
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const updates = next.map((item, i) => ({ type: 'fest', id: item._id, fields: { priority: i + 1 } }));
        applyLocalFestPageOrder(status, next);
        batchReorder(updates);
    }, [festPageCarousels, reordering, applyLocalFestPageOrder, batchReorder]);

    const handleTrekPageReorder = useCallback((section, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const source = trekPageCarousels[section] || [];
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        const isCommunitySection = section === 'communities' || section === 'comingSoon';
        if (isCommunitySection) {
            const updates = next.map((item, i) => ({
                type: 'community',
                id: item._id,
                fields: { trekPagePriority: i + 1 },
            }));
            applyLocalCommPageOrder(next);
            batchReorder(updates);
            return;
        }

        const updates = next.map((item, i) => ({ type: 'trek', id: item._id, fields: { trekPagePriority: i + 1 } }));
        applyLocalTrekPageOrder(next);
        batchReorder(updates);
    }, [trekPageCarousels, reordering, applyLocalTrekPageOrder, applyLocalCommPageOrder, batchReorder]);

    const handleSportsPageReorder = useCallback((section, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const source = sportsPageCarousels[section] || [];
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const updates = next.map((item, i) => {
            const pri = i + 1;
            if (section === 'run_clubs') return { type: 'runclub', id: item._id, fields: { runClubPriority: pri } };
            return { type: 'sport', id: item._id, fields: { upcomingPriority: pri, priority: pri } };
        });
        applyLocalSportsPageOrder(section, next);
        batchReorder(updates);
    }, [sportsPageCarousels, reordering, applyLocalSportsPageOrder, batchReorder]);

    const handleEventsPageReorder = useCallback((section, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const source = eventsPageCarousels[section] || [];
        const next = [...source];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const updates = next.map((item, i) => ({ type: 'events', id: item._id, fields: { pagePriority: i + 1 } }));
        applyLocalEventsPageOrder(next);
        batchReorder(updates);
    }, [eventsPageCarousels, reordering, applyLocalEventsPageOrder, batchReorder]);

    const handleMovingSlideReorder = useCallback((fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const next = [...movingSlideItems];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const updates = next.map((item, i) => {
            const fields = { homePriority: i + 1 };
            if (item._type === 'events') return { type: 'events', id: item._id, fields };
            if (item._type === 'runclub') return { type: 'runclub', id: item._id, fields: { priority: i + 1 } };
            return { type: 'fest', id: item._id, fields };
        });
        next.forEach((item, i) => {
            const pri = i + 1;
            if (item._type === 'events') {
                setEventShows((prev) => prev.map((s) => (s._id === item._id ? { ...s, homePriority: pri } : s)));
            } else if (item._type === 'runclub') {
                setRunClubs((prev) => prev.map((c) => (c._id === item._id ? { ...c, priority: pri } : c)));
            } else {
                setFests((prev) => prev.map((f) => ((f._id || f.id) === item._id ? { ...f, homePriority: pri } : f)));
            }
        });
        batchReorder(updates);
    }, [movingSlideItems, reordering, batchReorder]);

    const resolveTrekCommunity = useCallback((trek) => {
        const raw = trek?.communityId;
        if (!raw) return null;
        if (typeof raw === 'object' && (raw.name || raw.title)) return raw;
        const id = String(raw._id || raw);
        return communityById.get(id) || null;
    }, [communityById]);

    // ── Filtered lists ───────────────────────────────────────────────────────
    const q = search.trim().toLowerCase();
    const filteredFests = useMemo(() =>
        fests.filter(f => !q || [f.festName, f.collegeName].some(v => String(v || '').toLowerCase().includes(q)))
             .sort((a, b) => String(a.festName || '').localeCompare(String(b.festName || ''))),
        [fests, q]);
    const filteredTreks = useMemo(() =>
        treks.filter((t) => {
            if (!q) return true;
            const community = resolveTrekCommunity(t);
            return [t.trekName, t.city, t.destination, community?.name, community?.basedIn]
                .some((v) => String(v || '').toLowerCase().includes(q));
        }).sort((a, b) => String(a.trekName || '').localeCompare(String(b.trekName || ''))),
        [treks, q, resolveTrekCommunity]);

    const trekAssignGroups = useMemo(() => {
        const groups = new Map();
        const unassigned = [];
        for (const t of filteredTreks) {
            const community = resolveTrekCommunity(t);
            if (!community?._id && !community?.id) {
                unassigned.push(t);
                continue;
            }
            const cid = String(community._id || community.id);
            if (!groups.has(cid)) {
                groups.set(cid, {
                    id: cid,
                    name: community.name || community.title || 'Community',
                    basedIn: community.basedIn || '',
                    coverImage: community.coverImage || community.logo || null,
                    treks: [],
                });
            }
            groups.get(cid).treks.push(t);
        }
        const sorted = [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
        if (unassigned.length) {
            sorted.push({
                id: '__none__',
                name: 'No community assigned',
                basedIn: 'Assign a community on the trek form',
                coverImage: null,
                treks: unassigned,
            });
        }
        return sorted;
    }, [filteredTreks, resolveTrekCommunity]);

    const filteredComms = useMemo(() =>
        comms.filter(c => !q || [c.name, c.basedIn].some(v => String(v || '').toLowerCase().includes(q)))
             .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        [comms, q]);
    const filteredRuns = useMemo(() =>
        sports
            .filter((s) => s.runClubId)
            .filter((s) => !q || [s.title, s.city, s.organizer, s.displayType].some((v) => String(v || '').toLowerCase().includes(q)))
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
        [sports, q]);
    const filteredRunClubs = useMemo(() =>
        runClubs.filter(c => !q || [c.name, c.basedIn, c.organizer].some(v => String(v || '').toLowerCase().includes(q)))
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
        [runClubs, q]);
    const filteredEvents = useMemo(() =>
        eventShows.filter(s => !q || [s.title, s.city, s.organizer, s.eventType].some(v => String(v || '').toLowerCase().includes(q)))
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''))),
        [eventShows, q]);

    const getRunPageVal = (s) => {
        if (s.showOnSportsPage === false || s.showInUpcoming === false) return 'hidden';
        return 'upcoming';
    };

    const getRunClubPageVal = (c) => {
        if (c.showOnSportsPage === false || c.showInRunClubs === false) return 'hidden';
        return 'run_clubs';
    };

    const activeTabs = mode === 'assign' ? ASSIGN_TABS : REORDER_TABS;
    const tabCounts = {
        home: trendingCarousel.length + happeningCarousel.length,
        fests: fests.length,
        treks: treks.length,
        communities: comms.length,
        runclubs: runClubs.length,
        runs: sports.filter((s) => s.runClubId).length,
        sports: sportsPageCarousels.upcoming.length + sportsPageCarousels.run_clubs.length,
        events: eventShows.length,
    };

    const renderReorderContent = () => {
        if (tab === 'home') {
            return (
                <div className="p-4 space-y-4">
                    {reordering && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-xs text-[#0ECCEE]">
                            <Loader2 size={14} className="animate-spin" /> Saving carousel order…
                        </div>
                    )}
                    <HomeCarouselPanel
                        title="Ongoing Events"
                        subtitle="Home page · drag to set left-to-right order"
                        items={trendingCarousel}
                        onReorder={(from, to) => handleCarouselReorder('trending', from, to)}
                        isReordering={reordering}
                    />
                    <HomeCarouselPanel
                        title="📍 Happening Near You"
                        subtitle="Home page · drag to set left-to-right order"
                        items={happeningCarousel}
                        onReorder={(from, to) => handleCarouselReorder('happening', from, to)}
                        isReordering={reordering}
                    />
                    {customCarousels.map(({ section, items }) => (
                        <HomeCarouselPanel
                            key={section._id}
                            title={`✨ ${section.title}`}
                            subtitle={`Custom home section · ${getCardSizeLabel(section.cardSize)}`}
                            items={items}
                            onReorder={(from, to) => handleCarouselReorder(section.slug, from, to)}
                            isReordering={reordering}
                        />
                    ))}
                    <HomeCarouselPanel
                        title="🎠 Moving Hero Slides"
                        subtitle="Hero banner slides · tick Hero Banner under Home in Assign"
                        items={movingSlideItems}
                        onReorder={handleMovingSlideReorder}
                        isReordering={reordering}
                    />
                </div>
            );
        }
        if (tab === 'fests') {
            return (
                <div className="p-4 space-y-3">
                    {reordering && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-xs text-[#0ECCEE]">
                            <Loader2 size={14} className="animate-spin" /> Saving order…
                        </div>
                    )}
                    <p className="text-[11px] text-gray-500">Fest page sections on /fests — drag within each row</p>
                    {FEST_PAGE_SECTIONS.map(({ key, label }) => (
                        <HomeCarouselPanel
                            key={key}
                            title={label}
                            subtitle="Left-to-right order on fest page"
                            items={festPageCarousels[key] || []}
                            onReorder={(from, to) => handleFestPageReorder(key, from, to)}
                            isReordering={reordering}
                        />
                    ))}
                </div>
            );
        }
        if (tab === 'treks') {
            return (
                <div className="p-4 space-y-3">
                    {reordering && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-xs text-[#0ECCEE]">
                            <Loader2 size={14} className="animate-spin" /> Saving order…
                        </div>
                    )}
                    <p className="text-[11px] text-gray-500">Treks page sections on /treks — drag within each row</p>
                    {TREK_COMMUNITY_PAGE_SECTIONS.map(({ key, label }) => (
                        <HomeCarouselPanel
                            key={key}
                            title={label}
                            subtitle="Trek community order on /treks"
                            items={trekPageCarousels[key] || []}
                            onReorder={(from, to) => handleTrekPageReorder(key, from, to)}
                            isReordering={reordering}
                        />
                    ))}
                    {TREK_PAGE_SECTIONS.map(({ key, label }) => (
                        <HomeCarouselPanel
                            key={key}
                            title={label}
                            subtitle="Left-to-right order on treks page"
                            items={trekPageCarousels[key] || []}
                            onReorder={(from, to) => handleTrekPageReorder(key, from, to)}
                            isReordering={reordering}
                        />
                    ))}
                </div>
            );
        }
        if (tab === 'sports') {
            return (
                <div className="p-4 space-y-3">
                    {reordering && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-xs text-[#0ECCEE]">
                            <Loader2 size={14} className="animate-spin" /> Saving order…
                        </div>
                    )}
                    <p className="text-[11px] text-gray-500">Sports page sections on /sports — drag within each row</p>
                    <HomeCarouselPanel
                        title="🏃 Upcoming Activities"
                        subtitle="Runs shown on sports page"
                        items={sportsPageCarousels.upcoming}
                        onReorder={(from, to) => handleSportsPageReorder('upcoming', from, to)}
                        isReordering={reordering}
                    />
                    <HomeCarouselPanel
                        title="👟 Explore Run Clubs"
                        subtitle="Run clubs carousel on sports page"
                        items={sportsPageCarousels.run_clubs}
                        onReorder={(from, to) => handleSportsPageReorder('run_clubs', from, to)}
                        isReordering={reordering}
                    />
                </div>
            );
        }
        if (tab === 'events') {
            return (
                <div className="p-4 space-y-3">
                    {reordering && (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 text-xs text-[#0ECCEE]">
                            <Loader2 size={14} className="animate-spin" /> Saving order…
                        </div>
                    )}
                    <p className="text-[11px] text-gray-500">Events page sections on /events — drag within each row</p>
                    {EVENTS_PAGE_SECTIONS.map(({ key, label }) => (
                        <HomeCarouselPanel
                            key={key}
                            title={label}
                            subtitle="Left-to-right order on Events page"
                            items={eventsPageCarousels[key] || []}
                            onReorder={(from, to) => handleEventsPageReorder(key, from, to)}
                            isReordering={reordering}
                        />
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="max-w-5xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/8 bg-[#17181A] px-5 py-4">
                <div>
                    <h1 className="text-xl font-bold text-white">Home &amp; Sections</h1>
                    <p className="text-xs text-gray-500 mt-0.5">
                        {mode === 'reorder'
                            ? 'Drag cards to change order within each section on the site'
                            : 'Assign each item to home page sections and its own page'}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link
                        to="/admin/page-sections"
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-[#0ECCEE] hover:bg-[#3dd8f5] rounded-xl text-xs font-bold text-black transition-colors"
                    >
                        <LayoutGrid size={13} /> Page Sections
                    </Link>
                    <a href="/" target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors">
                        <ExternalLink size={13} /> Preview site
                    </a>
                    <button onClick={fetchAll} disabled={loading}
                        className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-50">
                        <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* Editable home carousel headings */}
            <HomeHeadingsEditor />

            {/* Errors */}
            {Object.keys(errors).length > 0 && (
                <div className="space-y-1.5">
                    {Object.entries(errors).map(([k, m]) => (
                        <div key={k} className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-300">
                            <AlertCircle size={14} /><span className="font-semibold capitalize">{k}:</span><span>{m}</span>
                        </div>
                    ))}
                </div>
            )}

            <ModeSwitcher mode={mode} onChange={handleModeChange} />

            {/* Page tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-[#17181A] p-1 rounded-xl border border-white/8 overflow-x-auto">
                    {activeTabs.map((t) => (
                        <button key={t.id} type="button" onClick={() => handleTabChange(t.id)}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap
                                ${tab === t.id ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                            <t.icon size={13} />{t.label}
                            {tabCounts[t.id] != null && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-black/20 text-black' : 'bg-white/8 text-gray-500'}`}>
                                    {tabCounts[t.id]}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
                {mode === 'assign' && (
                    <div className="relative flex-1 min-w-0">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}…`}
                            className="w-full h-10 bg-[#17181A] border border-white/8 rounded-xl pl-8 pr-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/50" />
                    </div>
                )}
            </div>

            {/* Column headers — assign mode only */}
            {!loading && mode === 'assign' && (
                <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    <span className="w-10 shrink-0" />
                    <span className="flex-1">Name</span>
                    <span className="min-w-[11rem] text-center">Home (multi)</span>
                    <span className="min-w-[11rem] text-center">
                        {tab === 'fests' ? 'Fest status'
                            : tab === 'runs' || tab === 'runclubs' ? 'Sports page'
                            : tab === 'treks' ? 'Treks page'
                            : tab === 'communities' ? 'Treks page'
                            : tab === 'events' ? 'Events page'
                            : 'Own page'}
                    </span>
                    <span className="min-w-[11rem] text-center">Custom sections</span>
                </div>
            )}

            {/* Content */}
            <div className="bg-[#17181A] rounded-2xl border border-white/8 overflow-hidden">
                {loading ? (
                    <InlinePageLoader label="Loading…" minHeight={false} />
                ) : mode === 'reorder' ? (
                    <>
                        {renderReorderContent()}
                        <div className="px-4 py-3 border-t border-white/4 bg-black/20">
                            <p className="text-[10px] text-gray-600">
                                Card order saves when you drop a row. To add cards to a section, switch to <button type="button" onClick={() => handleModeChange('assign')} className="text-[#0ECCEE] hover:underline">Assign cards</button>.
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="max-h-[640px] overflow-y-auto divide-y divide-white/4">

                        {/* ── FESTS ── */}
                        {tab === 'fests' && (() => {
                            if (filteredFests.length === 0) return <EmptyState label="No fests found" />;
                            const GROUPS = [
                                { key: 'cultural',  label: '🎭 Cultural',  emoji: '🎭' },
                                { key: 'technical', label: '💻 Tech',      emoji: '💻' },
                                { key: 'sports',    label: '⚽ Sports',    emoji: '⚽' },
                                { key: 'other',     label: '🎪 Other',     emoji: '🎪' },
                            ];
                            const grouped = GROUPS.map(g => ({
                                ...g,
                                fests: filteredFests.filter(f =>
                                    g.key === 'other'
                                        ? !['cultural','technical','sports'].includes(f.festType)
                                        : f.festType === g.key
                                ),
                            })).filter(g => g.fests.length > 0);

                            return grouped.map(group => (
                                <div key={group.key}>
                                    {/* Group header */}
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white/3 border-y border-white/5">
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{group.label}</span>
                                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{group.fests.length}</span>
                                    </div>
                                    {group.fests.map(f => {
                                        const id = f._id || f.id;
                                        return (
                                            <div key={id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors flex-wrap">
                                                <Thumb src={f.coverImage} icon={Flag} />
                                                <PreviewLink type="fest" id={id} />
                                                <div className="flex-1 min-w-[8rem]">
                                                    <p className="text-sm font-semibold text-white truncate">{f.festName || 'Untitled'}</p>
                                                    <p className="text-[11px] text-gray-600 truncate">{f.collegeName || '—'}</p>
                                                </div>
                                                <AssignCheckGroup
                                                    label="Home"
                                                    options={homeCheckOpts}
                                                    selected={homeSelected(f)}
                                                    onToggle={(slug, checked) => saveEntityHomeMulti('fest', id, f, slug, checked)}
                                                    saveKey={`fest-${id}-home`}
                                                    saving={saving}
                                                />
                                                <AssignPill
                                                    selectValue={f.status || 'upcoming'}
                                                    selectOpts={FEST_PAGE_OPTS}
                                                    onSelect={v => saveFest(id, { status: v })}
                                                    saveKey={`fest-${id}-page`}
                                                    saving={saving}
                                                />
                                                <AssignCheckGroup
                                                    label="Custom"
                                                    options={festCustomPageOpts}
                                                    selected={getCustomPageAssignmentKeys(f, FEST_CUSTOM_PAGES)}
                                                    onToggle={(key, checked) => saveEntityCustomToggle('fest', id, f, FEST_CUSTOM_PAGES, key, checked)}
                                                    saveKey={`fest-${id}-custom`}
                                                    saving={saving}
                                                    emptyHint={(
                                                        <>Add sections in <Link to="/admin/page-sections" className="text-[#0ECCEE] hover:underline">Page Sections</Link></>
                                                    )}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            ));
                        })()}

                        {/* ── TREKS ── */}
                        {tab === 'treks' && (filteredTreks.length === 0
                            ? <EmptyState label="No treks found" />
                            : (
                                <div className="py-2 space-y-1">
                                    <div className="px-4 pb-2">
                                        <p className="text-[11px] text-gray-500 leading-relaxed">
                                            Treks are grouped by the community they belong to. Search also matches community names.
                                        </p>
                                    </div>
                                    {trekAssignGroups.map((group) => (
                                        <div key={group.id} className="pb-2">
                                            <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-2.5 bg-[#1a1b1d]/95 backdrop-blur border-y border-white/6">
                                                <Thumb src={group.coverImage} icon={Users} />
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <p className={`text-sm font-bold truncate ${group.id === '__none__' ? 'text-amber-300' : 'text-white'}`}>
                                                            {group.name}
                                                        </p>
                                                        <span className="text-[10px] font-bold text-gray-500 bg-white/5 px-1.5 py-0.5 rounded-full">
                                                            {group.treks.length} trek{group.treks.length !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    {group.basedIn ? (
                                                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{group.basedIn}</p>
                                                    ) : null}
                                                </div>
                                                {group.id !== '__none__' ? (
                                                    <PreviewLink type="community" id={group.id} />
                                                ) : null}
                                            </div>
                                            {group.treks.map((t) => {
                                                const community = resolveTrekCommunity(t);
                                                return (
                                                    <AssignEntityRow key={t._id}>
                                                        <Thumb src={t.coverImage || t.images?.[0]} icon={Mountain} />
                                                        <PreviewLink type="trek" id={t._id} />
                                                        <div className="flex-1 min-w-[10rem]">
                                                            <p className="text-sm font-semibold text-white truncate">{t.trekName || 'Untitled'}</p>
                                                            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                                                {community ? (
                                                                    <MetaChip tone="sky">
                                                                        <Users size={10} className="shrink-0" />
                                                                        <span className="truncate">{community.name || community.title}</span>
                                                                    </MetaChip>
                                                                ) : (
                                                                    <MetaChip tone="amber">No community</MetaChip>
                                                                )}
                                                                {t.city ? <MetaChip>{t.city}</MetaChip> : null}
                                                                {t.difficultyLevel ? <MetaChip tone="emerald">{t.difficultyLevel}</MetaChip> : null}
                                                                {Number(t.registrationFee) > 0 ? (
                                                                    <MetaChip>₹{Number(t.registrationFee).toLocaleString('en-IN')}</MetaChip>
                                                                ) : (
                                                                    <MetaChip>Free</MetaChip>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <AssignCheckGroup
                                                            label="Home"
                                                            options={homeCheckOpts}
                                                            selected={homeSelected(t)}
                                                            onToggle={(slug, checked) => saveEntityHomeMulti('trek', t._id, t, slug, checked)}
                                                            saveKey={`trek-${t._id}-home`}
                                                            saving={saving}
                                                        />
                                                        <AssignCheckGroup
                                                            label="Treks page"
                                                            options={TREK_PAGE_CHECK_OPTS}
                                                            selected={getTrekPageChecks(t.featuredSection)}
                                                            onToggle={(slug, checked) => {
                                                                const cur = new Set(getTrekPageChecks(t.featuredSection));
                                                                if (checked) cur.add(slug);
                                                                else cur.delete(slug);
                                                                saveTrek(t._id, { featuredSection: toTrekFeaturedSection([...cur]) });
                                                            }}
                                                            saveKey={`trek-${t._id}-page`}
                                                            saving={saving}
                                                        />
                                                        <AssignCheckGroup
                                                            label="Custom"
                                                            options={trekCustomPageOpts}
                                                            selected={getCustomPageAssignmentKeys(t, TREK_CUSTOM_PAGES)}
                                                            onToggle={(key, checked) => saveEntityCustomToggle('trek', t._id, t, TREK_CUSTOM_PAGES, key, checked)}
                                                            saveKey={`trek-${t._id}-custom`}
                                                            saving={saving}
                                                            emptyHint="Add sections in Page Sections"
                                                        />
                                                    </AssignEntityRow>
                                                );
                                            })}
                                        </div>
                                    ))}
                                </div>
                            )
                        )}

                        {/* ── SPORTS ── */}
                        {tab === 'runs' && (filteredRuns.length === 0
                            ? <EmptyState label="No runs found — add runs inside a run club in Admin → Run Clubs" />
                            : filteredRuns.map(s => (
                                <div key={s._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors flex-wrap">
                                    <Thumb src={s.images?.[0] || s.coverImage} icon={Footprints} />
                                    <PreviewLink type="sport" id={s._id} />
                                    <div className="flex-1 min-w-[8rem]">
                                        <p className="text-sm font-semibold text-white truncate">{s.title || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">
                                            {[s.runCategory, s.city, s.status].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                    <AssignCheckGroup
                                        label="Home"
                                        options={homeCheckOpts}
                                        selected={homeSelected(s)}
                                        onToggle={(slug, checked) => saveEntityHomeMulti('sport', s._id, s, slug, checked)}
                                        saveKey={`sports-${s._id}-home`}
                                        saving={saving}
                                    />
                                    <AssignPill
                                        selectValue={getRunPageVal(s)}
                                        selectOpts={RUN_PAGE_OPTS}
                                        onSelect={v => saveRunPage(s._id, v)}
                                        saveKey={`sports-${s._id}-page`}
                                        saving={saving}
                                    />
                                    <AssignCheckGroup
                                        label="Custom"
                                        options={sportsCustomPageOpts}
                                        selected={getCustomPageAssignmentKeys(s, SPORTS_CUSTOM_PAGES)}
                                        onToggle={(key, checked) => saveEntityCustomToggle('sport', s._id, s, SPORTS_CUSTOM_PAGES, key, checked)}
                                        saveKey={`sports-${s._id}-custom`}
                                        saving={saving}
                                        emptyHint="Add sections in Page Sections"
                                    />
                                </div>
                            ))
                        )}

                        {/* ── RUN CLUBS ── */}
                        {tab === 'runclubs' && (filteredRunClubs.length === 0
                            ? <EmptyState label="No run clubs found" />
                            : filteredRunClubs.map(c => {
                                const pageVal = getRunClubPageVal(c);
                                return (
                                    <div key={c._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors flex-wrap">
                                        <Thumb src={c.coverImage} icon={Footprints} />
                                        <PreviewLink type="runclub" id={c._id} />
                                        <div className="flex-1 min-w-[8rem]">
                                            <p className="text-sm font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                                            <p className="text-[11px] text-gray-600 truncate">{c.basedIn || c.organizer || '—'}</p>
                                        </div>
                                        <AssignCheckGroup
                                            label="Home"
                                            options={homeCheckOpts}
                                            selected={homeSelected(c)}
                                            onToggle={(slug, checked) => saveEntityHomeMulti('runclub', c._id, c, slug, checked)}
                                            saveKey={`runclub-${c._id}-home`}
                                            saving={saving}
                                        />
                                        <AssignPill
                                            selectValue={pageVal}
                                            selectOpts={RUN_CLUB_PAGE_OPTS}
                                            onSelect={v => saveRunClub(c._id, { pageSection: v })}
                                            saveKey={`runclub-${c._id}-page`}
                                            saving={saving}
                                        />
                                        <AssignCheckGroup
                                            label="Custom"
                                            options={sportsCustomPageOpts}
                                            selected={getCustomPageAssignmentKeys(c, SPORTS_CUSTOM_PAGES)}
                                            onToggle={(key, checked) => saveEntityCustomToggle('runclub', c._id, c, SPORTS_CUSTOM_PAGES, key, checked)}
                                            saveKey={`runclub-${c._id}-custom`}
                                            saving={saving}
                                            emptyHint="Add sections in Page Sections"
                                        />
                                    </div>
                                );
                            })
                        )}

                        {/* ── COMMUNITIES ── */}
                        {tab === 'communities' && (filteredComms.length === 0
                            ? <EmptyState label="No communities found" />
                            : filteredComms.map(c => (
                                <div key={c._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors flex-wrap">
                                    <Thumb src={c.coverImage} icon={Users} />
                                    <PreviewLink type="community" id={c._id} />
                                    <div className="flex-1 min-w-[8rem]">
                                        <p className="text-sm font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">{c.basedIn || '—'}</p>
                                    </div>
                                    <AssignCheckGroup
                                        label="Home"
                                        options={homeCheckOpts}
                                        selected={homeSelected(c)}
                                        onToggle={(slug, checked) => saveEntityHomeMulti('community', c._id, c, slug, checked)}
                                        saveKey={`comm-${c._id}-home`}
                                        saving={saving}
                                    />
                                    <AssignCheckGroup
                                        label="Treks page"
                                        options={COMM_PAGE_CHECK_OPTS}
                                        selected={getCommPageChecks(c)}
                                        onToggle={(slug, checked) => {
                                            const cur = new Set(getCommPageChecks(c));
                                            if (checked) cur.add(slug);
                                            else cur.delete(slug);
                                            const next = toCommPageSection([...cur]);
                                            saveComm(c._id, { pageSection: next || 'hidden' });
                                        }}
                                        saveKey={`comm-${c._id}-page`}
                                        saving={saving}
                                    />
                                    <AssignCheckGroup
                                        label="Custom"
                                        options={trekCustomPageOpts}
                                        selected={getCustomPageAssignmentKeys(c, TREK_CUSTOM_PAGES)}
                                        onToggle={(key, checked) => saveEntityCustomToggle('community', c._id, c, TREK_CUSTOM_PAGES, key, checked)}
                                        saveKey={`comm-${c._id}-custom`}
                                        saving={saving}
                                        emptyHint="Add sections in Page Sections"
                                    />
                                </div>
                            ))
                        )}

                        {/* ── EVENTS ── */}
                        {tab === 'events' && (filteredEvents.length === 0
                            ? <EmptyState label="No events found — create events in Admin → Events" />
                            : filteredEvents.map((s) => (
                                <div key={s._id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors flex-wrap">
                                    <Thumb src={s.poster} icon={Theater} />
                                    <PreviewLink type="events" id={s._id} />
                                    <div className="flex-1 min-w-[8rem]">
                                        <p className="text-sm font-semibold text-white truncate">{s.title || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">
                                            {[s.city, s.eventType, s.status].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                    <AssignCheckGroup
                                        label="Home"
                                        options={homeCheckOpts}
                                        selected={homeSelected(s)}
                                        onToggle={(slug, checked) => saveEntityHomeMulti('events', s._id, s, slug, checked)}
                                        saveKey={`events-${s._id}-home`}
                                        saving={saving}
                                    />
                                    <AssignCheckGroup
                                        label="Events page"
                                        options={EVENTS_PAGE_CHECK_OPTS}
                                        selected={s.pageSection && s.pageSection !== 'hero' ? [s.pageSection] : []}
                                        onToggle={(slug, checked) => {
                                            // Single primary Events-page slot (not Hero — Hero is Home only)
                                            saveEventShow(s._id, { pageSection: checked ? slug : null });
                                        }}
                                        saveKey={`events-${s._id}-page`}
                                        saving={saving}
                                    />
                                    <AssignCheckGroup
                                        label="Custom"
                                        options={eventsCustomPageOpts}
                                        selected={getCustomPageAssignmentKeys(s, EVENTS_CUSTOM_PAGES)}
                                        onToggle={(key, checked) => saveEntityCustomToggle('events', s._id, s, EVENTS_CUSTOM_PAGES, key, checked, 'pagePriority')}
                                        saveKey={`events-${s._id}-custom`}
                                        saving={saving}
                                        emptyHint="Add sections in Page Sections"
                                    />
                                </div>
                            ))
                        )}

                    </div>
                )}

                {/* Footer hint — assign mode */}
                {!loading && mode === 'assign' && (
                    <div className="px-4 py-2 bg-black/20 border-t border-white/4">
                        <p className="text-[10px] text-gray-600">
                            Checkboxes save instantly — tick multiple places for the same card. New sections from{' '}
                            <Link to="/admin/page-sections" className="text-[#0ECCEE] hover:underline">Page Sections</Link>
                            {' '}appear here automatically. For left-to-right order, switch to{' '}
                            <button type="button" onClick={() => handleModeChange('reorder')} className="text-[#0ECCEE] hover:underline">Card order</button>.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

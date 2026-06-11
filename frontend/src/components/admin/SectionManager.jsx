import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, Check, ExternalLink, GripVertical, LayoutGrid, Layers, Loader2, RefreshCw, Search, Flag, Mountain, Users, Dumbbell, Footprints } from 'lucide-react';
import { buildHomeCarouselItems, normalizeHomeCarouselItem } from '../../utils/homeCarouselItems';
import { getCardSizeLabel } from '../../utils/homeCardSize';
import { getTargetPageLabel } from '../../utils/pageSections';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const authFetch = (url, opts = {}) => fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('admin_token')}`, ...opts.headers },
});

// ── Section options ────────────────────────────────────────────────────────────
const HOME_OPTS = [
    { value: '',          label: '— None —' },
    { value: 'trending',  label: '🔥 Trending Now' },
    { value: 'happening', label: '📍 Happening Near You' },
    { value: 'slide',     label: '🎠 Featured Slide' },
];
const FEST_PAGE_OPTS = [
    { value: 'ongoing',      label: '⭐ Featured' },
    { value: 'upcoming',     label: '📋 Listed' },
    { value: 'beyondcampus', label: '🌍 Beyond Campus' },
    { value: 'lastyearhit',  label: '🏆 Last Year Hit' },
    { value: 'completed',    label: '✅ Completed' },
];
const TREK_PAGE_OPTS = [
    { value: '',         label: '— None —' },
    { value: 'hero',     label: '🎬 Coming Soon' },
    { value: 'weekend',  label: '🏕️ Weekend Plans' },
    { value: 'beginner', label: '🌿 Beginner Friendly' },
    { value: 'both',     label: '🌟 Both Sections' },
];
const COMM_PAGE_OPTS = [
    { value: 'communities', label: '🏔️ Explore Communities' },
    { value: 'comingSoon',  label: '🎬 Coming Soon' },
    { value: 'both',        label: '🌟 Both Sections' },
    { value: 'hidden',      label: '🚫 Hidden' },
];
const RUN_CLUB_PAGE_OPTS = [
    { value: 'run_clubs', label: '👟 Explore Run Clubs' },
    { value: 'hidden',    label: '🚫 Hidden' },
];
const SPORTS_HOME_OPTS = [
    { value: '',          label: '— None —' },
    { value: 'trending',  label: '🔥 Trending Now' },
    { value: 'happening', label: '📍 Happening Near You' },
];
const RUN_PAGE_OPTS = [
    { value: 'upcoming', label: '🏃 Upcoming Activities' },
    { value: 'hidden',   label: '🚫 Hidden from Page' },
];

const FEST_CUSTOM_PAGES = ['fests', 'cultural-fest', 'tech-fest', 'sports-fest', 'theatre'];
const TREK_CUSTOM_PAGES = ['treks', 'theatre'];
const SPORTS_CUSTOM_PAGES = ['sports', 'theatre'];

function parseCustomPageValue(val) {
    if (!val || !val.includes(':')) return null;
    const [page, ...rest] = val.split(':');
    return { page, sectionSlug: rest.join(':') };
}

function getCustomPageValue(entity, pages) {
    const match = (entity.customPageSections || []).find((a) => pages.includes(a.page));
    return match ? `${match.page}:${match.sectionSlug}` : '';
}

function buildCustomPageOpts(sections, pages) {
    return [
        { value: '', label: '— None —' },
        ...sections
            .filter((s) => s.enabled !== false && pages.includes(s.targetPage || 'home'))
            .map((s) => ({
                value: `${s.targetPage}:${s.slug}`,
                label: `✨ ${getTargetPageLabel(s.targetPage)} — ${s.title}`,
            })),
    ];
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

/* Assign = section dropdown only (order is set in Reorder mode) */
function AssignPill({ selectValue, selectOpts, onSelect, saveKey, saving }) {
    const isSet = selectValue && selectValue !== '';
    return (
        <div className={`flex items-center gap-1.5 rounded-xl px-2 py-2 border transition-colors min-w-[11rem] ${isSet ? 'bg-[#0ECCEE]/5 border-[#0ECCEE]/25' : 'bg-[#0D0E10] border-white/8'}`}>
            <select value={selectValue} onChange={e => onSelect(e.target.value)}
                className={`${sel} ${isSet ? 'text-[#0ECCEE]' : 'text-gray-400'}`}>
                {selectOpts.map(o => <option key={o.value} value={o.value} className={opt}>{o.label}</option>)}
            </select>
            <SaveDot state={saving[saveKey]} />
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
];

const ASSIGN_TABS = [
    { id: 'fests', label: 'Fests', icon: Flag },
    { id: 'treks', label: 'Treks', icon: Mountain },
    { id: 'communities', label: 'Communities', icon: Users },
    { id: 'runclubs', label: 'Run Clubs', icon: Footprints },
    { id: 'runs', label: 'Runs', icon: Dumbbell },
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

const TYPE_BADGE = {
    fest: { label: 'Fest', cls: 'bg-violet-500/20 text-violet-300' },
    trek: { label: 'Trek', cls: 'bg-emerald-500/20 text-emerald-300' },
    community: { label: 'Community', cls: 'bg-sky-500/20 text-sky-300' },
    sport: { label: 'Sport', cls: 'bg-orange-500/20 text-orange-300' },
    runclub: { label: 'Run Club', cls: 'bg-cyan-500/20 text-cyan-300' },
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
    const [loading, setLoading] = useState(true);
    const [errors, setErrors]   = useState({});
    const [saving, setSaving]   = useState({});
    const [search, setSearch]   = useState('');
    const [reordering, setReordering] = useState(false);
    const [customSections, setCustomSections] = useState([]);

    // ── Fetch ────────────────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        setLoading(true); setErrors({});
        const token = localStorage.getItem('admin_token');
        if (!token) { window.location.href = '/admin/login'; return; }

        const safe = async (url, label) => {
            try {
                const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
                if (r.status === 401 || r.status === 403) { localStorage.removeItem('admin_token'); window.location.href = '/admin/login'; return null; }
                if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
                return await r.json();
            } catch (e) { setErrors(prev => ({ ...prev, [label]: e.message })); return null; }
        };

        const [fd, td, cd, sd, rcd, sectionData] = await Promise.all([
            safe(`${API}/admin/fests?limit=500`,            'fests'),
            safe(`${API}/admin/treks?limit=500`,            'treks'),
            safe(`${API}/admin/trek-communities?limit=500`, 'communities'),
            safe(`${API}/admin/sports?limit=500`,           'sports'),
            safe(`${API}/admin/run-clubs?limit=500`,        'runclubs'),
            safe(`${API}/admin/homepage-sections`,          'sections'),
        ]);
        if (fd) setFests(Array.isArray(fd.fests)       ? fd.fests       : []);
        if (td) setTreks(Array.isArray(td.treks)       ? td.treks       : []);
        if (cd) setComms(Array.isArray(cd.communities) ? cd.communities : []);
        if (sd) setSports(Array.isArray(sd.events)     ? sd.events      : []);
        if (rcd) setRunClubs(Array.isArray(rcd.clubs) ? rcd.clubs : []);
        if (sectionData) setCustomSections(Array.isArray(sectionData.sections) ? sectionData.sections : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const syncUrl = useCallback((nextMode, nextTab) => {
        setSearchParams({ mode: nextMode, tab: nextTab }, { replace: true });
    }, [setSearchParams]);

    const handleModeChange = useCallback((nextMode) => {
        setMode(nextMode);
        setSearch('');
        const tabs = nextMode === 'assign' ? ASSIGN_TABS : REORDER_TABS;
        setTab((prev) => {
            const nextTab = tabs.some((t) => t.id === prev)
                ? prev
                : (nextMode === 'assign' ? 'fests' : 'home');
            syncUrl(nextMode, nextTab);
            return nextTab;
        });
    }, [syncUrl]);

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
            const r = await authFetch(url, { method: 'PUT', body: JSON.stringify(body) });
            if (r.status === 401 || r.status === 403) { window.location.href = '/admin/login'; return; }
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Save failed');
            applyLocal?.();
            flash(key);
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
        } catch (e) {
            setSaving(s => ({ ...s, [key]: 'error' }));
            setErrors(prev => ({ ...prev, save: e.message }));
        }
    }, [flash]);

    const saveFest = useCallback((id, fields) => {
        const fid = id;
        Object.entries(fields).forEach(([k, v]) => {
            patch(`${API}/admin/fests/${fid}`, `fest-${fid}-${k}`, { [k]: v },
                () => setFests(prev => prev.map(f => (f._id === fid || f.id === fid) ? { ...f, [k]: v } : f)));
        });
    }, [patch]);

    const saveFestHome = useCallback((id, val) => {
        if (val === 'movingSlide') saveFest(id, { homeSection: null, showOnHomeSlide: true });
        else saveFest(id, { homeSection: val || null, showOnHomeSlide: false });
    }, [saveFest]);

    const saveTrek = useCallback((id, fields) => {
        patch(`${API}/admin/treks/${id}`, `trek-${id}-${Object.keys(fields)[0]}`, fields,
            () => setTreks(prev => prev.map(t => t._id === id ? { ...t, ...fields } : t)));
    }, [patch]);

    const saveComm = useCallback((id, fields) => {
        const body = fields.pageSection === 'hidden'
            ? { showOnTreks: false }
            : fields.pageSection
                ? { showOnTreks: true, trekPageSection: fields.pageSection }
                : fields;
        patch(`${API}/admin/trek-communities/${id}`, `comm-${id}-${Object.keys(fields)[0]}`, body,
            () => setComms(prev => prev.map(c => c._id === id ? { ...c, ...body, ...fields } : c)));
    }, [patch]);

    const saveRunClub = useCallback((id, fields) => {
        const body = fields.pageSection === 'hidden'
            ? { showOnSportsPage: false, showInRunClubs: false }
            : fields.pageSection === 'run_clubs'
                ? { showOnSportsPage: true, showInRunClubs: true }
                : fields;
        patch(`${API}/admin/run-clubs/${id}`, `runclub-${id}-${Object.keys(fields)[0]}`, body,
            () => setRunClubs(prev => prev.map(c => c._id === id ? { ...c, ...body, ...fields } : c)));
    }, [patch]);

    const saveSports = useCallback((id, fields) => {
        patch(`${API}/admin/sports/${id}`, `sports-${id}-${Object.keys(fields)[0]}`, fields,
            () => setSports(prev => prev.map(s => s._id === id ? { ...s, ...fields } : s)));
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
        () => buildHomeCarouselItems(fests, treks, comms, 'trending', sports, runClubs),
        [fests, treks, comms, sports, runClubs],
    );
    const happeningCarousel = useMemo(
        () => buildHomeCarouselItems(fests, treks, comms, 'happening', sports, runClubs),
        [fests, treks, comms, sports, runClubs],
    );

    const customHomeOpts = useMemo(
        () => customSections
            .filter((s) => s.enabled !== false && (s.targetPage || 'home') === 'home')
            .map((s) => ({ value: s.slug, label: `✨ ${s.title}` })),
        [customSections],
    );

    const festCustomPageOpts = useMemo(
        () => buildCustomPageOpts(customSections, FEST_CUSTOM_PAGES),
        [customSections],
    );
    const trekCustomPageOpts = useMemo(
        () => buildCustomPageOpts(customSections, TREK_CUSTOM_PAGES),
        [customSections],
    );
    const sportsCustomPageOpts = useMemo(
        () => buildCustomPageOpts(customSections, SPORTS_CUSTOM_PAGES),
        [customSections],
    );

    const festHomeSelectOpts = useMemo(
        () => [
            { value: '', label: '— None —' },
            { value: 'movingSlide', label: '🎠 Moving Slide' },
            { value: 'trending', label: '🔥 Trending Now' },
            { value: 'happening', label: '📍 Happening Near You' },
            ...customHomeOpts,
        ],
        [customHomeOpts],
    );

    const entityHomeSelectOpts = useMemo(
        () => [...HOME_OPTS, ...customHomeOpts],
        [customHomeOpts],
    );

    const sportsHomeSelectOpts = useMemo(
        () => [...SPORTS_HOME_OPTS, ...customHomeOpts],
        [customHomeOpts],
    );

    const customCarousels = useMemo(
        () => customSections
            .filter((s) => (s.targetPage || 'home') === 'home')
            .map((section) => ({
                section,
                items: buildHomeCarouselItems(fests, treks, comms, section.slug, sports, runClubs),
            })),
        [customSections, fests, treks, comms, sports, runClubs],
    );

    const saveEntityCustomPage = useCallback((entityType, id, entity, pages, val, priorityField) => {
        const parsed = parseCustomPageValue(val);
        const pagesToClear = pages;
        let next = [...(entity.customPageSections || [])].filter((a) => !pagesToClear.includes(a.page));
        if (parsed) {
            next = [...next, {
                page: parsed.page,
                sectionSlug: parsed.sectionSlug,
                priority: priorityField ? (entity[priorityField] ?? 999) : 999,
            }];
        }
        const body = { customPageSections: next };
        if (entityType === 'fest') {
            patch(`${API}/admin/fests/${id}`, `fest-${id}-custom`, body,
                () => setFests((prev) => prev.map((f) => ((f._id || f.id) === id ? { ...f, ...body } : f))));
        } else if (entityType === 'trek') {
            patch(`${API}/admin/treks/${id}`, `trek-${id}-custom`, body,
                () => setTreks((prev) => prev.map((t) => (t._id === id ? { ...t, ...body } : t))));
        } else if (entityType === 'community') {
            patch(`${API}/admin/trek-communities/${id}`, `comm-${id}-custom`, body,
                () => setComms((prev) => prev.map((c) => (c._id === id ? { ...c, ...body } : c))));
        } else if (entityType === 'sport') {
            patch(`${API}/admin/sports/${id}`, `sports-${id}-custom`, body,
                () => setSports((prev) => prev.map((s) => (s._id === id ? { ...s, ...body } : s))));
        } else if (entityType === 'runclub') {
            patch(`${API}/admin/run-clubs/${id}`, `runclub-${id}-custom`, body,
                () => setRunClubs((prev) => prev.map((c) => (c._id === id ? { ...c, ...body } : c))));
        }
    }, [patch]);

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
            } else {
                setComms((prev) => applyPriority(prev, item._id, 'priority', priority));
            }
        });
    }, []);

    const batchReorder = useCallback(async (updates, applyLocal) => {
        if (!updates.length) return;
        setReordering(true);
        try {
            const r = await authFetch(`${API}/admin/sections/reorder`, {
                method: 'POST',
                body: JSON.stringify({ updates }),
            });
            if (r.status === 401 || r.status === 403) { window.location.href = '/admin/login'; return; }
            if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || 'Batch reorder failed');
            applyLocal?.();
            localStorage.setItem('admin_data_updated', Date.now().toString());
            setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
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
            return { type: 'community', id: item._id, fields: { priority } };
        });
        applyLocalCarouselOrder(section, orderedItems);
        await batchReorder(updates);
    }, [applyLocalCarouselOrder, batchReorder]);

    const getCarouselBySection = useCallback((section) => {
        if (section === 'trending') return trendingCarousel;
        if (section === 'happening') return happeningCarousel;
        return buildHomeCarouselItems(fests, treks, comms, section, sports, runClubs);
    }, [trendingCarousel, happeningCarousel, fests, treks, comms, sports, runClubs]);

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
        () => fests.filter((f) => f.showOnHomeSlide).map((f) => normalizeHomeCarouselItem('fest', f))
            .sort((a, b) => a._priority - b._priority),
        [fests],
    );

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

    const trekPageCarousels = useMemo(() => {
        const norm = (t) => ({ ...normalizeHomeCarouselItem('trek', t), _priority: t.trekPagePriority ?? 999 });
        const inSection = (key) => treks.filter((t) => t.featuredSection === key || t.featuredSection === 'both').map(norm)
            .sort((a, b) => a._priority - b._priority);
        return { hero: inSection('hero'), weekend: inSection('weekend'), beginner: inSection('beginner') };
    }, [treks]);

    const sportsPageCarousels = useMemo(() => {
        const norm = (s, pri) => ({ ...normalizeHomeCarouselItem('sport', s), _priority: pri });
        const upcoming = sports
            .filter((s) => s.runClubId && s.showOnSportsPage !== false && (s.showInUpcoming !== false || s.featuredSection === 'upcoming' || s.featuredSection === 'both'))
            .map((s) => norm(s, s.upcomingPriority ?? s.priority ?? 999))
            .sort((a, b) => a._priority - b._priority);
        const runClubCarousel = runClubs
            .filter((c) => c.showOnSportsPage !== false && c.showInRunClubs !== false)
            .map((c) => ({ ...normalizeHomeCarouselItem('runclub', c), _priority: c.runClubPriority ?? 999 }))
            .sort((a, b) => a._priority - b._priority);
        return { upcoming, run_clubs: runClubCarousel };
    }, [sports, runClubs]);

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
        const updates = next.map((item, i) => ({ type: 'trek', id: item._id, fields: { trekPagePriority: i + 1 } }));
        applyLocalTrekPageOrder(next);
        batchReorder(updates);
    }, [trekPageCarousels, reordering, applyLocalTrekPageOrder, batchReorder]);

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

    const handleMovingSlideReorder = useCallback((fromIndex, toIndex) => {
        if (fromIndex === toIndex || reordering) return;
        const next = [...movingSlideFests];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const updates = next.map((item, i) => ({ type: 'fest', id: item._id, fields: { homePriority: i + 1 } }));
        next.forEach((item, i) => {
            setFests((prev) => prev.map((f) => ((f._id || f.id) === item._id ? { ...f, homePriority: i + 1 } : f)));
        });
        batchReorder(updates);
    }, [movingSlideFests, reordering, batchReorder]);

    // ── Filtered lists ───────────────────────────────────────────────────────
    const q = search.trim().toLowerCase();
    const filteredFests = useMemo(() =>
        fests.filter(f => !q || [f.festName, f.collegeName].some(v => String(v || '').toLowerCase().includes(q)))
             .sort((a, b) => String(a.festName || '').localeCompare(String(b.festName || ''))),
        [fests, q]);
    const filteredTreks = useMemo(() =>
        treks.filter(t => !q || [t.trekName, t.city, t.destination].some(v => String(v || '').toLowerCase().includes(q)))
             .sort((a, b) => String(a.trekName || '').localeCompare(String(b.trekName || ''))),
        [treks, q]);
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

    const getFestHomeVal = (f) => f.homeSection || (f.showOnHomeSlide ? 'movingSlide' : '');

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
                        title="🔥 Trending Now"
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
                        subtitle="Hero banner slides · fests with Moving Slide enabled"
                        items={movingSlideFests}
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
                    {tab === 'runs' ? (
                        <>
                            <span className="w-44 text-center">🏠 Home page</span>
                            <span className="w-44 text-center">🏃 Sports page</span>
                        </>
                    ) : tab === 'runclubs' ? (
                        <>
                            <span className="w-44 text-center">🏠 Home page</span>
                            <span className="w-44 text-center">👟 Sports page</span>
                        </>
                    ) : tab === 'communities' ? (
                        <>
                            <span className="w-44 text-center">🏠 Home page</span>
                            <span className="w-44 text-center">🏔️ Treks page</span>
                        </>
                    ) : (
                        <>
                            <span className="w-44 text-center">🏠 Home page</span>
                            <span className="w-44 text-center">
                                {tab === 'fests' ? '🎭 Fest page' : '🏔️ Own page'}
                            </span>
                        </>
                    )}
                    {(tab === 'fests' && festCustomPageOpts.length > 1)
                        || (tab === 'treks' && trekCustomPageOpts.length > 1)
                        || (tab === 'communities' && trekCustomPageOpts.length > 1)
                        || ((tab === 'runs' || tab === 'runclubs') && sportsCustomPageOpts.length > 1) ? (
                        <span className="w-44 text-center">✨ Custom section</span>
                    ) : null}
                </div>
            )}

            {/* Content */}
            <div className="bg-[#17181A] rounded-2xl border border-white/8 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-20 text-gray-500 text-sm">
                        <Loader2 size={20} className="animate-spin text-[#0ECCEE]" /> Loading…
                    </div>
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
                                            <div key={id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                                                <Thumb src={f.coverImage} icon={Flag} />
                                                <PreviewLink type="fest" id={id} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{f.festName || 'Untitled'}</p>
                                                    <p className="text-[11px] text-gray-600 truncate">{f.collegeName || '—'}</p>
                                                </div>
                                                <AssignPill
                                                    selectValue={getFestHomeVal(f)}
                                                    selectOpts={festHomeSelectOpts}
                                                    onSelect={v => saveFestHome(id, v)}
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
                                                {festCustomPageOpts.length > 1 && (
                                                    <AssignPill
                                                        selectValue={getCustomPageValue(f, FEST_CUSTOM_PAGES)}
                                                        selectOpts={festCustomPageOpts}
                                                        onSelect={(v) => saveEntityCustomPage('fest', id, f, FEST_CUSTOM_PAGES, v)}
                                                        saveKey={`fest-${id}-custom`}
                                                        saving={saving}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ));
                        })()}

                        {/* ── TREKS ── */}
                        {tab === 'treks' && (filteredTreks.length === 0
                            ? <EmptyState label="No treks found" />
                            : filteredTreks.map(t => (
                                <div key={t._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                                    <Thumb src={t.coverImage || t.images?.[0]} icon={Mountain} />
                                    <PreviewLink type="trek" id={t._id} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{t.trekName || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">{[t.city, t.difficultyLevel].filter(Boolean).join(' · ') || '—'}</p>
                                    </div>
                                    <AssignPill
                                        selectValue={t.homeSection || ''}
                                        selectOpts={entityHomeSelectOpts}
                                        onSelect={v => saveTrek(t._id, { homeSection: v || null })}
                                        saveKey={`trek-${t._id}-home`}
                                        saving={saving}
                                    />
                                    <AssignPill
                                        selectValue={t.featuredSection || ''}
                                        selectOpts={TREK_PAGE_OPTS}
                                        onSelect={v => saveTrek(t._id, { featuredSection: v || null })}
                                        saveKey={`trek-${t._id}-page`}
                                        saving={saving}
                                    />
                                    {trekCustomPageOpts.length > 1 && (
                                        <AssignPill
                                            selectValue={getCustomPageValue(t, TREK_CUSTOM_PAGES)}
                                            selectOpts={trekCustomPageOpts}
                                            onSelect={(v) => saveEntityCustomPage('trek', t._id, t, TREK_CUSTOM_PAGES, v)}
                                            saveKey={`trek-${t._id}-custom`}
                                            saving={saving}
                                        />
                                    )}
                                </div>
                            ))
                        )}

                        {/* ── SPORTS ── */}
                        {tab === 'runs' && (filteredRuns.length === 0
                            ? <EmptyState label="No runs found — add runs inside a run club in Admin → Run Clubs" />
                            : filteredRuns.map(s => (
                                <div key={s._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                                    <Thumb src={s.images?.[0] || s.coverImage} icon={Footprints} />
                                    <PreviewLink type="sport" id={s._id} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{s.title || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">
                                            {[s.runCategory, s.city, s.status].filter(Boolean).join(' · ') || '—'}
                                        </p>
                                    </div>
                                    <AssignPill
                                        selectValue={s.homeSection || ''}
                                        selectOpts={sportsHomeSelectOpts}
                                        onSelect={v => saveSports(s._id, { homeSection: v || null })}
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
                                    {sportsCustomPageOpts.length > 1 && (
                                        <AssignPill
                                            selectValue={getCustomPageValue(s, SPORTS_CUSTOM_PAGES)}
                                            selectOpts={sportsCustomPageOpts}
                                            onSelect={(v) => saveEntityCustomPage('sport', s._id, s, SPORTS_CUSTOM_PAGES, v)}
                                            saveKey={`sports-${s._id}-custom`}
                                            saving={saving}
                                        />
                                    )}
                                </div>
                            ))
                        )}

                        {/* ── RUN CLUBS ── */}
                        {tab === 'runclubs' && (filteredRunClubs.length === 0
                            ? <EmptyState label="No run clubs found" />
                            : filteredRunClubs.map(c => {
                                const pageVal = getRunClubPageVal(c);
                                return (
                                    <div key={c._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                                        <Thumb src={c.coverImage} icon={Footprints} />
                                        <PreviewLink type="runclub" id={c._id} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                                            <p className="text-[11px] text-gray-600 truncate">{c.basedIn || c.organizer || '—'}</p>
                                        </div>
                                        <AssignPill
                                            selectValue={c.homeSection || ''}
                                            selectOpts={entityHomeSelectOpts}
                                            onSelect={v => saveRunClub(c._id, { homeSection: v || null })}
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
                                        {sportsCustomPageOpts.length > 1 && (
                                            <AssignPill
                                                selectValue={getCustomPageValue(c, SPORTS_CUSTOM_PAGES)}
                                                selectOpts={sportsCustomPageOpts}
                                                onSelect={(v) => saveEntityCustomPage('runclub', c._id, c, SPORTS_CUSTOM_PAGES, v)}
                                                saveKey={`runclub-${c._id}-custom`}
                                                saving={saving}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}

                        {/* ── COMMUNITIES ── */}
                        {tab === 'communities' && (filteredComms.length === 0
                            ? <EmptyState label="No communities found" />
                            : filteredComms.map(c => {
                                const pageVal = c.showOnTreks === false ? 'hidden' : c.trekPageSection || 'communities';
                                return (
                                    <div key={c._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                                        <Thumb src={c.coverImage} icon={Users} />
                                        <PreviewLink type="community" id={c._id} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                                            <p className="text-[11px] text-gray-600 truncate">{c.basedIn || '—'}</p>
                                        </div>
                                        <AssignPill
                                            selectValue={c.homeSection || ''}
                                            selectOpts={entityHomeSelectOpts}
                                            onSelect={v => saveComm(c._id, { homeSection: v || null })}
                                            saveKey={`comm-${c._id}-home`}
                                            saving={saving}
                                        />
                                        <AssignPill
                                            selectValue={pageVal}
                                            selectOpts={COMM_PAGE_OPTS}
                                            onSelect={v => saveComm(c._id, { pageSection: v })}
                                            saveKey={`comm-${c._id}-page`}
                                            saving={saving}
                                        />
                                        {trekCustomPageOpts.length > 1 && (
                                            <AssignPill
                                                selectValue={getCustomPageValue(c, TREK_CUSTOM_PAGES)}
                                                selectOpts={trekCustomPageOpts}
                                                onSelect={(v) => saveEntityCustomPage('community', c._id, c, TREK_CUSTOM_PAGES, v)}
                                                saveKey={`comm-${c._id}-custom`}
                                                saving={saving}
                                            />
                                        )}
                                    </div>
                                );
                            })
                        )}

                    </div>
                )}

                {/* Footer hint — assign mode */}
                {!loading && mode === 'assign' && (
                    <div className="px-4 py-2 bg-black/20 border-t border-white/4">
                        <p className="text-[10px] text-gray-600">
                            Dropdowns save instantly. To change left-to-right order within a section, switch to{' '}
                            <button type="button" onClick={() => handleModeChange('reorder')} className="text-[#0ECCEE] hover:underline">Card order</button>.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

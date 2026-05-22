import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AlertCircle, Check, Loader2, RefreshCw, Search, Flag, Mountain, Users } from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const clamp = (v) => { const n = parseInt(v, 10); return isNaN(n) ? 999 : Math.max(1, Math.min(999, n)); };

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

// ── Shared UI helpers ──────────────────────────────────────────────────────────
const sel = 'flex-1 min-w-0 bg-transparent text-white text-xs focus:outline-none cursor-pointer';
const opt = 'bg-[#0D0E10] text-white';

function SaveDot({ state }) {
    if (state === 'saving') return <Loader2 size={11} className="animate-spin text-[#0ECCEE] flex-shrink-0" />;
    if (state === 'saved')  return <Check    size={11} className="text-emerald-400 flex-shrink-0" />;
    if (state === 'error')  return <AlertCircle size={11} className="text-red-400 flex-shrink-0" />;
    return <span className="w-3 flex-shrink-0" />;
}

/* Pill = [dropdown | divider | priority input | save dot] */
function Pill({ selectValue, selectOpts, onSelect, priorityValue, onPriority, saveKey, saving }) {
    const [p, setP] = useState(priorityValue && Number(priorityValue) !== 999 ? String(priorityValue) : '');
    useEffect(() => { setP(priorityValue && Number(priorityValue) !== 999 ? String(priorityValue) : ''); }, [priorityValue]);

    const commitPriority = useCallback((val) => {
        const v = val ?? p;
        onPriority(v === '' ? 999 : clamp(v));
    }, [p, onPriority]);

    // Auto-save priority 700ms after typing stops
    useEffect(() => {
        if (p === '' || p === String(priorityValue)) return;
        const t = setTimeout(() => commitPriority(p), 700);
        return () => clearTimeout(t);
    }, [p]); // eslint-disable-line react-hooks/exhaustive-deps

    const isSet = selectValue && selectValue !== '';

    return (
        <div className={`flex items-center gap-1.5 rounded-xl px-2 py-2 border transition-colors ${isSet ? 'bg-[#0ECCEE]/5 border-[#0ECCEE]/25' : 'bg-[#0D0E10] border-white/8'}`}>
            <select value={selectValue} onChange={e => onSelect(e.target.value)}
                className={`${sel} ${isSet ? 'text-[#0ECCEE]' : 'text-gray-400'}`}>
                {selectOpts.map(o => <option key={o.value} value={o.value} className={opt}>{o.label}</option>)}
            </select>
            <div className="w-px h-3.5 bg-white/10 flex-shrink-0" />
            <input
                type="number" min="1" max="999" value={p} placeholder="—"
                onChange={e => setP(e.target.value)}
                onBlur={() => commitPriority()}
                onKeyDown={e => { if (e.key === 'Enter') { e.target.blur(); } if (e.key === 'Escape') setP(''); }}
                className={`w-10 bg-transparent text-center text-xs font-bold focus:outline-none ${isSet ? 'text-[#0ECCEE]' : 'text-gray-500'} placeholder:text-gray-700`}
                title="Priority (1 = first)"
            />
            <SaveDot state={saving[saveKey]} />
        </div>
    );
}

function Thumb({ src, icon: Icon }) {
    return (
        <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-[#1A1B1D] flex items-center justify-center">
            {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Icon size={16} className="text-gray-600" />}
        </div>
    );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SectionManager() {
    const [tab, setTab]         = useState('fests');
    const [fests, setFests]     = useState([]);
    const [treks, setTreks]     = useState([]);
    const [comms, setComms]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [errors, setErrors]   = useState({});
    const [saving, setSaving]   = useState({});
    const [search, setSearch]   = useState('');

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

        const [fd, td, cd] = await Promise.all([
            safe(`${API}/admin/fests?limit=500`,            'fests'),
            safe(`${API}/admin/treks?limit=500`,            'treks'),
            safe(`${API}/admin/trek-communities?limit=500`, 'communities'),
        ]);
        if (fd) setFests(Array.isArray(fd.fests)       ? fd.fests       : []);
        if (td) setTreks(Array.isArray(td.treks)       ? td.treks       : []);
        if (cd) setComms(Array.isArray(cd.communities) ? cd.communities : []);
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

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

    const getFestHomeVal = (f) => f.homeSection || (f.showOnHomeSlide ? 'movingSlide' : '');

    const tabs = [
        { id: 'fests',       label: 'Fests',       icon: Flag,     count: fests.length },
        { id: 'treks',       label: 'Treks',        icon: Mountain, count: treks.length },
        { id: 'communities', label: 'Communities',  icon: Users,    count: comms.length },
    ];

    return (
        <div className="max-w-5xl mx-auto space-y-5">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 px-1">
                <div>
                    <h1 className="text-xl font-bold text-white">Section Manager</h1>
                    <p className="text-xs text-gray-500 mt-0.5">Assign fests, treks & communities to home page and page sections · set display priority</p>
                </div>
                <button onClick={fetchAll} disabled={loading}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-gray-300 transition-colors disabled:opacity-50">
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
                </button>
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

            {/* Tabs + Search */}
            <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-[#17181A] p-1 rounded-xl border border-white/8">
                    {tabs.map(t => (
                        <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); }}
                            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all
                                ${tab === t.id ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                            <t.icon size={13} />{t.label}
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.id ? 'bg-black/20 text-black' : 'bg-white/8 text-gray-500'}`}>{t.count}</span>
                        </button>
                    ))}
                </div>
                <div className="relative flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${tab}…`}
                        className="w-full h-10 bg-[#17181A] border border-white/8 rounded-xl pl-8 pr-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/50" />
                </div>
            </div>

            {/* Column headers */}
            {!loading && (
                <div className="flex items-center gap-3 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-600">
                    <span className="w-10 flex-shrink-0" />
                    <span className="flex-1">Name</span>
                    <span className="w-52 text-center">🏠 Home Page  <span className="text-gray-700 normal-case font-normal">(section · priority)</span></span>
                    <span className="w-52 text-center">
                        {tab === 'fests' ? '🎭 Fest Section' : tab === 'treks' ? '🏔️ Treks Page' : '🏔️ Treks Page'}
                        <span className="text-gray-700 normal-case font-normal">
                            {tab === 'fests' ? ' (Featured / Listed)' : ' (section · priority)'}
                        </span>
                    </span>
                </div>
            )}

            {/* Content */}
            <div className="bg-[#17181A] rounded-2xl border border-white/8 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center gap-3 py-20 text-gray-500 text-sm">
                        <Loader2 size={20} className="animate-spin text-[#0ECCEE]" /> Loading…
                    </div>
                ) : (
                    <div className="divide-y divide-white/[0.04] max-h-[640px] overflow-y-auto">

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
                                    <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] border-y border-white/[0.05]">
                                        <span className="text-xs font-bold uppercase tracking-widest text-gray-400">{group.label}</span>
                                        <span className="text-[10px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded-full">{group.fests.length}</span>
                                    </div>
                                    {group.fests.map(f => {
                                        const id = f._id || f.id;
                                        return (
                                            <div key={id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                                <Thumb src={f.coverImage} icon={Flag} />
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">{f.festName || 'Untitled'}</p>
                                                    <p className="text-[11px] text-gray-600 truncate">{f.collegeName || '—'}</p>
                                                </div>
                                                <Pill
                                                    selectValue={getFestHomeVal(f)}
                                                    selectOpts={[{ value: '', label: '— None —' }, { value: 'movingSlide', label: '🎠 Moving Slide' }, { value: 'trending', label: '🔥 Trending Now' }, { value: 'happening', label: '📍 Happening Near You' }]}
                                                    onSelect={v => saveFestHome(id, v)}
                                                    priorityValue={f.homePriority}
                                                    onPriority={v => saveFest(id, { homePriority: v })}
                                                    saveKey={`fest-${id}-home`}
                                                    saving={saving}
                                                />
                                                <Pill
                                                    selectValue={f.status || 'upcoming'}
                                                    selectOpts={FEST_PAGE_OPTS}
                                                    onSelect={v => saveFest(id, { status: v })}
                                                    priorityValue={f.priority}
                                                    onPriority={v => saveFest(id, { priority: v })}
                                                    saveKey={`fest-${id}-page`}
                                                    saving={saving}
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
                            : filteredTreks.map(t => (
                                <div key={t._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                    <Thumb src={t.coverImage || t.images?.[0]} icon={Mountain} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-white truncate">{t.trekName || 'Untitled'}</p>
                                        <p className="text-[11px] text-gray-600 truncate">{[t.city, t.difficultyLevel].filter(Boolean).join(' · ') || '—'}</p>
                                    </div>
                                    <Pill
                                        selectValue={t.homeSection || ''}
                                        selectOpts={HOME_OPTS}
                                        onSelect={v => saveTrek(t._id, { homeSection: v || null })}
                                        priorityValue={t.priority}
                                        onPriority={v => saveTrek(t._id, { priority: v })}
                                        saveKey={`trek-${t._id}-home`}
                                        saving={saving}
                                    />
                                    <Pill
                                        selectValue={t.featuredSection || ''}
                                        selectOpts={TREK_PAGE_OPTS}
                                        onSelect={v => saveTrek(t._id, { featuredSection: v || null })}
                                        priorityValue={t.trekPagePriority}
                                        onPriority={v => saveTrek(t._id, { trekPagePriority: v })}
                                        saveKey={`trek-${t._id}-page`}
                                        saving={saving}
                                    />
                                </div>
                            ))
                        )}

                        {/* ── COMMUNITIES ── */}
                        {tab === 'communities' && (filteredComms.length === 0
                            ? <EmptyState label="No communities found" />
                            : filteredComms.map(c => {
                                const pageVal = c.showOnTreks === false ? 'hidden' : c.trekPageSection || 'communities';
                                return (
                                    <div key={c._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02] transition-colors">
                                        <Thumb src={c.coverImage} icon={Users} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{c.name || 'Untitled'}</p>
                                            <p className="text-[11px] text-gray-600 truncate">{c.basedIn || '—'}</p>
                                        </div>
                                        <Pill
                                            selectValue={c.homeSection || ''}
                                            selectOpts={HOME_OPTS}
                                            onSelect={v => saveComm(c._id, { homeSection: v || null })}
                                            priorityValue={c.priority}
                                            onPriority={v => saveComm(c._id, { priority: v })}
                                            saveKey={`comm-${c._id}-home`}
                                            saving={saving}
                                        />
                                        <Pill
                                            selectValue={pageVal}
                                            selectOpts={COMM_PAGE_OPTS}
                                            onSelect={v => saveComm(c._id, { pageSection: v })}
                                            priorityValue={c.trekPagePriority}
                                            onPriority={v => saveComm(c._id, { trekPagePriority: v })}
                                            saveKey={`comm-${c._id}-page`}
                                            saving={saving}
                                        />
                                    </div>
                                );
                            })
                        )}

                    </div>
                )}

                {/* Footer hint */}
                {!loading && (
                    <div className="px-4 py-2 bg-black/20 border-t border-white/[0.04]">
                        <p className="text-[10px] text-gray-700">
                            Change dropdown → saves instantly · Type priority number → press <kbd className="bg-white/10 text-gray-500 px-1 rounded text-[9px]">Enter</kbd> or click away to save · 1 = first position · blank = default
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

function EmptyState({ label }) {
    return (
        <div className="flex items-center justify-center py-16 text-sm text-gray-600">{label}</div>
    );
}

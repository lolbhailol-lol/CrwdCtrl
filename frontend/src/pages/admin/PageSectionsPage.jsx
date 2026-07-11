import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    AlertCircle, ArrowRight, Layers, LayoutGrid, Loader2, Plus, Sparkles,
} from 'lucide-react';
import { adminFetchJSON } from '../../utils/adminApi';
import { getCardSizeShortLabel } from '../../utils/homeCardSize';
import { getTargetPageLabel } from '../../utils/pageSections';
import CardSizePicker from '../../components/admin/CardSizePicker';
import TargetPagePicker from '../../components/admin/TargetPagePicker';
import SectionListByPage from '../../components/admin/SectionListByPage';
import SectionLivePreview from '../../components/admin/SectionLivePreview';
import HomeFeaturedSlotsEditor from '../../components/admin/HomeFeaturedSlotsEditor';
import { useDialog } from '../../context/DialogContext';

export default function PageSectionsPage() {
    const { confirm } = useDialog();
    const [sections, setSections] = useState([]);
    const [fests, setFests] = useState([]);
    const [treks, setTreks] = useState([]);
    const [comms, setComms] = useState([]);
    const [sports, setSports] = useState([]);
    const [runClubs, setRunClubs] = useState([]);
    const [eventShows, setEventShows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [saving, setSaving] = useState({});
    const [creating, setCreating] = useState(false);

    const [title, setTitle] = useState('');
    const [cardSize, setCardSize] = useState('wide');
    const [targetPage, setTargetPage] = useState('home');

    const stats = useMemo(() => {
        const pagesUsed = new Set(sections.map((s) => s.targetPage || 'home')).size;
        const live = sections.filter((s) => s.enabled !== false).length;
        return { total: sections.length, pagesUsed, live };
    }, [sections]);

    const notifySite = () => {
        localStorage.setItem('admin_data_updated', Date.now().toString());
        setTimeout(() => localStorage.removeItem('admin_data_updated'), 1000);
        // Same-tab listeners (storage events only fire across tabs)
        window.dispatchEvent(new Event('admin_data_updated'));
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [sectionData, festData, trekData, commData, sportData, clubData, eventData] = await Promise.all([
                adminFetchJSON('/admin/homepage-sections'),
                adminFetchJSON('/admin/fests?limit=500'),
                adminFetchJSON('/admin/treks?limit=500'),
                adminFetchJSON('/admin/trek-communities?limit=500'),
                adminFetchJSON('/admin/sports?limit=500'),
                adminFetchJSON('/admin/run-clubs?limit=500'),
                adminFetchJSON('/admin/events?limit=500'),
            ]);
            setSections(Array.isArray(sectionData.sections) ? sectionData.sections : []);
            setFests(Array.isArray(festData.fests) ? festData.fests : []);
            setTreks(Array.isArray(trekData.treks) ? trekData.treks : []);
            setComms(Array.isArray(commData.communities) ? commData.communities : []);
            setSports(Array.isArray(sportData.events) ? sportData.events : []);
            setRunClubs(Array.isArray(clubData.clubs) ? clubData.clubs : []);
            setEventShows(Array.isArray(eventData.shows) ? eventData.shows : []);
        } catch (e) {
            setError(e.message || 'Failed to load data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const flash = useCallback((key) => {
        setSaving((s) => ({ ...s, [key]: 'saved' }));
        setTimeout(() => setSaving((s) => { const n = { ...s }; delete n[key]; return n; }), 1400);
    }, []);

    const handleCreate = async () => {
        if (!title.trim()) return;
        setCreating(true);
        setError('');
        setSuccess('');
        try {
            const data = await adminFetchJSON('/admin/homepage-sections', {
                method: 'POST',
                body: JSON.stringify({ title: title.trim(), cardSize, targetPage }),
            });
            setSections((prev) => [...prev, data.section]);
            setTitle('');
            setCardSize('wide');
            setTargetPage('home');
            setSuccess(`"${data.section.title}" created — assign content next.`);
            setTimeout(() => setSuccess(''), 4000);
            notifySite();
        } catch (e) {
            setError(e.message || 'Failed to create section');
        } finally {
            setCreating(false);
        }
    };

    const handleUpdate = async (id, fields) => {
        const key = `section-${id}`;
        setSaving((s) => ({ ...s, [key]: 'saving' }));
        try {
            const data = await adminFetchJSON(`/admin/homepage-sections/${id}`, {
                method: 'PUT',
                body: JSON.stringify(fields),
            });
            setSections((prev) => prev.map((sec) => (sec._id === id ? data.section : sec)));
            flash(key);
            notifySite();
        } catch (e) {
            setSaving((s) => ({ ...s, [key]: 'error' }));
            setError(e.message || 'Failed to update section');
        }
    };

    const handleTitleDraft = (id, newTitle) => {
        setSections((prev) => prev.map((sec) => (sec._id === id ? { ...sec, title: newTitle } : sec)));
    };

    const handleDelete = async (id) => {
        if (!(await confirm({ title: 'Delete section?', message: 'Delete this section? Items assigned to it will be unassigned.', confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/homepage-sections/${id}`, { method: 'DELETE' });
            setSections((prev) => prev.filter((s) => s._id !== id));
            notifySite();
        } catch (e) {
            setError(e.message || 'Failed to delete section');
        }
    };

    const handleReorder = async (page, fromIndex, toIndex) => {
        if (fromIndex === toIndex) return;
        const pageSections = sections
            .filter((s) => (s.targetPage || 'home') === page)
            .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999));
        const next = [...pageSections];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        const orderedIds = next.map((s) => s._id);
        const orderMap = Object.fromEntries(orderedIds.map((id, i) => [id, i + 1]));
        setSections((prev) => prev.map((s) => (
            orderMap[s._id] ? { ...s, displayOrder: orderMap[s._id] } : s
        )));
        try {
            await adminFetchJSON('/admin/homepage-sections/reorder', {
                method: 'POST',
                body: JSON.stringify({ orderedIds }),
            });
            notifySite();
        } catch (e) {
            setError(e.message || 'Failed to reorder sections');
            fetchAll();
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 py-24">
                <Loader2 size={28} className="animate-spin text-[#0ECCEE]" />
                <p className="text-sm text-gray-500">Loading page sections…</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-10">
            {/* Hero header */}
            <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-linear-to-br from-[#121316] via-[#161718] to-[#0ECCEE]/10 p-6 sm:p-8">
                <div className="absolute top-0 right-0 w-48 h-48 bg-[#0ECCEE]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
                <div className="relative flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                    <div className="space-y-3 max-w-xl">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[#0ECCEE]/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#0ECCEE]">
                            <Sparkles size={12} /> Page builder
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Page Sections</h1>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Add custom scrolling carousels to any page. Pick a card style, choose the target page, then assign content in Home &amp; Sections.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <span className="rounded-lg bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-gray-300">
                                <span className="text-white font-bold">{stats.total}</span> sections
                            </span>
                            <span className="rounded-lg bg-white/5 border border-white/8 px-3 py-1.5 text-xs text-gray-300">
                                <span className="text-white font-bold">{stats.pagesUsed}</span> pages
                            </span>
                            <span className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs text-emerald-400">
                                <span className="font-bold">{stats.live}</span> live
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 shrink-0">
                        <Link
                            to="/admin/sections?mode=assign"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#0ECCEE] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#3dd8f5] transition-colors"
                        >
                            <Layers size={16} /> Assign content
                        </Link>
                        <a
                            href="/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/5 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/10 transition-colors"
                        >
                            Preview site <ArrowRight size={14} />
                        </a>
                    </div>
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-sm text-red-300">
                    <AlertCircle size={16} className="shrink-0" /> {error}
                </div>
            )}

            {success && (
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-sm text-emerald-300">
                    <Sparkles size={16} className="shrink-0" /> {success}
                </div>
            )}

            <HomeFeaturedSlotsEditor
                fests={fests}
                eventShows={eventShows}
                treks={treks}
                communities={comms}
                sports={sports}
                runClubs={runClubs}
            />

            {/* Wizard + live preview */}
            <div className="grid xl:grid-cols-[1fr_minmax(280px,320px)] gap-5 items-start">
                <div className="rounded-2xl border border-white/8 bg-[#17181A] p-5 sm:p-6 space-y-5 shadow-xl shadow-black/20">
                    <div className="flex items-center gap-2 pb-1 border-b border-white/6">
                        <LayoutGrid size={18} className="text-[#0ECCEE]" />
                        <h2 className="text-base font-bold text-white">Create new section</h2>
                    </div>

                    <div className="rounded-xl border border-white/6 bg-[#0D0E10]/60 p-4">
                        <div className="flex items-start gap-3 mb-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0ECCEE]/15 text-[11px] font-bold text-[#0ECCEE] ring-1 ring-[#0ECCEE]/25">
                                1
                            </span>
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-white">Section heading</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">Shown above the carousel on the live site.</p>
                                <input
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' && title.trim()) handleCreate(); }}
                                    placeholder="e.g. Weekend Picks, Top Communities, Must See"
                                    className="mt-3 w-full h-11 bg-[#121316] border border-white/10 rounded-xl px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0ECCEE]/50 focus:ring-1 focus:ring-[#0ECCEE]/25"
                                />
                            </div>
                        </div>
                    </div>

                    <CardSizePicker value={cardSize} onChange={setCardSize} />
                    <TargetPagePicker value={targetPage} onChange={setTargetPage} />

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-white/8">
                        <div className="flex-1 rounded-xl bg-[#0D0E10]/80 border border-white/6 px-4 py-3">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mb-1">Ready to publish</p>
                            <p className="text-sm text-white font-semibold truncate">
                                {title.trim() || 'Untitled section'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {getCardSizeShortLabel(cardSize)} · {getTargetPageLabel(targetPage)}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={creating || !title.trim()}
                            className="flex items-center justify-center gap-2 h-11 px-6 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold disabled:opacity-40 hover:bg-[#3dd8f5] transition-colors shrink-0 shadow-lg shadow-[#0ECCEE]/20"
                        >
                            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            Create section
                        </button>
                    </div>
                </div>

                <div className="xl:sticky xl:top-4 rounded-2xl border border-white/8 bg-[#121316] p-3 shadow-xl shadow-black/20 order-first xl:order-last">
                    <SectionLivePreview
                        title={title}
                        cardSize={cardSize}
                        targetPage={targetPage}
                        existingSections={sections}
                        fests={fests}
                        treks={treks}
                        comms={comms}
                        sports={sports}
                    />
                </div>
            </div>

            <SectionListByPage
                sections={sections}
                fests={fests}
                treks={treks}
                comms={comms}
                sports={sports}
                runClubs={runClubs}
                eventShows={eventShows}
                saving={saving}
                onUpdate={handleUpdate}
                onTitleDraft={handleTitleDraft}
                onDelete={handleDelete}
                onReorder={handleReorder}
            />
        </div>
    );
}

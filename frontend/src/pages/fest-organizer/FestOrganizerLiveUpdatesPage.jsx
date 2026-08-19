import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
    Archive, Bell, Eye, Loader, MapPin, Pin, Plus, Radio, RefreshCw,
    Trash2, Zap,
} from 'lucide-react';
import {
    fetchFestOrganizerLiveUpdateMeta,
    fetchFestOrganizerLiveUpdates,
    createFestOrganizerLiveUpdate,
    updateFestOrganizerLiveUpdate,
    publishFestOrganizerLiveUpdate,
    archiveFestOrganizerLiveUpdate,
    deleteFestOrganizerLiveUpdate,
} from '../../services/api/festOrganizer.api';
import { useDialog } from '../../context/DialogContext';
import { getFestPlugin } from '../../features/fests/plugins';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const emptyForm = {
    title: '',
    body: '',
    type: 'happening_now',
    locationLabel: '',
    locationMapUrl: '',
    happensAt: '',
    competitionId: '',
    pinned: false,
    urgent: false,
    notifyOnPublish: true,
    publish: true,
};

function formatWhen(d) {
    if (!d) return '';
    try {
        return new Date(d).toLocaleString('en-IN', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return '';
    }
}

function toLocalInput(d) {
    if (!d) return '';
    try {
        const date = new Date(d);
        if (Number.isNaN(date.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    } catch {
        return '';
    }
}

function typeTone(type, urgent) {
    if (urgent || type === 'emergency') return 'border-rose-400/35 bg-rose-500/10';
    if (type === 'happening_now') return 'border-red-400/30 bg-red-500/10';
    if (type === 'delay') return 'border-amber-400/30 bg-amber-500/10';
    if (type === 'pro_show') return 'border-fuchsia-400/25 bg-fuchsia-500/10';
    if (type === 'competition') return 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10';
    return 'border-white/10 bg-[#161718]';
}

export default function FestOrganizerLiveUpdatesPage() {
    const { festId } = useParams();
    const { toast, confirm } = useDialog();
    const mindSpark = getFestPlugin(festId).id === 'mindspark';
    const [lastPublishConnect, setLastPublishConnect] = useState(null);

    const [meta, setMeta] = useState({ types: [], templates: [], competitions: [] });
    const [rows, setRows] = useState([]);
    const [counts, setCounts] = useState({ draft: 0, published: 0, archived: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('active');
    const [typeFilter, setTypeFilter] = useState('');
    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState('');
    const [saving, setSaving] = useState(false);
    const [busyId, setBusyId] = useState('');
    const [composerOpen, setComposerOpen] = useState(true);

    const visibleTypes = useMemo(
        () => (mindSpark
            ? (meta.types || []).filter((t) => t.id !== 'pro_show')
            : (meta.types || [])),
        [meta.types, mindSpark],
    );
    const visibleTemplates = useMemo(
        () => (mindSpark
            ? (meta.templates || []).filter((t) => t.type !== 'pro_show' && !/pro\s*show/i.test(t.title || ''))
            : (meta.templates || [])),
        [meta.templates, mindSpark],
    );

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (typeFilter) params.type = typeFilter;
            const [m, list] = await Promise.all([
                fetchFestOrganizerLiveUpdateMeta(festId),
                fetchFestOrganizerLiveUpdates(festId, params),
            ]);
            setMeta({
                types: m.types || [],
                templates: m.templates || [],
                competitions: m.competitions || [],
            });
            setRows(list.updates || []);
            setCounts(list.counts || { draft: 0, published: 0, archived: 0, total: 0 });
        } catch (e) {
            toast(e.message || 'Failed to load live updates');
        } finally {
            setLoading(false);
        }
    }, [festId, statusFilter, typeFilter, toast]);

    useEffect(() => {
        load();
    }, [load]);

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    const applyTemplate = (t) => {
        setForm({
            ...emptyForm,
            title: t.title || '',
            body: t.body || '',
            type: t.type || 'general',
            locationLabel: t.locationLabel || '',
            urgent: Boolean(t.urgent),
            notifyOnPublish: t.notifyOnPublish !== false,
            publish: true,
        });
        setEditingId('');
        setComposerOpen(true);
        toast(t.title);
    };

    const resetForm = () => {
        setForm(emptyForm);
        setEditingId('');
    };

    const startEdit = (row) => {
        setEditingId(row.id);
        setForm({
            title: row.title || '',
            body: row.body || '',
            type: row.type || 'general',
            locationLabel: row.locationLabel || '',
            locationMapUrl: row.locationMapUrl || '',
            happensAt: toLocalInput(row.happensAt),
            competitionId: row.competitionId || '',
            pinned: Boolean(row.pinned),
            urgent: Boolean(row.urgent),
            notifyOnPublish: Boolean(row.notifyOnPublish),
            publish: row.status === 'published',
        });
        setComposerOpen(true);
    };

    const payloadFromForm = () => ({
        title: form.title.trim(),
        body: form.body.trim(),
        type: form.type,
        locationLabel: form.locationLabel.trim(),
        locationMapUrl: form.locationMapUrl.trim(),
        happensAt: form.happensAt ? new Date(form.happensAt).toISOString() : null,
        competitionId: form.competitionId || null,
        pinned: form.pinned,
        urgent: form.urgent,
        notifyOnPublish: form.notifyOnPublish,
        publish: form.publish,
        status: form.publish ? 'published' : 'draft',
    });

    const save = async (e) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast('Title required');
            return;
        }
        setSaving(true);
        try {
            const body = payloadFromForm();
            if (editingId) {
                const res = await updateFestOrganizerLiveUpdate(festId, editingId, {
                    ...body,
                    sendNotify: Boolean(form.publish && form.notifyOnPublish),
                });
                toast(res.message || 'Saved');
            } else {
                const res = await createFestOrganizerLiveUpdate(festId, body);
                toast(res.message || 'Created');
                if (res.notify?.participants) {
                    toast(`Notified ${res.notify.participants}`);
                }
                if (form.publish) {
                    setLastPublishConnect({
                        competitionId: form.competitionId || '',
                        message: [form.title, form.body].filter(Boolean).join('\n').slice(0, 280),
                    });
                }
            }
            resetForm();
            await load();
        } catch (err) {
            toast(err.message || 'Failed');
        } finally {
            setSaving(false);
        }
    };

    const publish = async (row) => {
        setBusyId(`pub-${row.id}`);
        try {
            const res = await publishFestOrganizerLiveUpdate(festId, row.id, {
                notifyOnPublish: row.notifyOnPublish,
            });
            toast(res.message || 'Published');
            if (res.notify?.participants) toast(`Notified ${res.notify.participants}`);
            setLastPublishConnect({
                competitionId: row.competitionId || '',
                message: [row.title, row.body].filter(Boolean).join('\n').slice(0, 280),
            });
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const togglePin = async (row) => {
        setBusyId(`pin-${row.id}`);
        try {
            await updateFestOrganizerLiveUpdate(festId, row.id, { pinned: !row.pinned });
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const archive = async (row) => {
        setBusyId(`arc-${row.id}`);
        try {
            await archiveFestOrganizerLiveUpdate(festId, row.id);
            toast('Archived');
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const remove = async (row) => {
        const ok = await confirm({
            title: 'Delete update?',
            message: row.title,
        });
        if (!ok) return;
        setBusyId(`del-${row.id}`);
        try {
            await deleteFestOrganizerLiveUpdate(festId, row.id);
            toast('Deleted');
            if (editingId === row.id) resetForm();
            await load();
        } catch (e) {
            toast(e.message || 'Failed');
        } finally {
            setBusyId('');
        }
    };

    const livePreview = useMemo(
        () => rows.filter((r) => r.status === 'published').slice(0, 6),
        [rows],
    );

    const typeLabel = (id) => meta.types.find((t) => t.id === id)?.label || id;

    return (
        <div className="max-w-3xl mx-auto space-y-4 pb-10">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold">Fest day</p>
                    <h1 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                        <Radio className="text-[#0ECCEE]" size={20} /> Live updates
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                        {mindSpark
                            ? 'Students see published posts on the fest Live strip. Use Connect for WhatsApp nudges.'
                            : 'Post what\'s happening, where, and when — student feed UI comes later; this desk is the source of truth.'}
                    </p>
                </div>
                <button type="button" onClick={load} className="p-2 rounded-xl border border-white/10 text-gray-400" aria-label="Refresh">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {lastPublishConnect ? (
                <div className="rounded-2xl border border-[#0ECCEE]/25 bg-[#0ECCEE]/10 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-[#7DE8F7]">Published — also nudge via WhatsApp?</p>
                    <Link
                        to={`/fest-organizer/fests/${festId}/notifications?tab=connect${lastPublishConnect.competitionId ? `&competitionId=${lastPublishConnect.competitionId}` : ''}`}
                        className="px-3 py-1.5 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold"
                        onClick={() => setLastPublishConnect(null)}
                    >
                        Open Connect
                    </Link>
                </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2.5">
                {[
                    { id: 'published', label: 'Live', value: counts.published, tone: 'border-emerald-400/30 bg-emerald-500/10' },
                    { id: 'draft', label: 'Drafts', value: counts.draft, tone: 'border-amber-400/30 bg-amber-500/10' },
                    { id: 'active', label: 'All active', value: (counts.published || 0) + (counts.draft || 0), tone: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10' },
                ].map((b) => (
                    <button
                        key={b.id}
                        type="button"
                        onClick={() => setStatusFilter(b.id)}
                        className={`rounded-2xl border p-3 text-left ${b.tone} ${statusFilter === b.id ? 'ring-1 ring-white/20' : ''}`}
                    >
                        <p className="text-xl font-bold tabular-nums text-white">{b.value}</p>
                        <p className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">{b.label}</p>
                    </button>
                ))}
            </div>

            {/* Templates */}
            <section className="space-y-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 px-0.5">Quick post templates</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {(visibleTemplates).map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => applyTemplate(t)}
                            className="shrink-0 px-3 py-2 rounded-xl border border-white/10 bg-[#161718] text-xs text-gray-300 hover:border-[#0ECCEE]/40 inline-flex items-center gap-1.5"
                        >
                            <Zap size={12} className="text-[#0ECCEE]" />
                            {t.title}
                        </button>
                    ))}
                </div>
            </section>

            {/* Composer */}
            <section className="rounded-2xl border border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/10 to-[#161718] overflow-hidden">
                <button
                    type="button"
                    onClick={() => setComposerOpen((o) => !o)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                    <div className="flex items-center gap-2">
                        <Plus size={16} className="text-[#0ECCEE]" />
                        <span className="text-sm font-semibold text-white">
                            {editingId ? 'Edit update' : 'Compose live update'}
                        </span>
                    </div>
                    <span className="text-xs text-gray-500">{composerOpen ? 'Hide' : 'Show'}</span>
                </button>

                {composerOpen ? (
                    <form onSubmit={save} className="px-4 pb-4 space-y-2.5 border-t border-white/5 pt-3">
                        <select
                            value={form.type}
                            onChange={(e) => set('type', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                        >
                            {(visibleTypes).map((t) => (
                                <option key={t.id} value={t.id}>{t.label}</option>
                            ))}
                        </select>
                        <input
                            required
                            value={form.title}
                            onChange={(e) => set('title', e.target.value)}
                            placeholder="Headline — what should people know?"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                        <textarea
                            value={form.body}
                            onChange={(e) => set('body', e.target.value)}
                            rows={3}
                            placeholder="Details (optional)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                        <div className="grid sm:grid-cols-2 gap-2.5">
                            <div className="relative">
                                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    value={form.locationLabel}
                                    onChange={(e) => set('locationLabel', e.target.value)}
                                    placeholder="Where? (stage / room / gate)"
                                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                                />
                            </div>
                            <input
                                type="datetime-local"
                                value={form.happensAt}
                                onChange={(e) => set('happensAt', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            />
                        </div>
                        <input
                            value={form.locationMapUrl}
                            onChange={(e) => set('locationMapUrl', e.target.value)}
                            placeholder="Map / directions link (optional)"
                            className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white placeholder:text-gray-600"
                        />
                        {(meta.competitions || []).length ? (
                            <select
                                value={form.competitionId}
                                onChange={(e) => set('competitionId', e.target.value)}
                                className="w-full px-3 py-2.5 rounded-xl bg-[#121314] border border-white/10 text-sm text-white"
                            >
                                <option value="">Link competition (optional)</option>
                                {meta.competitions.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        ) : null}

                        <div className="flex flex-wrap gap-3 text-xs text-gray-300">
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={form.publish} onChange={(e) => set('publish', e.target.checked)} />
                                Publish now (else draft)
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={form.pinned} onChange={(e) => set('pinned', e.target.checked)} />
                                Pin to top
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={form.urgent} onChange={(e) => set('urgent', e.target.checked)} />
                                Urgent
                            </label>
                            <label className="inline-flex items-center gap-2">
                                <input type="checkbox" checked={form.notifyOnPublish} onChange={(e) => set('notifyOnPublish', e.target.checked)} />
                                Notify participants in-app
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader className="animate-spin" size={16} /> : <Radio size={16} />}
                                {editingId
                                    ? (form.publish ? 'Save & keep live' : 'Save draft')
                                    : (form.publish ? 'Publish to live feed' : 'Save draft')}
                            </button>
                            {editingId ? (
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400"
                                >
                                    Cancel
                                </button>
                            ) : null}
                        </div>
                    </form>
                ) : null}
            </section>

            {/* Student-facing preview (API ready) */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Eye size={14} className="text-[#0ECCEE]" /> Public feed preview
                    </h2>
                    <p className="text-[10px] text-gray-600">GET /fests/:id/live-updates</p>
                </div>
                {livePreview.length ? (
                    <div className="space-y-2">
                        {livePreview.map((u) => (
                            <div key={u.id} className={`rounded-xl border px-3 py-2.5 ${typeTone(u.type, u.urgent)}`}>
                                <div className="flex items-center gap-2 text-[10px] text-gray-500 mb-1">
                                    {u.pinned ? <Pin size={10} className="text-[#0ECCEE]" /> : null}
                                    {u.urgent ? <span className="text-rose-300 font-semibold">URGENT</span> : null}
                                    <span>{typeLabel(u.type)}</span>
                                    <span className="ml-auto tabular-nums">{formatWhen(u.publishedAt || u.createdAt)}</span>
                                </div>
                                <p className="text-sm font-semibold text-white">{u.title}</p>
                                {u.body ? <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{u.body}</p> : null}
                                {(u.locationLabel || u.happensAt) ? (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                        {u.locationLabel ? `📍 ${u.locationLabel}` : ''}
                                        {u.locationLabel && u.happensAt ? ' · ' : ''}
                                        {u.happensAt ? formatWhen(u.happensAt) : ''}
                                    </p>
                                ) : null}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-gray-500 text-center py-6">Nothing published yet — students will see an empty feed</p>
                )}
            </section>

            {/* Filters + list */}
            <div className="flex flex-wrap gap-1.5">
                {[
                    { id: 'active', label: 'Active' },
                    { id: 'published', label: 'Live' },
                    { id: 'draft', label: 'Drafts' },
                    { id: 'archived', label: 'Archived' },
                ].map((s) => (
                    <button
                        key={s.id}
                        type="button"
                        onClick={() => setStatusFilter(s.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            statusFilter === s.id
                                ? 'bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30'
                                : 'text-gray-500'
                        }`}
                    >
                        {s.label}
                    </button>
                ))}
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="ml-auto px-2.5 py-1.5 rounded-lg bg-[#161718] border border-white/10 text-xs text-white"
                >
                    <option value="">All types</option>
                    {(meta.types || []).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                </select>
            </div>

            {loading && !rows.length ? (
                <InlinePageLoader label="Loading…" variant="fest" minHeight={false} />
            ) : (
                <div className="space-y-2.5">
                    {rows.map((row) => (
                        <div
                            key={row.id}
                            className={`rounded-2xl border p-3.5 space-y-2.5 ${typeTone(row.type, row.urgent)}`}
                        >
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] mb-1">
                                        <span className={`px-2 py-0.5 rounded-full capitalize ${
                                            row.status === 'published'
                                                ? 'bg-emerald-500/15 text-emerald-300'
                                                : row.status === 'draft'
                                                    ? 'bg-amber-500/15 text-amber-300'
                                                    : 'bg-white/5 text-gray-500'
                                        }`}
                                        >
                                            {row.status}
                                        </span>
                                        <span className="text-gray-500">{typeLabel(row.type)}</span>
                                        {row.pinned ? <span className="text-[#0ECCEE] inline-flex items-center gap-0.5"><Pin size={10} /> pinned</span> : null}
                                        {row.urgent ? <span className="text-rose-300 font-semibold">urgent</span> : null}
                                        {row.notifiedAt ? <span className="text-gray-600">notified</span> : null}
                                    </div>
                                    <p className="text-[15px] font-semibold text-white">{row.title}</p>
                                    {row.body ? <p className="text-xs text-gray-400 mt-1 whitespace-pre-wrap">{row.body}</p> : null}
                                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-[11px] text-gray-500">
                                        {row.locationLabel ? <span>📍 {row.locationLabel}</span> : null}
                                        {row.happensAt ? <span>🕒 {formatWhen(row.happensAt)}</span> : null}
                                        {row.competitionName ? <span>🏆 {row.competitionName}</span> : null}
                                        <span className="tabular-nums">{formatWhen(row.publishedAt || row.createdAt)}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {row.status !== 'published' ? (
                                    <button
                                        type="button"
                                        disabled={Boolean(busyId)}
                                        onClick={() => publish(row)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0ECCEE] text-black text-xs font-semibold disabled:opacity-50"
                                    >
                                        {busyId === `pub-${row.id}` ? <Loader className="animate-spin" size={12} /> : <Radio size={12} />}
                                        Publish
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={Boolean(busyId)}
                                    onClick={() => startEdit(row)}
                                    className="px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300"
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    disabled={Boolean(busyId)}
                                    onClick={() => togglePin(row)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-300"
                                >
                                    <Pin size={12} /> {row.pinned ? 'Unpin' : 'Pin'}
                                </button>
                                {row.status !== 'archived' ? (
                                    <button
                                        type="button"
                                        disabled={Boolean(busyId)}
                                        onClick={() => archive(row)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-400"
                                    >
                                        <Archive size={12} /> Archive
                                    </button>
                                ) : null}
                                {row.status === 'published' && !row.notifiedAt ? (
                                    <button
                                        type="button"
                                        disabled={Boolean(busyId)}
                                        onClick={async () => {
                                            setBusyId(`n-${row.id}`);
                                            try {
                                                const res = await publishFestOrganizerLiveUpdate(festId, row.id, {
                                                    notifyOnPublish: true,
                                                    forceNotify: true,
                                                });
                                                toast(res.notify?.participants
                                                    ? `Notified ${res.notify.participants}`
                                                    : 'Notify done');
                                                await load();
                                            } catch (e) {
                                                toast(e.message || 'Failed');
                                            } finally {
                                                setBusyId('');
                                            }
                                        }}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-amber-400/25 text-amber-200 text-xs"
                                    >
                                        <Bell size={12} /> Push notify
                                    </button>
                                ) : null}
                                <button
                                    type="button"
                                    disabled={Boolean(busyId)}
                                    onClick={() => remove(row)}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-white/10 text-xs text-gray-500 ml-auto"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    ))}
                    {!rows.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 py-14 text-center text-sm text-gray-500">
                            No updates in this filter — compose one above
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

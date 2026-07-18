import { useEffect, useState, useCallback } from 'react';
import { Mountain, Calendar, Clock, MapPin, Edit2, Trash2, Plus, Eye, EyeOff, Users2, ExternalLink, Phone, Images, GripVertical } from 'lucide-react';
import TrekFormModal from '../../components/admin/TrekFormModal';
import TrekCommunityFormModal from '../../components/admin/TrekCommunityFormModal';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';
import { resolveCoverImage } from '../../utils/coverImages';

function communityBannerUrl(c) {
    return resolveCoverImage(c, 'hero') || c.coverImage || '';
}

/** communityId may be a raw ObjectId string or a populated `{ _id, name }` object. */
function resolveCommunityId(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'object') {
        const id = value._id || value.id;
        return id != null ? String(id) : null;
    }
    return String(value);
}

function sortByCommunityPriority(list) {
    return [...list].sort((a, b) => {
        const pa = Number(a.communityPriority) || 999;
        const pb = Number(b.communityPriority) || 999;
        if (pa !== pb) return pa - pb;
        const da = a.trekDate ? new Date(a.trekDate).getTime() : Infinity;
        const db = b.trekDate ? new Date(b.trekDate).getTime() : Infinity;
        if (da !== db) return da - db;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
}

function useListDragDrop(onReorder) {
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

    return {
        draggedIndex,
        overIndex,
        setOverIndex,
        handleDragStart,
        handleDragOver,
        handleDrop,
        handleDragEnd: () => { setDraggedIndex(null); setOverIndex(null); },
    };
}

const DIFFICULTY_BADGE = {
    easy:     'bg-green-900/60 text-green-300 border border-green-700',
    moderate: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
    difficult:'bg-orange-900/60 text-orange-300 border border-orange-700',
    extreme:  'bg-red-900/60 text-red-300 border border-red-700',
};

const STATUS_BADGE = {
    published: 'bg-green-900/60 text-green-300 border border-green-700',
    draft:     'bg-gray-700 text-gray-300 border border-gray-600',
    completed: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    cancelled: 'bg-red-900/60 text-red-300 border border-red-700',
};

const TREK_PAGE_SECTION_LABELS = {
    communities: 'Explore',
    comingSoon: 'Coming Soon',
    both: 'Both',
};

function galleryCount(c) {
    const urls = new Set();
    if (c.coverImage) urls.add(c.coverImage);
    (c.galleryImages || []).filter(Boolean).forEach((url) => urls.add(url));
    return urls.size;
}

function formatDate(d) {
    if (!d) return 'TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Trek Row (clean list item inside community) ── */
function AdminTrekCard({
    trek,
    rank,
    onEdit,
    onDelete,
    draggable = false,
    isDragging = false,
    isOver = false,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onDragEnd,
}) {
    const [imgErr, setImgErr] = useState(false);
    const diff = DIFFICULTY_BADGE[trek.difficultyLevel];

    return (
        <div
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            className={`flex items-center gap-3 px-3 sm:px-4 py-3 transition-colors group ${
                isDragging ? 'opacity-40' : ''
            } ${isOver ? 'bg-[#0ECCEE]/10' : 'hover:bg-white/3'}`}
        >
            {draggable ? (
                <div className="flex items-center gap-2 shrink-0 cursor-grab active:cursor-grabbing text-gray-600" title="Drag to set community page order">
                    <GripVertical size={16} aria-hidden />
                    <span className="w-6 text-center text-[11px] font-bold tabular-nums text-gray-500">
                        {rank}
                    </span>
                </div>
            ) : null}

            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                {(trek.coverImages?.portrait || trek.coverImage || trek.images?.[0] || trek.heroImages?.[0]) && !imgErr
                    ? <img src={trek.coverImages?.portrait || trek.coverImage || trek.images?.[0] || trek.heroImages?.[0]} alt={trek.trekName} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                    : <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-green-900 to-emerald-700">
                        <Mountain size={20} className="text-white/40" />
                      </div>
                }
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{trek.trekName}</p>
                    {trek.difficultyLevel && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${diff || 'bg-gray-700 text-gray-300'}`}>
                            {trek.difficultyLevel}
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${STATUS_BADGE[trek.status] || 'bg-gray-700 text-gray-300'}`}>
                        {trek.status}
                    </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {(trek.city || trek.destination) && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <MapPin size={10} />{trek.city || trek.destination}
                        </span>
                    )}
                    {trek.trekDate && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Calendar size={10} />{formatDate(trek.trekDate)}
                        </span>
                    )}
                    {trek.trekDuration && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Clock size={10} />{trek.trekDuration}
                        </span>
                    )}
                </div>
            </div>

            {/* Price */}
            <span className={`text-sm font-bold shrink-0 ${trek.registrationFee > 0 ? 'text-[#0ECCEE]' : 'text-green-400'}`}>
                {trek.registrationFee > 0 ? `₹${trek.registrationFee}` : 'Free'}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-1.5 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(trek)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                    title="Edit trek">
                    <Edit2 size={13} className="text-white" />
                </button>
                <button onClick={() => onDelete(trek._id, trek.trekName)}
                    className="p-2 bg-red-900/60 hover:bg-red-600 rounded-lg transition-colors border border-red-800"
                    title="Delete trek">
                    <Trash2 size={13} className="text-red-400" />
                </button>
            </div>
        </div>
    );
}

function CommunityTrekList({ treks, saving, onReorder, onEdit, onDelete }) {
    const ordered = sortByCommunityPriority(treks);
    const dnd = useListDragDrop((from, to) => onReorder(ordered, from, to));

    return (
        <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
            {ordered.map((t, index) => (
                <AdminTrekCard
                    key={t._id}
                    trek={t}
                    rank={index + 1}
                    draggable={!saving}
                    isDragging={dnd.draggedIndex === index}
                    isOver={dnd.overIndex === index && dnd.draggedIndex !== index}
                    onDragStart={(e) => dnd.handleDragStart(e, index)}
                    onDragOver={dnd.handleDragOver}
                    onDragEnter={() => dnd.setOverIndex(index)}
                    onDragLeave={() => dnd.setOverIndex(null)}
                    onDrop={(e) => dnd.handleDrop(e, index)}
                    onDragEnd={dnd.handleDragEnd}
                    onEdit={onEdit}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}

/* ── Stats Bar ── */
function StatsBar({ treks }) {
    const total = treks.length;
    const published = treks.filter(t => t.status === 'published').length;
    const free = treks.filter(t => !t.registrationFee || t.registrationFee === 0).length;
    const withImages = treks.filter(t => t.images?.length > 0).length;

    return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
                { label: 'Total Treks', value: total, color: 'text-white' },
                { label: 'Published', value: published, color: 'text-green-400' },
                { label: 'Free Treks', value: free, color: 'text-[#0ECCEE]' },
                { label: 'With Images', value: withImages, color: 'text-purple-400' },
            ].map(s => (
                <div key={s.label} className="bg-[#232425] rounded-xl p-4 border border-gray-700/50">
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                </div>
            ))}
        </div>
    );
}

export default function TreksPage() {
    const [treks, setTreks]           = useState([]);
    const [loading, setLoading]       = useState(true);
    const [showForm, setShowForm]     = useState(false);
    const [selected, setSelected]     = useState(null);
    const [activeCommunityId, setActiveCommunityId] = useState(null);

    const [communities, setCommunities]   = useState([]);
    const [commLoading, setCommLoading]   = useState(true);
    const [error, setError]               = useState('');
    const [showCommForm, setShowCommForm] = useState(false);
    const [selectedComm, setSelectedComm] = useState(null);
    const [expandedComm, setExpandedComm] = useState(() => new Set());
    const [reorderSaving, setReorderSaving] = useState(false);
    const { confirm } = useDialog();

    const fetchTreks = () => {
        setLoading(true);
        adminFetchJSON('/admin/treks?limit=500')
            .then(d => setTreks(d.treks || []))
            .catch(err => setError(err.message || 'Failed to load treks'))
            .finally(() => setLoading(false));
    };

    const fetchCommunities = () => {
        setCommLoading(true);
        setError('');
        adminFetchJSON('/admin/trek-communities?limit=100')
            .then(d => setCommunities(d.communities || []))
            .catch(err => setError(err.message || 'Failed to load communities'))
            .finally(() => setCommLoading(false));
    };

    useEffect(() => { fetchTreks(); fetchCommunities(); }, []);

    const reorderCommunityTreks = useCallback(async (orderedBefore, fromIndex, toIndex) => {
        if (fromIndex === toIndex || reorderSaving) return;
        const next = [...orderedBefore];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);

        const updates = next.map((t, i) => ({
            type: 'trek',
            id: t._id,
            fields: { communityPriority: i + 1 },
        }));

        const prev = treks;
        setTreks((list) => {
            const byId = new Map(updates.map((u) => [String(u.id), u.fields.communityPriority]));
            return list.map((t) => {
                const p = byId.get(String(t._id));
                return p != null ? { ...t, communityPriority: p } : t;
            });
        });

        setReorderSaving(true);
        setError('');
        try {
            await adminFetchJSON('/admin/sections/reorder', {
                method: 'POST',
                body: JSON.stringify({ updates }),
            });
        } catch (err) {
            setTreks(prev);
            setError(err.message || 'Failed to save trek order');
        } finally {
            setReorderSaving(false);
        }
    }, [reorderSaving, treks]);

    const deleteCommunity = async (id, name) => {
        if (!(await confirm({ title: 'Delete community?', message: `Delete "${name}"?`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/trek-communities/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete community');
        }
        fetchCommunities();
        fetchTreks();
    };

    const deleteTrek = async (id, name) => {
        if (!(await confirm({ title: 'Delete trek?', message: `Delete "${name}"?`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/treks/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete trek');
        }
        fetchTreks();
    };

    const activeCommunityKey = resolveCommunityId(activeCommunityId || selected?.communityId || null);
    const activeCommunity = activeCommunityKey
        ? communities.find(c => String(c._id) === activeCommunityKey)
        : null;

    const unassignedTreks = treks.filter((t) => !resolveCommunityId(t.communityId));

    return (
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold mb-2">Trek Management</h1>
            <p className="text-gray-400">
                Manage trek communities and the treks inside them. Drag treks to set first / second / … on the community page.
            </p>
        </div>
        <div className="bg-[#111213] rounded-xl p-6">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users2 size={20} className="text-[#0ECCEE]" /> Trek Communities
                </h2>
                <button
                    onClick={() => { setSelectedComm(null); setShowCommForm(true); }}
                    className="flex items-center gap-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                >
                    <Plus size={16} /> Add Community
                </button>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => { fetchCommunities(); fetchTreks(); }}
                        className="underline hover:text-red-200 shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Community list */}
            {commLoading ? (
                <div className="space-y-3">
                    {[1,2,3].map(i => <div key={i} className="h-20 bg-[#232425] rounded-2xl animate-pulse" />)}
                </div>
            ) : communities.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Users2 size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No communities yet</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Add a community, then add treks inside it</p>
                    <button
                        onClick={() => { setSelectedComm(null); setShowCommForm(true); }}
                        className="inline-flex items-center gap-2 bg-[#0ECCEE] text-black px-4 py-2 rounded-xl font-bold text-sm"
                    >
                        <Plus size={14} /> Add Community
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {communities.map(c => {
                        const communityKey = String(c._id);
                        const commTreks = treks.filter(
                            (t) => resolveCommunityId(t.communityId) === communityKey,
                        );
                        const isOpen = expandedComm.has(c._id);

                        return (
                            <div key={c._id} className="bg-[#232425] rounded-2xl border border-gray-700/50 overflow-hidden">
                                {/* Community header row */}
                                <div className="flex items-center gap-3 p-4">
                                    {/* Thumbnail */}
                                    <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                                        {communityBannerUrl(c)
                                            ? <img src={communityBannerUrl(c)} alt={c.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-green-900 to-emerald-700"><Users2 size={20} className="text-white/40" /></div>
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold text-sm line-clamp-1">{c.name}</h3>
                                        {c.basedIn && <p className="text-gray-500 text-xs">📍 {c.basedIn}</p>}
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-gray-600 text-[11px]">
                                                {loading ? '…' : `${commTreks.length} trek${commTreks.length !== 1 ? 's' : ''}`}
                                            </span>
                                            {galleryCount(c) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Images size={10} /> {galleryCount(c)} photos
                                                </span>
                                            )}
                                            {c.contactPhone && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Phone size={10} /> contact
                                                </span>
                                            )}
                                            {c.showOnTreks !== false && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/20">
                                                    {TREK_PAGE_SECTION_LABELS[c.trekPageSection] || 'Explore'}
                                                </span>
                                            )}
                                            {c.showOnTreks === false && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">Hidden</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                            href={`/treks/community/${c._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-gray-700 hover:bg-[#0ECCEE]/20 rounded-lg transition-colors"
                                            title="Preview community page"
                                        >
                                            <ExternalLink size={13} className="text-[#0ECCEE]" />
                                        </a>
                                        <button
                                            onClick={() => { setSelectedComm(c); setShowCommForm(true); }}
                                            className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors"
                                            title="Edit community (banner, details, gallery)"
                                        >
                                            <Edit2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            onClick={() => deleteCommunity(c._id, c.name)}
                                            className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors"
                                            title="Delete community"
                                        >
                                            <Trash2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            onClick={() => setExpandedComm(prev => {
                                                const next = new Set(prev);
                                                if (next.has(c._id)) next.delete(c._id);
                                                else next.add(c._id);
                                                return next;
                                            })}
                                            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                        >
                                            {isOpen
                                                ? <EyeOff size={13} className="text-gray-300" />
                                                : <Eye size={13} className="text-gray-300" />
                                            }
                                        </button>
                                    </div>
                                </div>

                                {/* Treks inside this community */}
                                {isOpen && (
                                    <div className="border-t border-gray-700/50 p-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                                            <p className="text-[11px] text-gray-500">
                                                Drag ⋮⋮ to prioritize — #1 shows first on the community page
                                                {reorderSaving ? ' · Saving…' : ''}
                                            </p>
                                            <button
                                                onClick={() => { setActiveCommunityId(c._id); setSelected(null); setShowForm(true); }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0ECCEE]/10 hover:bg-[#0ECCEE]/20 border border-[#0ECCEE]/30 rounded-lg text-xs font-semibold text-[#0ECCEE] transition-colors"
                                            >
                                                <Plus size={12} /> Add Trek
                                            </button>
                                        </div>
                                        {loading ? (
                                            <p className="text-xs text-gray-500 text-center py-4">Loading treks…</p>
                                        ) : commTreks.length === 0 ? (
                                            <div className="text-center py-6">
                                                <Mountain size={28} className="mx-auto mb-2 text-gray-700" />
                                                <p className="text-xs text-gray-500 mb-3">No treks in this community yet</p>
                                            </div>
                                        ) : (
                                            <CommunityTrekList
                                                treks={commTreks}
                                                saving={reorderSaving}
                                                onReorder={reorderCommunityTreks}
                                                onEdit={(trek) => { setSelected(trek); setActiveCommunityId(c._id); setShowForm(true); }}
                                                onDelete={deleteTrek}
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {!loading && unassignedTreks.length > 0 && (
                        <div className="bg-[#232425] rounded-2xl border border-amber-700/40 overflow-hidden">
                            <div className="flex items-center gap-3 p-4 border-b border-white/5">
                                <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-amber-900/30 flex items-center justify-center">
                                    <Mountain size={20} className="text-amber-300/70" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-amber-200 font-bold text-sm">No community assigned</h3>
                                    <p className="text-gray-500 text-xs">
                                        {unassignedTreks.length} trek{unassignedTreks.length !== 1 ? 's' : ''} — open edit and pick a community
                                    </p>
                                </div>
                            </div>
                            <div className="rounded-none overflow-hidden divide-y divide-white/5">
                                {unassignedTreks.map((t) => (
                                    <AdminTrekCard
                                        key={t._id}
                                        trek={t}
                                        onEdit={(trek) => {
                                            setSelected(trek);
                                            setActiveCommunityId(null);
                                            setShowForm(true);
                                        }}
                                        onDelete={deleteTrek}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <TrekFormModal
                    trek={selected}
                    communityId={activeCommunityKey}
                    communityCategories={activeCommunity?.trekCategories || []}
                    onClose={() => { setShowForm(false); setActiveCommunityId(null); }}
                    onSaved={() => { setShowForm(false); setActiveCommunityId(null); fetchTreks(); }}
                />
            )}
            {showCommForm && (
                <TrekCommunityFormModal
                    community={selectedComm}
                    onClose={() => setShowCommForm(false)}
                    onSaved={() => { setShowCommForm(false); fetchCommunities(); }}
                />
            )}
        </div>
        </div>
    );
}

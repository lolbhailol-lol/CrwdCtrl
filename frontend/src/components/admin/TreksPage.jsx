import { useEffect, useState } from 'react';
import { Mountain, Calendar, Clock, Users, MapPin, Edit2, Trash2, Plus, Eye, EyeOff, Users2 } from 'lucide-react';
import TrekFormModal from './TrekFormModal';
import TrekCommunityFormModal from './TrekCommunityFormModal';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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

const CATEGORY_LABELS = {
    hiking: '🥾 Hiking', trail: '🌲 Trail Walks', backpacking: '🎒 Backpacking',
    camping: '⛺ Camping', adventure: '🏔️ Adventure',
};

function formatDate(d) {
    if (!d) return 'TBA';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ── Trek Row (clean list item inside community) ── */
function AdminTrekCard({ trek, onEdit, onDelete }) {
    const [imgErr, setImgErr] = useState(false);
    const diff = DIFFICULTY_BADGE[trek.difficultyLevel];

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group">
            {/* Thumbnail */}
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                {(trek.coverImage || trek.images?.[0]) && !imgErr
                    ? <img src={trek.coverImage || trek.images[0]} alt={trek.trekName} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
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
            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
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

/* ── Section ── */
function TrekSection({ title, icon, treks, onEdit, onDelete, color = 'text-white' }) {
    const [collapsed, setCollapsed] = useState(false);
    if (treks.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
                <h3 className={`text-base font-bold flex items-center gap-2 ${color}`}>
                    <span>{icon}</span> {title}
                    <span className="text-sm font-normal text-gray-500">({treks.length})</span>
                </h3>
                <button onClick={() => setCollapsed(c => !c)} className="text-gray-500 hover:text-gray-300 transition-colors">
                    {collapsed ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
            </div>
            {!collapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {treks.map(t => (
                        <AdminTrekCard key={t._id} trek={t} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
            )}
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
    const [showCommForm, setShowCommForm] = useState(false);
    const [selectedComm, setSelectedComm] = useState(null);
    const [expandedComm, setExpandedComm] = useState(() => new Set());

    const fetchTreks = () => {
        setLoading(true);
        fetch(`${API}/admin/treks?limit=200`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        })
            .then(r => r.json())
            .then(d => setTreks(d.treks || []))
            .catch(err => console.error('Error fetching treks:', err))
            .finally(() => setLoading(false));
    };

    const fetchCommunities = () => {
        const token = localStorage.getItem('admin_token');
        if (!token) return;
        setCommLoading(true);
        fetch(`${API}/admin/trek-communities?limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(r => {
                if (r.status === 401) { window.location.href = '/admin/login'; return null; }
                return r.json();
            })
            .then(d => d && setCommunities(d.communities || []))
            .catch(err => console.error('Error fetching communities:', err))
            .finally(() => setCommLoading(false));
    };

    useEffect(() => { fetchTreks(); fetchCommunities(); }, []);

    const deleteCommunity = async (id, name) => {
        if (!window.confirm(`Delete "${name}"?`)) return;
        await fetch(`${API}/admin/trek-communities/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchCommunities();
    };

    const deleteTrek = async (id, name) => {
        if (!window.confirm(`Delete "${name}"?`)) return;
        await fetch(`${API}/admin/treks/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
        });
        fetchTreks();
    };

    const activeCommunityKey = activeCommunityId || selected?.communityId || null;
    const activeCommunity = activeCommunityKey
        ? communities.find(c => String(c._id) === String(activeCommunityKey))
        : null;

    return (
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
                        const commTreks = treks.filter(t => t.communityId === c._id || String(t.communityId) === String(c._id));
                        const isOpen = expandedComm.has(c._id);

                        return (
                            <div key={c._id} className="bg-[#232425] rounded-2xl border border-gray-700/50 overflow-hidden">
                                {/* Community header row */}
                                <div className="flex items-center gap-3 p-4">
                                    {/* Thumbnail */}
                                    <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                                        {c.coverImage
                                            ? <img src={c.coverImage} alt={c.name} className="w-full h-full object-cover" />
                                            : <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-green-900 to-emerald-700"><Users2 size={20} className="text-white/40" /></div>
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold text-sm line-clamp-1">{c.name}</h3>
                                        {c.basedIn && <p className="text-gray-500 text-xs">📍 {c.basedIn}</p>}
                                        <p className="text-gray-600 text-[11px] mt-0.5">
                                            {loading ? '…' : `${commTreks.length} trek${commTreks.length !== 1 ? 's' : ''}`}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <button
                                            onClick={() => { setSelectedComm(c); setShowCommForm(true); }}
                                            className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors"
                                            title="Edit community"
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
                                        <div className="flex items-center justify-between mb-4">
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
                                            <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
                                                {commTreks.map(t => (
                                                    <AdminTrekCard
                                                        key={t._id}
                                                        trek={t}
                                                        onEdit={trek => { setSelected(trek); setActiveCommunityId(c._id); setShowForm(true); }}
                                                        onDelete={deleteTrek}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
    );
}

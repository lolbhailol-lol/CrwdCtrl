import { useEffect, useState } from 'react';
import {
    Dumbbell,
    Calendar,
    MapPin,
    Edit2,
    Trash2,
    Plus,
    Eye,
    EyeOff,
    Users2,
    ExternalLink,
    Phone,
    Images,
    Footprints,
} from 'lucide-react';
import SportsFormModal from '../../components/admin/SportsFormModal';
import RunClubFormModal from '../../components/admin/RunClubFormModal';
import { normalizeImageUrl } from '../../utils/uploadUrls';
import { adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';

const STATUS_BADGE = {
    published: 'bg-green-900/60 text-green-300 border border-green-700',
    draft: 'bg-gray-700 text-gray-300 border border-gray-600',
    completed: 'bg-blue-900/60 text-blue-300 border border-blue-700',
    cancelled: 'bg-red-900/60 text-red-300 border border-red-700',
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

function AdminRunRow({ run, onEdit, onDelete }) {
    const [imgErr, setImgErr] = useState(false);
    const thumb = normalizeImageUrl(run.images?.[0] || run.coverImage);

    return (
        <div className="flex items-center gap-3 px-4 py-3 hover:bg-white/3 transition-colors group">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                {thumb && !imgErr ? (
                    <img src={thumb} alt={run.title} className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-900 to-green-700">
                        <Footprints size={20} className="text-white/40" />
                    </div>
                )}
            </div>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white truncate">{run.title}</p>
                    {run.runCategory && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30">
                            {run.runCategory}
                        </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${STATUS_BADGE[run.status] || 'bg-gray-700 text-gray-300'}`}>
                        {run.status}
                    </span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {(run.city || run.venue) && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <MapPin size={10} />
                            {run.city || run.venue}
                        </span>
                    )}
                    {run.eventDate && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Calendar size={10} />
                            {formatDate(run.eventDate)}
                        </span>
                    )}
                    {run.distance && (
                        <span className="text-[11px] text-gray-500">{run.distance}</span>
                    )}
                </div>
            </div>

            <span className={`text-sm font-bold shrink-0 ${run.registrationFee > 0 ? 'text-[#0ECCEE]' : 'text-green-400'}`}>
                {run.registrationFee > 0 ? `₹${run.registrationFee}` : 'Free'}
            </span>

            <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <a
                    href={`/sports/run/${run._id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-gray-700 hover:bg-[#0ECCEE]/20 rounded-lg transition-colors"
                    title="Preview run page"
                >
                    <ExternalLink size={13} className="text-[#0ECCEE]" />
                </a>
                <button
                    type="button"
                    onClick={() => onEdit(run)}
                    className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors"
                    title="Edit run"
                >
                    <Edit2 size={13} className="text-white" />
                </button>
                <button
                    type="button"
                    onClick={() => onDelete(run._id, run.title)}
                    className="p-2 bg-red-900/60 hover:bg-red-600 rounded-lg transition-colors border border-red-800"
                    title="Delete run"
                >
                    <Trash2 size={13} className="text-red-400" />
                </button>
            </div>
        </div>
    );
}

export default function SportsPage() {
    const { confirm } = useDialog();
    const [runs, setRuns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [selected, setSelected] = useState(null);
    const [activeClubId, setActiveClubId] = useState(null);

    const [clubs, setClubs] = useState([]);
    const [clubsLoading, setClubsLoading] = useState(true);
    const [error, setError] = useState('');
    const [showClubForm, setShowClubForm] = useState(false);
    const [selectedClub, setSelectedClub] = useState(null);
    const [expandedClub, setExpandedClub] = useState(() => new Set());

    const fetchRuns = () => {
        setLoading(true);
        adminFetchJSON('/admin/sports?limit=200')
            .then((d) => {
                const all = d.events || [];
                setRuns(all.filter((ev) => ev.runClubId));
            })
            .catch((err) => setError(err.message || 'Failed to load runs'))
            .finally(() => setLoading(false));
    };

    const fetchClubs = () => {
        setClubsLoading(true);
        setError('');
        adminFetchJSON('/admin/run-clubs?limit=100')
            .then((d) => setClubs(d.clubs || []))
            .catch((err) => setError(err.message || 'Failed to load run clubs'))
            .finally(() => setClubsLoading(false));
    };

    useEffect(() => {
        fetchRuns();
        fetchClubs();
    }, []);

    const deleteClub = async (id, name) => {
        if (!(await confirm({ title: 'Delete run club?', message: `Delete "${name}"? Runs inside will be removed from this club.`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/run-clubs/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete run club');
        }
        fetchClubs();
        fetchRuns();
    };

    const deleteRun = async (id, title) => {
        if (!(await confirm({ title: 'Delete run?', message: `Delete "${title}"?`, confirmText: 'Delete', tone: 'danger' }))) return;
        try {
            await adminFetchJSON(`/admin/sports/${id}`, { method: 'DELETE' });
        } catch (err) {
            setError(err.message || 'Failed to delete run');
        }
        fetchRuns();
    };

    const activeClubKey = activeClubId || selected?.runClubId || null;
    const activeClub = activeClubKey
        ? clubs.find((c) => String(c._id) === String(activeClubKey))
        : null;

    return (
        <div className="space-y-6">
        <div>
            <h1 className="text-3xl font-bold mb-2">Run Club Management</h1>
            <p className="text-gray-400">Manage run clubs and the runs inside them</p>
        </div>
        <div className="bg-[#111213] rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Users2 size={20} className="text-[#0ECCEE]" />
                    Run Clubs
                </h2>
                <button
                    type="button"
                    onClick={() => {
                        setSelectedClub(null);
                        setShowClubForm(true);
                    }}
                    className="flex items-center gap-2 bg-[#0ECCEE] hover:bg-[#0ECCEE]/80 text-black px-4 py-2.5 rounded-xl font-bold text-sm transition-colors"
                >
                    <Plus size={16} />
                    Add Run Club
                </button>
            </div>

            {error && (
                <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
                    <span>{error}</span>
                    <button
                        type="button"
                        onClick={() => { fetchClubs(); fetchRuns(); }}
                        className="underline hover:text-red-200 shrink-0"
                    >
                        Retry
                    </button>
                </div>
            )}

            {clubsLoading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-20 bg-[#232425] rounded-2xl animate-pulse" />
                    ))}
                </div>
            ) : clubs.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                    <Users2 size={48} className="mx-auto mb-3 opacity-20" />
                    <p className="text-lg font-medium">No run clubs yet</p>
                    <p className="text-sm text-gray-500 mt-1 mb-4">Add a run club, then add upcoming runs inside it</p>
                    <button
                        type="button"
                        onClick={() => {
                            setSelectedClub(null);
                            setShowClubForm(true);
                        }}
                        className="inline-flex items-center gap-2 bg-[#0ECCEE] text-black px-4 py-2 rounded-xl font-bold text-sm"
                    >
                        <Plus size={14} />
                        Add Run Club
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {clubs.map((c) => {
                        const clubRuns = runs.filter(
                            (r) => r.runClubId === c._id || String(r.runClubId) === String(c._id),
                        );
                        const isOpen = expandedClub.has(c._id);
                        const clubCover = normalizeImageUrl(c.coverImage);

                        return (
                            <div key={c._id} className="bg-[#232425] rounded-2xl border border-gray-700/50 overflow-hidden">
                                <div className="flex items-center gap-3 p-4">
                                    <div className="size-12 rounded-xl overflow-hidden shrink-0 bg-gray-800">
                                        {clubCover ? (
                                            <img src={clubCover} alt={c.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-emerald-900 to-green-700">
                                                <Users2 size={20} className="text-white/40" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-white font-bold text-sm line-clamp-1">{c.name}</h3>
                                        {c.basedIn && <p className="text-gray-500 text-xs">📍 {c.basedIn}</p>}
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span className="text-gray-600 text-[11px]">
                                                {loading ? '…' : `${clubRuns.length} run${clubRuns.length !== 1 ? 's' : ''}`}
                                            </span>
                                            {galleryCount(c) > 0 && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Images size={10} />
                                                    {galleryCount(c)} photos
                                                </span>
                                            )}
                                            {c.contactPhone && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500">
                                                    <Phone size={10} />
                                                    contact
                                                </span>
                                            )}
                                            {c.showOnSportsPage !== false && c.showInRunClubs !== false ? (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/20">
                                                    Explore Run Clubs
                                                </span>
                                            ) : (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-500">Hidden</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <a
                                            href={`/sports/run-club/${c._id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-1.5 bg-gray-700 hover:bg-[#0ECCEE]/20 rounded-lg transition-colors"
                                            title="Preview run club page"
                                        >
                                            <ExternalLink size={13} className="text-[#0ECCEE]" />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedClub(c);
                                                setShowClubForm(true);
                                            }}
                                            className="p-1.5 bg-gray-700 hover:bg-blue-600 rounded-lg transition-colors"
                                            title="Edit run club"
                                        >
                                            <Edit2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => deleteClub(c._id, c.name)}
                                            className="p-1.5 bg-gray-700 hover:bg-red-600 rounded-lg transition-colors"
                                            title="Delete run club"
                                        >
                                            <Trash2 size={13} className="text-gray-300" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setExpandedClub((prev) => {
                                                    const next = new Set(prev);
                                                    if (next.has(c._id)) next.delete(c._id);
                                                    else next.add(c._id);
                                                    return next;
                                                })
                                            }
                                            className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                                        >
                                            {isOpen ? (
                                                <EyeOff size={13} className="text-gray-300" />
                                            ) : (
                                                <Eye size={13} className="text-gray-300" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="border-t border-gray-700/50 p-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveClubId(c._id);
                                                    setSelected(null);
                                                    setShowForm(true);
                                                }}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0ECCEE]/10 hover:bg-[#0ECCEE]/20 border border-[#0ECCEE]/30 rounded-lg text-xs font-semibold text-[#0ECCEE] transition-colors"
                                            >
                                                <Plus size={12} />
                                                Add Run
                                            </button>
                                        </div>
                                        {loading ? (
                                            <p className="text-xs text-gray-500 text-center py-4">Loading runs…</p>
                                        ) : clubRuns.length === 0 ? (
                                            <div className="text-center py-6">
                                                <Dumbbell size={28} className="mx-auto mb-2 text-gray-700" />
                                                <p className="text-xs text-gray-500 mb-3">No upcoming runs in this club yet</p>
                                            </div>
                                        ) : (
                                            <div className="rounded-xl border border-white/6 overflow-hidden divide-y divide-white/5">
                                                {clubRuns.map((run) => (
                                                    <AdminRunRow
                                                        key={run._id}
                                                        run={run}
                                                        onEdit={(r) => {
                                                            setSelected(r);
                                                            setActiveClubId(c._id);
                                                            setShowForm(true);
                                                        }}
                                                        onDelete={deleteRun}
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

            {showForm && activeClubKey && (
                <SportsFormModal
                    event={selected}
                    runClubId={activeClubKey}
                    clubName={activeClub?.name}
                    onClose={() => {
                        setShowForm(false);
                        setActiveClubId(null);
                    }}
                    onSaved={() => {
                        setShowForm(false);
                        setActiveClubId(null);
                        fetchRuns();
                    }}
                />
            )}

            {showClubForm && (
                <RunClubFormModal
                    club={selectedClub}
                    onClose={() => setShowClubForm(false)}
                    onSaved={() => {
                        setShowClubForm(false);
                        fetchClubs();
                    }}
                />
            )}
        </div>
        </div>
    );
}

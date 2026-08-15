import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import {
    ExternalLink, Loader, Pencil, Plus, RefreshCw, Trophy, PartyPopper,
} from 'lucide-react';
import {
    fetchFestOrganizerFestDetails,
    fetchFestOrganizerCompetitions,
    fetchFestOrganizerDashboard,
    buildFestOrganizerAdminApi,
} from '../../services/api/festOrganizer.api';
import { getFestOrganizerSession } from '../../utils/festOrganizerSession';
import CompetitionModal from '../../components/admin/Competition_Modal';
import FestFormModal from '../../components/admin/FestFormModal';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';

function ModalHost({ children }) {
    if (typeof document === 'undefined') return null;
    return createPortal(children, document.body);
}

/**
 * Dedicated sidebar section: edit fest + competitions using the same
 * admin wizards (FestFormModal / Competition_Modal).
 */
export default function FestOrganizerListingEditPage() {
    const { festId } = useParams();
    const session = getFestOrganizerSession();
    const sessionFest = session?.fests?.find((f) => String(f._id) === String(festId));

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [fest, setFest] = useState(() => ({
        _id: festId,
        festName: sessionFest?.festName || 'Fest',
    }));
    const [competitions, setCompetitions] = useState([]);
    const [showFestModal, setShowFestModal] = useState(false);
    const [showCompModal, setShowCompModal] = useState(false);
    const [editCompetition, setEditCompetition] = useState(null);
    const [startInCreate, setStartInCreate] = useState(false);

    const adminApi = useMemo(() => buildFestOrganizerAdminApi(festId), [festId]);

    const load = async () => {
        setLoading(true);
        setError('');
        const errors = [];

        try {
            const festData = await fetchFestOrganizerFestDetails(festId);
            const f = festData.fest;
            if (f) {
                setFest({ ...f, _id: String(f._id || f.id || festId) });
            }
        } catch (e) {
            errors.push(e.message || 'Fest details failed');
            try {
                const dash = await fetchFestOrganizerDashboard(festId);
                if (dash.fest) {
                    setFest({
                        ...dash.fest,
                        _id: String(dash.fest.id || dash.fest._id || festId),
                    });
                }
            } catch (_) {
                setFest((prev) => ({
                    ...prev,
                    _id: festId,
                    festName: sessionFest?.festName || prev.festName || 'Fest',
                }));
            }
        }

        try {
            const compsData = await fetchFestOrganizerCompetitions(festId);
            setCompetitions(Array.isArray(compsData.competitions) ? compsData.competitions : []);
        } catch (e) {
            errors.push(e.message || 'Competitions list failed');
            try {
                const dash = await fetchFestOrganizerDashboard(festId);
                setCompetitions(
                    (dash.competitions || [])
                        .filter((c) => c.id)
                        .map((c) => ({
                            ...c,
                            _id: c.id,
                            id: c.id,
                        })),
                );
            } catch (_) {
                setCompetitions([]);
            }
        }

        if (errors.length) setError(errors.join(' · '));
        setLoading(false);
    };

    useEffect(() => {
        load();
    }, [festId]);

    const publicUrl = fest?.slug
        ? `${window.location.origin}/view-details/${fest.slug}`
        : fest?._id
            ? `${window.location.origin}/view-details/${fest._id}`
            : null;

    const openCreateCompetition = () => {
        setEditCompetition(null);
        setStartInCreate(true);
        setShowCompModal(true);
    };

    const openEditCompetition = (comp = null) => {
        setEditCompetition(comp);
        setStartInCreate(false);
        setShowCompModal(true);
    };

    const closeCompModal = () => {
        setShowCompModal(false);
        setEditCompetition(null);
        setStartInCreate(false);
    };

    if (loading && !fest?._id) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading…
            </div>
        );
    }

    return (
        <div className={`max-w-3xl mx-auto space-y-5 transition-opacity duration-200 ${loading ? 'opacity-70' : 'opacity-100'}`}>
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] uppercase tracking-[0.14em] text-[#0ECCEE] font-semibold mb-1">
                        Content edit
                    </p>
                    <h1 className="text-xl sm:text-2xl font-bold text-white">Edit fest &amp; competitions</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        Same forms as main admin — updates the public fest page
                    </p>
                </div>
                <button
                    type="button"
                    onClick={load}
                    className="p-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white"
                    aria-label="Refresh"
                >
                    <RefreshCw size={16} />
                </button>
            </div>

            {error ? (
                <p className="text-xs text-amber-300/90 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2">
                    Some data loaded with warnings: {error}. You can still open the editors.
                </p>
            ) : null}

            <div className="grid sm:grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={() => setShowFestModal(true)}
                    className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/12 p-4 text-left hover:border-[#0ECCEE]/60 transition"
                >
                    <PartyPopper className="text-[#0ECCEE] mb-2" size={20} />
                    <p className="text-sm font-semibold text-white">Edit fest</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                        Cover · gallery · contacts · sponsors · registration form
                    </p>
                </button>
                <button
                    type="button"
                    onClick={openCreateCompetition}
                    className="rounded-2xl border border-[#0ECCEE]/35 bg-[#0ECCEE]/12 p-4 text-left hover:border-[#0ECCEE]/60 transition"
                >
                    <Plus className="text-[#0ECCEE] mb-2" size={20} />
                    <p className="text-sm font-semibold text-white">Add competition</p>
                    <p className="text-[11px] text-gray-400 mt-1">
                        Info · cover · gallery · rules · registration form
                    </p>
                </button>
            </div>

            {/* Edit fest summary */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <PartyPopper className="text-[#0ECCEE] shrink-0" size={16} />
                        <h2 className="text-sm font-semibold text-white truncate">{fest?.festName || 'Fest'}</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        {publicUrl ? (
                            <a
                                href={publicUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#0ECCEE]"
                            >
                                <ExternalLink size={12} /> Public
                            </a>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => setShowFestModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0ECCEE] text-black text-xs font-bold"
                        >
                            <Pencil size={12} /> Edit fest
                        </button>
                    </div>
                </div>
                <div className="p-4 flex gap-3 items-center">
                    {fest?.coverImage ? (
                        <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-[#1a1b1d] ring-1 ring-white/10">
                            <img
                                src={getImageUrl(fest.coverImage, { preset: 'cardSm' })}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        </div>
                    ) : null}
                    <p className="text-xs text-gray-500 truncate">
                        {[fest?.collegeName, fest?.festDate, fest?.venue].filter(Boolean).join(' · ') || 'Open admin fest form to edit listing'}
                    </p>
                </div>
            </section>

            {/* Competitions list */}
            <section className="rounded-2xl border border-white/10 bg-[#161718] overflow-hidden">
                <div className="px-4 sm:px-5 py-3 border-b border-white/8 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <Trophy className="text-[#0ECCEE]" size={16} />
                        <h2 className="text-sm font-semibold text-white">Competitions</h2>
                        <span className="text-[11px] text-gray-500 tabular-nums">{competitions.length}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => openEditCompetition(null)}
                        className="text-xs font-medium text-[#0ECCEE]"
                    >
                        Open manager
                    </button>
                </div>
                <div className="p-3 space-y-2">
                    {competitions.map((c) => {
                        const id = String(c._id || c.id);
                        return (
                            <button
                                key={id}
                                type="button"
                                onClick={() => openEditCompetition({ ...c, _id: id })}
                                className="w-full flex items-center gap-3 rounded-xl border border-white/8 bg-[#111213] p-3 text-left hover:border-[#0ECCEE]/40 transition"
                            >
                                <div className="relative w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-[#1a1b1d]">
                                    <img
                                        src={getImageUrl(c.coverImage, { preset: 'cardSm' })}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => handleImageErrorWithFallback(e, 48, 48, '#0ea5e9', c.name || 'C')}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-white truncate">{c.name}</p>
                                    <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                                        {c.feeAmount > 0
                                            ? `₹${Number(c.feeAmount).toLocaleString('en-IN')}`
                                            : (c.registrationFee || 'Free')}
                                        {c.category ? ` · ${c.category}` : ''}
                                    </p>
                                </div>
                                <Pencil size={14} className="text-[#0ECCEE] shrink-0" />
                            </button>
                        );
                    })}
                    {!competitions.length ? (
                        <div className="text-center py-10 space-y-3">
                            <p className="text-sm text-gray-500">No competitions yet</p>
                            <button
                                type="button"
                                onClick={openCreateCompetition}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                            >
                                <Plus size={16} /> Add first competition
                            </button>
                        </div>
                    ) : null}
                </div>
            </section>

            {showFestModal && fest?._id ? (
                <ModalHost>
                    <FestFormModal
                        fest={fest}
                        api={adminApi}
                        onClose={() => setShowFestModal(false)}
                        onSaved={() => {
                            setShowFestModal(false);
                            load();
                        }}
                    />
                </ModalHost>
            ) : null}

            {showCompModal && fest?._id ? (
                <ModalHost>
                    <CompetitionModal
                        fest={fest}
                        api={adminApi}
                        initialCompetition={editCompetition || undefined}
                        initialCompetitionId={editCompetition?._id || editCompetition?.id || undefined}
                        startInCreate={startInCreate}
                        onClose={closeCompModal}
                        onSaved={() => {
                            closeCompModal();
                            load();
                        }}
                    />
                </ModalHost>
            ) : null}
        </div>
    );
}

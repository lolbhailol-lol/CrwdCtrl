import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader, RefreshCw, Search, ChevronRight, Trophy, UserPlus } from 'lucide-react';
import { fetchFestOrganizerDashboard } from '../../services/api/festOrganizer.api';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';

function formatCategoryLabel(tab) {
    if (!tab || tab === 'OTHER') return 'Other';
    return tab.charAt(0) + tab.slice(1).toLowerCase();
}

function feeLabel(feeAmount) {
    const n = Number(feeAmount) || 0;
    if (n <= 0) return 'Free';
    return `₹${n.toLocaleString('en-IN')}`;
}

function MiniBox({ label, value, tone = 'default' }) {
    const tones = {
        default: 'border-white/10 bg-white/4 text-white',
        warn: 'border-amber-400/30 bg-amber-500/10 text-amber-200',
        ok: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
        accent: 'border-[#0ECCEE]/30 bg-[#0ECCEE]/10 text-[#0ECCEE]',
    };
    return (
        <div className={`rounded-xl border px-2 py-2 text-center ${tones[tone] || tones.default}`}>
            <p className="text-sm font-bold tabular-nums leading-none">{value}</p>
            <p className="text-[9px] uppercase tracking-wide text-gray-500 mt-1">{label}</p>
        </div>
    );
}

export default function FestOrganizerCompetitionsPage() {
    const { festId } = useParams();
    const navigate = useNavigate();
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [festName, setFestName] = useState('');
    const [stats, setStats] = useState(null);
    const [activeTab, setActiveTab] = useState('ALL');
    const [query, setQuery] = useState('');

    const load = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await fetchFestOrganizerDashboard(festId);
            setFestName(data.fest?.festName || '');
            setRows(data.competitions || []);
            setStats(data.stats || null);
        } catch (e) {
            setError(e.message || 'Failed to load competitions');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [festId]);

    const categories = useMemo(() => {
        const set = new Set();
        rows.forEach((c) => {
            if (c.id) set.add(c.category || 'OTHER');
        });
        return ['ALL', ...Array.from(set).sort()];
    }, [rows]);

    const needsReview = useMemo(
        () => rows.reduce((sum, c) => sum + (c.id ? Number(c.pending) || 0 : 0), 0),
        [rows],
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        let list = rows.filter((c) => c.id);
        if (activeTab !== 'ALL') {
            list = list.filter((c) => (c.category || 'OTHER') === activeTab);
        }
        if (q) {
            list = list.filter((c) => {
                const hay = `${c.name || ''} ${c.subtitle || ''} ${c.competitionType || ''} ${c.category || ''}`.toLowerCase();
                return hay.includes(q);
            });
        }
        return [...list].sort((a, b) => {
            const pd = (Number(b.pending) || 0) - (Number(a.pending) || 0);
            if (pd !== 0) return pd;
            return (Number(b.total) || 0) - (Number(a.total) || 0);
        });
    }, [rows, activeTab, query]);

    useEffect(() => {
        if (activeTab !== 'ALL' && !categories.includes(activeTab)) {
            setActiveTab('ALL');
        }
    }, [categories, activeTab]);

    if (loading) {
        return (
            <div className="flex justify-center py-20 text-gray-400 gap-2">
                <Loader className="animate-spin" size={18} /> Loading…
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-4">
            <div className="rounded-3xl border border-[#0ECCEE]/20 bg-linear-to-br from-[#0ECCEE]/15 via-[#161718] to-[#161718] p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2 text-[#0ECCEE] mb-1">
                            <Trophy size={16} />
                            <span className="text-[11px] uppercase tracking-[0.12em] font-semibold">Competition hub</span>
                        </div>
                        <h1 className="text-xl font-bold tracking-tight text-white">{festName || 'Competitions'}</h1>
                        <p className="text-sm text-gray-400 mt-1">
                            {needsReview > 0 ? (
                                <span className="text-amber-300 font-medium">{needsReview} waiting for review</span>
                            ) : (
                                <span className="text-emerald-300/90">All clear</span>
                            )}
                            {stats ? (
                                <span className="text-gray-500">
                                    {' · '}
                                    {stats.totalRegistrations || 0} entries · {stats.checkedIn || 0} checked in
                                </span>
                            ) : null}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={load}
                        className="p-2.5 rounded-xl bg-white/5 text-gray-300 hover:bg-white/10"
                        aria-label="Refresh"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>
            </div>

            {error ? <p className="text-sm text-red-400">{error}</p> : null}

            <button
                type="button"
                onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/probables`)}
                className="w-full rounded-2xl border border-amber-400/30 bg-linear-to-r from-amber-500/15 to-[#161718] p-4 text-left hover:border-amber-400/50 transition flex items-center gap-3"
            >
                <div className="size-11 rounded-xl bg-amber-400/15 flex items-center justify-center shrink-0">
                    <UserPlus size={18} className="text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">Competition probables</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                        Add interested name &amp; phone → WhatsApp / call → convert to entries
                    </p>
                </div>
                <ChevronRight size={18} className="text-amber-300/80 shrink-0" />
            </button>

            <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search competitions"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#161718] border border-white/10 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0ECCEE]/50"
                />
            </div>

            {categories.length > 2 ? (
                <div className="flex gap-2 overflow-x-auto pb-0.5">
                    {categories.map((tab) => {
                        const active = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setActiveTab(tab)}
                                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                                    active
                                        ? 'bg-[#0ECCEE] text-black'
                                        : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                                }`}
                            >
                                {tab === 'ALL' ? 'All' : formatCategoryLabel(tab)}
                            </button>
                        );
                    })}
                </div>
            ) : null}

            <div className="space-y-3">
                {filtered.map((c) => {
                    const id = String(c.id);
                    const pending = Number(c.pending) || 0;
                    const total = Number(c.total) || 0;
                    const checkedIn = Number(c.checkedIn) || 0;
                    const slotsAllotted = Number(c.slotsAllotted) || 0;
                    const slotsLeft = c.slotsLeft;
                    const slotsLabel = slotsAllotted > 0
                        ? `${c.slotsFilled ?? c.approved}/${slotsAllotted}`
                        : 'Open';

                    return (
                        <button
                            key={id}
                            type="button"
                            onClick={() => navigate(`/fest-organizer/fests/${festId}/competitions/${id}`)}
                            className="w-full text-left rounded-2xl bg-[#161718] border border-white/10 hover:border-[#0ECCEE]/45 p-3 transition active:scale-[0.99] group"
                        >
                            <div className="flex gap-3">
                                <div className="relative w-16 h-16 shrink-0 rounded-xl overflow-hidden bg-[#1a1b1d] ring-1 ring-white/10">
                                    <img
                                        src={getImageUrl(c.coverImage || c.image, { preset: 'cardSm' })}
                                        alt=""
                                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        onError={(e) => handleImageErrorWithFallback(e, 64, 64, '#0ea5e9', c.name || 'C')}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-[15px] font-semibold text-white truncate group-hover:text-[#0ECCEE] transition-colors">
                                                {c.name}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                                                <span className={feeLabel(c.feeAmount) === 'Free' ? 'text-emerald-400' : 'text-[#0ECCEE]'}>
                                                    {feeLabel(c.feeAmount)}
                                                </span>
                                                {c.category ? ` · ${formatCategoryLabel(c.category)}` : ''}
                                            </p>
                                        </div>
                                        <ChevronRight size={18} className="shrink-0 text-gray-600 group-hover:text-[#0ECCEE] mt-0.5" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5 mt-3">
                                <MiniBox label="Entries" value={total} tone="accent" />
                                <MiniBox label="Review" value={pending} tone={pending > 0 ? 'warn' : 'default'} />
                                <MiniBox label="Check-in" value={checkedIn} tone="ok" />
                                <MiniBox
                                    label="Slots"
                                    value={slotsLabel}
                                    tone={slotsAllotted > 0 && slotsLeft === 0 ? 'warn' : 'default'}
                                />
                            </div>
                        </button>
                    );
                })}
            </div>

            {!filtered.length ? (
                <p className="text-center text-sm text-gray-500 py-16">
                    {query ? 'No matches' : 'No competitions yet'}
                </p>
            ) : null}
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, SlidersHorizontal } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import CardFavoriteButton from '../CardFavoriteButton';
import CardShareButton from '../CardShareButton';
import { TrekListSkeleton } from '../HomeEventCardSkeleton';
import { TREK_BROWSE_CATEGORIES } from '../../constants/trekBrowseCategories';
import {
    USER_FILTER_SECTIONS,
    emptyUserFilters,
    trekMatchesFilters,
} from '../../constants/trekFilters';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const TREK_CATEGORIES = TREK_BROWSE_CATEGORIES;

function TrekFilterModal({ isOpen, isDark, draftFilters, onToggle, onClear, onApply, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[119px]">
            <button
                type="button"
                aria-label="Close filters"
                className="absolute inset-0 bg-stone-900/50"
                onClick={onClose}
            />

            <div
                className={`relative w-full max-w-[288px] rounded-3xl overflow-hidden shadow-xl ${
                    isDark ? 'bg-[#111213]' : 'bg-white'
                }`}
            >
                <div className={`px-5 py-4 ${isDark ? 'bg-[#161718]' : 'bg-[#F5F6FA]'}`}>
                    <h2
                        className={`text-lg font-semibold font-inter leading-7 tracking-wide ${
                            isDark ? 'text-white' : 'text-gray-900'
                        }`}
                    >
                        Filter by
                    </h2>
                </div>

                <div className="max-h-[360px] overflow-y-auto px-5 py-4">
                    {USER_FILTER_SECTIONS.map((section) => (
                        <div key={section.id} className="flex gap-4 py-3 border-b border-black/10 last:border-b-0">
                            <p
                                className={`w-20 shrink-0 text-sm font-semibold font-inter leading-5 tracking-tight pt-0.5 ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}
                            >
                                {section.label}
                            </p>

                            <div className="relative flex-1 pl-4 border-l border-black/20">
                                <div className="space-y-3">
                                    {section.options.map((option) => {
                                        const checked = (draftFilters[section.id] || []).includes(option);
                                        return (
                                            <label
                                                key={option}
                                                className="flex items-center gap-3 cursor-pointer select-none"
                                            >
                                                <span
                                                    className={`size-3 shrink-0 border flex items-center justify-center ${
                                                        isDark ? 'border-gray-400' : 'border-black'
                                                    } ${checked ? (isDark ? 'bg-[#0ECCEE]' : 'bg-white') : ''}`}
                                                >
                                                    {checked && (
                                                        <svg viewBox="0 0 12 10" className="w-2 h-1.5" aria-hidden>
                                                            <path
                                                                d="M1 5 L4.5 8.5 L11 1"
                                                                fill="none"
                                                                stroke={isDark ? '#111213' : '#000'}
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                            />
                                                        </svg>
                                                    )}
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    className="sr-only"
                                                    checked={checked}
                                                    onChange={() => onToggle(section.id, option)}
                                                />
                                                <span
                                                    className={`text-sm font-medium font-inter leading-5 tracking-tight ${
                                                        isDark ? 'text-gray-200' : 'text-black/80'
                                                    }`}
                                                >
                                                    {option}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex items-center justify-center gap-3 px-5 pb-5 pt-2">
                    <button
                        type="button"
                        onClick={onClear}
                        className={`h-8 min-w-28 rounded-2xl text-base font-medium font-inter leading-6 ${
                            isDark
                                ? 'bg-[#161718] text-[#0ECCEE]'
                                : 'bg-[#F5F6FA] text-[#0ECCEE]'
                        }`}
                    >
                        Clear all
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        className="h-8 min-w-28 rounded-2xl bg-[#0ECCEE] text-black text-base font-medium font-inter leading-6"
                    >
                        Apply
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function TrekCategoryPage() {
    const navigate        = useNavigate();
    const { category }    = useParams();
    const { isDark }      = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [treks,       setTreks]       = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [active,      setActive]      = useState(category || TREK_CATEGORIES[0].id);
    const [showFilter,  setShowFilter]  = useState(false);
    const [draftFilters, setDraftFilters] = useState(emptyUserFilters);
    const [appliedFilters, setAppliedFilters] = useState(emptyUserFilters);

    useEffect(() => {
        if (category) setActive(category);
    }, [category]);

    useEffect(() => {
        Promise.all([
            fetch(`${API}/treks?_cb=${Date.now()}`,             { credentials: 'omit', mode: 'cors', headers: { Accept: 'application/json' } }),
            fetch(`${API}/trek-communities?_cb=${Date.now()}`,  { credentials: 'omit', mode: 'cors', headers: { Accept: 'application/json' } }),
        ])
            .then(([r1, r2]) => Promise.all([r1.json(), r2.json()]))
            .then(([t, c]) => {
                setTreks(Array.isArray(t?.treks) ? t.treks : []);
                setCommunities(Array.isArray(c?.communities) ? c.communities : []);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const filtered = useMemo(
        () =>
            treks.filter(
                (t) => t.trekCategory === active && trekMatchesFilters(t, appliedFilters)
            ),
        [treks, active, appliedFilters]
    );

    const activeFilterCount = useMemo(
        () => Object.values(appliedFilters).reduce((sum, values) => sum + values.length, 0),
        [appliedFilters]
    );

    const toggleDraftFilter = (sectionId, option) => {
        setDraftFilters((prev) => {
            const current = prev[sectionId] || [];
            const next = current.includes(option)
                ? current.filter((v) => v !== option)
                : [...current, option];
            return { ...prev, [sectionId]: next };
        });
    };

    const handleOpenFilter = () => {
        setDraftFilters(appliedFilters);
        setShowFilter(true);
    };

    const handleApplyFilters = () => {
        setAppliedFilters(draftFilters);
        setShowFilter(false);
    };

    const handleClearDraft = () => {
        setDraftFilters(emptyUserFilters());
    };

    const handleClearFilters = () => {
        const cleared = emptyUserFilters();
        setDraftFilters(cleared);
        setAppliedFilters(cleared);
    };

    const commName = (id) =>
        communities.find(c => String(c._id) === String(id))?.name || '';

    return (
        <div className="crwdctrl-page crwdctrl-page--content crwdctrl-mobile-page flex flex-col min-h-screen">

            {/* ── Sticky Header ── */}
            <div
                className={`crwdctrl-sticky-header sticky top-0 z-40 rounded-b-[16px] px-4 pb-4 ${isDark ? 'bg-black' : 'bg-slate-100'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
            >
                {/* Back + Title + Filter */}
                <div className="flex items-center gap-3 mt-2 mb-5">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className={`size-8 rounded-full flex items-center justify-center shrink-0 ${
                            isDark ? 'bg-white/10' : 'bg-white'
                        }`}
                    >
                        <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-900'} />
                    </button>
                    <h1
                        className={`flex-1 text-2xl font-medium font-inter leading-8 ${
                            isDark ? 'text-white' : 'text-gray-900'
                        }`}
                    >
                        Trek Category
                    </h1>
                    <button
                        type="button"
                        onClick={handleOpenFilter}
                        className={`relative size-8 rounded-full flex items-center justify-center shrink-0 ${
                            isDark ? 'bg-white/10' : 'bg-white'
                        }`}
                        aria-label="Open filters"
                    >
                        <SlidersHorizontal size={16} className={isDark ? 'text-white' : 'text-gray-900'} />
                        {activeFilterCount > 0 && (
                            <span className="absolute -top-1 -right-1 size-4 rounded-full bg-[#0ECCEE] text-[10px] font-semibold text-black flex items-center justify-center">
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Category circles */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                    <div className="flex gap-7 pb-2 pt-2">
                        {TREK_CATEGORIES.map((cat) => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setActive(cat.id)}
                                className="flex flex-col items-center gap-1.5 shrink-0 active:scale-95 transition-all duration-200"
                            >
                                <div
                                    className={`size-20 rounded-full overflow-hidden ${
                                        active === cat.id ? 'ring-2 ring-[#0ECCEE] ring-offset-2' : ''
                                    } ${isDark ? 'bg-[#111213]' : 'bg-slate-100'}`}
                                >
                                    <img
                                        src={cat.image}
                                        alt={cat.label}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <span
                                    className={`text-sm font-medium font-inter leading-5 tracking-tight whitespace-nowrap ${
                                        active === cat.id
                                            ? 'text-blue-700'
                                            : isDark
                                              ? 'text-gray-300'
                                              : 'text-gray-900'
                                    }`}
                                >
                                    {cat.label}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                {activeFilterCount > 0 && (
                    <div className="flex items-center justify-between mt-2 px-1">
                        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''} applied
                        </span>
                        <button
                            type="button"
                            onClick={handleClearFilters}
                            className="text-xs font-medium text-[#0ECCEE]"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            {/* ── Content ── */}
            <main className="flex-1 pt-5 pb-28 px-4">
                {loading ? (
                    <TrekListSkeleton count={3} />
                ) : filtered.length === 0 ? (
                    <div className={`text-center py-16 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <div className="flex justify-center mb-3">
                            {(() => {
                                const cat = TREK_CATEGORIES.find((c) => c.id === active);
                                return cat ? (
                                    <img src={cat.icon} alt={cat.label} className="size-14 object-contain" />
                                ) : null;
                            })()}
                        </div>
                        <p className="text-sm">
                            {activeFilterCount > 0
                                ? 'No treks match your filters'
                                : `No ${TREK_CATEGORIES.find((c) => c.id === active)?.label} treks added yet`}
                        </p>
                        {activeFilterCount > 0 && (
                            <button
                                type="button"
                                onClick={handleClearFilters}
                                className="mt-3 text-sm font-medium text-[#0ECCEE]"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map((trek) => {
                            const img = trek.coverImage || trek.images?.[0];
                            const comm = commName(trek.communityId);
                            return (
                                <div
                                    key={trek._id}
                                    onClick={() => navigate(`/trek/${trek._id}`, { state: { trek } })}
                                    className="card-surface rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
                                >
                                    {/* Image */}
                                    <div className="card-wide-image w-full">
                                        {img ? (
                                            <img
                                                src={getImageUrl(img, { preset: 'cardLg' })}
                                                alt={trek.trekName}
                                                className="w-full h-full object-cover"
                                                onError={e => handleImageErrorWithFallback(e, 361, 224, '#1a3a2a', trek.trekName)}
                                            />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                <span className="text-5xl">🏔️</span>
                                            </div>
                                        )}
                                        <CardFavoriteButton
                                            isFavorite={isFavorite(trek._id)}
                                            onClick={() => toggleFavorite(trek._id, trek)}
                                        />
                                    </div>

                                    {/* Info row */}
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-lg font-medium leading-7 tracking-wide line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {trek.trekName}
                                            </p>
                                            {comm && (
                                                <p
                                                    className={`text-sm font-medium font-inter leading-5 tracking-tight ${
                                                        isDark ? 'text-gray-400' : 'text-gray-500'
                                                    }`}
                                                >
                                                    {comm}
                                                </p>
                                            )}
                                        </div>
                                        <CardShareButton
                                            isDark={isDark}
                                            className="ml-3 shrink-0"
                                            onClick={() => {
                                                if (navigator.share) navigator.share({ title: trek.trekName, url: `${window.location.origin}/trek/${trek._id}` }).catch(() => {});
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <TrekFilterModal
                isOpen={showFilter}
                isDark={isDark}
                draftFilters={draftFilters}
                onToggle={toggleDraftFilter}
                onClear={handleClearDraft}
                onApply={handleApplyFilters}
                onClose={() => setShowFilter(false)}
            />
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import ShareIcon from '../../assets/share.svg';
import HikingIcon from '../../assets/mobile-icons/hiking.svg';
import TrailIcon from '../../assets/mobile-icons/trail walks.svg';
import BackpackingIcon from '../../assets/mobile-icons/backpacking.svg';
import CampingIcon from '../../assets/mobile-icons/camping.svg';
import AdventureIcon from '../../assets/mobile-icons/adventure.svg';
import NatureIcon from '../../assets/mobile-icons/nature.svg';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const TREK_CATEGORIES = [
    { id: 'hiking',      label: 'Hiking',      icon: HikingIcon,      bg: '#FFF7ED', darkBg: '#2D1B0E' },
    { id: 'trail',       label: 'Trail Walks', icon: TrailIcon,       bg: '#F0FDF4', darkBg: '#0A2318' },
    { id: 'backpacking', label: 'Backpacking', icon: BackpackingIcon, bg: '#EEF2FF', darkBg: '#1A1B3A' },
    { id: 'camping',     label: 'Camping',     icon: CampingIcon,     bg: '#0F172A', darkBg: '#0F172A' },
    { id: 'adventure',   label: 'Adventure',   icon: AdventureIcon,   bg: '#F0F9FF', darkBg: '#0B1D2E' },
    { id: 'nature',      label: 'Nature',      icon: NatureIcon,      bg: '#D1FAE5', darkBg: '#0A2D1A' },
];

export default function TrekCategoryPage() {
    const navigate        = useNavigate();
    const { category }    = useParams();
    const { isDark }      = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [treks,       setTreks]       = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [active,      setActive]      = useState(category || TREK_CATEGORIES[0].id);

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

    const filtered = treks.filter(t => t.trekCategory === active);

    const commName = (id) =>
        communities.find(c => String(c._id) === String(id))?.name || '';

    const bg   = isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]';
    const card = isDark ? 'bg-[#111213]' : 'bg-white';

    return (
        <div className={`flex flex-col min-h-screen max-w-md mx-auto ${bg}`}>

            {/* ── Sticky Header ── */}
            <div
                className={`sticky top-0 z-40 rounded-b-3xl px-4 pb-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${isDark ? 'bg-black' : 'bg-white'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}
            >
                {/* Back + Title */}
                <div className="flex items-center gap-3 mt-2 mb-5">
                    <button
                        onClick={() => navigate(-1)}
                        className={`size-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}
                    >
                        <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-700'} />
                    </button>
                    <h1 className={`text-2xl font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Trek Category</h1>
                </div>

                {/* Category circles */}
                <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                    <div className="flex gap-5 pb-2 pt-6">
                        {TREK_CATEGORIES.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setActive(cat.id)}
                                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-all duration-200"
                            >
                                <div className={`transition-all duration-200 ${active === cat.id ? '-translate-y-2 scale-110' : 'scale-100'}`}>
                                    <div
                                        className="size-20 rounded-full overflow-hidden flex items-center justify-center transition-all duration-200"
                                        style={{ backgroundColor: isDark ? '#161718' : '#F5F5F0' }}
                                    >
                                        <img src={cat.icon} alt={cat.label} className="w-full h-full object-contain object-center" />
                                    </div>
                                </div>
                                <span className={`text-xs font-medium ${active === cat.id ? 'text-[#0ECCEE]' : isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {cat.label}
                                </span>
                                <div className={`h-1 rounded-full transition-all duration-200 ${active === cat.id ? 'w-5 bg-[#0ECCEE]' : 'w-0'}`} />
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Content ── */}
            <main className="flex-1 pt-5 pb-28 px-4">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 rounded-full border-4 border-[#0ECCEE] border-t-transparent animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className={`text-center py-16 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <div className="flex justify-center mb-3">
                            {(() => { const cat = TREK_CATEGORIES.find(c => c.id === active); return cat ? <img src={cat.icon} alt={cat.label} className="size-14 object-contain" /> : null; })()}
                        </div>
                        <p className="text-sm">No {TREK_CATEGORIES.find(c => c.id === active)?.label} treks added yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {filtered.map(trek => {
                            const img  = trek.coverImage || trek.images?.[0];
                            const comm = commName(trek.communityId);
                            return (
                                <div
                                    key={trek._id}
                                    onClick={() => navigate(`/trek/${trek._id}`, { state: { trek } })}
                                    className={`rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${card} shadow-sm`}
                                >
                                    {/* Image */}
                                    <div className="relative w-full h-56 overflow-hidden">
                                        {img ? (
                                            <img
                                                src={getImageUrl(img)}
                                                alt={trek.trekName}
                                                className="w-full h-full object-cover"
                                                onError={e => handleImageErrorWithFallback(e, 361, 224, '#1a3a2a', trek.trekName)}
                                            />
                                        ) : (
                                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                <span className="text-5xl">🏔️</span>
                                            </div>
                                        )}
                                        {/* Heart */}
                                        <button
                                            onClick={e => { e.stopPropagation(); toggleFavorite(trek._id, trek); }}
                                            className="absolute top-2.5 right-2.5 size-6 rounded-full bg-black/10 border-[0.5px] border-slate-100 flex items-center justify-center"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24"
                                                fill={isFavorite(trek._id) ? '#ef4444' : 'none'}
                                                stroke={isFavorite(trek._id) ? '#ef4444' : 'white'} strokeWidth="2">
                                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Info row */}
                                    <div className="flex items-center justify-between px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-lg font-medium leading-7 tracking-wide line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {trek.trekName}
                                            </p>
                                            {comm && (
                                                <p className={`text-sm font-medium leading-5 tracking-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {comm}
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (navigator.share) navigator.share({ title: trek.trekName, url: `${window.location.origin}/trek/${trek._id}` }).catch(() => {});
                                            }}
                                            className={`size-8 rounded-2xl flex items-center justify-center ml-3 flex-shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-white shadow-sm border border-gray-100'}`}
                                        >
                                            <img src={ShareIcon} alt="Share" className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}

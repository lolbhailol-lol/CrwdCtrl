import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const STATUS_BADGE = {
    ongoing:      { label: 'Ongoing',       cls: 'bg-green-500 text-white' },
    upcoming:     { label: 'Upcoming',      cls: 'bg-blue-500 text-white' },
    beyondcampus: { label: 'Beyond Campus', cls: 'bg-purple-500 text-white' },
    completed:    { label: 'Completed',     cls: 'bg-gray-500 text-white' },
    lastyearhit:  { label: 'Last Year',     cls: 'bg-amber-500 text-black' },
};

function StatusBadge({ status }) {
    const b = STATUS_BADGE[status];
    if (!b) return null;
    return (
        <span className={`absolute bottom-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-lg ${b.cls}`}>
            {b.label}
        </span>
    );
}

function formatDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DotPagination({ total, current, isDark }) {
    if (total <= 1) return null;
    return (
        <div className="flex justify-center items-center gap-1.5 mt-3">
            {Array.from({ length: Math.min(total, 5) }).map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-300
                    ${i === current % Math.min(total, 5)
                        ? `h-2 w-5 ${isDark ? 'bg-white' : 'bg-[#0ECCEE]'}`
                        : `size-2 bg-transparent border-2 ${isDark ? 'border-gray-500' : 'border-slate-300'}`
                    }`} />
            ))}
        </div>
    );
}

export default function SportsFestPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [fests, setFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [featuredPg, setFeaturedPg] = useState(0);
    const scrollRef = useRef(null);

    useEffect(() => {
        fetch(`${API}/fests/all?_cb=${Date.now()}`, { credentials: 'omit', mode: 'cors', headers: { Accept: 'application/json' } })
            .then(r => r.json())
            .then(data => {
                const all = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                setFests(all.filter(f => f.festType === 'sports' && f.status !== 'lastyearhit'));
            })
            .catch(() => setFests([]))
            .finally(() => setLoading(false));
    }, []);

    const featured = fests.filter(f => f.status === 'ongoing');
    const listed   = fests.filter(f => f.status !== 'ongoing');
    const bg   = isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]';
    const card = isDark ? 'bg-[#111213]' : 'bg-white';

    return (
        <div className={`flex flex-col min-h-screen max-w-md mx-auto ${bg}`}>
            <div className={`sticky top-0 z-40 rounded-b-[16px] px-4 pb-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${isDark ? 'bg-[#111213]' : 'bg-[#F2F4F7]'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
                <div className="flex items-center gap-3 mt-2">
                    <button onClick={() => navigate(-1)} className={`size-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                        <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-700'} />
                    </button>
                    <h1 className={`text-2xl font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Sports</h1>
                </div>
            </div>

            <main className="flex-1 pt-5 pb-28">
                {loading ? (
                    <div className="flex justify-center items-center py-20">
                        <div className="w-8 h-8 rounded-full border-4 border-[#0ECCEE] border-t-transparent animate-spin" />
                    </div>
                ) : (
                    <>
                        {featured.length > 0 && (
                            <section className="mb-6">
                                <h2 className={`text-xl font-semibold px-4 mb-3 ${isDark ? 'text-white' : 'text-black'}`}>Featured Fests</h2>
                                <div ref={scrollRef} className="overflow-x-auto scrollbar-hide pl-4" style={{ scrollbarWidth: 'none' }}
                                    onScroll={e => setFeaturedPg(Math.round(e.target.scrollLeft / 320))}>
                                    <div className="flex gap-4 pb-1 snap-x snap-mandatory">
                                        {featured.map(fest => {
                                            const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                            return (
                                                <div key={fest._id} className={`w-[320px] shrink-0 rounded-2xl overflow-hidden snap-start ${card} shadow-sm`}>
                                                    <div className="relative w-full h-[175px] overflow-hidden">
                                                        {img ? <img src={getImageUrl(img, { preset: 'cardLg' })} alt={fest.festName} className="w-full h-full object-cover" onError={e => handleImageErrorWithFallback(e, 320, 175, '#1a2a1a', fest.festName)} />
                                                            : <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}><span className="text-5xl">⚽</span></div>}
                                                        <StatusBadge status={fest.status} />
                                                        <button onClick={e => { e.stopPropagation(); toggleFavorite(fest._id, fest); }}
                                                            className={`absolute top-2.5 right-2.5 size-8 rounded-2xl flex items-center justify-center ${isDark ? 'bg-black/30' : 'bg-white shadow-sm'}`}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite(fest._id) ? '#ef4444' : 'none'} stroke={isFavorite(fest._id) ? '#ef4444' : (isDark ? 'white' : '#374151')} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                        </button>
                                                    </div>
                                                    <div className="px-4 pt-3 pb-4">
                                                        <p className={`text-lg font-medium leading-7 line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{fest.festName}</p>
                                                        <p className={`text-sm font-medium leading-5 mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fest.collegeName}</p>
                                                        <button onClick={() => navigate(`/view-details/${fest._id}`)} className="w-full h-11 rounded-2xl bg-[#0ECCEE] text-black text-sm font-medium shadow-md">View details</button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <DotPagination total={featured.length} current={featuredPg} isDark={isDark} />
                            </section>
                        )}

                        <section className="px-4">
                            <h2 className={`text-xl font-semibold mb-3 ${isDark ? 'text-white' : 'text-black'}`}>Listed Fest</h2>
                            {listed.length === 0 && featured.length === 0 ? (
                                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="text-4xl mb-2">⚽</div><p>No sports fests right now</p>
                                </div>
                            ) : listed.length === 0 ? null : (
                                <div className="space-y-3">
                                    {listed.map(fest => {
                                        const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                        return (
                                            <div key={fest._id} onClick={() => navigate(`/view-details/${fest._id}`)}
                                                className={`flex rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all ${card} shadow-sm`}>
                                                <div className="relative shrink-0 size-40">
                                                    {img ? <img src={getImageUrl(img, { preset: 'cardLg' })} alt={fest.festName} className="w-full h-full object-cover" onError={e => handleImageErrorWithFallback(e, 160, 160, '#1a2a1a', fest.festName)} />
                                                        : <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}><span className="text-4xl">⚽</span></div>}
                                                    <StatusBadge status={fest.status} />
                                                    <button onClick={e => { e.stopPropagation(); toggleFavorite(fest._id, fest); }}
                                                        className="absolute top-2 right-2 size-6 rounded-full bg-black/10 border-[0.5px] border-slate-100 flex items-center justify-center">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill={isFavorite(fest._id) ? '#ef4444' : 'none'} stroke={isFavorite(fest._id) ? '#ef4444' : 'white'} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                                                    </button>
                                                </div>
                                                <div className="flex-1 min-w-0 px-4 py-4">
                                                    <p className={`text-sm font-medium line-clamp-2 mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{fest.festName}</p>
                                                    <p className={`text-xs font-medium line-clamp-1 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{fest.collegeName}</p>
                                                    {fest.festDate && <p className={`text-xs font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDate(fest.festDate)}</p>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

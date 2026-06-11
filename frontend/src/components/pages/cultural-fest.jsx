import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { toCardText } from '../../utils/cardText';
import { FestSubpageLoadingSkeleton } from '../HomeEventCardSkeleton';
import CardFavoriteButton from '../CardFavoriteButton';
import CarouselDotPagination from '../CarouselDotPagination';
import { getCarouselScrollPage } from '../../utils/horizontalScroll';
import CustomPageSectionsRenderer from '../CustomPageSectionsRenderer';
import { usePageSectionHandlers } from '../../utils/pageSectionHandlers';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const STATUS_BADGE = {
    ongoing:      { label: 'Ongoing',      cls: 'bg-green-500 text-white' },
    upcoming:     { label: 'Upcoming',     cls: 'bg-blue-500 text-white' },
    beyondcampus: { label: 'Beyond Campus', cls: 'bg-purple-500 text-white' },
    completed:    { label: 'Completed',    cls: 'bg-gray-500 text-white' },
    lastyearhit:  { label: 'Last Year',    cls: 'bg-amber-500 text-black' },
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

export default function CulturalFestPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();


    const [fests, setFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [featuredPg, setFeaturedPg] = useState(0);
    const scrollRef = useRef(null);

    useEffect(() => {
        const fetchFests = async () => {
            try {
                const r = await fetch(`${API}/fests/all?_cb=${Date.now()}`, {
                    credentials: 'omit', mode: 'cors', headers: { Accept: 'application/json' },
                });
                const data = await r.json();
                const all = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
                setFests(all.filter(f => f.festType === 'cultural' && f.status !== 'lastyearhit'));
            } catch {
                setFests([]);
            } finally {
                setLoading(false);
            }
        };
        fetchFests();
    }, []);

    const featured = fests.filter(f => f.status === 'ongoing');
    const listed   = fests.filter(f => f.status !== 'ongoing');
    const { onItemClick, onToggleFavorite: onSectionFav, getShareUrl } = usePageSectionHandlers(navigate, { toggleFavorite });

    const bg   = isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]';
    return (
        <div className={`crwdctrl-page crwdctrl-mobile-page min-h-screen ${bg}`}>

            {/* ── Header ── */}
            <div className={`sticky top-0 z-40 rounded-b-[16px] px-4 pb-4 shadow-[0_4px_16px_rgba(0,0,0,0.08)] ${isDark ? 'bg-[#111213]' : 'bg-[#F2F4F7]'}`}
                style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>
                <div className="flex items-center gap-3 mt-2">
                    <button type="button" onClick={() => navigate(-1)} aria-label="Go back"
                        className={`touch-target size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-white/10' : 'bg-white shadow-sm'}`}>
                        <ArrowLeft size={18} className={isDark ? 'text-white' : 'text-gray-700'} />
                    </button>
                    <h1 className={`text-2xl font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Cultural</h1>
                </div>
            </div>

            <main className="pt-5 pb-28">

                {loading ? (
                    <FestSubpageLoadingSkeleton listedCount={3} />
                ) : (
                    <>
                        {/* ── Featured Fests ── */}
                        {featured.length > 0 && (
                            <section className="mb-6">
                                <h2 className={`home-section-heading px-4 mb-3 ${isDark ? 'text-white' : 'text-black'}`}>Featured Fests</h2>
                                <div
                                    ref={scrollRef}
                                    className="carousel-scroll-gutter overflow-x-auto scrollbar-hide"
                                    style={{ scrollbarWidth: 'none' }}
                                    onScroll={(e) => setFeaturedPg(getCarouselScrollPage(e.currentTarget))}
                                >
                                    <div className="flex gap-4 pb-1">
                                        {featured.map(fest => {
                                            const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                            return (
                                                <div key={fest._id}
                                                    className="card-surface card-carousel-fest rounded-2xl overflow-hidden snap-start">
                                                    {/* Image */}
                                                    <div className="fest-card-image">
                                                        {img ? (
                                                            <img src={getImageUrl(img, { preset: 'cardLg' })} alt={fest.festName}
                                                                className="w-full h-full object-cover"
                                                                onError={e => handleImageErrorWithFallback(e, 320, 175, '#1a1a2e', fest.festName)} />
                                                        ) : (
                                                            <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                                <span className="text-5xl">🎭</span>
                                                            </div>
                                                        )}
                                                        <StatusBadge status={fest.status} />
                                                        <CardFavoriteButton
                                                            isFavorite={isFavorite(fest._id)}
                                                            onClick={() => toggleFavorite(fest._id, fest)}
                                                        />
                                                    </div>
                                                    {/* Info */}
                                                    <div className="px-4 pt-3 pb-4">
                                                        <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{toCardText(fest.festName)}</p>
                                                        <p className={`card-event-subtitle mb-3 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{toCardText(fest.collegeName)}</p>
                                                        <button
                                                            onClick={() => navigate(`/view-details/${fest._id}`)}
                                                            className="w-full h-11 rounded-2xl bg-[#0ECCEE] text-black text-sm font-medium shadow-md">
                                                            View details
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <CarouselDotPagination total={featured.length} current={featuredPg} />
                            </section>
                        )}

                        {/* ── Listed Fest ── */}
                        <section className="px-4">
                            <h2 className={`home-section-heading mb-3 ${isDark ? 'text-white' : 'text-black'}`}>Listed Fest</h2>
                            {listed.length === 0 && featured.length === 0 ? (
                                <div className={`text-center py-12 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    <div className="text-4xl mb-2">🎭</div>
                                    <p>No cultural fests right now</p>
                                </div>
                            ) : listed.length === 0 ? null : (
                                <div className="space-y-3">
                                    {listed.map(fest => {
                                        const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];
                                        return (
                                            <div key={fest._id}
                                                onClick={() => navigate(`/view-details/${fest._id}`)}
                                                className="card-surface flex rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all">
                                                {/* Square image */}
                                                <div className="relative list-card-thumb shrink-0">
                                                    {img ? (
                                                        <img src={getImageUrl(img, { preset: 'cardLg' })} alt={fest.festName}
                                                            className="w-full h-full object-cover"
                                                            onError={e => handleImageErrorWithFallback(e, 160, 160, '#1a1a2e', fest.festName)} />
                                                    ) : (
                                                        <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-100'}`}>
                                                            <span className="text-4xl">🎭</span>
                                                        </div>
                                                    )}
                                                    <StatusBadge status={fest.status} />
                                                    <CardFavoriteButton
                                                        isFavorite={isFavorite(fest._id)}
                                                        onClick={() => toggleFavorite(fest._id, fest)}
                                                    />
                                                </div>
                                                {/* Details */}
                                                <div className="flex-1 min-w-0 px-4 py-4">
                                                    <p className={`card-event-title line-clamp-2 mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{toCardText(fest.festName)}</p>
                                                    <p className={`card-event-subtitle line-clamp-1 mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{toCardText(fest.collegeName)}</p>
                                                    {fest.festDate && (
                                                        <p className={`text-xs font-medium leading-4 tracking-tight ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{formatDate(fest.festDate)}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        <CustomPageSectionsRenderer
                            targetPage="cultural-fest"
                            fests={fests}
                            isDark={isDark}
                            loading={loading}
                            isFavorite={isFavorite}
                            onToggleFavorite={onSectionFav}
                            onItemClick={onItemClick}
                            getShareUrl={getShareUrl}
                        />
                    </>
                )}
            </main>
        </div>
    );
}

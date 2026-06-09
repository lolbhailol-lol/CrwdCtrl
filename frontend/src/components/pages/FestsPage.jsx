import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, Bell } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import ContentImage from '../ContentImage';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import HomeCategoryBar from '../HomeCategoryBar';
import MobileStickyHeader from '../MobileStickyHeader';
import HeroSearchBar from '../HeroSearchBar';
import HeroBanner from '../HeroBanner';
import AppLogo from '../AppLogo';
import ShareIcon from '../../assets/share.svg';
import { FestCardsRowSkeleton } from '../HomeEventCardSkeleton';
import CulturalIcon from '../../assets/mobile-icons/cul.svg';
import TechIcon from '../../assets/mobile-icons/techhh.svg';
import SportsIcon from '../../assets/mobile-icons/spor.svg';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const SUBCATEGORIES = [
    { id: 'cultural',   label: 'CULTURAL', icon: CulturalIcon, path: '/cultural-fest' },
    { id: 'technical',  label: 'TECH',     icon: TechIcon,     path: '/tech-fest' },
    { id: 'sports',     label: 'SPORTS',   icon: SportsIcon,   path: '/sports-fest' },
];

// ── Sub-category tile (crisp SVG on iOS) ───────────────────────────────────
const SubcategoryTile = ({ cat, isDark, onClick }) => (
    <button
        type="button"
        onClick={onClick}
        aria-label={cat.label}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        className="flex flex-col items-center justify-center gap-2.5 py-5 lg:py-7 rounded-2xl lg:rounded-3xl
                   transition-opacity duration-150 active:opacity-80"
    >
        <img
            src={cat.icon}
            alt={cat.label}
            width={128}
            height={113}
            draggable={false}
            decoding="sync"
            className="crisp-icon category-icon-lg pointer-events-none"
        />
        <span className={`text-fluid-xs lg:text-sm font-bold tracking-wide ${isDark ? 'text-white' : 'text-[#111827]'}`}>
            {cat.label}
        </span>
    </button>
);

// ── Dot Pagination ──────────────────────────────────────────────────────────
const DotRow = ({ total, active }) => {
    if (total <= 1) return null;
    const shown = Math.min(total, 5);
    return (
        <div className="flex justify-center gap-1.5 mt-3 lg:hidden">
            {Array.from({ length: shown }).map((_, i) => (
                <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                        i === (active % shown) ? 'w-5 h-2 bg-[#0ECCEE]' : 'w-2 h-2 bg-gray-500/50'
                    }`}
                />
            ))}
        </div>
    );
};

// ── Horizontal scroll hook (tracks active index from scroll position) ────────
function useScrollIndex(ref, cardSelector = '.card-carousel-fest', gap = 12) {
    const [idx, setIdx] = useState(0);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const handler = () => {
            const card = el.querySelector(cardSelector);
            const step = (card?.offsetWidth ?? 312) + gap;
            setIdx(Math.round(el.scrollLeft / step));
        };
        el.addEventListener('scroll', handler, { passive: true });
        return () => el.removeEventListener('scroll', handler);
    }, [ref, cardSelector, gap]);
    return idx;
}

// ── Fest Event Card ──────────────────────────────────────────────────────────
const FestEventCard = ({ fest, isDark, isFavorite, onToggleFavorite, onViewDetails }) => {
    const img = fest.coverImage || fest.galleryImages?.[0] || fest.festImages?.[0];

    const handleShare = (e) => {
        e.stopPropagation();
        if (navigator.share) {
            navigator.share({
                title: fest.festName,
                text: `Check out ${fest.festName}`,
                url: `${window.location.origin}/view-details/${fest._id}`,
            }).catch(() => {});
        }
    };

    return (
        <div
            className={`card-carousel-fest lg:w-auto rounded-2xl lg:rounded-3xl overflow-hidden cursor-pointer snap-start
                        transition-all duration-200 active:scale-[0.98]
                        ${isDark ? 'bg-[#111213]' : 'bg-white shadow-md lg:shadow-lg'}`}
            onClick={onViewDetails}
        >
            {/* Image */}
            <div className="relative aspect-[16/9] lg:aspect-[8/5] overflow-hidden">
                <ContentImage
                    src={img}
                    alt={fest.festName}
                    preset="cardLg"
                    className="w-full h-full object-cover"
                    onError={(e) => handleImageErrorWithFallback(e, 320, 190, '#6366f1', fest.festName || 'Fest')}
                />
                {/* Heart */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
                    className={`absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center
                                transition-all duration-200 active:scale-90
                                ${isFavorite
                                    ? 'bg-red-500 shadow-lg shadow-red-500/40'
                                    : 'bg-black/40 backdrop-blur-sm border border-white/20'
                                }`}
                    aria-label={isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                >
                    <Heart size={16} className={isFavorite ? 'fill-white text-white' : 'text-white'} />
                </button>
            </div>

            {/* Info */}
            <div className="px-3 pt-3 pb-3 lg:px-4 lg:pt-4 lg:pb-4">
                <div className="flex items-start justify-between mb-1">
                    <h3 className={`text-fluid-base lg:text-base font-bold leading-snug flex-1 pr-2 line-clamp-1
                                   ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {fest.festName}
                    </h3>
                    <button
                        onClick={handleShare}
                        className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-colors
                                   ${isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        aria-label="Share"
                    >
                        <img
                            src={ShareIcon}
                            alt="Share"
                            className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`}
                        />
                    </button>
                </div>

                <p className={`text-xs lg:text-sm mb-3 line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {fest.collegeName}
                </p>

                <button
                    onClick={(e) => { e.stopPropagation(); onViewDetails(); }}
                    className="w-full py-2.5 lg:py-3 rounded-xl text-sm lg:text-base font-bold text-white
                               bg-blue-500 hover:bg-blue-600 active:bg-blue-700
                               transition-colors shadow-lg shadow-blue-500/20"
                >
                    View details
                </button>
            </div>
        </div>
    );
};

// ── Horizontal Section ───────────────────────────────────────────────────────
const FestSection = ({ title, fests, loading, isDark, isFavorite, toggleFavorite, navigate }) => {
    const scrollRef = useRef(null);
    const activeIdx = useScrollIndex(scrollRef, 312);

    if (!loading && fests.length === 0) return null;

    return (
        <section className="mb-8">
            <h2 className={`text-xl lg:text-2xl font-bold px-[var(--page-gutter)] lg:px-10 mb-4 lg:mb-6 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {title}
            </h2>

            <div
                ref={scrollRef}
                className="overflow-x-auto lg:overflow-visible scrollbar-hide px-[var(--page-gutter)] lg:px-10"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
            >
                <div className="flex gap-3 lg:grid lg:grid-cols-3 xl:grid-cols-4 lg:gap-6 pb-1 lg:pb-6 snap-x snap-mandatory lg:snap-none">
                    {loading
                        ? <FestCardsRowSkeleton count={2} />
                        : fests.map(fest => (
                            <FestEventCard
                                key={fest._id}
                                fest={fest}
                                isDark={isDark}
                                isFavorite={isFavorite(fest._id)}
                                onToggleFavorite={() => toggleFavorite(fest._id, fest)}
                                onViewDetails={() => navigate(`/view-details/${fest._id}`)}
                            />
                        ))
                    }
                </div>
            </div>

            {!loading && <DotRow total={fests.length} active={activeIdx} />}
        </section>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
export default function FestsPage() {
    const navigate = useNavigate();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const [fests, setFests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch all fests
    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await fetch(`${API}/fests/all`, {
                    credentials: 'omit',
                    mode: 'cors',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!cancelled) {
                    setFests(Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('FestsPage fetch error:', err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    // Filter by sub-category + search
    const filtered = useMemo(() => {
        let list = fests;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(f =>
                f.festName?.toLowerCase().includes(q) ||
                f.collegeName?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [fests, searchQuery]);

    const sortByPriority = (a, b) => (a.priority || 999) - (b.priority || 999);

    const ongoingFests = useMemo(() =>
        filtered.filter(f => f.status === 'ongoing').sort(sortByPriority),
        [filtered]
    );

    const upcomingFests = useMemo(() =>
        filtered.filter(f => f.status === 'upcoming' || f.status === 'beyondcampus').sort(sortByPriority),
        [filtered]
    );

    const lastYearFests = useMemo(() =>
        filtered.filter(f => f.status === 'lastyearhit').sort(sortByPriority),
        [filtered]
    );

    const isEmpty = !loading && ongoingFests.length === 0 && upcomingFests.length === 0 && lastYearFests.length === 0;

    return (
        <div className={`crwdctrl-page min-h-screen ${isDark ? 'bg-[#161718]' : 'bg-[#ffffff]'}`}>

            <MobileStickyHeader
                isDark={isDark}
                brandingRow={
                    <>
                        <AppLogo className="cursor-pointer" onClick={() => navigate('/')} />
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => navigate('/')}
                                className={`p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-black/5'}`}
                                aria-label="Notifications"
                            >
                                <Bell className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                            </button>
                        </div>
                    </>
                }
                searchRow={
                    <HeroSearchBar
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery('')}
                        isDark={isDark}
                    />
                }
                categoryBar={<HomeCategoryBar isDark={isDark} activeCategory="fests" noPadding />}
            />

            <main className="pb-8 lg:pb-12">

                {/* ── Desktop Search ── */}
                <div className="hidden lg:block lg:px-10 lg:pt-6 lg:pb-4">
                    <HeroSearchBar
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        onClear={() => setSearchQuery('')}
                        isDark={isDark}
                        className="lg:py-[18px]"
                    />
                </div>

                <div className="pt-6 lg:pt-0">

                {/* ── Hero Banner ── */}
                <HeroBanner
                    events={[...ongoingFests, ...upcomingFests]
                        .filter(f => f.image || f.heroImage)
                        .slice(0, 5)
                        .map(f => ({
                            id: f._id,
                            image: f.heroImage || f.image,
                            title: f.festName,
                            subtitle: f.collegeName,
                            dateTime: f.festDate,
                            status: f.status || 'ongoing',
                        }))}
                    onEventClick={(id) => navigate(`/view-details/${id}`)}
                    isDark={isDark}
                />

                {/* ── Sub-category tiles: Cultural / Tech / Sports ── */}
                <div className="px-4 mb-6 lg:px-10 lg:mb-10">
                    <div className="flex items-center justify-between mb-4 lg:mb-6">
                        <h2 className={`text-xl lg:text-2xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Categories
                        </h2>
                    </div>
                    <div className="grid grid-cols-3 gap-3 lg:gap-6">
                        {SUBCATEGORIES.map(cat => (
                            <SubcategoryTile
                                key={cat.id}
                                cat={cat}
                                isDark={isDark}
                                onClick={() => navigate(cat.path)}
                            />
                        ))}
                    </div>
                </div>

                {/* ── Ongoing Events ── */}
                <FestSection
                    title="Ongoing Events"
                    fests={ongoingFests}
                    loading={loading}
                    isDark={isDark}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    navigate={navigate}
                />

                {/* ── Upcoming Events ── */}
                <FestSection
                    title="Upcoming Events"
                    fests={upcomingFests}
                    loading={loading}
                    isDark={isDark}
                    isFavorite={isFavorite}
                    toggleFavorite={toggleFavorite}
                    navigate={navigate}
                />

                {/* ── Last Year Hits ── */}
                {lastYearFests.length > 0 && (
                    <FestSection
                        title="Last Year Hits"
                        fests={lastYearFests}
                        loading={loading}
                        isDark={isDark}
                        isFavorite={isFavorite}
                        toggleFavorite={toggleFavorite}
                        navigate={navigate}
                    />
                )}

                {/* ── Empty state ── */}
                {isEmpty && (
                    <div className={`mx-4 lg:mx-10 text-center py-16 lg:py-20 rounded-2xl
                                   ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-white text-gray-500 shadow-sm'}`}>
                        <div className="text-5xl mb-3">🎪</div>
                        <p className="text-base lg:text-lg font-semibold mb-1">
                            {searchQuery ? 'No results found' : 'No fests available yet'}
                        </p>
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="mt-3 text-sm text-[#0ECCEE] font-medium"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}
                </div>{/* end pt-5 wrapper */}
            </main>
        </div>
    );
}

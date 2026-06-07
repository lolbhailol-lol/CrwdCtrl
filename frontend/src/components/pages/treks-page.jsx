import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Search, MapPin } from 'lucide-react';
import Logo from '../../assets/logo01_.svg';
import ShareIcon from '../../assets/share.svg';
import { TREK_BROWSE_CATEGORIES } from '../../constants/trekBrowseCategories';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useNotifications } from '../../context/NotificationsContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import HomeCategoryBar from '../HomeCategoryBar';
import Footer from '../Footer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const fetchJSON = async (endpoint) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${API_BASE_URL}${endpoint}${sep}_cb=${Date.now()}`;
    try {
        const response = await fetch(url, {
            method: 'GET', credentials: 'omit', mode: 'cors',
            headers: { 'Accept': 'application/json', 'Cache-Control': 'no-cache' },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) { clearTimeout(timeoutId); throw err; }
};

/* Browse by Trek Categories — circular PNG icons */
const TREK_CATEGORIES = TREK_BROWSE_CATEGORIES;

/* ── Dot Pagination — active: solid pill, inactive: hollow ring (Figma spec) ── */
function DotPagination({ total, current, isDark }) {
    if (total <= 1) return null;
    const shown = Math.min(total, 5);
    return (
        <div className="flex justify-center items-center gap-1.5 mt-3">
            {Array.from({ length: shown }).map((_, i) => (
                <div key={i} className={`rounded-full transition-all duration-300
                    ${i === current % shown
                        ? `h-2.5 w-6 ${isDark ? 'bg-white' : 'bg-[#0ECCEE]'}`
                        : `size-2.5 bg-transparent border-2 ${isDark ? 'border-gray-500' : 'border-slate-400'}`
                    }`}
                />
            ))}
        </div>
    );
}

/* ── Community Card — Figma: w-40 h-52 (160×208px), heart overlay, Name + Based in + share below ── */
function CommunityCard({ trek, isDark, isFavorite, onToggleFavorite, onClick, fullWidth = false }) {
    return (
        <div className={`flex flex-col cursor-pointer active:scale-95 transition-all duration-200 ${fullWidth ? 'w-full' : 'shrink-0'}`} onClick={onClick}>
            {/* Image: fills container width, fixed height */}
            <div className={`relative rounded-2xl overflow-hidden ${fullWidth ? 'w-full h-48' : 'w-40 h-52'}`}>
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image)}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-5xl">🏔️</span>
                    </div>
                )}
                {/* Heart button — Figma: size-6 bg-black/10 rounded-full border-slate-100 */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
                    className={`absolute top-2.5 right-2.5 size-6 rounded-full flex items-center justify-center
                        border-[0.5px] border-slate-100 transition-all duration-200 active:scale-90
                        ${isFavorite ? 'bg-red-500/80' : 'bg-black/10'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'white' : 'none'} stroke={isFavorite ? 'white' : 'white'} strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>
            </div>

            {/* Text below */}
            <div className={`flex items-start justify-between mt-2 ${fullWidth ? 'w-full' : 'w-40'}`}>
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`text-[15px] font-medium leading-6 tracking-wide line-clamp-1
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.title}
                    </p>
                    <p className={`text-sm font-medium leading-5 tracking-tight line-clamp-1
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trek.subtitle || 'Based in'}
                    </p>
                </div>
                {/* Share: size-8 bg-white rounded-2xl */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                    className={`size-8 shrink-0 rounded-2xl flex items-center justify-center mt-0.5
                        ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}
                >
                    <img src={ShareIcon} alt="Share" className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`} />
                </button>
            </div>
        </div>
    );
}

/* ── Weekend Plans Card — Figma: size-80 (320px) card, w-80 h-56 image, Trek Name + Type + share ── */
function WeekendCard({ trek, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div
            className={`shrink-0 w-80 rounded-2xl overflow-hidden cursor-pointer
                active:scale-[0.98] transition-all duration-200
                ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}
            onClick={onClick}
        >
            {/* Image: w-80 h-56 (320×224px) */}
            <div className="relative w-80 h-56 overflow-hidden">
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image)}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 320, 224, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                        <span className="text-6xl">🏔️</span>
                    </div>
                )}
                {/* Heart: size-6 bg-black/10 rounded-full */}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
                    className={`absolute top-3 right-3 size-6 rounded-full flex items-center justify-center
                        border-[0.5px] border-slate-100 transition-all active:scale-90
                        ${isFavorite ? 'bg-red-500/80' : 'bg-black/10'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'white' : 'none'} stroke="white" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>
            </div>

            {/* Info bar — Trek Name + Type + share (Figma: size-8 bg-white rounded-2xl for share) */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-medium leading-7 tracking-wide line-clamp-1
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.title}
                    </p>
                    <p className={`text-sm font-medium leading-5 tracking-tight
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trek.type || 'Trek'}
                    </p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                    className={`size-8 shrink-0 rounded-2xl flex items-center justify-center ml-3
                        ${isDark ? 'bg-gray-700' : 'bg-white shadow-sm'}`}
                >
                    <img src={ShareIcon} alt="Share" className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`} />
                </button>
            </div>
        </div>
    );
}

/* ── Beginner Card — same w-40 h-52 as Community but Name + Date + share below ── */
function BeginnerCard({ trek, isDark, isFavorite, onToggleFavorite, onClick }) {
    return (
        <div className="shrink-0 flex flex-col cursor-pointer active:scale-95 transition-all duration-200" onClick={onClick}>
            <div className="relative w-40 h-52 rounded-2xl overflow-hidden">
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image)}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title || 'Trek')}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-5xl">🏔️</span>
                    </div>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
                    className={`absolute top-2.5 right-2.5 size-6 rounded-full flex items-center justify-center
                        border-[0.5px] border-slate-100 active:scale-90
                        ${isFavorite ? 'bg-red-500/80' : 'bg-black/10'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill={isFavorite ? 'white' : 'none'} stroke="white" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>
            </div>

            {/* Name + Date + Share */}
            <div className="flex items-start justify-between mt-2 w-40">
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`text-[15px] font-medium leading-6 tracking-wide line-clamp-1
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.title}
                    </p>
                    <p className={`text-sm font-medium leading-5 tracking-tight
                        ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trek.date || 'Date TBA'}
                    </p>
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (navigator.share) navigator.share({ title: trek.title, url: window.location.origin + '/treks' }).catch(() => {});
                    }}
                    className={`size-8 shrink-0 rounded-2xl flex items-center justify-center mt-0.5
                        ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}
                >
                    <img src={ShareIcon} alt="Share" className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`} />
                </button>
            </div>
        </div>
    );
}

/* ── Skeleton ── */
function Skeleton({ w, h, isDark }) {
    return <div className={`shrink-0 rounded-2xl animate-pulse ${isDark ? 'bg-[#111213]' : 'bg-gray-200'}`} style={{ width: w, height: h }} />;
}

/* ── Main Page ── */
function TreksPage() {
    const { isDark } = useDarkMode();
    const navigate = useNavigate();
    const { toggleFavorite, isFavorite } = useFavorites();
    const { unreadCount } = useNotifications();

    const [treks, setTreks] = useState([]);
    const [communities, setCommunities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, _setActiveCategory] = useState(null);
    const [heroPg, setHeroPg] = useState(0);
    const [weekendPg, setWeekendPg] = useState(0);

    const heroScrollRef = useRef(null);
    const weekendScrollRef = useRef(null);

    const loadData = useCallback(async () => {
        try {
            const [trekData, commData] = await Promise.all([
                fetchJSON('/treks'),
                fetchJSON('/trek-communities'),
            ]);
            const commList = (Array.isArray(commData?.communities) ? commData.communities : [])
                .filter(c => c.showOnTreks !== false);
            setCommunities(commList.map(c => ({
                id: c._id,
                title: c.name,
                subtitle: c.basedIn || '',
                image: c.coverImage || c.galleryImages?.[0] || null,
                aboutUs: c.aboutUs,
                trekCategories: c.trekCategories || [],
                galleryImages: c.galleryImages || [],
                contactPhone: c.contactPhone,
                contactInstagram: c.contactInstagram,
                trekPageSection: c.trekPageSection || 'communities',
                trekPagePriority: c.trekPagePriority || 999,
                type: 'Community',
            })));
            const list = Array.isArray(trekData?.treks) ? trekData.treks : [];
            setTreks(list.map(t => ({
                id: t._id,
                title: t.trekName,
                subtitle: t.city || t.startingPoint || '',
                image: t.coverImage || t.images?.[0] || null,
                difficulty: t.difficultyLevel,
                duration: t.trekDuration,
                date: t.trekDate
                    ? new Date(t.trekDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null,
                trekCategory: t.trekCategory || null,
                featuredSection: t.featuredSection || null,
                homeSection: t.homeSection || null,
                trekPagePriority: t.trekPagePriority || 999,
                type: t.difficultyLevel
                    ? t.difficultyLevel.charAt(0).toUpperCase() + t.difficultyLevel.slice(1)
                    : 'Trek',
            })));
        } catch { setTreks([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Refresh when admin makes changes in another tab
    useEffect(() => {
        const handleAdminChange = (e) => {
            if (e.key === 'admin_data_updated' && e.newValue) {
                loadData();
                localStorage.removeItem('admin_data_updated');
            }
        };
        window.addEventListener('storage', handleAdminChange);
        return () => window.removeEventListener('storage', handleAdminChange);
    }, [loadData]);

    const sortTrekPage = arr => [...arr].sort((a, b) => (a.trekPagePriority || 999) - (b.trekPagePriority || 999));
    const beginnerTreks = treks.filter(t => t.difficulty === 'easy');
    const heroTreks = sortTrekPage(treks.filter(t => t.featuredSection === 'hero' || t.featuredSection === 'both'));
    const weekendTreks = sortTrekPage(treks.filter(t => t.featuredSection === 'weekend' || t.featuredSection === 'both'));
    const comingSoonCommunities = sortTrekPage(communities.filter(c => c.trekPageSection === 'comingSoon' || c.trekPageSection === 'both'));
    const exploreCommunities    = sortTrekPage(communities.filter(c => c.trekPageSection === 'communities' || c.trekPageSection === 'both' || !c.trekPageSection));
    const heroItems = sortTrekPage([...heroTreks, ...comingSoonCommunities]);
    const categoryTreks = activeCategory ? treks.filter(t => t.trekCategory === activeCategory) : [];

    const handleFav = useCallback((trek) => {
        toggleFavorite(trek.id, { id: trek.id, title: trek.title, image: trek.image, type: 'Trek' });
    }, [toggleFavorite]);

    const handleCommunityClick = useCallback((trek) => {
        navigate(`/treks/community/${trek.id}`, { state: { community: trek } });
    }, [navigate]);

    /* empty state helper */
    const EmptyState = ({ label }) => (
        <div className={`mx-4 py-6 text-center rounded-2xl text-sm ${isDark ? 'bg-[#111213] text-gray-500' : 'bg-gray-50 text-gray-400'}`}>
            {label}
        </div>
    );

    return (
        <div className={`flex flex-col min-h-screen transition-colors ${isDark ? 'bg-[#161718]' : 'bg-[#ffffff]'}`}>

            {/* ── Sticky Header — matches Figma bg-slate-100 card ── */}
            <header className={`lg:hidden sticky top-0 z-40 backdrop-blur-md transition-all duration-300
                ${isDark ? 'bg-[#0D0E10]/95' : 'bg-white/95'}`}>
                <div className={`rounded-b-3xl px-4 pb-3 shadow-[0_4px_16px_rgba(0,0,0,0.08)]
                    ${isDark ? 'bg-[#0D0E10]' : 'bg-white'}`}
                    style={{ paddingTop: 'max(env(safe-area-inset-top), 12px)' }}>

                    {/* Row 1: Logo + icons */}
                    <div className="flex items-center justify-between mb-2">
                        <img src={Logo} alt="CrwdCtrl" className="h-20 sm:h-24 w-auto" />
                        <div className="flex items-center gap-1">
                            <button
                                className={`p-2 rounded-xl bg-transparent transition-colors
                                    ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                                aria-label="Location"
                            >
                                <MapPin className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => navigate('/notifications')}
                                className={`relative p-2 rounded-xl bg-transparent transition-colors
                                    ${isDark ? 'text-white hover:bg-gray-800' : 'text-black hover:bg-gray-100'}`}
                                aria-label="Notifications"
                            >
                                <Bell className="w-6 h-6" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Row 2: Search bar */}
                    <div className="mb-3.5">
                        <div className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-4
                            ${isDark ? 'bg-[#161718]' : 'bg-[#ffffff] border border-gray-100'}`}>
                            <Search size={16} className="text-gray-400 shrink-0" />
                            <span className={`text-sm flex-1
                                ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                search college, fest
                            </span>
                        </div>
                    </div>

                    {/* Row 3: Category bar */}
                    <HomeCategoryBar isDark={isDark} activeCategory="treks" noPadding />
                </div>
            </header>

            <main className="flex-1 pb-28 overflow-x-hidden">
                <div className="max-w-2xl lg:max-w-7xl mx-auto pt-6 lg:pt-0">

                    {/* ── Hero Banner — only admin-configured hero/comingSoon items ── */}
                    {heroItems.length > 0 && (
                        <div className="mb-2" style={{ paddingLeft: '16px', paddingRight: '16px' }}>
                            <div
                                ref={heroScrollRef}
                                className="overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                                onScroll={(e) => {
                                    const idx = Math.round(e.target.scrollLeft / e.target.clientWidth);
                                    setHeroPg(idx);
                                }}
                            >
                                <div className="flex">
                                    {heroItems.map((item, _slide) => (
                                        <div key={item.id} className="shrink-0 w-full snap-start"
                                            onClick={() => navigate(`/trek/${item.id}`, { state: { trek: { ...item, trekName: item.title, images: item.image ? [item.image] : [] } } })}>
                                            <div className="relative w-full overflow-hidden cursor-pointer"
                                                style={{ height: '194px', borderRadius: '16px' }}>
                                                {item.image ? (
                                                    <img
                                                        src={getImageUrl(item.image)}
                                                        alt={item.title}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => handleImageErrorWithFallback(e, 361, 194, '#1a3a2a', 'Trek')}
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-linear-to-br from-green-900 via-emerald-800 to-teal-700" />
                                                )}
                                                <div className="absolute inset-0 bg-black/35" />
                                                <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                                                    <h2 className="text-white text-3xl font-black tracking-widest uppercase drop-shadow-lg">
                                                        {item.title}
                                                    </h2>
                                                </div>
                                                {heroItems.length > 1 && (
                                                    <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-2">
                                                        {heroItems.map((_, i) => (
                                                            <div key={i} className={`rounded-2xl transition-all duration-300
                                                                ${i === heroPg
                                                                    ? 'h-2.5 w-6 bg-white'
                                                                    : 'size-2.5 bg-transparent border-2 border-white/60'
                                                                }`}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── Explore the Communities — Figma: w-40 h-52 (160×208) cards ── */}
                    <section className="mb-6 mt-4">
                        <h2 className={`text-xl font-semibold px-4 mb-3 font-inter leading-7
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Explore the Communities
                        </h2>
                        {loading ? (
                            <div className="flex gap-4 px-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} w={150} h={208} isDark={isDark} />)}
                            </div>
                        ) : exploreCommunities.length === 0 ? (
                            <EmptyState label="No communities added yet" />
                        ) : (
                            <div
                                className="overflow-x-auto scrollbar-hide pl-4"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2 snap-x snap-proximity">
                                    {exploreCommunities.map((comm) => (
                                        <div key={comm.id} className="snap-start shrink-0">
                                            <CommunityCard
                                                trek={comm}
                                                isDark={isDark}
                                                isFavorite={isFavorite(comm.id)}
                                                onToggleFavorite={() => handleFav(comm)}
                                                onClick={() => handleCommunityClick(comm)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* ── Upcoming Weekend Plans — Figma: size-80 (320px) card ── */}
                    <section className="mb-6">
                        <h2 className={`text-xl font-semibold px-4 mb-3 font-inter leading-7
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Upcoming Weekend Plans
                        </h2>
                        {loading ? (
                            <div className="flex gap-3 px-4">
                                {[1, 2].map(i => <Skeleton key={i} w={320} h={290} isDark={isDark} />)}
                            </div>
                        ) : weekendTreks.length === 0 ? (
                            <EmptyState label="No weekend plans added yet" />
                        ) : (
                            <>
                                <div
                                    ref={weekendScrollRef}
                                    className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                    onScroll={(e) => setWeekendPg(Math.round(e.target.scrollLeft / 328))}
                                >
                                    <div className="flex gap-4 pb-1 snap-x snap-mandatory">
                                        {weekendTreks.map((trek) => (
                                            <div key={trek.id} className="snap-start">
                                                <WeekendCard
                                                    trek={trek}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(trek.id)}
                                                    onToggleFavorite={() => handleFav(trek)}
                                                    onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                {weekendTreks.length > 1 && (
                                    <div className="flex justify-center items-center gap-2 mt-3">
                                        {weekendTreks.map((_, i) => (
                                            <div key={i} className={`rounded-2xl transition-all duration-300
                                                ${i === weekendPg
                                                    ? `h-2.5 w-6 ${isDark ? 'bg-white' : 'bg-[#0ECCEE]'}`
                                                    : `size-3 bg-transparent rounded-full border-2 ${isDark ? 'border-gray-600' : 'border-[#0ECCEE]'}`
                                                }`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </section>

                    {/* ── Browse by Trek Categories — Figma: size-20 rounded-full circles ── */}
                    <section className="mb-6">
                        <h2 className={`text-xl font-semibold px-4 mb-6 font-inter leading-7
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Browse by Trek Categories
                        </h2>
                        <div
                            className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                        >
                            <div className="flex gap-6 pb-2 pt-1">
                                {TREK_CATEGORIES.map(cat => (
                                    <button
                                        key={cat.id}
                                        onClick={() => navigate(`/treks/category/${cat.id}`)}
                                        className="shrink-0 flex flex-col items-center gap-1.5 active:scale-95 transition-all duration-200"
                                    >
                                        {/* Circle with HomeCategoryBar-style lift effect */}
                                        <div className={`transition-all duration-200 ${activeCategory === cat.id ? '-translate-y-2 scale-110' : 'scale-100'}`}>
                                            <div
                                                className={`size-20 rounded-full overflow-hidden transition-all duration-200 ${
                                                    activeCategory === cat.id ? 'ring-2 ring-[#0ECCEE] ring-offset-2' : ''
                                                } ${isDark ? 'bg-[#111213]' : 'bg-slate-100'}`}
                                            >
                                                <img
                                                    src={cat.image}
                                                    alt={cat.label}
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        </div>
                                        <span className={`text-sm font-medium font-inter leading-5 tracking-tight
                                            ${activeCategory === cat.id
                                                ? 'text-[#0ECCEE]'
                                                : isDark ? 'text-gray-200' : 'text-black'
                                            }`}>
                                            {cat.label}
                                        </span>
                                        {/* Figma: white active indicator under label */}
                                        <div className={`h-1.5 rounded-2xl transition-all duration-200
                                            ${activeCategory === cat.id
                                                ? `w-5 ${isDark ? 'bg-[#0ECCEE]' : 'bg-gray-800'}`
                                                : 'w-0'
                                            }`}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filtered cards when category is active */}
                        {activeCategory && (
                            <div className="mt-4">
                                {categoryTreks.length > 0 ? (
                                    <div
                                        className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                                    >
                                        <div className="flex gap-4 pb-2">
                                            {categoryTreks.map(trek => (
                                                <BeginnerCard
                                                    key={trek.id}
                                                    trek={trek}
                                                    isDark={isDark}
                                                    isFavorite={isFavorite(trek.id)}
                                                    onToggleFavorite={() => handleFav(trek)}
                                                    onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className={`mx-4 py-6 text-center rounded-2xl text-sm
                                        ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                                        No treks in this category yet
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* ── Beginner Friendly — same w-40 h-52, Name + Date + share ── */}
                    <section className="mb-6">
                        <h2 className={`text-xl font-semibold px-4 mb-3 font-inter leading-7
                            ${isDark ? 'text-white' : 'text-black'}`}>
                            Beginner Friendly
                        </h2>
                        {loading ? (
                            <div className="flex gap-3 px-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} w={160} h={208} isDark={isDark} />)}
                            </div>
                        ) : beginnerTreks.length === 0 ? (
                            <EmptyState label="No beginner treks added yet" />
                        ) : (
                            <div
                                className="overflow-x-auto scrollbar-hide pl-4 pr-4"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                            >
                                <div className="flex gap-4 pb-2 snap-x snap-mandatory">
                                    {beginnerTreks.map((trek) => (
                                        <div key={trek.id} className="snap-start">
                                            <BeginnerCard
                                                trek={trek}
                                                isDark={isDark}
                                                isFavorite={isFavorite(trek.id)}
                                                onToggleFavorite={() => handleFav(trek)}
                                                onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                </div>
            </main>

            <div className="pb-20 md:pb-0">
                <Footer />
            </div>
        </div>
    );
}

export default TreksPage;

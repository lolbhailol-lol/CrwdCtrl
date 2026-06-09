import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Phone, Instagram } from 'lucide-react';
import ShareIcon from '../../assets/share.svg';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { CompactPortraitCardsRowSkeleton } from '../HomeEventCardSkeleton';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const CAT_META = {
    hiking:      { label: 'Hiking',      emoji: '🥾', bg: '#FFF7ED', darkBg: '#2D1B0E' },
    trail:       { label: 'Trail Walks', emoji: '🌲', bg: '#F0FDF4', darkBg: '#0A2318' },
    backpacking: { label: 'Backpacking', emoji: '🎒', bg: '#EEF2FF', darkBg: '#1A1B3A' },
    camping:     { label: 'Camping',     emoji: '⛺', bg: '#0F172A', darkBg: '#0F172A' },
    adventure:   { label: 'Adventure',   emoji: '🏔️', bg: '#F0F9FF', darkBg: '#0B1D2E' },
};

const CATEGORY_LABEL_TO_VALUE = {
    Camping: 'camping',
    'Trail Walks': 'trail',
    Hiking: 'hiking',
    Adventure: 'adventure',
    Backpacking: 'backpacking',
};

const CATEGORY_VALUES = new Set(['hiking', 'trail', 'backpacking', 'camping', 'adventure']);

const normalizeCategory = (label) => {
    if (!label) return null;
    if (CATEGORY_LABEL_TO_VALUE[label]) return CATEGORY_LABEL_TO_VALUE[label];
    const lower = String(label).toLowerCase();
    return CATEGORY_VALUES.has(lower) ? lower : null;
};

const normalizeCommunity = (raw) => {
    if (!raw) return null;
    return {
        id: raw.id || raw._id,
        title: raw.title || raw.name || 'Community Name',
        subtitle: raw.subtitle || raw.basedIn || '',
        image: raw.image || raw.coverImage || raw.galleryImages?.[0] || null,
        aboutUs: raw.aboutUs || '',
        trekCategories: raw.trekCategories || [],
        galleryImages: raw.galleryImages || [],
        contactPhone: raw.contactPhone || '',
        contactInstagram: raw.contactInstagram || '',
    };
};

/* ── Trek Card (same as BeginnerCard) ── */
function TrekCard({ trek, isDark, isFav, onFav, onClick }) {
    return (
        <div
            className="card-portrait flex flex-col cursor-pointer active:scale-95 transition-transform"
            onClick={onClick}
        >
            <div className="card-portrait-image">
                {trek.image ? (
                    <img
                        src={getImageUrl(trek.image, { preset: 'cardLg' })}
                        alt={trek.title}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#1a3a2a', trek.title)}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-4xl">🏔️</span>
                    </div>
                )}
                <button
                    onClick={onFav}
                    className={`absolute top-2.5 right-2.5 size-6 rounded-full flex items-center justify-center
                        border-[0.5px] border-slate-100 ${isFav ? 'bg-red-500/80' : 'bg-black/10'}`}
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill={isFav ? 'white' : 'none'} stroke="white" strokeWidth="2">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                </button>
            </div>
            <div className="flex items-start justify-between mt-2">
                <div className="flex-1 min-w-0 pr-1">
                    <p className={`text-[15px] font-medium leading-6 tracking-wide line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.title}
                    </p>
                    <p className={`text-sm font-medium leading-5 tracking-tight ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trek.date || 'Date TBA'}
                    </p>
                </div>
                <button className={`size-8 shrink-0 rounded-2xl flex items-center justify-center mt-0.5 ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
                    <img src={ShareIcon} alt="Share" className={`w-4 h-4 ${isDark ? 'filter brightness-0 invert' : 'opacity-60'}`} />
                </button>
            </div>
        </div>
    );
}

export default function CommunityDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [community, setCommunity] = useState(() => normalizeCommunity(location.state?.community || null));
    const [treks, setTreks] = useState([]);
    const [loadingTreks, setLoadingTreks] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [imgPg, _setImgPg] = useState(0);
    const [liked, setLiked] = useState(false);

    const communityId = community?.id || id || null;

    const categoryOptions = useMemo(() => {
        return (community?.trekCategories || [])
            .map(label => ({ label, value: normalizeCategory(label) }))
            .filter(option => option.value);
    }, [community]);

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        fetch(`${API_BASE_URL}/trek-communities/${id}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => { if (data.community) setCommunity(normalizeCommunity(data.community)); })
            .catch(() => {});
        return () => controller.abort();
    }, [id]);

    useEffect(() => {
        if (!communityId) return;
        const controller = new AbortController();
        setLoadingTreks(true);
        fetch(`${API_BASE_URL}/treks?communityId=${communityId}`, { signal: controller.signal })
            .then(res => res.json())
            .then(data => {
                const list = Array.isArray(data?.treks) ? data.treks : [];
                setTreks(list.map(t => ({
                    id: t._id,
                    title: t.trekName,
                    date: t.trekDate
                        ? new Date(t.trekDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : null,
                    image: t.coverImage || t.images?.[0] || null,
                    trekCategory: t.trekCategory || null,
                })));
            })
            .catch(() => setTreks([]))
            .finally(() => setLoadingTreks(false));
        return () => controller.abort();
    }, [communityId]);

    useEffect(() => {
        if (!categoryOptions.length) {
            setActiveCategory(null);
            return;
        }
        if (!activeCategory || !categoryOptions.some(option => option.value === activeCategory)) {
            setActiveCategory(categoryOptions[0].value);
        }
    }, [categoryOptions, activeCategory]);

    const name    = community?.title    || 'Community Name';
    const basedIn = community?.subtitle || 'Based In';
    const image   = community?.image    || null;

    const description = community?.aboutUs?.trim()
        || 'Trek Community is a platform designed for travel enthusiasts to connect, share experiences, and inspire each other.';
    const shortDesc = description.slice(0, 130);

    const filteredTreks = activeCategory
        ? treks.filter(trek => trek.trekCategory === activeCategory)
        : treks;

    const handleShare = () => {
        if (navigator.share) navigator.share({ title: name, url: window.location.href }).catch(() => {});
    };

    return (
        <div className={`flex flex-col min-h-screen ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>

            {/* ── Cover image (full width, 396px tall) ── */}
            <div className="relative w-full h-[396px] shrink-0">
                {image ? (
                    <img
                        src={getImageUrl(image, { preset: 'hero' })}
                        alt={name}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 393, 396, '#1a3a2a', name)}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-900 via-emerald-800 to-teal-700" />
                )}
                <div className="absolute inset-0 bg-black/20" />

                {/* Top action bar */}
                <div className="absolute top-14 left-0 right-0 flex items-center justify-between px-4">
                    {/* Back */}
                    <button
                        onClick={() => navigate(-1)}
                        className="size-8 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                    >
                        <ArrowLeft size={16} className="text-white" />
                    </button>
                    {/* Right: Share + Heart */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleShare}
                            className="size-8 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Share2 size={15} className="text-white" />
                        </button>
                        <button
                            onClick={() => setLiked(l => !l)}
                            className="size-8 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Heart size={15} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} />
                        </button>
                    </div>
                </div>

                {/* Dots at bottom of image */}
                <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2">
                    {[0, 1, 2, 3].map(i => (
                        <div key={i} className={`rounded-2xl transition-all duration-300
                            ${i === imgPg
                                ? 'h-2.5 w-6 bg-white'
                                : 'size-2.5 bg-transparent border-2 border-white/60'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* ── Content card — slides up over the image ── */}
            <div className={`relative -mt-10 flex-1 rounded-t-3xl px-4 pt-5 pb-24
                ${isDark ? 'bg-[#161718]' : 'bg-slate-100'}`}>

                {/* Community name + share */}
                <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 pr-3">
                        <h1 className={`text-2xl font-medium font-inter leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {name}
                        </h1>
                        <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {basedIn}
                        </p>
                    </div>
                    <button
                        onClick={handleShare}
                        className={`size-8 shrink-0 rounded-full flex items-center justify-center mt-1
                            ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}`}
                    >
                        <Share2 size={14} className={isDark ? 'text-white' : 'text-gray-600'} />
                    </button>
                </div>

                {/* ── About Us ── */}
                <div className="mt-5 mb-5">
                    <h2 className={`text-lg font-semibold font-inter leading-7 tracking-wide mb-2
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        About Us
                    </h2>
                    <p className={`text-sm font-medium leading-5 tracking-tight ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {expanded ? description : shortDesc}
                        {!expanded && (
                            <button
                                onClick={() => setExpanded(true)}
                                className="text-[#0ECCEE] font-medium ml-1"
                            >
                                read more
                            </button>
                        )}
                    </p>
                </div>

                {/* ── Trek Category ── */}
                <div className="mb-5">
                    <h2 className={`text-lg font-semibold font-inter leading-7 tracking-wide mb-3
                        ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Trek Category
                    </h2>
                    {/* Category chips */}
                    {categoryOptions.length > 0 ? (
                        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                            <div className="flex gap-2 pb-2">
                                {categoryOptions.map(option => {
                                    const meta = CAT_META[option.value] || { label: option.label };
                                    const isActive = activeCategory === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => setActiveCategory(option.value)}
                                            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95
                                                ${isActive
                                                    ? 'bg-[#0ECCEE] text-black'
                                                    : isDark ? 'bg-[#1D1E20] text-gray-300' : 'bg-white text-gray-700 shadow-sm'
                                                }`}
                                        >
                                            {meta.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No trek categories set yet.</p>
                    )}

                    {/* Trek cards for selected category */}
                    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mt-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                        {loadingTreks ? (
                            <CompactPortraitCardsRowSkeleton count={3} className="px-0" />
                        ) : filteredTreks.length === 0 ? (
                            <div className={`mx-4 rounded-2xl px-4 py-6 text-sm text-center ${isDark ? 'bg-[#111213] text-gray-400' : 'bg-white text-gray-600'}`}>
                                No treks in this category yet.
                            </div>
                        ) : (
                            <div className="flex gap-4 pb-2">
                                {filteredTreks.map(trek => (
                                    <TrekCard
                                        key={trek.id}
                                        trek={trek}
                                        isDark={isDark}
                                        isFav={isFavorite(trek.id)}
                                        onFav={() => toggleFavorite(trek.id, trek)}
                                        onClick={() => navigate(`/trek/${trek.id}`, { state: { trek: { ...trek, trekName: trek.title, images: trek.image ? [trek.image] : [] } } })}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Contact Details ── */}
                <div className="mb-5">
                    <h2 className={`text-lg font-semibold font-inter leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Contact Details
                    </h2>
                    <div className="space-y-2.5">
                        {/* Phone */}
                        <a href={community?.contactPhone ? `tel:${community.contactPhone}` : undefined}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Phone</p>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {community?.contactPhone || 'Not set'}
                                </p>
                            </div>
                        </a>
                        {/* Instagram */}
                        <a href={community?.contactInstagram ? `https://instagram.com/${community.contactInstagram.replace('@','')}` : undefined}
                            target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #7C3AED 100%)' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Instagram</p>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {community?.contactInstagram || 'Not set'}
                                </p>
                            </div>
                        </a>
                    </div>
                </div>

            </div>
        </div>
    );
}

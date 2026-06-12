import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Phone, X, ChevronLeft, ChevronRight } from 'lucide-react';
import CardFavoriteButton from '../CardFavoriteButton';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { normalizeImageList, normalizeImageUrl } from '../../utils/uploadUrls';
import { CompactPortraitCardsRowSkeleton } from '../HomeEventCardSkeleton';
import {
    AnimatedCard,
    AnimatedCounter,
    ImmersiveHero,
    ScrollReveal,
    StickyCta,
} from '../../motion';

const GALLERY_PREVIEW_COUNT = 4;

const resolveGallerySrc = (url, preset = 'thumb') =>
    getImageUrl(url, { preset }) || normalizeImageUrl(url) || url;

const buildGalleryImages = (community) => {
    if (!community) return [];
    const seen = new Set();
    const out = [];
    const add = (url) => {
        const normalized = normalizeImageUrl(url);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            out.push(normalized);
        }
    };
    add(community.coverImage);
    add(community.image);
    normalizeImageList(community.galleryImages).forEach(add);
    return out;
};

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
    const coverImage = normalizeImageUrl(raw.coverImage);
    const galleryImages = normalizeImageList(raw.galleryImages);
    return {
        id: raw.id || raw._id,
        title: raw.title || raw.name || 'Community Name',
        subtitle: raw.subtitle || raw.basedIn || '',
        coverImage,
        image: normalizeImageUrl(raw.image) || coverImage || galleryImages[0] || null,
        aboutUs: raw.aboutUs || '',
        trekCategories: raw.trekCategories || [],
        galleryImages,
        contactPhone: raw.contactPhone || '',
        contactInstagram: raw.contactInstagram || '',
    };
};

function GalleryLightbox({ images, index, name, onClose, onIndexChange }) {
    const current = images[index];
    const hasPrev = index > 0;
    const hasNext = index < images.length - 1;

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label="Gallery viewer"
        >
            <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-3">
                <p className="text-white text-sm font-medium">
                    {index + 1} / {images.length}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close gallery"
                    className="size-10 rounded-full bg-white/10 flex items-center justify-center"
                >
                    <X size={20} className="text-white" />
                </button>
            </div>

            <div className="relative flex-1 flex items-center justify-center px-4 pb-4 min-h-0">
                {hasPrev && (
                    <button
                        type="button"
                        onClick={() => onIndexChange(index - 1)}
                        aria-label="Previous image"
                        className="absolute left-2 z-10 size-10 rounded-full bg-white/10 flex items-center justify-center"
                    >
                        <ChevronLeft size={22} className="text-white" />
                    </button>
                )}
                {current && (
                    <img
                        src={resolveGallerySrc(current, 'detail')}
                        alt={`${name} gallery ${index + 1}`}
                        className="max-h-full max-w-full object-contain rounded-xl"
                        onError={(e) => handleImageErrorWithFallback(e, 360, 360, '#1a3a2a', name)}
                    />
                )}
                {hasNext && (
                    <button
                        type="button"
                        onClick={() => onIndexChange(index + 1)}
                        aria-label="Next image"
                        className="absolute right-2 z-10 size-10 rounded-full bg-white/10 flex items-center justify-center"
                    >
                        <ChevronRight size={22} className="text-white" />
                    </button>
                )}
            </div>
        </div>
    );
}

/* ── Trek Card — matches treks-page BeginnerCard (white surface + shadow) ── */
function TrekCard({ trek, isDark, isFav, onFav, onClick }) {
    return (
        <AnimatedCard
            className="card-surface card-portrait flex flex-col rounded-2xl overflow-hidden cursor-pointer"
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
                <CardFavoriteButton isFavorite={isFav} onClick={onFav} />
            </div>
            <div className="flex items-start justify-between px-3 pb-3 pt-2 w-full min-w-0">
                <div className="flex-1 min-w-0">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.title}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {trek.date || 'Date TBA'}
                    </p>
                </div>
            </div>
        </AnimatedCard>
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
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);

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

    const galleryImages = useMemo(() => buildGalleryImages(community), [community]);

    const openGallery = (index = 0) => {
        setGalleryIndex(index);
        setGalleryOpen(true);
    };

    const handleShare = () => {
        if (navigator.share) navigator.share({ title: name, url: window.location.href }).catch(() => {});
    };

    return (
        <div className={`flex flex-col min-h-screen pb-24 ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>

            <ImmersiveHero
                imageSrc={image ? getImageUrl(image, { preset: 'hero' }) : null}
                imageAlt={name}
                height="396px"
                onImageError={(e) => handleImageErrorWithFallback(e, 393, 396, '#1a3a2a', name)}
                fallback={
                    <div className="absolute inset-0 bg-linear-to-br from-green-900 via-emerald-800 to-teal-700" />
                }
            >
                {/* Floating stats */}
                <div className="absolute bottom-20 left-4 right-4 flex gap-2 pointer-events-none">
                    {[
                        { label: 'Treks', value: treks.length },
                        { label: 'Categories', value: categoryOptions.length },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-2xl bg-black/45 backdrop-blur-md px-3 py-2 border border-white/10"
                        >
                            <p className="text-white text-lg font-bold leading-none">
                                <AnimatedCounter value={stat.value} />
                            </p>
                            <p className="text-white/70 text-[10px] font-medium mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>

                {/* Top action bar */}
                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4"
                    style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 2.5rem)' }}
                >
                    {/* Back */}
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                    >
                        <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                    </button>
                    {/* Right: Share + Heart */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label="Share"
                            className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLiked(l => !l)}
                            aria-label="Favourite"
                            className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Heart
                                size={20}
                                strokeWidth={2.25}
                                className={liked ? 'fill-red-500 text-red-500' : 'text-white'}
                            />
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
            </ImmersiveHero>

            {/* ── Content card — slides up over the image ── */}
            <div className={`relative -mt-10 flex-1 rounded-t-3xl px-4 pt-8 pb-8
                ${isDark ? 'bg-[#161718]' : 'bg-slate-100'}`}>

                {/* Community name + call */}
                <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 pr-3">
                        <h1 className={`text-3xl font-medium font-inter leading-9 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {name}
                        </h1>
                        <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {basedIn}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (community?.contactPhone) {
                                window.location.href = `tel:${community.contactPhone}`;
                            }
                        }}
                        disabled={!community?.contactPhone}
                        aria-label="Call community"
                        className={`size-8 shrink-0 rounded-full flex items-center justify-center mt-1 transition-opacity
                            ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}
                            ${!community?.contactPhone ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                    >
                        <Phone size={18} strokeWidth={2.25} className="text-[#0ECCEE]" />
                    </button>
                </div>

                {/* ── About Us ── */}
                <ScrollReveal className="mt-5 mb-5">
                    <h2 className={`text-lg font-medium font-inter leading-7 tracking-wide mb-2
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
                </ScrollReveal>

                {/* ── Trek Category ── */}
                <ScrollReveal className="mb-5" delay={0.05}>
                    <h2 className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3
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
                                            type="button"
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
                            <div className={`card-surface mx-4 rounded-2xl px-4 py-6 text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
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
                </ScrollReveal>

                {/* ── Contact Details ── */}
                <ScrollReveal className="mb-5" delay={0.08}>
                    <h2 className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
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
                </ScrollReveal>

                {/* ── Gallery ── */}
                <ScrollReveal className="mb-2" delay={0.1}>
                    <h2 className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Gallery
                    </h2>
                    {galleryImages.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2.5">
                            {galleryImages.slice(0, GALLERY_PREVIEW_COUNT).map((img, i) => {
                                const isOverflowTile = galleryImages.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                                const remainingCount = galleryImages.length - GALLERY_PREVIEW_COUNT;
                                return (
                                    <button
                                        key={`${img}-${i}`}
                                        type="button"
                                        onClick={() => openGallery(i)}
                                        aria-label={isOverflowTile ? `View all ${galleryImages.length} gallery images` : `View gallery image ${i + 1}`}
                                        className={`relative w-full aspect-square rounded-2xl overflow-hidden active:scale-[0.98] transition-transform ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}
                                    >
                                        <img
                                            src={resolveGallerySrc(img, 'cardSm')}
                                            alt={`${name} gallery ${i + 1}`}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => handleImageErrorWithFallback(e, 120, 120, '#1a3a2a', name)}
                                        />
                                        {isOverflowTile && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                                                <span className="text-white text-base font-semibold tracking-wide">
                                                    {remainingCount}+
                                                </span>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            No gallery images yet.
                        </p>
                    )}
                </ScrollReveal>

            </div>

            <StickyCta>
                <div className={`px-4 py-3 border-t ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100'}`}>
                    <button
                        type="button"
                        onClick={() => {
                            if (community?.contactPhone) {
                                window.location.href = `tel:${community.contactPhone}`;
                            } else if (filteredTreks[0]) {
                                navigate(`/trek/${filteredTreks[0].id}`, {
                                    state: {
                                        trek: {
                                            ...filteredTreks[0],
                                            trekName: filteredTreks[0].title,
                                            images: filteredTreks[0].image ? [filteredTreks[0].image] : [],
                                        },
                                    },
                                });
                            }
                        }}
                        className="w-full py-3 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm shadow-md shadow-[#0ECCEE]/20 active:scale-[0.98] transition-transform"
                    >
                        Join Community
                    </button>
                </div>
            </StickyCta>

            {galleryOpen && galleryImages.length > 0 && (
                <GalleryLightbox
                    images={galleryImages}
                    index={galleryIndex}
                    name={name}
                    onClose={() => setGalleryOpen(false)}
                    onIndexChange={setGalleryIndex}
                />
            )}
        </div>
    );
}

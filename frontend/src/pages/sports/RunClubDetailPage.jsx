import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, Phone, X, ChevronLeft, ChevronRight } from 'lucide-react';
import CardFavoriteButton from '../../components/CardFavoriteButton';
import { useDarkMode } from '../../context/DarkModeContext';
import { useFavorites } from '../../context/FavoritesContext';
import { getImageUrl } from '../../utils/imageImports';
import { getCoverImageUrl, resolveCoverImage } from '../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { normalizeImageList, normalizeImageUrl } from '../../utils/uploadUrls';
import { shareContent, openExternalUrl } from '../../utils/externalLink';
import { CompactPortraitCardsRowSkeleton } from '../../components/HomeEventCardSkeleton';
import { normalizeRunCategory } from '../../constants/runClubCategories';
import {
    AnimatedCard,
    AnimatedCounter,
    ScrollProgress,
    ScrollReveal,
} from '../../motion';
import Seo from '../../components/Seo';
import { breadcrumbSchema, itemListSchema } from '../../utils/seo';

const GALLERY_PREVIEW_COUNT = 4;
import {
    fetchRunClub,
    fetchSportsByRunClub,
} from '../../services/api/public.api';
import { runClubPath, sportRunPath } from '../../utils/slugRoutes';

const resolveGallerySrc = (url, preset = 'thumb') =>
    getImageUrl(url, { preset }) || normalizeImageUrl(url) || url;

const buildHeroImages = (club) => {
    if (!club) return [];
    const seen = new Set();
    const out = [];
    const add = (url) => {
        const normalized = normalizeImageUrl(url);
        if (normalized && !seen.has(normalized)) {
            seen.add(normalized);
            out.push(normalized);
        }
    };
    const hero = resolveCoverImage(club, 'hero');
    if (hero) add(hero);
    add(club.coverImage);
    const covers = club.coverImages;
    if (covers && typeof covers === 'object') {
        Object.values(covers).forEach(add);
    }
    normalizeImageList(club.galleryImages).forEach(add);
    return out.length ? out : [null];
};

const buildGalleryImages = (club) => normalizeImageList(club?.galleryImages);

function buildReadableParagraphs(text = '') {
    const cleaned = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return [];

    // Keep manual paragraph breaks when present.
    const manual = String(text)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (manual.length > 1) return manual;

    // Auto-group long single blocks into short readable paragraphs.
    const sentences = cleaned.match(/[^.!?]+[.!?]?/g)?.map((s) => s.trim()).filter(Boolean) || [cleaned];
    const chunks = [];
    for (let i = 0; i < sentences.length; i += 2) {
        chunks.push(sentences.slice(i, i + 2).join(' ').trim());
    }
    return chunks;
}

const normalizeRunClub = (raw) => {
    if (!raw) return null;
    const coverImage = normalizeImageUrl(raw.coverImage);
    const galleryImages = normalizeImageList(raw.galleryImages);
    return {
        id: raw.id || raw._id,
        title: raw.title || raw.name || 'Run Club Name',
        subtitle: raw.subtitle || raw.basedIn || 'Based In',
        coverImage,
        coverImages: raw.coverImages || null,
        image: normalizeImageUrl(raw.image) || coverImage || galleryImages[0] || null,
        aboutUs: raw.aboutUs || '',
        runCategories: raw.runCategories || [],
        galleryImages,
        contactPhone: raw.contactPhone || '',
        contactInstagram: raw.contactInstagram || '',
        registrationLink: raw.registrationLink || '',
        registration: raw.registration && typeof raw.registration === 'object' ? raw.registration : {},
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
                        onError={(e) => handleImageErrorWithFallback(e, 360, 360, '#14532d', name)}
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

function RunCard({ run, isDark, isFav, onFav, onClick }) {
    return (
        <AnimatedCard
            enableHover={false}
            className="card-surface card-portrait flex flex-col rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
            onClick={onClick}
        >
            <div className="card-portrait-image">
                {getCoverImageUrl(run, 'cardPortrait') ? (
                    <img
                        src={getCoverImageUrl(run, 'cardPortrait')}
                        alt={run.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={(e) => handleImageErrorWithFallback(e, 160, 208, '#14532d', run.title)}
                    />
                ) : (
                    <div className="w-full h-full bg-linear-to-br from-green-800 to-emerald-600 flex items-center justify-center">
                        <span className="text-4xl">🏃</span>
                    </div>
                )}
                <CardFavoriteButton isFavorite={isFav} onClick={onFav} />
            </div>
            <div className="flex items-start justify-between px-3 pb-3 pt-2 w-full min-w-0">
                <div className="flex-1 min-w-0">
                    <p className={`card-event-title line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {run.title}
                    </p>
                    <p className={`card-event-subtitle line-clamp-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        {run.date || 'Date TBA'}
                    </p>
                </div>
            </div>
        </AnimatedCard>
    );
}

export default function RunClubDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [club, setClub] = useState(() => normalizeRunClub(location.state?.club || null));
    const [runs, setRuns] = useState([]);
    const [loadingRuns, setLoadingRuns] = useState(true);
    const [runsError, setRunsError] = useState('');
    const [activeCategory, setActiveCategory] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [imgPg, setImgPg] = useState(0);
    const [liked, setLiked] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [heroLoaded, setHeroLoaded] = useState(false);
    const imgRef = useRef(null);

    const clubId = club?.id || id || null;

    const categoryOptions = useMemo(() => {
        const fromClub = (club?.runCategories || [])
            .map((label) => ({ label, value: normalizeRunCategory(label) }))
            .filter((option) => option.value);
        if (!fromClub.length) return [];
        return [{ label: 'All', value: 'all' }, ...fromClub];
    }, [club]);

    const heroImages = useMemo(() => buildHeroImages(club), [club]);
    const galleryImages = useMemo(() => buildGalleryImages(club), [club]);
    const firstHeroSrc = heroImages[0] || '';

    useEffect(() => {
        setHeroLoaded(!firstHeroSrc);
    }, [firstHeroSrc]);

    useEffect(() => {
        if (!id) return;
        const controller = new AbortController();
        fetchRunClub(id, controller.signal)
            .then((data) => {
                if (data.club) setClub(normalizeRunClub(data.club));
            })
            .catch(() => {});
        return () => controller.abort();
    }, [id]);

    useEffect(() => {
        if (!club || !id) return;
        const canonical = runClubPath(club);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [club, id, navigate, location.state]);

    useEffect(() => {
        if (!clubId) return;
        const controller = new AbortController();
        setLoadingRuns(true);
        setRunsError('');
        fetchSportsByRunClub(clubId, controller.signal)
            .then((data) => {
                const list = Array.isArray(data?.events) ? data.events : [];
                setRuns(
                    list.map((e) => ({
                        id: e._id,
                        title: e.title,
                        date: e.eventDate
                            ? new Date(e.eventDate).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                              })
                            : null,
                        image: e.coverImage || e.images?.[0] || null,
                        runCategory: normalizeRunCategory(e.runCategory),
                        registrationLink: e.registrationLink || '',
                    })),
                );
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                setRuns([]);
                setRunsError(err?.message || 'Could not load runs');
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingRuns(false);
            });
        return () => controller.abort();
    }, [clubId]);

    useEffect(() => {
        if (!categoryOptions.length) {
            setActiveCategory(null);
            return;
        }
        if (!activeCategory || !categoryOptions.some((option) => option.value === activeCategory)) {
            setActiveCategory('all');
        }
    }, [categoryOptions, activeCategory]);

    const name = club?.title || 'Run Club Name';
    const basedIn = club?.subtitle || 'Based In';

    const description =
        club?.aboutUs?.trim() ||
        'Run Club is a platform designed for fitness enthusiasts to connect, share experiences, and inspire each other.';
    const paragraphs = useMemo(() => buildReadableParagraphs(description), [description]);
    const previewParagraphs = paragraphs.slice(0, 2);
    const hasMoreText = paragraphs.length > 2;

    const filteredRuns = !activeCategory || activeCategory === 'all'
        ? runs
        : runs.filter((run) => run.runCategory === activeCategory);

    const openGallery = (index = 0) => {
        setGalleryIndex(index);
        setGalleryOpen(true);
    };

    const handleShare = () => {
        shareContent({ title: name, url: window.location.href });
    };

    const handleRunClick = (run) => {
        navigate(sportRunPath(run), {
            state: {
                event: {
                    _id: run.id,
                    title: run.title,
                    images: run.image ? [run.image] : [],
                    runClub: club
                        ? { _id: club.id, name: club.title, basedIn: club.subtitle, contactPhone: club.contactPhone, contactInstagram: club.contactInstagram }
                        : null,
                },
                runClub: club,
            },
        });
    };

    const canonicalPath = runClubPath(club || { id });

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen pb-24" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <Seo
                title={`${name} — Running Club`}
                description={description}
                canonical={canonicalPath}
                image={club?.coverImage || club?.image}
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Sports', path: '/sports' },
                        { name, path: canonicalPath },
                    ]),
                    itemListSchema({
                        name: `Runs by ${name}`,
                        description,
                        url: canonicalPath,
                        items: runs
                            .filter((r) => r?.id && r?.title)
                            .map((r) => ({ name: r.title, url: sportRunPath(r) })),
                    }),
                ]}
            />
            <ScrollProgress />
            <div className="mx-auto w-full md:max-w-2xl flex flex-col flex-1">
            {/* ── Cover image carousel (full width, 396px tall — matches trek community page) ── */}
            <div className="relative w-full h-[396px] shrink-0 overflow-hidden">
                <div
                    ref={imgRef}
                    className="overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full h-full"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    onScroll={(e) => {
                        const p = Math.round(e.target.scrollLeft / e.target.clientWidth);
                        setImgPg((prev) => (prev === p ? prev : p));
                    }}
                >
                    <div className="flex h-full">
                        {heroImages.map((img, i) => (
                            <div key={i} className="shrink-0 w-full h-full snap-start relative">
                                {img ? (
                                    <>
                                        {i === 0 && !heroLoaded && (
                                            <div aria-hidden className="absolute inset-0 bg-gray-800 animate-pulse" />
                                        )}
                                        <img
                                            src={getImageUrl(img, { preset: 'hero' })}
                                            alt={name}
                                            className={`w-full h-full object-cover transition-opacity duration-200 ${
                                                i === 0 && !heroLoaded ? 'opacity-0' : 'opacity-100'
                                            }`}
                                            loading={i === 0 ? 'eager' : 'lazy'}
                                            fetchPriority={i === 0 ? 'high' : 'auto'}
                                            decoding="async"
                                            onLoad={() => {
                                                if (i === 0) setHeroLoaded(true);
                                            }}
                                            onError={(e) => {
                                                if (i === 0) setHeroLoaded(true);
                                                handleImageErrorWithFallback(e, 393, 396, '#14532d', name);
                                            }}
                                        />
                                    </>
                                ) : (
                                    <div className="w-full h-full bg-linear-to-br from-green-900 via-emerald-800 to-teal-700" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

                {/* Floating stats — Nike Run Club feel */}
                <div className="absolute bottom-20 left-4 right-4 flex gap-2 pointer-events-none z-10">
                    {[
                        { label: 'Upcoming Runs', value: runs.length },
                        { label: 'Categories', value: Math.max(0, categoryOptions.filter((o) => o.value !== 'all').length) },
                    ].map((stat) => (
                        <div
                            key={stat.label}
                            className="rounded-2xl bg-black/50 px-3 py-2 border border-white/10"
                        >
                            <p className="text-white text-lg font-bold leading-none">
                                <AnimatedCounter value={stat.value} />
                            </p>
                            <p className="text-white/70 text-[10px] font-medium mt-0.5">{stat.label}</p>
                        </div>
                    ))}
                </div>

                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4"
                    style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 2.5rem)' }}
                >
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                    >
                        <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label="Share"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                        >
                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                        >
                            <Heart
                                size={20}
                                strokeWidth={2.25}
                                className={liked ? 'fill-red-500 text-red-500' : 'text-white'}
                            />
                        </button>
                    </div>
                </div>

                {heroImages.length > 1 && (
                    <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2">
                        {heroImages.slice(0, 4).map((_, i) => (
                            <div
                                key={i}
                                className={`rounded-2xl transition-all duration-300
                                    ${
                                        i === imgPg
                                            ? 'h-2.5 w-6 bg-white'
                                            : 'size-2.5 bg-transparent border-2 border-white/60'
                                    }`}
                            />
                        ))}
                    </div>
                )}
            </div>

            <div
                className={`relative -mt-10 flex-1 rounded-t-3xl px-4 pt-8 pb-8
                ${isDark ? 'bg-[#161718]' : 'bg-slate-100'}`}
            >
                <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0 pr-3">
                        <h1
                            className={`text-3xl font-medium font-inter leading-9 ${isDark ? 'text-white' : 'text-gray-900'}`}
                        >
                            {name}
                        </h1>
                        <p className={`text-xs font-semibold mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {basedIn}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => {
                            if (club?.contactPhone) {
                                window.location.href = `tel:${club.contactPhone}`;
                            }
                        }}
                        disabled={!club?.contactPhone}
                        aria-label="Call run club"
                        className={`size-8 shrink-0 rounded-full flex items-center justify-center mt-1 transition-opacity
                            ${isDark ? 'bg-gray-800' : 'bg-white shadow-sm'}
                            ${!club?.contactPhone ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                    >
                        <Phone size={18} strokeWidth={2.25} className="text-[#0ECCEE]" />
                    </button>
                </div>

                <ScrollReveal className="mt-5 mb-5">
                    <h2
                        className={`text-lg font-medium font-inter leading-7 tracking-wide mb-2
                        ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                        About Us
                    </h2>
                    <div className="space-y-3">
                        {(expanded ? paragraphs : previewParagraphs).map((para, idx) => (
                            <p
                                key={`${idx}-${para.slice(0, 24)}`}
                                className={`text-[14px] sm:text-[15px] font-medium leading-7 tracking-normal text-left ${
                                    isDark ? 'text-gray-200' : 'text-gray-700'
                                }`}
                            >
                                {para}
                            </p>
                        ))}
                    </div>
                    {hasMoreText && (
                        <button
                            onClick={() => setExpanded((prev) => !prev)}
                            className="mt-3 text-[#0ECCEE] text-sm font-semibold hover:opacity-90"
                        >
                            {expanded ? 'Read less' : 'Read more'}
                        </button>
                    )}
                </ScrollReveal>

                <ScrollReveal className="mb-5" delay={0.05}>
                    <h2
                        className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3
                        ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                        Upcoming Runs
                    </h2>
                    {categoryOptions.length > 0 ? (
                        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ scrollbarWidth: 'none' }}>
                            <div className="flex gap-2 pb-2">
                                {categoryOptions.map((option) => {
                                    const isActive = activeCategory === option.value;
                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            onClick={() => setActiveCategory(option.value)}
                                            className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95
                                                ${
                                                    isActive
                                                        ? 'bg-[#0ECCEE] text-black'
                                                        : isDark
                                                          ? 'bg-[#1D1E20] text-gray-300'
                                                          : 'bg-white text-gray-700 shadow-sm'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            No run categories set yet.
                        </p>
                    )}

                    <div
                        className="overflow-x-auto scrollbar-hide -mx-4 px-4 mt-4"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                    >
                        {loadingRuns ? (
                            <CompactPortraitCardsRowSkeleton count={3} className="px-0" />
                        ) : filteredRuns.length === 0 ? (
                            <div
                                className={`card-surface mx-4 rounded-2xl px-4 py-6 text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}
                            >
                                {runsError
                                    ? `${runsError}. Pull to refresh or try again.`
                                    : 'No upcoming runs in this category yet.'}
                            </div>
                        ) : (
                            <div className="flex gap-4 pb-2">
                                {filteredRuns.map((run) => (
                                    <RunCard
                                        key={run.id}
                                        run={run}
                                        isDark={isDark}
                                        isFav={isFavorite(run.id)}
                                        onFav={() => toggleFavorite(run.id, run)}
                                        onClick={() => handleRunClick(run)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollReveal>

                <ScrollReveal className="mb-5" delay={0.08}>
                    <h2
                        className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                        Contact Details
                    </h2>
                    <div className="space-y-2.5">
                        <a
                            href={club?.contactPhone ? `tel:${club.contactPhone}` : undefined}
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                        >
                            <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Phone</p>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {club?.contactPhone || 'Not set'}
                                </p>
                            </div>
                        </a>
                        <a
                            href={
                                club?.contactInstagram
                                    ? `https://instagram.com/${club.contactInstagram.replace('@', '')}`
                                    : undefined
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                        >
                            <div
                                className="size-10 rounded-xl flex items-center justify-center shrink-0"
                                style={{
                                    background: 'linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #7C3AED 100%)',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                </svg>
                            </div>
                            <div>
                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Instagram</p>
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {club?.contactInstagram || 'Not set'}
                                </p>
                            </div>
                        </a>
                    </div>
                </ScrollReveal>

                <ScrollReveal className="mb-2" delay={0.1}>
                    <h2
                        className={`text-lg font-medium font-inter leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}
                    >
                        Gallery
                    </h2>
                    {galleryImages.length > 0 ? (
                        <div className="grid grid-cols-4 gap-2.5">
                            {galleryImages.slice(0, GALLERY_PREVIEW_COUNT).map((img, i) => {
                                const isOverflowTile =
                                    galleryImages.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                                const remainingCount = galleryImages.length - GALLERY_PREVIEW_COUNT;
                                return (
                                    <button
                                        key={`${img}-${i}`}
                                        type="button"
                                        onClick={() => openGallery(i)}
                                        aria-label={
                                            isOverflowTile
                                                ? `View all ${galleryImages.length} gallery images`
                                                : `View gallery image ${i + 1}`
                                        }
                                        className={`relative w-full aspect-square rounded-2xl overflow-hidden active:scale-[0.98] transition-transform ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}
                                    >
                                        <img
                                            src={resolveGallerySrc(img, 'square')}
                                            alt={`${name} gallery ${i + 1}`}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => handleImageErrorWithFallback(e, 120, 120, '#14532d', name)}
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
                        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No gallery images yet.</p>
                    )}
                </ScrollReveal>
            </div>
            </div>

            <div
                className="fixed bottom-0 left-0 right-0 z-50 px-2"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
            >
                <div className={`mx-auto w-full max-w-md md:max-w-2xl rounded-[30px] px-3 py-3 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
                    {(() => {
                        const closed = club?.registration?.status === 'closed';
                        const extLink = club?.registration?.mode === 'external_link'
                            ? club?.registrationLink
                            : null;
                        if (closed) {
                            return (
                                <button
                                    type="button"
                                    disabled
                                    className="w-full flex items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-gray-600 text-gray-300 cursor-not-allowed"
                                >
                                    Registration Closed
                                </button>
                            );
                        }
                        return (
                            <button
                                type="button"
                                onClick={() => {
                                    if (extLink) {
                                        openExternalUrl(extLink);
                                    } else if (filteredRuns[0]) {
                                        handleRunClick(filteredRuns[0]);
                                    } else if (club?.contactPhone) {
                                        window.location.href = `tel:${club.contactPhone}`;
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-[#0ECCEE] text-black active:opacity-90 transition"
                            >
                                {extLink ? 'Join Community' : 'Join Run Club'}
                            </button>
                        );
                    })()}
                </div>
            </div>

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

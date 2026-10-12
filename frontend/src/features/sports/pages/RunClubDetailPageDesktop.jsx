import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Share2,
    Heart,
    MapPin,
    Calendar,
    ChevronDown,
    Phone,
    Instagram,
    MessageCircle,
    Activity,
    CheckCircle2,
    Users,
    Image as ImageIcon,
    Sparkles,
    ExternalLink,
} from 'lucide-react';
import CardFavoriteButton from '../../../components/CardFavoriteButton';
import FollowCommunityBar from '../../../components/FollowCommunityBar';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { getImageUrl } from '../../../utils/imageImports';
import { getCoverImageUrl, resolveCoverImage } from '../../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { normalizeImageList, normalizeImageUrl } from '../../../utils/uploadUrls';
import { shareContent, openExternalUrl } from '../../../utils/externalLink';
import { useInAppBack } from '../../../hooks/useInAppBack';
import DetailPageLoader from '../../../components/DetailPageLoader';
import GalleryLightbox from '../../../components/GalleryLightbox';
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import { signalDetailPageReady } from '../../../utils/bootSplash';
import { normalizeRunCategory } from '../../../constants/runClubCategories';
import {
    AnimatedCard,
    AnimatedCounter,
    ScrollProgress,
    ScrollReveal,
} from '../../../motion';
import Seo from '../../../components/Seo';
import { breadcrumbSchema, itemListSchema, toOgShareImageUrl } from '../../../utils/seo';

import {
    fetchRunClub,
    fetchSportsByRunClub,
} from '../../../services/api/public.api';
import { runClubPath, sportRunPath, entityMatchesRouteParam } from '../../../utils/slugRoutes';
import {
    classifyDetailLoadError,
    isTransientDetailError,
    createDetailCache,
} from '../../../utils/detailPageLoad';

const runClubDetailCache = createDetailCache('crwdctrl_run_club_v1_');

const resolveGallerySrc = (url, preset = 'thumb') =>
    getImageUrl(url, { preset }) || normalizeImageUrl(url) || url;

const buildGalleryImages = (club) => normalizeImageList(club?.galleryImages);

function buildReadableParagraphs(text = '') {
    const cleaned = String(text || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return [];

    const manual = String(text)
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
    if (manual.length > 1) return manual;

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
        slug: raw.slug || '',
        listingHub: raw.listingHub === 'events' ? 'events' : 'sports',
        name: raw.name || raw.title || '',
        title: raw.title || raw.name || '',
        subtitle: raw.subtitle || raw.basedIn || '',
        coverImage,
        coverImages: raw.coverImages || null,
        image: normalizeImageUrl(raw.image) || coverImage || galleryImages[0] || null,
        aboutUs: raw.aboutUs || '',
        runCategories: raw.runCategories || [],
        galleryImages,
        contactPhone: raw.contactPhone || '',
        contactInstagram: raw.contactInstagram || '',
        groupLink: raw.groupLink || '',
        registrationLink: raw.registrationLink || '',
        registration: raw.registration && typeof raw.registration === 'object' ? raw.registration : {},
    };
};

/* ── Modern Run Card ── */
function RunCard({ run, isDark, isFav, onFav, onClick, eager = false }) {
    const imgSrc = getCoverImageUrl(run, 'cardPortraitFit') || run.image;

    return (
        <AnimatedCard
            enableHover={false}
            className={`group flex flex-col rounded-2xl overflow-hidden cursor-pointer border transition-all duration-300 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] ${
                isDark ? 'bg-[#151618] border-white/5 hover:border-white/20' : 'bg-white border-gray-200/80 hover:border-gray-300 shadow-sm'
            }`}
            onClick={onClick}
        >
            <div className="relative aspect-[4/3] sm:aspect-[16/11] w-full overflow-hidden bg-[#1A1B1D]">
                {imgSrc ? (
                    <img
                        src={getImageUrl(imgSrc, { preset: 'cardPortraitFit' }) || imgSrc}
                        alt={run.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        loading={eager ? 'eager' : 'lazy'}
                        decoding="async"
                        onError={(e) => handleImageErrorWithFallback(e, 360, 240, '#2A2B2E', run.title)}
                    />
                ) : (
                    <div className="w-full h-full bg-[#1A1B1D] flex items-center justify-center text-gray-600">
                        <Activity size={32} />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

                <div className="absolute top-2.5 right-2.5 z-10">
                    <CardFavoriteButton isFavorite={isFav} onClick={onFav} />
                </div>

                {run.runCategory && (
                    <div className="absolute top-2.5 left-2.5 z-10 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-semibold text-white">
                        {run.runCategory}
                    </div>
                )}
            </div>

            <div className="flex flex-col p-3.5 sm:p-4 gap-1.5 flex-1 justify-between">
                <div>
                    <h3 className={`font-bold text-sm sm:text-base leading-snug line-clamp-1 transition-colors group-hover:text-[#0ECCEE] ${
                        isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                        {run.title}
                    </h3>
                    <p className={`text-xs font-medium flex items-center gap-1.5 mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                        <Calendar size={13} className="shrink-0 text-[#0ECCEE]" />
                        <span className="line-clamp-1">{run.date || 'Date TBA'}</span>
                    </p>
                </div>
            </div>
        </AnimatedCard>
    );
}

export default function RunClubDetailPageDesktop() {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();
    const { toggleFavorite, isFavorite } = useFavorites();

    const [club, setClub] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [runs, setRuns] = useState([]);
    const [pastRuns, setPastRuns] = useState([]);
    const [loadingRuns, setLoadingRuns] = useState(true);
    const [activeCategory, setActiveCategory] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [showPast, setShowPast] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [showLogin, setShowLogin] = useState(false);
    const [liked, setLiked] = useState(false);

    const clubId = club?.id || id || null;

    const categoryOptions = useMemo(() => {
        const fromClub = (club?.runCategories || [])
            .map((label) => ({ label, value: normalizeRunCategory(label) }))
            .filter((option) => option.value);
        if (!fromClub.length) return [];
        return [{ label: 'All', value: 'all' }, ...fromClub];
    }, [club]);

    const galleryImages = useMemo(() => buildGalleryImages(club), [club]);

    useEffect(() => {
        if (!id) {
            setClub(null);
            setLoadError('');
            setLoading(false);
            return undefined;
        }

        const seeded = normalizeRunClub(location.state?.club || null);
        const ok = entityMatchesRouteParam(seeded, id, ['name', 'title']);
        const cached = runClubDetailCache.read(id);
        const cacheOk = entityMatchesRouteParam(cached, id, ['name', 'title']);
        const fallback = ok ? seeded : (cacheOk ? normalizeRunClub(cached) : null);
        setRuns([]);
        setPastRuns([]);
        setLoadingRuns(true);
        setLoadError('');

        if (fallback) {
            setClub(fallback);
            setLoading(false);
        } else {
            setClub(null);
            setLoading(true);
        }

        const controller = new AbortController();
        fetchRunClub(id, controller.signal)
            .then((data) => {
                if (controller.signal.aborted) return;
                if (data.club) {
                    const normalized = normalizeRunClub(data.club);
                    setClub(normalized);
                    runClubDetailCache.write(id, data.club);
                    if (data.club._id) runClubDetailCache.write(String(data.club._id), data.club);
                    if (data.club.slug) runClubDetailCache.write(String(data.club.slug), data.club);
                    setLoadError('');
                } else if (fallback) {
                    setClub(fallback);
                    setLoadError('');
                } else {
                    setClub(null);
                    setLoadError('not_found');
                }
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                if (fallback) {
                    setClub(fallback);
                    setLoadError('');
                } else {
                    setClub(null);
                    setLoadError(classifyDetailLoadError(err));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [id]);

    useEffect(() => {
        if (!club || !id) return;
        if (!entityMatchesRouteParam(club, id, ['name', 'title'])) return;
        const canonical = runClubPath(club);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [club, id, navigate, location.state]);

    const mapRunCard = (e) => ({
        id: e._id,
        slug: e.slug || '',
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
        status: e.status || null,
        detail: e,
    });

    useEffect(() => {
        if (!clubId || loading) return;
        const controller = new AbortController();
        setLoadingRuns(true);
        setShowPast(false);
        fetchSportsByRunClub(clubId, controller.signal, { timeframe: 'upcoming' })
            .then((data) => {
                if (controller.signal.aborted) return;
                const list = Array.isArray(data?.events) ? data.events : [];
                setRuns(list.map(mapRunCard));
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setRuns([]);
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoadingRuns(false);
            });
        fetchSportsByRunClub(clubId, controller.signal, { timeframe: 'past' })
            .then((data) => {
                if (controller.signal.aborted) return;
                const list = Array.isArray(data?.events) ? data.events : [];
                setPastRuns(list.map(mapRunCard));
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                setPastRuns([]);
            });
        return () => controller.abort();
    }, [clubId, loading]);

    useEffect(() => {
        if (!categoryOptions.length) {
            setActiveCategory(null);
            return;
        }
        if (!activeCategory || !categoryOptions.some((option) => option.value === activeCategory)) {
            setActiveCategory('all');
        }
    }, [categoryOptions, activeCategory]);

    const showPageLoader = (loading && !club)
        || (Boolean(club) && Boolean(id) && !entityMatchesRouteParam(club, id, ['name', 'title']));

    useDetailLoaderFailsafe(showPageLoader, () => {
        setLoading(false);
        if (!club) setLoadError((prev) => prev || 'network');
    });

    useEffect(() => {
        if (!showPageLoader && club) signalDetailPageReady();
    }, [showPageLoader, club]);

    const name = club?.title || '';
    const basedIn = club?.subtitle || '';
    const description = club?.aboutUs?.trim() || '';
    const paragraphs = useMemo(() => buildReadableParagraphs(description), [description]);
    const previewParagraphs = paragraphs.slice(0, 2);
    const hasMoreText = paragraphs.length > 2;
    const coverSrc = resolveCoverImage(club, 'cardPortrait') || club?.coverImage || club?.image;

    const filteredRuns = !activeCategory || activeCategory === 'all'
        ? runs
        : runs.filter((run) => run.runCategory === activeCategory);

    if (showPageLoader) {
        return <DetailPageLoader label="Loading run club" variant="run" />;
    }

    if (!club) {
        const isNetwork = isTransientDetailError(loadError);
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isNetwork ? "Couldn't load this run club" : 'Run club not found'}
                </p>
                <p className="text-gray-500 text-sm text-center max-w-xs">
                    {isNetwork
                        ? 'Slow network or server waking up — tap Retry.'
                        : 'This club may have been removed or the link is outdated.'}
                </p>
                {isNetwork ? (
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold cursor-pointer"
                    >
                        Retry
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => (isNetwork ? navigate('/sports') : goBack())}
                    className="text-[#0ECCEE] text-sm font-semibold cursor-pointer"
                >
                    {isNetwork ? 'Browse events' : '← Go back'}
                </button>
            </div>
        );
    }

    const openGallery = (index = 0) => {
        setGalleryIndex(index);
        setGalleryOpen(true);
    };

    const handleShare = () => {
        shareContent({ title: name, url: window.location.href });
    };

    const handleRunClick = (run) => {
        const eventSeed = run.detail && typeof run.detail === 'object'
            ? run.detail
            : {
                _id: run.id,
                slug: run.slug || '',
                title: run.title,
                images: run.image ? [run.image] : [],
                coverImage: run.image || '',
            };
        navigate(sportRunPath(eventSeed), {
            state: {
                event: {
                    ...eventSeed,
                    runClub: club
                        ? {
                            _id: club.id,
                            name: club.title,
                            basedIn: club.subtitle,
                            contactPhone: club.contactPhone,
                            contactInstagram: club.contactInstagram,
                        }
                        : eventSeed.runClub || null,
                },
                runClub: club,
            },
        });
    };

    const canonicalPath = runClubPath(club || { id });

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen pb-16" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <Seo
                title={`${name} — Running Club`}
                description={description}
                canonical={canonicalPath}
                image={toOgShareImageUrl(coverSrc, { contain: true, portrait: true })}
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

            {/* Main Wide Container */}
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 lg:px-8 py-3 lg:py-5 flex flex-col flex-1 gap-5 sm:gap-6">

                {/* Top Action Header Bar */}
                <div className="flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={goBack}
                        aria-label="Go back"
                        className={`size-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                            isDark
                                ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]'
                                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                        }`}
                    >
                        <ArrowLeft size={18} strokeWidth={2.25} />
                    </button>

                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold backdrop-blur-md"
                        style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                        }}
                    >
                        <span className="text-[#0ECCEE]">🏃</span>
                        <span className={isDark ? 'text-gray-300' : 'text-gray-700'}>Running Club</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label="Share"
                            className={`size-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                                isDark
                                    ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                            }`}
                        >
                            <Share2 size={17} strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className={`size-10 rounded-full flex items-center justify-center border transition-all cursor-pointer ${
                                isDark
                                    ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]'
                                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                            }`}
                        >
                            <Heart size={17} strokeWidth={2} className={liked ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                    </div>
                </div>

                {/* Hero Split Section */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 lg:gap-6 items-stretch">

                    {/* Left Column (md:col-span-7): Media Showcase with Ambient Glow & Badges */}
                    <div className="md:col-span-7 flex flex-col">
                        <div className={`relative w-full h-[280px] sm:h-[340px] md:h-[390px] rounded-3xl overflow-hidden border shadow-xl flex items-center justify-center p-6 ${
                            isDark ? 'bg-[#0E0F11] border-white/10' : 'bg-gray-900 border-gray-200'
                        }`}>
                            {coverSrc ? (
                                <img
                                    src={coverSrc}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 w-full h-full object-cover filter blur-3xl scale-125 opacity-30 select-none pointer-events-none"
                                />
                            ) : null}

                            <div className="absolute inset-0 bg-radial from-transparent via-black/30 to-black/70 pointer-events-none" />

                            {coverSrc ? (
                                <img
                                    src={coverSrc}
                                    alt={name}
                                    className="relative z-10 max-h-[82%] max-w-[85%] object-contain drop-shadow-2xl rounded-2xl transition-transform duration-500 hover:scale-105"
                                    onError={(e) => handleImageErrorWithFallback(e, 393, 396, '#2A2B2E', name)}
                                />
                            ) : (
                                <div className="relative z-10 size-28 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40">
                                    <Activity size={48} />
                                </div>
                            )}

                            <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-xs font-semibold text-white shadow-lg">
                                <span className="size-2 rounded-full bg-[#0ECCEE] animate-pulse" />
                                <span>Official Run Club</span>
                            </div>

                            <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
                                <div className="px-3.5 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-white flex items-center gap-2 shadow-lg">
                                    <span className="font-extrabold text-sm sm:text-base text-[#0ECCEE]">
                                        <AnimatedCounter value={runs.length} />
                                    </span>
                                    <span className="text-[11px] font-medium text-gray-300">Upcoming Runs</span>
                                </div>
                                {categoryOptions.length > 1 && (
                                    <div className="px-3.5 py-1.5 rounded-xl bg-black/65 backdrop-blur-md border border-white/15 text-white flex items-center gap-2 shadow-lg">
                                        <span className="font-extrabold text-sm sm:text-base text-[#0ECCEE]">
                                            <AnimatedCounter value={categoryOptions.length - 1} />
                                        </span>
                                        <span className="text-[11px] font-medium text-gray-300">Formats</span>
                                    </div>
                                )}
                            </div>

                            {galleryImages.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => openGallery(0)}
                                    className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/90 text-black hover:bg-white text-xs font-bold shadow-lg transition-transform active:scale-95 cursor-pointer"
                                >
                                    <ImageIcon size={14} />
                                    <span>{galleryImages.length} Photos</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Right Column (md:col-span-5): Run Club Profile Card */}
                    <div className="md:col-span-5 flex flex-col">
                        <div className={`rounded-3xl p-5 sm:p-7 border flex flex-col justify-between h-full shadow-xl relative overflow-hidden backdrop-blur-md ${
                            isDark ? 'bg-[#111213] border-white/10' : 'bg-white border-gray-100'
                        }`}>
                            <div className="pointer-events-none absolute -top-20 -right-20 size-44 rounded-full bg-[#0ECCEE]/15 blur-3xl" />

                            <div className="flex flex-col gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#0ECCEE]/15 text-[#0ECCEE] border border-[#0ECCEE]/30">
                                            <CheckCircle2 size={12} />
                                            Verified Club
                                        </span>
                                    </div>

                                    <h1 className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold font-inter tracking-tight leading-tight ${
                                        isDark ? 'text-white' : 'text-gray-900'
                                    }`}>
                                        {name}
                                    </h1>

                                    {basedIn && (
                                        <p className={`text-sm sm:text-base font-semibold mt-1.5 flex items-center gap-1.5 ${
                                            isDark ? 'text-gray-400' : 'text-gray-600'
                                        }`}>
                                            <MapPin size={16} className="text-[#0ECCEE] shrink-0" />
                                            <span>{basedIn}</span>
                                        </p>
                                    )}
                                </div>

                                {/* Club Metrics Strip */}
                                <div className={`grid grid-cols-3 gap-2.5 p-3 rounded-2xl border ${
                                    isDark ? 'bg-white/[0.03] border-white/5' : 'bg-gray-50 border-gray-100'
                                }`}>
                                    <div className="text-center">
                                        <p className="text-lg sm:text-xl font-extrabold text-[#0ECCEE] leading-none">
                                            <AnimatedCounter value={runs.length} />
                                        </p>
                                        <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Upcoming</p>
                                    </div>
                                    <div className="text-center border-x border-current/10">
                                        <p className={`text-lg sm:text-xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            <AnimatedCounter value={Math.max(1, categoryOptions.length - 1)} />
                                        </p>
                                        <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Formats</p>
                                    </div>
                                    <div className="text-center">
                                        <p className={`text-lg sm:text-xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            <AnimatedCounter value={pastRuns.length} />
                                        </p>
                                        <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Completed</p>
                                    </div>
                                </div>

                                {clubId && (
                                    <div className="pt-1">
                                        <FollowCommunityBar
                                            entityType="run_club"
                                            entityId={clubId}
                                            followLabel="Follow Club"
                                            followingLabel="Following"
                                            membersTitle={`${name || 'Club'} members`}
                                            onRequireLogin={() => setShowLogin(true)}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="flex flex-col gap-2.5 mt-5 pt-4 border-t border-current/10">
                                {club?.groupLink && (
                                    <a
                                        href={club.groupLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white font-bold text-sm shadow-md shadow-[#25D366]/20 transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer"
                                    >
                                        <MessageCircle size={18} />
                                        <span>Join WhatsApp Community</span>
                                    </a>
                                )}

                                {club?.registrationLink && !club?.groupLink && (
                                    <button
                                        type="button"
                                        onClick={() => openExternalUrl(club.registrationLink)}
                                        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0ECCEE] text-black font-extrabold text-sm shadow-md shadow-[#0ECCEE]/20 transition-all hover:brightness-110 active:scale-[0.99] cursor-pointer"
                                    >
                                        <ExternalLink size={16} />
                                        <span>Official Club Membership</span>
                                    </button>
                                )}

                                <div className="grid grid-cols-2 gap-2">
                                    {club?.contactPhone && (
                                        <a
                                            href={`tel:${club.contactPhone}`}
                                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.99] ${
                                                isDark
                                                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-200'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            <Phone size={14} className="text-[#0ECCEE]" />
                                            <span className="truncate">Call Club</span>
                                        </a>
                                    )}

                                    {club?.contactInstagram && (
                                        <a
                                            href={`https://instagram.com/${club.contactInstagram.replace('@', '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all active:scale-[0.99] ${
                                                isDark
                                                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-gray-200'
                                                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            <Instagram size={14} className="text-pink-500" />
                                            <span className="truncate">Instagram</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── About Us Card ── */}
                {description && (
                    <ScrollReveal>
                        <div className={`p-5 sm:p-6 rounded-3xl border transition-all ${
                            isDark ? 'bg-[#111213] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                        }`}>
                            <h2 className={`text-base sm:text-lg font-bold font-inter leading-tight tracking-wide mb-3 flex items-center gap-2 ${
                                isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                                <Sparkles size={18} className="text-[#0ECCEE]" />
                                <span>About {name}</span>
                            </h2>
                            <div className={`text-xs sm:text-sm font-medium leading-relaxed space-y-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                {(expanded ? paragraphs : previewParagraphs).map((p, idx) => (
                                    <p key={idx}>{p}</p>
                                ))}
                                {hasMoreText && (
                                    <button
                                        type="button"
                                        onClick={() => setExpanded((v) => !v)}
                                        className="text-[#0ECCEE] font-bold hover:underline cursor-pointer inline-block pt-1"
                                    >
                                        {expanded ? 'Show less' : 'Read full story →'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* ── Upcoming Runs Section ── */}
                <ScrollReveal delay={0.05}>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <h2 className={`text-lg sm:text-xl font-extrabold font-inter tracking-tight ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                    Upcoming Runs
                                </h2>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    Join active group runs and fitness sessions
                                </p>
                            </div>

                            {categoryOptions.length > 1 && (
                                <div className="overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0" style={{ scrollbarWidth: 'none' }}>
                                    <div className="flex items-center gap-2 pb-1">
                                        {categoryOptions.map((option) => {
                                            const isActive = activeCategory === option.value;
                                            return (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    onClick={() => setActiveCategory(option.value)}
                                                    className={`shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                                                        isActive
                                                            ? 'bg-gradient-to-r from-[#0ECCEE] to-[#007BFF] text-black shadow-md shadow-[#0ECCEE]/25'
                                                            : isDark
                                                                ? 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                                                                : 'bg-gray-100 border border-gray-200 text-gray-700 hover:bg-gray-200'
                                                    }`}
                                                >
                                                    {option.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {loadingRuns ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className={`h-64 rounded-2xl animate-pulse ${isDark ? 'bg-white/5' : 'bg-gray-100'}`} />
                                ))}
                            </div>
                        ) : filteredRuns.length === 0 ? (
                            <div className={`p-8 rounded-3xl text-center border ${
                                isDark ? 'bg-[#111213] border-white/5 text-gray-400' : 'bg-white border-gray-100 text-gray-600 shadow-sm'
                            }`}>
                                <Activity size={36} className="mx-auto text-gray-500 mb-2 opacity-60" />
                                <p className="text-sm font-bold">No upcoming runs{activeCategory && activeCategory !== 'all' ? ' in this format' : ''}</p>
                                <p className="text-xs text-gray-500 mt-1">Stay tuned or follow the club to get notified when new runs drop!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredRuns.map((run, index) => (
                                    <RunCard
                                        key={run.id}
                                        run={run}
                                        isDark={isDark}
                                        isFav={isFavorite(run.id)}
                                        onFav={() => toggleFavorite(run.id, run)}
                                        eager={index < 4}
                                        onClick={() => handleRunClick(run)}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollReveal>

                {/* ── Past Runs Accordion ── */}
                {pastRuns.length > 0 && (
                    <ScrollReveal delay={0.08}>
                        <div className={`rounded-3xl border overflow-hidden ${
                            isDark ? 'bg-[#111213] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                        }`}>
                            <button
                                type="button"
                                onClick={() => setShowPast((v) => !v)}
                                className={`w-full flex items-center justify-between p-5 text-sm font-bold transition-all cursor-pointer ${
                                    isDark ? 'text-gray-200 hover:bg-white/[0.02]' : 'text-gray-800 hover:bg-gray-50'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-[#0ECCEE]">🏁</span>
                                    <span>Past Runs & Achievements ({pastRuns.length})</span>
                                </div>
                                <ChevronDown
                                    size={18}
                                    className={`transition-transform duration-200 text-gray-400 ${showPast ? 'rotate-180' : ''}`}
                                />
                            </button>

                            {showPast && (
                                <div className="px-5 pb-5 pt-1 border-t border-current/10">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mt-2">
                                        {pastRuns.map((run) => (
                                            <button
                                                key={run.id}
                                                type="button"
                                                onClick={() => handleRunClick(run)}
                                                className={`w-full text-left flex items-center justify-between gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                                    isDark
                                                        ? 'bg-white/[0.02] border-white/5 hover:bg-white/5 text-gray-300'
                                                        : 'bg-gray-50 border-gray-200/80 hover:bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                <span className="truncate text-xs sm:text-sm font-medium">{run.title}</span>
                                                {run.date && (
                                                    <span className={`shrink-0 text-xs font-semibold ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {run.date}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollReveal>
                )}

                {/* ── Community Contacts ── */}
                {(club?.contactPhone || club?.contactInstagram) && (
                    <ScrollReveal delay={0.1}>
                        <div className={`p-5 sm:p-6 rounded-3xl border ${
                            isDark ? 'bg-[#111213] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                        }`}>
                            <h2 className={`text-base sm:text-lg font-bold font-inter leading-tight tracking-wide mb-4 flex items-center gap-2 ${
                                isDark ? 'text-white' : 'text-gray-900'
                            }`}>
                                <Users size={18} className="text-[#0ECCEE]" />
                                <span>Club Leadership & Contact</span>
                            </h2>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {club?.contactPhone && (
                                    <a
                                        href={`tel:${club.contactPhone}`}
                                        className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.99] cursor-pointer ${
                                            isDark
                                                ? 'bg-white/[0.03] border-white/10 hover:border-[#0ECCEE]/50 hover:bg-white/[0.06]'
                                                : 'bg-gray-50/70 border-gray-200/80 shadow-xs hover:border-[#0ECCEE]/60 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="size-11 rounded-xl bg-gradient-to-br from-[#0ECCEE] to-[#007BFF] flex items-center justify-center shrink-0 shadow-md shadow-[#0ECCEE]/20">
                                            <Phone size={18} className="text-black" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Club Hotline</p>
                                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {club.contactPhone}
                                            </p>
                                        </div>
                                    </a>
                                )}

                                {club?.contactInstagram && (
                                    <a
                                        href={`https://instagram.com/${club.contactInstagram.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all duration-200 active:scale-[0.99] cursor-pointer ${
                                            isDark
                                                ? 'bg-white/[0.03] border-white/10 hover:border-pink-500/50 hover:bg-white/[0.06]'
                                                : 'bg-gray-50/70 border-gray-200/80 shadow-xs hover:border-pink-500/50 hover:shadow-md'
                                        }`}
                                    >
                                        <div
                                            className="size-11 rounded-xl flex items-center justify-center shrink-0 shadow-md shadow-pink-500/20"
                                            style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #7C3AED 100%)' }}
                                        >
                                            <Instagram size={18} className="text-white" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Instagram Handle</p>
                                            <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {club.contactInstagram}
                                            </p>
                                        </div>
                                    </a>
                                )}
                            </div>
                        </div>
                    </ScrollReveal>
                )}

                {/* ── Gallery Showcase ── */}
                {galleryImages.length > 0 && (
                    <ScrollReveal delay={0.12}>
                        <div className={`p-5 sm:p-6 rounded-3xl border ${
                            isDark ? 'bg-[#111213] border-white/10' : 'bg-white border-gray-100 shadow-sm'
                        }`}>
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <h2 className={`text-base sm:text-lg font-bold font-inter leading-tight tracking-wide flex items-center gap-2 ${
                                    isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                    <ImageIcon size={18} className="text-[#0ECCEE]" />
                                    <span>Club Gallery</span>
                                </h2>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                                    isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-gray-100 border-gray-200 text-gray-600'
                                }`}>
                                    {galleryImages.length} photos
                                </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {galleryImages.slice(0, 4).map((img, i) => {
                                    const isOverflowTile = galleryImages.length > 4 && i === 3;
                                    const remainingCount = galleryImages.length - 4;
                                    return (
                                        <button
                                            key={`${img}-${i}`}
                                            type="button"
                                            onClick={() => openGallery(i)}
                                            aria-label={isOverflowTile ? `View all ${galleryImages.length} gallery images` : `View gallery image ${i + 1}`}
                                            className={`group relative w-full aspect-square rounded-2xl overflow-hidden active:scale-[0.98] transition-all cursor-pointer ${
                                                isDark ? 'bg-white/5 border border-white/10' : 'bg-white shadow-xs border border-gray-200/70'
                                            }`}
                                        >
                                            <img
                                                src={resolveGallerySrc(img, 'square')}
                                                alt={`${name} gallery ${i + 1}`}
                                                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                loading="lazy"
                                                decoding="async"
                                                onError={(e) => handleImageErrorWithFallback(e, 200, 200, '#2A2B2E', name)}
                                            />
                                            {isOverflowTile && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                                                    <span className="text-white text-base font-extrabold tracking-wide">
                                                        +{remainingCount}
                                                    </span>
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </ScrollReveal>
                )}

            </div>

            {/* Gallery Lightbox */}
            {galleryOpen && galleryImages.length > 0 && (
                <GalleryLightbox
                    images={galleryImages}
                    index={galleryIndex}
                    name={name}
                    onClose={() => setGalleryOpen(false)}
                    onIndexChange={setGalleryIndex}
                />
            )}

            {/* Login Popup */}
            {showLogin && (
                <CrwdCtrlLogin
                    googleOnly
                    title="Sign in to follow"
                    subtitle="One tap with Google — then you're in"
                    onClose={() => setShowLogin(false)}
                />
            )}
        </div>
    );
}

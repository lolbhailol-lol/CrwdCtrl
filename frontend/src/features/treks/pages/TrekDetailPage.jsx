import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import {
    ArrowLeft,
    Share2,
    Heart,
    ChevronRight,
    ChevronDown,
    Backpack,
    MapPin,
    Calendar,
    Clock,
    Phone,
    Instagram,
    ExternalLink,
    Check,
    Hourglass,
} from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { getImageUrl } from '../../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { ScrollProgress, ScrollReveal } from '../../../motion';
import { shareContent } from '../../../utils/externalLink';
import { useInAppBack } from '../../../hooks/useInAppBack';
import Seo from '../../../components/Seo';
import LazyMap from '../../../components/LazyMap';
import TrekDetailIcon from '../../../components/TrekDetailIcon';
import DetailPageLoader from '../../../components/DetailPageLoader';
import OrganizersStorySlider from '../../../components/OrganizersStorySlider';
import GalleryLightbox from '../../../components/GalleryLightbox';
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import { breadcrumbSchema, eventSchema } from '../../../utils/seo';
import { formatBatchDate, normalizeTrekBatches } from '../../../utils/trekDateDisplay';
import { ScheduleMainMarker, ScheduleSubMarker } from '../../../components/SchedulePointMarkers';
import { normalizeItineraryDay, SCHEDULE_SUB_INDENT_PX } from '../../../utils/trekItinerary';
import { normalizeDetailBoxes, resolveTrekMapPin } from '../../../utils/trekDetailBoxes';
import { fetchTrekCommunity } from '../../../services/api/public.api';
import { publicFetchJSONRetry } from '../../../services/api/client';
import { trackBookNowClick } from '../../../services/analyticsService';
import { trekPath, entityMatchesRouteParam, communityPath } from '../../../utils/slugRoutes';
import { fetchCatalogJSON } from '../../../services/api/catalogCache';
import { resolveTrekHeroSlides, resolveTrekGalleryImages } from '../../../utils/trekImages';
import {
    classifyDetailLoadError,
    createDetailCache,
    DETAIL_FETCH_OPTS,
} from '../../../utils/detailPageLoad';

const trekDetailCache = createDetailCache('crwdctrl_trek_detail_v1_');
const GALLERY_PREVIEW_COUNT = 4;

function trekMatchesRouteParam(trek, routeParam) {
    return entityMatchesRouteParam(trek, routeParam, ['trekName', 'title']);
}

// ── Icons ─────────────────────────────────────────────────────────────
const ClockIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const ChartIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20v-6M6 20V10M18 20V4" />
    </svg>
);

const GridIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
);

const CalendarIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const MapPinIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

// Clean list items from admin
function cleanListItem(item) {
    return String(item || '').replace(/^[-*•\s]+/, '').trim();
}

function TrekInfoList({ items, isDark, dotClass = 'bg-[#0ECCEE]' }) {
    const rows = (items || []).map(cleanListItem).filter(Boolean);
    if (!rows.length) return null;
    return (
        <div className={`rounded-2xl border p-4 ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
            <ul className="space-y-3">
                {rows.map((item, i) => (
                    <li key={i} className={`flex gap-3 text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        <span className={`mt-2 size-1.5 rounded-full shrink-0 ${dotClass}`} />
                        <span className="flex-1 min-w-0">{item}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}


function deduplicateTrekDetailCards(cards) {
    if (!cards || cards.length === 0) return [];
    const seenLabels = new Set();
    const seenValues = new Set();

    return cards.filter((card) => {
        const rawLabel = String(card?.label || '').trim();
        const rawVal = String(card?.value || '').trim();
        if (!rawLabel || !rawVal) return false;

        const lLow = rawLabel.toLowerCase();
        const vLow = rawVal.toLowerCase();

        if (seenLabels.has(lLow)) return false;

        if (/meeting|starting|location/i.test(lLow)) {
            if (seenValues.has(vLow)) return false;
            seenValues.add(vLow);
        }

        seenLabels.add(lLow);
        return true;
    });
}

export default function TrekDetailPage() {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();

    const seedFromNav = (raw) => {
        if (!raw) return null;
        return {
            ...raw,
            trekName: raw.trekName || raw.title || 'Trek',
            trekDuration: raw.trekDuration || raw.duration,
            difficultyLevel: raw.difficultyLevel || raw.difficulty,
            images: raw.images?.length ? raw.images : raw.image ? [raw.image] : [],
            coverImage: raw.coverImage || raw.image || raw.images?.[0] || null,
        };
    };

    const [trek, setTrek] = useState(null);
    const [genderRegistration, setGenderRegistration] = useState(null);
    const [community, setCommunity] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [liked, setLiked] = useState(false);
    const [imgPg, setImgPg] = useState(0);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [activeTab, setActiveTab] = useState('Details');
    const [termsOpen, setTermsOpen] = useState(false);
    const [carryOpen, setCarryOpen] = useState(false);
    const [departuresOpen, setDeparturesOpen] = useState(false);
    const [similarTreks, setSimilarTreks] = useState([]);
    const [heroLoaded, setHeroLoaded] = useState(false);
    const imgRef = useRef(null);
    const departuresRef = useRef(null);
    const trekRef = useRef(trek);
    trekRef.current = trek;
    const redirectedRef = useRef('');

    useEffect(() => {
        let active = true;
        fetchCatalogJSON('/treks')
            .then((res) => {
                if (!active) return;
                const list = Array.isArray(res?.data?.treks) ? res.data.treks : [];
                const currentId = String(trek?._id || trek?.id || id || '');
                const currentTitle = String(trek?.trekName || trek?.title || '').trim().toLowerCase();
                const others = list.filter((item) => {
                    const itemId = String(item._id || item.id || '');
                    const itemTitle = String(item.trekName || item.title || '').trim().toLowerCase();
                    return itemId !== currentId && item.slug !== id && itemTitle !== currentTitle;
                });
                setSimilarTreks(others.slice(0, 3));
            })
            .catch(() => { });
        return () => { active = false; };
    }, [id, trek?._id, trek?.id, trek?.title, trek?.trekName]);

    useEffect(() => {
        if (!departuresOpen) return undefined;
        const onDocClick = (e) => {
            if (departuresRef.current && !departuresRef.current.contains(e.target)) {
                setDeparturesOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [departuresOpen]);

    useEffect(() => {
        setDeparturesOpen(false);
    }, [activeTab]);

    useEffect(() => {
        const navTrek = location.state?.trek;
        const trekId = id || navTrek?.id || navTrek?._id;
        if (!trekId) {
            setTrek(null);
            setCommunity(null);
            setLoadError('');
            setLoading(false);
            return undefined;
        }

        const existing = trekRef.current;
        const existingReady = Boolean(
            existing &&
            entityMatchesRouteParam(existing, id, ['trekName', 'title', 'name']) &&
            (existing.about || existing.itinerary || existing.inclusions || existing.batches)
        );

        const seeded = entityMatchesRouteParam(navTrek, id, ['trekName', 'title', 'name']) ? seedFromNav(navTrek) : null;
        const cached = trekDetailCache.read(trekId);
        const cacheOk = entityMatchesRouteParam(cached, id, ['trekName', 'title', 'name']);
        const fallback = existingReady ? existing : (seeded || (cacheOk ? cached : null));

        setImgPg(0);
        setOverviewExpanded(false);
        setActiveTab('Details');
        setTermsOpen(false);
        setCarryOpen(false);
        setGenderRegistration(null);
        setLoadError('');
        setTrek(fallback);
        setCommunity(fallback ? (location.state?.community || null) : null);
        setLoading(!fallback);

        const controller = new AbortController();
        publicFetchJSONRetry(`/treks/${encodeURIComponent(trekId)}`, {
            signal: controller.signal,
            ...DETAIL_FETCH_OPTS,
        })
            .then((res) => {
                if (controller.signal.aborted) return;
                const d = res?.data;
                if (d?.trek) {
                    setTrek(d.trek);
                    setGenderRegistration(d.genderRegistration || null);
                    trekDetailCache.write(trekId, d.trek);
                    if (d.trek._id) trekDetailCache.write(String(d.trek._id), d.trek);
                    if (d.trek.slug) trekDetailCache.write(String(d.trek.slug), d.trek);
                    const populated = d.trek.communityId;
                    if (populated && typeof populated === 'object' && populated.name) {
                        setCommunity(populated);
                    }
                    setLoadError('');
                } else if (fallback) {
                    setTrek(fallback);
                    setLoadError('');
                } else {
                    setTrek(null);
                    setLoadError('not_found');
                }
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                if (fallback) {
                    setTrek(fallback);
                    setLoadError('');
                    return;
                }
                setTrek(null);
                setLoadError(classifyDetailLoadError(err));
            })
            .finally(() => {
                setLoading(false);
            });

        return () => controller.abort();
    }, [id]);

    const showPageLoader = loading || (trek && id && !entityMatchesRouteParam(trek, id, ['trekName', 'title', 'name']));
    useDetailLoaderFailsafe(showPageLoader, () => {
        setLoading(false);
        if (!trek) setLoadError((prev) => prev || 'network');
    });

    useEffect(() => {
        if (!trek?.communityId) return undefined;
        const populated = typeof trek.communityId === 'object' ? trek.communityId : null;
        if (populated?.name) return undefined;

        const communityId = typeof trek.communityId === 'object'
            ? trek.communityId._id || trek.communityId.id
            : trek.communityId;
        if (!communityId) return undefined;

        const controller = new AbortController();
        fetchTrekCommunity(communityId, controller.signal)
            .then((data) => {
                if (controller.signal.aborted) return;
                if (data?.community) setCommunity((prev) => prev || data.community);
            })
            .catch(() => { });
        return () => controller.abort();
    }, [trek?.communityId]);

    useEffect(() => {
        if (!trek || !id) return;
        if (!entityMatchesRouteParam(trek, id, ['trekName', 'title', 'name'])) return;
        const canonical = trekPath(trek);
        if (!canonical || window.location.pathname === canonical) return;
        if (redirectedRef.current === canonical) return;
        redirectedRef.current = canonical;
        navigate(`${canonical}${window.location.search || ''}`, {
            replace: true,
            state: { ...location.state, trek },
        });
    }, [trek, id, navigate, location.state]);

    if (showPageLoader) return <DetailPageLoader label="Loading trek" variant="trek" />;
    if (!trek) {
        const isNotFound = loadError === 'not_found';
        const isRetryable = !isNotFound;
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isRetryable ? "Couldn't load this trek" : 'This trek is no longer available'}
                </p>
                <p className="text-gray-500 text-sm text-center max-w-xs">
                    {isRetryable
                        ? 'Slow network or server waking up — tap Retry.'
                        : 'It may have ended, been unpublished, or the link is outdated.'}
                </p>
                {isRetryable ? (
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
                    onClick={() => (isRetryable ? navigate('/treks') : goBack())}
                    className="text-[#0ECCEE] text-sm font-semibold cursor-pointer"
                >
                    {isRetryable ? 'Browse treks' : '← Go back'}
                </button>
            </div>
        );
    }

    const images = (() => {
        const slides = resolveTrekHeroSlides(trek);
        return slides.length ? slides : [null];
    })();
    const coverImg = images[0]
        || trek.coverImage
        || trek.coverImages?.hero
        || trek.coverImages?.portrait
        || null;
    const galleryImages = resolveTrekGalleryImages(trek);
    const communityName =
        community?.name ||
        community?.title ||
        (typeof trek.communityId === 'object' ? trek.communityId?.name : null) ||
        trek.communityName ||
        trek.trekLeader ||
        null;

    const buildOverview = () => {
        if (trek.description) return trek.description;
        const parts = [];
        if (trek.trekName) parts.push(`${trek.trekName} is an exciting trek`);
        if (trek.city || trek.destination) parts.push(`located in ${[trek.city, trek.destination].filter(Boolean).join(', ')}`);
        if (trek.difficultyLevel) parts.push(`with a ${trek.difficultyLevel} difficulty level`);
        if (trek.trekDuration) parts.push(`spanning ${trek.trekDuration}`);
        if (trek.startingPoint) parts.push(`Starting from ${trek.startingPoint}`);
        if (trek.fitnessRequirements) parts.push(`Fitness requirements: ${trek.fitnessRequirements}`);
        if (trek.maxParticipants) parts.push(`This trek accommodates up to ${trek.maxParticipants} participants`);
        return parts.length ? parts.join('. ') + '.' : 'No description available for this trek.';
    };
    const desc = buildOverview();
    const shortDesc = desc.slice(0, 150);

    const handleShare = () => {
        shareContent({ title: trek.trekName, url: window.location.href });
    };

    const trekName = trek.trekName || trek.title || trek.name || 'Trek';
    const trekLocation = trek.meetingLocation || trek.startingPoint || trek.city || trek.destination || null;
    const mapPin = resolveTrekMapPin(trek);
    const canonicalPath = trekPath(trek);
    const baseDetailRows = deduplicateTrekDetailCards(normalizeDetailBoxes(trek.detailBoxes, trek));
    const extraRows = [];
    if (trek.trekDuration && !baseDetailRows.some((r) => /duration|day/i.test(r.label))) {
        extraRows.push({ label: 'Duration', value: String(trek.trekDuration), icon: 'clock' });
    }
    if (trek.difficultyLevel && !baseDetailRows.some((r) => /difficulty/i.test(r.label))) {
        extraRows.push({ label: 'Difficulty', value: String(trek.difficultyLevel), icon: 'fitness' });
    }
    if (trek.highestAltitude && !baseDetailRows.some((r) => /altitude|elevation/i.test(r.label))) {
        extraRows.push({ label: 'Altitude', value: String(trek.highestAltitude), icon: 'mountain' });
    }
    if (trek.trekDistance && !baseDetailRows.some((r) => /distance|trail/i.test(r.label))) {
        extraRows.push({ label: 'Distance', value: String(trek.trekDistance), icon: 'route' });
    }
    const cleanDetailRows = [...baseDetailRows, ...extraRows];
    const batches = normalizeTrekBatches(trek.trekBatches, trek.trekDate);

    const handleBookNow = () => {
        const regStatus = trek.registration?.status || 'open';
        const extLink = trek.registration?.mode === 'external_link' ? trek.registrationLink : null;
        if (regStatus === 'closed' || regStatus === 'not_open_yet') return;

        if (extLink) {
            trackBookNowClick({
                entityType: 'trek',
                entityId: trek._id || trek.id || trek.slug || '',
                mode: 'external_link',
                destination: 'external',
            });
            window.open(extLink, '_blank', 'noopener,noreferrer');
            return;
        }
        trackBookNowClick({
            entityType: 'trek',
            entityId: trek._id || trek.id || trek.slug || '',
            mode: trek.registration?.mode || 'internal_form',
            destination: 'internal_book_page',
        });
        navigate(`${trekPath(trek)}/book`, { state: { trek, genderRegistration, freshBooking: true } });
    };

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen pb-6">
            <Seo
                title={trekName}
                description={desc}
                canonical={canonicalPath}
                image={coverImg || images?.[0]}
                type="article"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Treks', path: '/treks' },
                        { name: trekName, path: canonicalPath },
                    ]),
                    eventSchema({
                        name: trekName,
                        description: desc,
                        url: canonicalPath,
                        image: coverImg || images?.[0],
                        location: trekLocation || undefined,
                        price: trek.registrationFee != null ? trek.registrationFee : undefined,
                        organizerName: communityName || undefined,
                        availabilityUrl: `${canonicalPath}/book`,
                    }),
                ]}
            />
            <ScrollProgress />

            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-2.5 lg:py-4 flex flex-col flex-1 gap-3.5">

                {/* TOP HEADER ROW (Matching Reference: Title + Share/Favorite Action Icons) */}
                <div className="flex items-center justify-between gap-4">
                    <h1 className={`text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.trekName || trek.title || trek.name || ''}
                    </h1>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleShare}
                            aria-label="Share"
                            className={`size-9 rounded-full flex items-center justify-center border transition cursor-pointer ${isDark ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                                }`}
                        >
                            <Share2 size={16} strokeWidth={2} />
                        </button>
                        <button
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className={`size-9 rounded-full flex items-center justify-center border transition cursor-pointer ${isDark ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                                }`}
                        >
                            <Heart size={16} strokeWidth={2} className={liked ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                    </div>
                </div>

                {/* REFERENCE-STYLE HERO SPLIT SECTION (Left: Media Carousel | Right: Info & Booking Card) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-start">

                    {/* LEFT COLUMN (md:col-span-7): Media Slider with Badges Overlay */}
                    <div className="md:col-span-7 flex flex-col">
                        <div className={`relative w-full h-[260px] sm:h-[275px] md:h-[280px] overflow-hidden rounded-3xl border shadow-lg ${isDark ? 'bg-[#1A1B1D] border-white/5' : 'bg-gray-900 border-gray-200'
                            }`}>


                            <div
                                ref={imgRef}
                                className="overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full h-full"
                                style={{
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                    touchAction: 'pan-x',
                                    overscrollBehaviorX: 'contain',
                                }}
                                onScroll={(e) => {
                                    const p = Math.round(e.target.scrollLeft / e.target.clientWidth);
                                    setImgPg((prev) => (prev === p ? prev : p));
                                }}
                            >
                                <div className="flex h-full">
                                    {images.map((img, i) => {
                                        const raw = typeof img === 'string' ? img : (img?.url || img?.secure_url || '');
                                        const src = getImageUrl(raw, { preset: 'eventHeroFit' }) || getImageUrl(raw) || raw || null;
                                        return (
                                            <div key={i} className="shrink-0 w-full h-full snap-start relative">
                                                {src ? (
                                                    <>
                                                        {!heroLoaded && i === 0 && (
                                                            <div aria-hidden className="absolute inset-0 bg-[#1A1B1D]" />
                                                        )}
                                                        <img
                                                            src={src}
                                                            alt={trek.trekName}
                                                            className={`w-full h-full object-cover object-center ${i === 0 && !heroLoaded ? 'opacity-0' : 'opacity-100'
                                                                }`}
                                                            loading={i === 0 ? 'eager' : 'lazy'}
                                                            fetchPriority={i === 0 ? 'high' : 'auto'}
                                                            decoding="async"
                                                            onLoad={() => { if (i === 0) setHeroLoaded(true); }}
                                                            onError={(e) => {
                                                                if (i === 0) setHeroLoaded(true);
                                                                if (raw && e.currentTarget.src !== raw) {
                                                                    e.currentTarget.src = raw;
                                                                    return;
                                                                }
                                                                handleImageErrorWithFallback(e, 800, 440, '#1A1B1D', trek.trekName);
                                                            }}
                                                        />
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full bg-[#1A1B1D]" />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Slider Navigation Arrow Controls (< >) */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imgRef.current) {
                                                imgRef.current.scrollBy({ left: -imgRef.current.clientWidth, behavior: 'smooth' });
                                            }
                                        }}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition z-20 backdrop-blur-xs cursor-pointer text-lg font-bold"
                                        aria-label="Previous image"
                                    >
                                        ‹
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imgRef.current) {
                                                imgRef.current.scrollBy({ left: imgRef.current.clientWidth, behavior: 'smooth' });
                                            }
                                        }}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition z-20 backdrop-blur-xs cursor-pointer text-lg font-bold"
                                        aria-label="Next image"
                                    >
                                        ›
                                    </button>

                                    {/* Pagination Dots */}
                                    <div className="absolute bottom-4 inset-x-0 flex items-center justify-center gap-1.5 z-20">
                                        {images.slice(0, 5).map((_, i) => (
                                            <div
                                                key={i}
                                                className={`rounded-full transition-all duration-300 ${i === imgPg ? 'h-2 w-6 bg-[#0ECCEE]' : 'size-2 bg-white/50 border border-white/60'
                                                    }`}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT COLUMN (md:col-span-5): Equal-height Trek Summary & Book Now Card */}
                    <div className="md:col-span-5 flex flex-col">
                        <div className={`w-full h-[260px] sm:h-[275px] md:h-[280px] rounded-3xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between ${isDark ? 'bg-[#111213] border-white/10 shadow-xl' : 'bg-white border-gray-200 shadow-md'
                            }`}>
                            {/* Card Details Top Section */}
                            <div className="space-y-2.5">
                                {/* Date & Status Chip */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-amber-400' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            <Calendar size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {batches.length > 0
                                                    ? formatBatchDate(batches[0].date)
                                                    : (trek.trekDate ? formatBatchDate(trek.trekDate) : 'Date TBA')}
                                            </p>
                                            {batches.length > 1 && (
                                                <p className="text-[11px] text-[#0ECCEE] font-medium truncate mt-0.5">
                                                    +{batches.length - 1} more departure dates
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/25">
                                        Filling Fast
                                    </span>
                                </div>

                                {/* Location with Map Pin & Quick Map Link */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-cyan-50 text-cyan-600'
                                            }`}>
                                            <MapPin size={16} />
                                        </div>
                                        <p className={`text-xs sm:text-sm font-semibold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`} title={trekLocation || ''}>
                                            {trekLocation || 'Location TBA'}
                                        </p>
                                    </div>

                                    {mapPin.query ? (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPin.query)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="size-7 rounded-lg flex items-center justify-center text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0 cursor-pointer transition border border-[#0ECCEE]/20"
                                            title="Open in Maps"
                                        >
                                            <ExternalLink size={13} />
                                        </a>
                                    ) : null}
                                </div>

                                {/* Trek Key Chips: Duration, Difficulty, Category */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {trek.trekDuration ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            ⏳ {trek.trekDuration}
                                        </span>
                                    ) : null}
                                    {trek.difficultyLevel ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold capitalize ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            ⛰️ {trek.difficultyLevel}
                                        </span>
                                    ) : null}
                                    {trek.trekCategory ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            🧭 {trek.trekCategory}
                                        </span>
                                    ) : null}
                                </div>

                                {/* Organizer Contact Row */}
                                {(() => {
                                    const phone = community?.contactPhone || trek.emergencyContact;
                                    const insta = community?.contactInstagram || trek.contactInstagram;
                                    const handle = insta ? insta.replace('@', '') : null;
                                    if (!communityName && !phone && !handle) return null;
                                    return (
                                        <div className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                            <div className="min-w-0 flex items-center gap-1.5">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0ECCEE]">BY</span>
                                                <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {communityName || 'Trek Organizer'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {phone && (
                                                    <a
                                                        href={`tel:${phone}`}
                                                        className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-[#0ECCEE]' : 'bg-white text-gray-700 hover:text-[#0ECCEE] shadow-xs'}`}
                                                        title={`Call ${phone}`}
                                                    >
                                                        <Phone size={13} />
                                                    </a>
                                                )}
                                                {handle && (
                                                    <a
                                                        href={`https://instagram.com/${handle}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-pink-400' : 'bg-white text-gray-700 hover:text-pink-500 shadow-xs'}`}
                                                        title={`Instagram @${handle}`}
                                                    >
                                                        <Instagram size={13} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Divider & Price / Booking CTA row */}
                            <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between gap-3`}>
                                <div>
                                    {trek.registrationFee == null ? (
                                        <p className={`text-xl sm:text-2xl font-black ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
                                    ) : Number(trek.registrationFee) > 0 ? (
                                        <div>
                                            <div className="flex items-baseline gap-1">
                                                <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    ₹{Number(trek.registrationFee).toLocaleString('en-IN')}
                                                </span>
                                                <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    onwards
                                                </span>
                                            </div>
                                            <p className="text-[10px] font-semibold text-amber-400">Verified Pricing</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-xl sm:text-2xl font-black text-emerald-400">Free</p>
                                            <p className="text-[10px] font-semibold text-emerald-400">Instant Entry</p>
                                        </div>
                                    )}
                                </div>

                                {(() => {
                                    const regStatus = trek.registration?.status || 'open';
                                    if (regStatus === 'closed') {
                                        return (
                                            <button disabled className="px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-gray-600 text-gray-300 cursor-not-allowed shrink-0">
                                                Closed
                                            </button>
                                        );
                                    }
                                    if (regStatus === 'not_open_yet') {
                                        return (
                                            <button disabled className="px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-gray-600 text-gray-300 cursor-not-allowed shrink-0">
                                                Not Open
                                            </button>
                                        );
                                    }
                                    return (
                                        <button
                                            type="button"
                                            onClick={handleBookNow}
                                            className="px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-extrabold shadow-lg bg-[#0ECCEE] text-black hover:bg-[#0cb8d6] active:scale-[0.98] transition cursor-pointer shrink-0"
                                        >
                                            Book Now
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full-width About / Description Card */}
                {desc && (
                    <div className={`w-full rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <h2 className={`text-sm sm:text-base font-bold leading-snug mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            About This Trek
                        </h2>
                        <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {overviewExpanded ? desc : shortDesc}
                            {desc.length > 150 && (
                                <button
                                    type="button"
                                    onClick={() => setOverviewExpanded((e) => !e)}
                                    className="ml-1 text-xs font-bold text-[#0ECCEE] hover:underline cursor-pointer"
                                >
                                    {overviewExpanded ? 'Show less' : 'Read more'}
                                </button>
                            )}
                        </p>
                    </div>
                )}

                {/* ORGANIZERS STORY SLIDER (Compact 5-6 organizers with real organizer first if available) */}
                <OrganizersStorySlider
                    title="Organizers"
                    realOrganizer={trek.trekLeader || trek.organizer || (communityName ? { name: communityName, image: community?.logo || community?.image } : null)}
                    eventKey={trek.id || 'trek'}
                    isDark={isDark}
                />

                {/* DETAILS & MAP BALANCED SECTION (High-density space-efficient layout) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start mt-0.5">

                    {/* LEFT COLUMN (lg:col-span-7): Trek Info (Tabs), Overview & Things to Carry */}
                    <div className="lg:col-span-7 flex flex-col gap-3.5">
                        <div className={`rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="flex items-center justify-between mb-3.5">
                                <h2 className={`text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Trek Info
                                </h2>

                                {/* Tabs */}
                                <div className={`flex rounded-xl p-1 gap-1 overflow-x-auto scrollbar-hide ${isDark ? 'bg-[#1A1B1D]' : 'bg-gray-100'}`}>
                                    {[
                                        { id: 'Details', label: 'Details' },
                                        ...(trek.itinerary?.length > 0 ? [{ id: 'Schedule', label: 'Itinerary' }] : []),
                                        ...(trek.inclusions?.length > 0 ? [{ id: 'Inclusion', label: `Includes (${trek.inclusions.length})` }] : []),
                                        ...(trek.exclusions?.length > 0 ? [{ id: 'Exclusion', label: 'Excludes' }] : []),
                                    ].map((tab) => (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${activeTab === tab.id
                                                ? isDark ? 'bg-[#252629] text-[#0ECCEE] shadow-xs' : 'bg-white text-gray-900 shadow-xs'
                                                : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                                                }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* TAB 1: DETAILS */}
                            {activeTab === 'Details' && (
                                <div className="space-y-3">
                                    {cleanDetailRows.length > 0 ? (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {cleanDetailRows.map((row, idx) => (
                                                <div
                                                    key={`fact-${row.label}-${idx}`}
                                                    className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border transition-all ${isDark ? 'bg-[#161718] border-white/5 hover:border-white/10' : 'bg-gray-50 border-gray-100 shadow-2xs hover:border-gray-200'
                                                        }`}
                                                >
                                                    <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-white text-[#0ECCEE] shadow-xs'
                                                        }`}>
                                                        <TrekDetailIcon icon={row.icon || 'default'} size={15} />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className={`text-[10px] font-semibold leading-none truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.label}</p>
                                                        <p className={`text-xs sm:text-[13px] font-bold leading-tight mt-0.5 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No specific details listed.</p>
                                    )}

                                    {trek.inclusions?.length > 0 && (
                                        <div className={`pt-2.5 border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                                            <p className={`text-[11px] font-bold mb-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                Key Inclusions
                                            </p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {trek.inclusions.map(cleanListItem).filter(Boolean).slice(0, 5).map((inc, i) => (
                                                    <span
                                                        key={i}
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${isDark ? 'bg-[#161718] border border-white/5 text-gray-200' : 'bg-gray-50 border border-gray-100 text-gray-800'
                                                            }`}
                                                    >
                                                        <Check size={11} className="text-[#0ECCEE]" />
                                                        <span className="truncate max-w-[150px]">{inc}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: ITINERARY TIMELINE */}
                            {activeTab === 'Schedule' && (
                                trek.itinerary?.length > 0 ? (
                                    <div className="relative border-l-2 border-[#0ECCEE]/30 ml-3 pl-4 sm:pl-5 space-y-4 my-2">
                                        {trek.itinerary.map((day, i) => {
                                            const normalized = normalizeItineraryDay(day, i);
                                            const points = normalized.points.filter((p) => p.text);
                                            if (!normalized.title && !points.length) return null;
                                            return (
                                                <div key={i} className="relative group">
                                                    <div className="absolute -left-[23px] sm:-left-[27px] top-1 size-3 rounded-full border-2 border-[#0ECCEE] bg-[#111213]" />

                                                    <span className="text-[10px] font-black uppercase tracking-wider text-[#0ECCEE]">
                                                        DAY {normalized.day || i + 1}
                                                    </span>

                                                    {normalized.title && (
                                                        <h3 className={`text-xs sm:text-sm font-extrabold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {normalized.title}
                                                        </h3>
                                                    )}

                                                    {points.length > 0 && (
                                                        <ul className="mt-1.5 space-y-1">
                                                            {points.map((point, j) => (
                                                                <li
                                                                    key={j}
                                                                    className={`flex items-start gap-2 text-xs leading-relaxed ${point.level === 'sub'
                                                                        ? isDark ? 'text-gray-400 pl-2.5' : 'text-gray-500 pl-2.5'
                                                                        : isDark ? 'text-gray-200 font-medium' : 'text-gray-800 font-medium'
                                                                        }`}
                                                                >
                                                                    <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE]/70 shrink-0" />
                                                                    <span>{point.text}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p className={`text-xs py-4 text-center ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        No detailed itinerary schedule available.
                                    </p>
                                )
                            )}

                            {/* TAB 3: INCLUSIONS */}
                            {activeTab === 'Inclusion' && (
                                trek.inclusions?.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {trek.inclusions.map(cleanListItem).filter(Boolean).map((item, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5 text-gray-200' : 'bg-gray-50 border-gray-100 text-gray-800'
                                                    }`}
                                            >
                                                <span className="size-5 rounded-md bg-[#0ECCEE]/15 text-[#0ECCEE] flex items-center justify-center shrink-0">
                                                    <Check size={11} strokeWidth={3} />
                                                </span>
                                                <span className="text-xs font-semibold leading-snug truncate">
                                                    {item}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No inclusions specified.</p>
                                )
                            )}

                            {/* TAB 4: EXCLUSIONS */}
                            {activeTab === 'Exclusion' && (
                                trek.exclusions?.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {trek.exclusions.map(cleanListItem).filter(Boolean).map((item, i) => (
                                            <div
                                                key={i}
                                                className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5 text-gray-300' : 'bg-gray-50 border-gray-100 text-gray-700'
                                                    }`}
                                            >
                                                <span className="size-5 rounded-md bg-rose-500/15 text-rose-400 flex items-center justify-center shrink-0 text-xs font-bold">
                                                    ✕
                                                </span>
                                                <span className="text-xs font-semibold leading-snug truncate">
                                                    {item}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No exclusions specified.</p>
                                )
                            )}
                        </div>



                    </div>

                    {/* RIGHT COLUMN (lg:col-span-5): Location Map, Gallery & Info */}
                    <div className="lg:col-span-5 flex flex-col gap-2.5 sm:gap-3">
                        {/* Map Card */}
                        {(mapPin.query || mapPin.mapUrl) && (
                            <div className={`rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-[#0ECCEE]" />
                                        <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            Location &amp; Route Map
                                        </p>
                                    </div>
                                    {mapPin.query ? (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapPin.query)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-[#0ECCEE] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            Directions <ExternalLink size={12} />
                                        </a>
                                    ) : null}
                                </div>
                                <div className="w-full h-[145px] sm:h-[155px] rounded-2xl overflow-hidden relative border border-white/5">
                                    <LazyMap query={mapPin.query} mapUrl={mapPin.mapUrl || undefined} isDark={isDark} title="trek-map" />
                                </div>
                                {mapPin.caption && (
                                    <p className={`text-xs mt-2 font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        📍 {mapPin.caption}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Gallery Preview Card */}
                        {galleryImages.length > 0 && (
                            <div className={`rounded-3xl border overflow-hidden p-3 sm:p-3.5 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        Trek Gallery
                                    </p>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-[#1D1E20] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                                        {galleryImages.length} Photos
                                    </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {galleryImages.slice(0, 4).map((img, i) => {
                                        const isLast = i === 3 && galleryImages.length > 4;
                                        const remaining = galleryImages.length - 4;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => { setGalleryIndex(i); setGalleryOpen(true); }}
                                                className="relative h-[70px] sm:h-[80px] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition border border-white/5"
                                            >
                                                <img src={getImageUrl(img, { preset: 'square' })} alt="" className="w-full h-full object-cover" />
                                                {isLast && remaining > 0 && (
                                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[11px] font-bold">
                                                        +{remaining}
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                    </div>
                </div>

                {/* FULL-WIDTH EXPANDABLE SECTION (Gear Checklist & Terms across navbar length) */}
                <div className="flex flex-col gap-3.5 w-full mt-1">
                    {/* Full-width Things to Carry (Packing & Gear Checklist) */}
                    {trek.thingsToCarry?.length > 0 && (
                        <div className={`w-full rounded-3xl border overflow-hidden transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <button
                                type="button"
                                onClick={() => setCarryOpen((o) => !o)}
                                className="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer text-left"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                        <Backpack size={16} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            Packing &amp; Gear Checklist
                                        </p>
                                        <p className={`text-[10px] sm:text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {trek.thingsToCarry.length} items · Tap to {carryOpen ? 'collapse' : 'view full list'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight
                                    size={18}
                                    className={`transition-transform duration-200 shrink-0 ${carryOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                                />
                            </button>
                            {carryOpen && (
                                <div className={`border-t p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 ${isDark ? 'border-white/5 bg-[#0E0F10]/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                    {trek.thingsToCarry.map(cleanListItem).filter(Boolean).map((item, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs">
                                            <span className="size-1.5 rounded-full bg-emerald-400 shrink-0" />
                                            <span className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{item}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Full-width Terms & Participation Policy Card */}
                    {(() => {
                        const terms = (trek.termsAndConditions || []).map(cleanListItem).filter(Boolean);
                        if (!terms.length) return null;
                        return (
                            <div className={`w-full rounded-3xl border overflow-hidden transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <button
                                    type="button"
                                    onClick={() => setTermsOpen((o) => !o)}
                                    className="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
                                            <Hourglass size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                Terms &amp; Participation Policy
                                            </p>
                                            <p className={`text-[10px] sm:text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                {terms.length} Policy Points · Tap to {termsOpen ? 'collapse' : 'view'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className={`transition-transform duration-200 shrink-0 ${termsOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                                    />
                                </button>

                                {termsOpen && (
                                    <div className={`border-t px-4 sm:px-5 py-4 space-y-2.5 ${isDark ? 'border-white/5 bg-[#0E0F10]/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                        {terms.map((term, i) => (
                                            <div key={i} className="flex gap-2.5 text-xs">
                                                <span className={`text-[10px] font-bold mt-0.5 shrink-0 size-4 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1A1B1D] text-[#0ECCEE]' : 'bg-amber-100 text-amber-700'}`}>{i + 1}</span>
                                                <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{term}</p>
                                            </div>
                                        ))}
                                        <p className={`text-[11px] pt-1 font-medium ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>
                                            ⚠️ By registering, you agree to all the above trek terms.
                                        </p>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>

                {/* SIMILAR TREKS FULL-WIDTH SHELF */}
                {similarTreks.length > 0 && (
                    <div className={`mt-2 rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-3.5">
                            <div>
                                <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Explore Other Treks
                                </h3>
                                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    More outdoor adventures and trail experiences
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/treks')}
                                className="text-xs font-bold text-[#0ECCEE] hover:underline cursor-pointer flex items-center gap-1"
                            >
                                View all <ChevronRight size={14} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {similarTreks.map((sim) => {
                                const simImg = sim.coverImage || sim.images?.[0] || sim.image;
                                const simFee = sim.registrationFee;
                                const simDate = sim.trekDate || sim.date;
                                const formattedSimDate = simDate
                                    ? new Date(simDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    : '';
                                const simLocation = sim.city || sim.destination || '';

                                return (
                                    <div
                                        key={sim._id || sim.id || sim.slug}
                                        onClick={() => {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                            navigate(trekPath(sim), { state: { trek: sim } });
                                        }}
                                        className={`flex items-center gap-3 p-2.5 rounded-2xl border transition-all cursor-pointer group ${isDark
                                            ? 'bg-[#161718] border-white/5 hover:border-[#0ECCEE]/35 hover:bg-[#1D1E20]'
                                            : 'bg-gray-50 border-gray-100 hover:border-[#0ECCEE]/40 hover:bg-cyan-50/30'
                                            }`}
                                    >
                                        <div className="size-16 rounded-xl overflow-hidden shrink-0 bg-neutral-800 relative">
                                            {simImg ? (
                                                <img
                                                    src={getImageUrl(simImg, { preset: 'square' })}
                                                    alt={sim.trekName || 'Trek'}
                                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        handleImageErrorWithFallback(e, 100, 100, '#1A1B1D', sim.trekName || 'Trek');
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                                    🏔️
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <p className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#0ECCEE] transition-colors ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {sim.trekName || sim.title || 'Trek'}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                                                {formattedSimDate && <span>📅 {formattedSimDate}</span>}
                                                {simLocation && <span className="truncate">📍 {simLocation}</span>}
                                            </div>
                                            <div className="flex items-center justify-between mt-1.5">
                                                <span className="text-xs font-extrabold text-[#0ECCEE]">
                                                    {simFee != null && Number(simFee) > 0 ? `₹${Number(simFee).toLocaleString('en-IN')}` : 'Free'}
                                                </span>
                                                <span className="text-[11px] font-semibold text-gray-400 group-hover:translate-x-0.5 transition-transform flex items-center">
                                                    View →
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>



            {/* Gallery Lightbox modal */}
            {galleryOpen && galleryImages.length > 0 ? (
                <GalleryLightbox
                    images={galleryImages}
                    index={galleryIndex}
                    name={trekName}
                    onClose={() => setGalleryOpen(false)}
                    onIndexChange={setGalleryIndex}
                />
            ) : null}
        </div>
    );
}

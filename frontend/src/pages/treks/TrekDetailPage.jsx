import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight, Backpack } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { ScrollProgress, ScrollReveal } from '../../motion';
import { shareContent, openExternalUrl } from '../../utils/externalLink';
import Seo from '../../components/Seo';
import LazyMap from '../../components/LazyMap';
import DetailPageLoader from '../../components/DetailPageLoader';
import { breadcrumbSchema, eventSchema } from '../../utils/seo';
import { formatTrekDisplayDate, formatBatchDate, normalizeTrekBatches } from '../../utils/trekDateDisplay';
import { ScheduleMainMarker, ScheduleSubMarker } from '../../components/SchedulePointMarkers';
import { normalizeItineraryDay, SCHEDULE_SUB_INDENT_PX } from '../../utils/trekItinerary';
import { normalizeDetailBoxes, resolveTrekMapPin } from '../../utils/trekDetailBoxes';
import TrekDetailIcon from '../../components/TrekDetailIcon';
import { fetchTrekCommunity } from '../../services/api/public.api';
import { publicFetchJSONRetry } from '../../services/api/client';
import { trackBookNowClick } from '../../services/analyticsService';
import { trekPath, entityMatchesRouteParam } from '../../utils/slugRoutes';
import { resolveTrekHeroSlides, resolveTrekGalleryImages } from '../../utils/trekImages';
import {
    classifyDetailLoadError,
    createDetailCache,
    DETAIL_FETCH_OPTS,
} from '../../utils/detailPageLoad';

const trekDetailCache = createDetailCache('crwdctrl_trek_detail_v1_');
const GALLERY_PREVIEW_COUNT = 4;

function TrekGalleryLightbox({ images, index, name, onClose, onIndexChange }) {
    const current = images[index];
    if (!current) return null;
    return (
        <div
            className="fixed inset-0 z-80 bg-black/92 flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label="Gallery viewer"
            onClick={onClose}
        >
            <div className="flex items-center justify-between px-4 py-3" onClick={(e) => e.stopPropagation()}>
                <p className="text-white text-sm font-medium truncate">{name}</p>
                <button type="button" onClick={onClose} className="text-white/80 text-sm px-3 py-1.5 rounded-lg bg-white/10">
                    Close
                </button>
            </div>
            <div className="flex-1 flex items-center justify-center px-4" onClick={(e) => e.stopPropagation()}>
                <img
                    src={getImageUrl(current, { preset: 'detail' })}
                    alt=""
                    className="max-h-full max-w-full object-contain rounded-lg"
                />
            </div>
            {images.length > 1 ? (
                <div className="flex items-center justify-between px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm"
                        onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
                    >
                        Prev
                    </button>
                    <span className="text-white/70 text-xs tabular-nums">{index + 1} / {images.length}</span>
                    <button
                        type="button"
                        className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm"
                        onClick={() => onIndexChange((index + 1) % images.length)}
                    >
                        Next
                    </button>
                </div>
            ) : null}
        </div>
    );
}

function trekMatchesRouteParam(trek, routeParam) {
    return entityMatchesRouteParam(trek, routeParam, ['trekName', 'title']);
}

// ── Colorful SVG Icons (no background — work on both light & dark) ─────────────
function InfoRow({ label, value, isDark }) {
    return (
        <div className={`flex items-center justify-between py-2 border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
            <span className="text-sm text-gray-500">{label}</span>
            <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{value}</span>
        </div>
    );
}

// Hourglass — amber/orange for duration
const ClockIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 12 C9 9 6 7 6 4h12c0 3-3 5-6 8z" fill="#F59E0B" opacity="0.9"/>
        <path d="M12 12 C15 15 18 17 18 20H6c0-3 3-5 6-8z" fill="#D97706"/>
        <rect x="5" y="3" width="14" height="2" rx="1" fill="#FBBF24"/>
        <rect x="5" y="19" width="14" height="2" rx="1" fill="#B45309"/>
    </svg>
);

// Bar chart — green for difficulty
const ChartIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3"  y="14" width="4" height="7" rx="1.5" fill="#4ADE80"/>
        <rect x="10" y="9"  width="4" height="12" rx="1.5" fill="#22C55E"/>
        <rect x="17" y="4"  width="4" height="17" rx="1.5" fill="#16A34A"/>
    </svg>
);

// Compass — cyan/blue for trek style
const GridIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#0ECCEE" strokeWidth="1.5"/>
        <circle cx="12" cy="12" r="2" fill="#0ECCEE"/>
        <polygon points="12,3 14,10 12,12 10,10" fill="#0ECCEE" opacity="0.9"/>
        <polygon points="21,12 14,14 12,12 14,10" fill="#9CA3AF" opacity="0.7"/>
        <polygon points="12,21 10,14 12,12 14,14" fill="#9CA3AF" opacity="0.7"/>
        <polygon points="3,12 10,10 12,12 10,14" fill="#0ECCEE" opacity="0.6"/>
    </svg>
);

// People — teal for max participants
const PersonIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="9"  cy="6"  r="3"   fill="#2DD4BF"/>
        <path   d="M3 20 Q3 14 9 14 Q15 14 15 20" fill="#0D9488"/>
        <circle cx="17" cy="7"  r="2.5" fill="#5EEAD4" opacity="0.8"/>
        <path   d="M14 20 Q14 15.5 17 15.5 Q21 15.5 21 20" fill="#0D9488" opacity="0.7"/>
    </svg>
);

// Calendar — blue for trek date
const CalendarIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="5" width="18" height="16" rx="2" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5"/>
        <path d="M3 9h18" stroke="#3B82F6" strokeWidth="1.5"/>
        <path d="M8 3v4M16 3v4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round"/>
        <rect x="7" y="12" width="3" height="3" rx="0.5" fill="#3B82F6"/>
    </svg>
);

// Sun — yellow for departure time
const SunIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5" fill="#FCD34D"/>
        <circle cx="12" cy="12" r="3.5" fill="#FBBF24"/>
        {[0,45,90,135,180,225,270,315].map((deg,i) => {
            const r = 8.5, r2 = 10.5;
            const rad = deg * Math.PI / 180;
            return <line key={i} x1={12+r*Math.cos(rad)} y1={12+r*Math.sin(rad)} x2={12+r2*Math.cos(rad)} y2={12+r2*Math.sin(rad)} stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>;
        })}
    </svg>
);

// Checklist — green for inclusions
const ListIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#DCFCE7"/>
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round"/>
        <circle cx="19" cy="16" r="3.5" fill="#22C55E"/>
        <path d="M17.2 16l1 1.2 2-2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Document — amber for T&C
const UserCardIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="4" y="2" width="16" height="20" rx="3" fill="#FEF3C7"/>
        <rect x="4" y="2" width="16" height="20" rx="3" stroke="#F59E0B" strokeWidth="1.2"/>
        <path d="M8 8h8M8 11.5h8M8 15h5" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 2v5h6" fill="none" stroke="#F59E0B" strokeWidth="1.2"/>
    </svg>
);

// Moon — purple for return time
const MoonIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#A78BFA"/>
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#moon-grad)"/>
        <defs><linearGradient id="moon-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C4B5FD"/><stop offset="100%" stopColor="#7C3AED"/></linearGradient></defs>
    </svg>
);

// Map pin — red for location
const MapPinIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FCA5A5"/>
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="url(#pin-grad)"/>
        <circle cx="12" cy="9" r="3" fill="white" opacity="0.9"/>
        <defs><linearGradient id="pin-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171"/><stop offset="100%" stopColor="#DC2626"/></linearGradient></defs>
    </svg>
);

// Age — blue/indigo
const AgeIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.2"/>
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1D4ED8">18+</text>
    </svg>
);

// Heart-rate / fitness — red/pink
const FitnessIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M3 12h3l2-6 3 12 3-8 2 4h5" stroke="#F43F5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

// Clean list items from admin (one per line)
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

export default function TrekDetailPage() {
    const navigate  = useNavigate();
    const location  = useLocation();
    const { id }    = useParams();
    const { isDark } = useDarkMode();

    const seedFromNav = (raw) => {
        if (!raw) return null;
        return {
            ...raw,
            trekName:        raw.trekName || raw.title || 'Trek',
            trekDuration:    raw.trekDuration || raw.duration,
            difficultyLevel: raw.difficultyLevel || raw.difficulty,
            images:          raw.images?.length ? raw.images : raw.image ? [raw.image] : [],
            coverImage:      raw.coverImage || raw.image || raw.images?.[0] || null,
        };
    };

    const [trek,      setTrek]      = useState(null);
    const [genderRegistration, setGenderRegistration] = useState(null);
    const [community, setCommunity] = useState(null);
    const [loading,   setLoading]   = useState(true);
    const [loadError, setLoadError] = useState('');
    const [liked,     setLiked]     = useState(false);
    const [imgPg,     setImgPg]     = useState(0);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [activeTab, setActiveTab] = useState('Details');
    const [termsOpen, setTermsOpen] = useState(false);
    const [carryOpen, setCarryOpen] = useState(false);
    const [departuresOpen, setDeparturesOpen] = useState(false);
    const imgRef = useRef(null);
    const departuresRef = useRef(null);

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

        const seeded = trekMatchesRouteParam(navTrek, id) ? seedFromNav(navTrek) : null;
        const cached = trekDetailCache.read(trekId);
        const cacheOk = trekMatchesRouteParam(cached, id);
        const fallback = seeded || (cacheOk ? cached : null);

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
                if (!controller.signal.aborted) setLoading(false);
            });

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Always clear to loader when switching treks (do not paint previous trek under loading=false)
    const showPageLoader = loading || (trek && id && !trekMatchesRouteParam(trek, id));

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
            .catch(() => {});
        return () => controller.abort();
    }, [trek?.communityId]);

    useEffect(() => {
        if (!trek || !id) return;
        const canonical = trekPath(trek);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [trek, id, navigate, location.state]);

    if (showPageLoader) return <DetailPageLoader />;
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
                        className="px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold"
                    >
                        Retry
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => (isRetryable ? navigate('/treks') : navigate(-1))}
                    className="text-[#0ECCEE] text-sm font-semibold"
                >
                    {isNetwork ? 'Browse treks' : '← Go back'}
                </button>
            </div>
        );
    }

    const images    = (() => {
        const slides = resolveTrekHeroSlides(trek);
        return slides.length ? slides : [null];
    })();
    const coverImg  = images[0]
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
    // WhatsApp group link is only shown to registered users (My Bookings → View Details + email).
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
    const desc      = buildOverview();
    const shortDesc = desc.slice(0, 150);

    const handleShare = () => {
        shareContent({ title: trek.trekName, url: window.location.href });
    };

    const trekName = trek.trekName || trek.title || trek.name || 'Trek';
    const trekLocation = trek.meetingLocation || trek.startingPoint || trek.city || trek.destination || null;
    const mapPin = resolveTrekMapPin(trek);
    const canonicalPath = trekPath(trek);

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen pb-28">
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

            <div className="mx-auto w-full md:max-w-2xl flex flex-col flex-1">

            {/* ── HERO IMAGE ── */}
            <div className="relative w-full h-[396px] shrink-0 overflow-hidden">
                <div
                    ref={imgRef}
                    className="overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full h-full"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}
                    onScroll={e => { const p = Math.round(e.target.scrollLeft / e.target.clientWidth); setImgPg(prev => (prev === p ? prev : p)); }}
                >
                    <div className="flex h-full">
                        {images.map((img, i) => {
                            const raw = typeof img === 'string' ? img : (img?.url || img?.secure_url || '');
                            const src = getImageUrl(raw, { preset: 'communityBanner' }) || getImageUrl(raw) || raw || null;
                            return (
                            <div key={i} className="shrink-0 w-full h-full snap-start">
                                {src
                                    ? <img src={src} alt={trek.trekName} className="w-full h-full object-cover content-image"
                                        loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} decoding="async"
                                        onError={e => {
                                            if (raw && e.currentTarget.src !== raw) {
                                                e.currentTarget.src = raw;
                                                return;
                                            }
                                            handleImageErrorWithFallback(e, 393, 396, '#2A2B2E', trek.trekName);
                                        }} />
                                    : <div className="w-full h-full bg-[#1A1B1D]" />
                                }
                            </div>
                            );
                        })}
                    </div>
                </div>

                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

                {/* Back / Share / Heart */}
                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
                    style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
                >
                    <button onClick={() => navigate(-1)}
                        aria-label="Go back"
                        className="size-11 rounded-full bg-black/40 flex items-center justify-center">
                        <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button onClick={handleShare}
                            aria-label="Share"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center">
                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                        </button>
                        <button onClick={() => setLiked(l => !l)}
                            aria-label="Favourite"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center">
                            <Heart size={20} strokeWidth={2.25} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} />
                        </button>
                    </div>
                </div>

                {/* Dots */}
                {images.length > 1 && (
                    <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2 z-10">
                        {images.slice(0, 5).map((_, i) => (
                            <div key={i} className={`rounded-2xl transition-all duration-300
                                ${i === imgPg ? 'h-2.5 w-6 bg-white' : 'size-2.5 bg-transparent border-2 border-white/60'}`} />
                        ))}
                    </div>
                )}
            </div>

            {/* ── Sticky price + CTA bar (events-style floating pill) ── */}
        <div
            className="fixed bottom-0 left-0 right-0 z-40 px-2"
            style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
        >
            <div className={`mx-auto w-full max-w-md md:max-w-2xl flex items-center justify-between gap-4 rounded-[30px] px-5 py-3.5 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>

                {/* Price block — don't treat missing fee as Free (seed flash) */}
                <div className="min-w-0 shrink-0">
                    <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Registration Fee</p>
                    {trek.registrationFee == null ? (
                        <p className={`mt-0.5 text-2xl font-bold leading-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
                    ) : Number(trek.registrationFee) > 0 ? (
                        <p className={`mt-0.5 text-2xl font-bold leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            ₹{Number(trek.registrationFee).toLocaleString('en-IN')}
                        </p>
                    ) : (
                        <p className="mt-0.5 text-2xl font-bold leading-none text-green-500">Free</p>
                    )}
                </div>

                {/* CTA button — respects registration status, gender phase, then internal form / external link */}
                {(() => {
                    const regStatus = trek.registration?.status || 'open';
                    const extLink = trek.registration?.mode === 'external_link'
                        ? trek.registrationLink
                        : null;
                    if (regStatus === 'closed') {
                        return (
                            <button
                                disabled
                                className="flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-gray-600 text-gray-300 cursor-not-allowed"
                            >
                                Registration Closed
                            </button>
                        );
                    }
                    if (regStatus === 'not_open_yet') {
                        return (
                            <button
                                disabled
                                className="flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-gray-600 text-gray-300 cursor-not-allowed"
                            >
                                Registration Not Open Yet
                            </button>
                        );
                    }
                    return (
                        <button
                            onClick={() => {
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
                            }}
                            className="flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-[#0ECCEE] text-black active:opacity-90 transition"
                        >
                            Book Now
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m9 18 6-6-6-6"/>
                            </svg>
                        </button>
                    );
                })()}
            </div>
        </div>

        <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>

                {/* Trek name + community */}
                <ScrollReveal className="px-4 pt-5 pb-3">
                    <h1 className={`text-[26px] font-bold leading-8 wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {trek.trekName || trek.title || trek.name || ''}
                    </h1>
                    {communityName ? (
                        <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {communityName}
                        </p>
                    ) : null}
                </ScrollReveal>

                {/* Meta: details LEFT, map RIGHT — side by side */}
                <ScrollReveal className="px-4 flex items-start gap-3 mb-5" delay={0.05}>

                    {/* Left: 3 detail rows */}
                    <div className="flex-1 min-w-0 space-y-3.5">
                        {[
                            { Icon: ClockIcon,  label: 'Trek Duration',   value: trek.trekDuration || trek.duration || '—' },
                            { Icon: ChartIcon,  label: 'Difficulty',      value: (trek.difficultyLevel || trek.difficulty || '—'), extra: 'capitalize' },
                            { Icon: GridIcon,   label: 'Trek Category',      value: trek.trekCategory || '—', extra: 'capitalize' },
                            ...(formatTrekDisplayDate(trek) ? [{ Icon: CalendarIcon, label: 'Trek Date', value: formatTrekDisplayDate(trek) }] : []),
                        ].map((row) => (
                            <div key={row.label} className="flex items-center gap-2.5">
                                <row.Icon size={22} />
                                <div>
                                    <p className={`text-[15px] font-semibold leading-5 ${row.extra || ''} ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                    <p className={`text-[11px] font-medium leading-4 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Right: map pinned to meeting point */}
                    <div className="w-60 shrink-0 flex flex-col">
                        <div className="w-full h-[132px] rounded-2xl overflow-hidden relative">
                            {(mapPin.query || mapPin.mapUrl) ? (
                                <LazyMap
                                    query={mapPin.query}
                                    mapUrl={mapPin.mapUrl || undefined}
                                    isDark={isDark}
                                    title="trek-meeting-point"
                                />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center gap-1">
                                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                                        <circle cx="12" cy="9" r="2.5" fill="#9CA3AF"/>
                                    </svg>
                                    <span className="text-[10px] text-gray-400">No meeting point</span>
                                </div>
                            )}
                        </div>
                        {mapPin.caption ? (
                            <p className={`text-[11px] font-semibold text-center mt-1.5 leading-4 tracking-tight w-full line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                {mapPin.caption}
                            </p>
                        ) : null}
                    </div>
                </ScrollReveal>

                {/* ── Overview ── */}
                <ScrollReveal className="px-4 mb-5" delay={0.08}>
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Overview</h2>
                    <p className={`text-sm leading-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {overviewExpanded ? desc : shortDesc}
                        {desc.length > 150 && (
                            <>
                                {!overviewExpanded && '...'}
                                <button onClick={() => setOverviewExpanded(v => !v)}
                                    className="text-[#0ECCEE] text-sm font-medium ml-0.5">
                                    {overviewExpanded ? ' show less' : 'read more'}
                                </button>
                            </>
                        )}
                    </p>
                </ScrollReveal>

                {/* ── Gallery (separate from hero slider) ── */}
                {galleryImages.length > 0 ? (
                    <ScrollReveal className="px-4 mb-5" delay={0.09}>
                        <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Gallery
                        </h2>
                        <div className="grid grid-cols-4 gap-2.5">
                            {galleryImages.slice(0, GALLERY_PREVIEW_COUNT).map((img, i) => {
                                const isOverflowTile = galleryImages.length > GALLERY_PREVIEW_COUNT && i === GALLERY_PREVIEW_COUNT - 1;
                                const remainingCount = galleryImages.length - GALLERY_PREVIEW_COUNT;
                                return (
                                    <button
                                        key={`${img}-${i}`}
                                        type="button"
                                        onClick={() => {
                                            setGalleryIndex(i);
                                            setGalleryOpen(true);
                                        }}
                                        aria-label={isOverflowTile ? `View all ${galleryImages.length} gallery images` : `View gallery image ${i + 1}`}
                                        className={`relative w-full aspect-square rounded-2xl overflow-hidden active:scale-[0.98] transition-transform ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}
                                    >
                                        <img
                                            src={getImageUrl(img, { preset: 'square' })}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                            decoding="async"
                                            onError={(e) => handleImageErrorWithFallback(e, 120, 120, '#1a3a2a', trek.trekName)}
                                        />
                                        {isOverflowTile ? (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/55">
                                                <span className="text-white text-base font-semibold tracking-wide">
                                                    {remainingCount}+
                                                </span>
                                            </div>
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>
                    </ScrollReveal>
                ) : null}

                {/* ── Trek Info Tabs ── */}
                <ScrollReveal className="px-4 mb-5" delay={0.1}>
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Trek Info</h2>
                    <div className={`rounded-2xl p-1 mb-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                    <div className="flex rounded-xl p-1">
                        {['Details', 'Schedule', 'Inclusion', 'Exclusion'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200
                                    ${activeTab === tab
                                        ? isDark ? 'bg-[#1D1E20] text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
                                        : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#0ECCEE]" />
                                )}
                            </button>
                        ))}
                    </div>
                    </div>

                    {/* Tab content */}
                    <div>
                        {activeTab === 'Details' && (
                            <div className="space-y-2">
                                {(() => {
                                    const batches = normalizeTrekBatches(trek.trekBatches, trek.trekDate);
                                    const cardCls = `rounded-2xl p-2.5 pt-2 border ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`;
                                    const iconWrapCls = `size-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`;
                                    const departuresIconWrapCls = `size-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#0ECCEE]/15' : 'bg-[#0ECCEE]/10'}`;

                                    const batchSub = (batch) => {
                                        const parts = [];
                                        if (batch.batchSize > 0) parts.push(`${batch.batchSize} seats`);
                                        if (batch.timing) parts.push(batch.timing);
                                        if (batch.note) parts.push(batch.note);
                                        return parts.join(' · ');
                                    };
                                    const batchMeta = batchSub;

                                    const detailRows = normalizeDetailBoxes(trek.detailBoxes, trek).map((box) => ({
                                        show: true,
                                        icon: box.icon,
                                        label: box.label,
                                        value: box.value,
                                        id: box.id,
                                    }));

                                    const renderDetailCard = (row) => (
                                        <div key={row.id || row.label} className={`${cardCls} h-[84px] overflow-hidden`}>
                                            <div className={iconWrapCls}>
                                                <TrekDetailIcon icon={row.icon || 'default'} size={16} />
                                            </div>
                                            <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.label}</p>
                                            <p
                                                className={`text-sm font-semibold mt-0 leading-tight line-clamp-2 ${isDark ? 'text-white' : 'text-gray-900'}`}
                                                title={typeof row.value === 'string' ? row.value : undefined}
                                            >
                                                {row.value}
                                            </p>
                                        </div>
                                    );

                                    const beforeBatches = detailRows.slice(0, 3);
                                    const afterBatches = detailRows.slice(3);

                                    return (
                                        <div ref={batches.length > 1 ? departuresRef : undefined} className="grid grid-cols-2 gap-2">
                                            {beforeBatches.map(renderDetailCard)}

                                            {batches.length > 0 ? (
                                                batches.length > 1 ? (
                                                    <div className="min-w-0">
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeparturesOpen((o) => !o)}
                                                            aria-expanded={departuresOpen}
                                                            aria-label={departuresOpen ? 'Collapse departures' : 'Expand departures'}
                                                            className={`w-full text-left ${cardCls} h-[84px] overflow-hidden transition-colors duration-200 ${
                                                                departuresOpen
                                                                    ? isDark
                                                                        ? 'border-[#0ECCEE]/30 bg-[#1D1E20]/60'
                                                                        : 'border-[#0ECCEE]/25 bg-[#0ECCEE]/3'
                                                                    : isDark
                                                                        ? 'hover:bg-[#1D1E20]'
                                                                        : 'hover:bg-gray-50/90'
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className={departuresIconWrapCls}>
                                                                    <CalendarIcon size={16} />
                                                                </div>
                                                                <ChevronRight
                                                                    size={16}
                                                                    className={`shrink-0 mt-0.5 transition-transform duration-200 ${departuresOpen ? 'rotate-90 text-[#0ECCEE]' : isDark ? 'text-gray-500' : 'text-gray-400'}`}
                                                                />
                                                            </div>
                                                            <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Departures</p>
                                                            <p className={`text-sm font-semibold mt-0 leading-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                {departuresOpen
                                                                    ? `${batches.length} dates`
                                                                    : formatBatchDate(batches[0].date) || '—'}
                                                            </p>
                                                            {!departuresOpen ? (
                                                                <p className={`text-[10px] mt-1 ${isDark ? 'text-[#0ECCEE]/80' : 'text-[#0ECCEE]'}`}>
                                                                    +{batches.length - 1} more
                                                                </p>
                                                            ) : null}
                                                        </button>

                                                        {departuresOpen ? (
                                                            <div className={`mt-1 w-full rounded-xl border px-2.5 py-2 ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                                {batches.map((batch, i) => {
                                                                    const meta = batchMeta(batch);
                                                                    return (
                                                                        <p
                                                                            key={`${batch.date}-${i}`}
                                                                            className={`text-[11px] leading-4 py-1 ${i < batches.length - 1 ? `border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}` : ''} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                                                                        >
                                                                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                                {formatBatchDate(batch.date) || '—'}
                                                                            </span>
                                                                            {meta ? (
                                                                                <span className={isDark ? 'text-gray-500' : 'text-gray-500'}> · {meta}</span>
                                                                            ) : null}
                                                                        </p>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <div className={`${cardCls} h-[84px] overflow-hidden`}>
                                                        <div className={departuresIconWrapCls}>
                                                            <CalendarIcon size={16} />
                                                        </div>
                                                        <p className={`text-[11px] font-medium mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Departure</p>
                                                        <p className={`text-sm font-semibold mt-0 leading-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {formatBatchDate(batches[0].date) || '—'}
                                                        </p>
                                                        {batchSub(batches[0]) ? (
                                                            <p className={`text-[10px] mt-0.5 leading-tight line-clamp-1 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                                                {batchSub(batches[0])}
                                                            </p>
                                                        ) : null}
                                                    </div>
                                                )
                                            ) : null}

                                            {afterBatches.map(renderDetailCard)}
                                        </div>
                                    );
                                })()}

                                {trek.thingsToCarry?.length > 0 && (
                                    <div>
                                        <button
                                            onClick={() => setCarryOpen(o => !o)}
                                            className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${isDark ? 'bg-[#111213] border-white/5 hover:bg-[#1D1E20]' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'}`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-emerald-500/10'}`}>
                                                    <Backpack size={18} className="text-emerald-500" strokeWidth={2.25} />
                                                </div>
                                                <div className="text-left">
                                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Things to Carry</p>
                                                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{trek.thingsToCarry.length} items — tap to {carryOpen ? 'collapse' : 'view'}</p>
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className={`transition-transform duration-200 shrink-0 ${carryOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                        </button>
                                        {carryOpen && (
                                            <div className="mt-2">
                                                <TrekInfoList items={trek.thingsToCarry} isDark={isDark} dotClass="bg-emerald-500" />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'Schedule' && (
                            trek.itinerary?.length > 0
                                ? <div className="space-y-3">{trek.itinerary.map((day, i) => {
                                    const normalized = normalizeItineraryDay(day, i);
                                    const points = normalized.points.filter((p) => p.text);
                                    if (!normalized.title && !points.length) return null;
                                    return (
                                        <div key={i} className={`rounded-xl p-3 ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#0ECCEE] mb-0.5">Day {normalized.day || i + 1}</p>
                                            {normalized.title ? (
                                                <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>{normalized.title}</p>
                                            ) : null}
                                            {points.length > 0 ? (
                                                <ul className={`${normalized.title ? 'mt-1.5' : ''}`}>
                                                    {points.map((point, j) => {
                                                        const isSub = point.level === 'sub';
                                                        const prev = j > 0 ? points[j - 1] : null;
                                                        const isNewMainBlock = !isSub && j > 0 && prev?.level === 'main';
                                                        const isMainAfterSubs = !isSub && j > 0 && prev?.level === 'sub';

                                                        if (isSub) {
                                                            return (
                                                                <li
                                                                    key={j}
                                                                    className={`flex gap-2 text-xs leading-relaxed ${isDark ? 'text-gray-500' : 'text-gray-600'}`}
                                                                    style={{ paddingLeft: `${SCHEDULE_SUB_INDENT_PX}px` }}
                                                                >
                                                                    <ScheduleSubMarker isDark={isDark} />
                                                                    <span>{point.text}</span>
                                                                </li>
                                                            );
                                                        }

                                                        return (
                                                            <li
                                                                key={j}
                                                                className={`flex gap-2 text-xs leading-relaxed ${isNewMainBlock || isMainAfterSubs ? 'mt-2' : ''} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                                                            >
                                                                <ScheduleMainMarker />
                                                                <span className="font-medium">{point.text}</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            ) : null}
                                        </div>
                                    );
                                })}</div>
                                : <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No schedule added yet.</p>
                        )}
                        {activeTab === 'Inclusion' && (
                            trek.inclusions?.length > 0
                                ? <TrekInfoList items={trek.inclusions} isDark={isDark} dotClass="bg-green-400" />
                                : <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No inclusions listed.</p>
                        )}
                        {activeTab === 'Exclusion' && (
                            trek.exclusions?.length > 0
                                ? <TrekInfoList items={trek.exclusions} isDark={isDark} dotClass="bg-red-400" />
                                : <p className={`text-sm ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No exclusions listed.</p>
                        )}
                    </div>
                </ScrollReveal>

                {/* ── Terms & Conditions ── */}
                {(() => {
                    const terms = (trek.termsAndConditions || []).map(cleanListItem).filter(Boolean);
                    if (!terms.length) return null;
                    return (
                        <div className="px-4 mb-6">
                            <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Terms &amp; Conditions</h2>
                            <button
                                onClick={() => setTermsOpen(o => !o)}
                                className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${isDark ? 'bg-[#111213] border-white/5 hover:bg-[#1D1E20]' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-amber-50'}`}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#FCD34D' : '#D97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                            <polyline points="14 2 14 8 20 8"/>
                                            <line x1="16" y1="13" x2="8" y2="13"/>
                                            <line x1="16" y1="17" x2="8" y2="17"/>
                                            <polyline points="10 9 9 9 8 9"/>
                                        </svg>
                                    </div>
                                    <div className="text-left">
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Terms &amp; Conditions</p>
                                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{terms.length} points — tap to {termsOpen ? 'collapse' : 'read'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className={`transition-transform duration-200 shrink-0 ${termsOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                            </button>
                            {termsOpen && (
                                <div className={`mt-2 rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    {terms.map((term, i) => (
                                        <div key={i} className={`flex gap-3 px-4 py-3 ${i < terms.length - 1 ? `border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}>
                                            <span className={`text-xs font-bold mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-amber-50 text-amber-600'}`}>{i + 1}</span>
                                            <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{term}</p>
                                        </div>
                                    ))}
                                    <div className={`px-4 py-3 ${isDark ? 'bg-[#1D1E20]/50' : 'bg-amber-50/60'}`}>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>
                                            ⚠️ By registering, you agree to all the above terms.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {/* ── Contact Details ── */}
                <div className="px-4 pb-28">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
                    <div className="space-y-2.5">
                        {/* Phone */}
                        {(() => {
                            const phone = community?.contactPhone || trek.emergencyContact;
                            return (
                                <a href={phone ? `tel:${phone}` : undefined}
                                    className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Phone</p>
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{phone || 'Not set'}</p>
                                    </div>
                                </a>
                            );
                        })()}
                        {/* Instagram */}
                        {(() => {
                            const insta = community?.contactInstagram || trek.contactInstagram;
                            return (
                                <a href={insta ? `https://instagram.com/${insta.replace('@','')}` : undefined}
                                    target={insta ? '_blank' : undefined} rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className="size-10 rounded-xl flex items-center justify-center shrink-0"
                                        style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #7C3AED 100%)' }}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                                        </svg>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Instagram</p>
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{insta || 'Not set'}</p>
                                    </div>
                                </a>
                            );
                        })()}
                        {/* People to contact (per-trek) */}
                        {(Array.isArray(trek.contacts) ? trek.contacts : [])
                            .filter(c => c && (c.name || c.role || c.phone))
                            .map((c, i) => (
                                <a key={`${c.phone || c.name}-${i}`} href={c.phone ? `tel:${c.phone}` : undefined}
                                    className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {c.name || 'Contact'}{c.role ? ` · ${c.role}` : ''}
                                        </p>
                                        <p className={`text-sm font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{c.phone || 'Not set'}</p>
                                    </div>
                                </a>
                            ))}
                    </div>
                </div>
            </div>
            </div>

            {galleryOpen && galleryImages.length > 0 ? (
                <TrekGalleryLightbox
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

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight, ChevronDown, Check, Hourglass, MapPin, Phone, Instagram, ExternalLink } from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { getImageUrl } from '../../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { ScrollProgress, ScrollReveal } from '../../../motion';
import Seo from '../../../components/Seo';
import LazyMap from '../../../components/LazyMap';
import TrekDetailIcon from '../../../components/TrekDetailIcon';
import DetailPageLoader from '../../../components/DetailPageLoader';
import OrganizersStorySlider from '../../../components/OrganizersStorySlider';
import GalleryLightbox from '../../../components/GalleryLightbox';
import { breadcrumbSchema, eventSchema, toOgShareImageUrl } from '../../../utils/seo';
import { shareContent } from '../../../utils/externalLink';
import { sportRunPath, entityMatchesRouteParam, runClubPath } from '../../../utils/slugRoutes';
import { normalizeRunDetailBoxes, resolveRunMapPin } from '../../../utils/trekDetailBoxes';
import { resolveRunContacts, instagramHandle } from '../../../utils/runContacts';
import { getSportsTiers, isTiersPricing, minSportsFee, formatInr, hasPricingSnapshot, sportsOriginalFee } from '../../../utils/sportsTiers';
import { getSuggestedCouponCode, getSuggestedCouponLabel } from '../../../utils/suggestedCoupon';
import { groupTermsAndConditions } from '../../../utils/termsAndConditions';
import { useInAppBack } from '../../../hooks/useInAppBack';
import { resolveAuthToken, getBearerAuthHeaders } from '../../../utils/authToken';
import { resolveCoverImage, primaryCoverUrl } from '../../../utils/coverImages';

import { publicFetchJSONRetry } from '../../../services/api/client';
import { fetchCatalogJSON } from '../../../services/api/catalogCache';
import { DETAIL_FETCH_OPTS, classifyDetailLoadError } from '../../../utils/detailPageLoad';
import { trackBookNowClick } from '../../../services/analyticsService';
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import { signalDetailPageReady } from '../../../utils/bootSplash';

const RUN_DETAIL_CACHE_PREFIX = 'crwdctrl_run_detail_v2_';
const readRunDetailCache = (key) => {
    try {
        const raw = sessionStorage.getItem(`${RUN_DETAIL_CACHE_PREFIX}${key}`);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};
const writeRunDetailCache = (key, event) => {
    try {
        if (key && event) sessionStorage.setItem(`${RUN_DETAIL_CACHE_PREFIX}${key}`, JSON.stringify(event));
    } catch { /* storage full */ }
};

const SKILL_LABELS = {
    all: 'All Levels',
    beginner: 'Beginner',
    intermediate: 'Moderate',
    advanced: 'Advanced',
};

function seedEventFromNav(navEvent) {
    if (!navEvent) return null;
    return navEvent;
}

function pickRunFallback(seeded, cachedEvent, routeParam) {
    const seedOk = entityMatchesRouteParam(seeded, routeParam, ['title', 'name']);
    const cacheOk = entityMatchesRouteParam(cachedEvent, routeParam, ['title', 'name']);
    if (seedOk && hasPricingSnapshot(seeded)) return seeded;
    if (cacheOk && hasPricingSnapshot(cachedEvent)) return cachedEvent;
    // Prefer richer cache over a thin title/image stub
    if (cacheOk && cachedEvent && !hasPricingSnapshot(seeded)) return cachedEvent;
    return null;
}

const ClockIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 12 C9 9 6 7 6 4h12c0 3-3 5-6 8z" fill="#F59E0B" opacity="0.9" />
        <path d="M12 12 C15 15 18 17 18 20H6c0-3 3-5 6-8z" fill="#D97706" />
        <rect x="5" y="3" width="14" height="2" rx="1" fill="#FBBF24" />
        <rect x="5" y="19" width="14" height="2" rx="1" fill="#B45309" />
    </svg>
);

const ChartIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="14" width="4" height="7" rx="1.5" fill="#4ADE80" />
        <rect x="10" y="9" width="4" height="12" rx="1.5" fill="#22C55E" />
        <rect x="17" y="4" width="4" height="17" rx="1.5" fill="#16A34A" />
    </svg>
);

const GridIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#0ECCEE" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" fill="#0ECCEE" />
        <polygon points="12,3 14,10 12,12 10,10" fill="#0ECCEE" opacity="0.9" />
    </svg>
);

function deduplicateRunDetailCards(cards) {
    if (!cards || cards.length === 0) return [];
    const seenTimes = new Set();
    const seenLabels = new Set();
    const seenFitness = new Set();

    return cards.filter((card) => {
        const rawLabel = String(card?.label || '').trim();
        const rawVal = String(card?.value || '').trim();
        if (!rawLabel || !rawVal) return false;

        const lLow = rawLabel.toLowerCase();
        const vLow = rawVal.toLowerCase();

        if (seenLabels.has(lLow)) return false;

        if (/timing|time|start|depart|reporting/i.test(lLow)) {
            const cleanVal = vLow.replace(/[^a-z0-9]/g, '');
            if (seenTimes.has(cleanVal)) return false;
            seenTimes.add(cleanVal);
        }

        if (/fitness|skill|level/i.test(lLow)) {
            if (seenFitness.size > 0) return false;
            seenFitness.add(vLow);
        }

        if (lLow === 'fitness level' && (vLow === 'all' || vLow === 'all levels')) {
            if (seenFitness.size > 0) return false;
            seenFitness.add(vLow);
        }

        if (/meeting point/i.test(lLow)) {
            const venueCard = cards.find((c) => /venue|location/i.test(c?.label || ''));
            if (venueCard && String(venueCard.value || '').trim().toLowerCase() === vLow) {
                return false;
            }
        }

        if (lLow === 'city') {
            const venueCard = cards.find((c) => /venue|location/i.test(c?.label || ''));
            if (venueCard && String(venueCard.value || '').toLowerCase().includes(vLow)) {
                return false;
            }
        }

        seenLabels.add(lLow);
        return true;
    });
}

export default function RunEventDetailPage() {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();
    const { token: authToken } = useAuth();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [userRegistration, setUserRegistration] = useState(null);
    const [liked, setLiked] = useState(false);
    const [imgPg, setImgPg] = useState(0);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [activeRunTab, setActiveRunTab] = useState('Details');
    const [openInfo, setOpenInfo] = useState(null);
    const [termsOpen, setTermsOpen] = useState(false);
    const [heroLoaded, setHeroLoaded] = useState(false);
    const [tierSheetOpen, setTierSheetOpen] = useState(false);
    const [expandedTierId, setExpandedTierId] = useState(null);
    const [selectingTierId, setSelectingTierId] = useState(null);
    const [similarEvents, setSimilarEvents] = useState([]);
    const [galleryOpen, setGalleryOpen] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const imgRef = useRef(null);

    useEffect(() => {
        let active = true;
        fetchCatalogJSON('/sports')
            .then((res) => {
                if (!active) return;
                const list = Array.isArray(res?.data?.events) ? res.data.events : [];
                const currentId = String(event?._id || event?.id || id || '');
                const currentTitle = String(event?.title || event?.name || '').trim().toLowerCase();
                const others = list.filter((item) => {
                    const itemId = String(item._id || item.id || '');
                    const itemTitle = String(item.title || item.name || '').trim().toLowerCase();
                    return itemId !== currentId && item.slug !== id && itemTitle !== currentTitle;
                });
                setSimilarEvents(others.slice(0, 3));
            })
            .catch(() => { });
        return () => { active = false; };
    }, [id, event?._id, event?.id, event?.title]);

    useEffect(() => {
        if (!tierSheetOpen) return undefined;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [tierSheetOpen]);

    useEffect(() => {
        const eventId = id || location.state?.event?._id || location.state?.event?.id;
        if (!eventId) {
            setEvent(null);
            setLoadError('');
            setLoading(false);
            return undefined;
        }

        const seeded = seedEventFromNav(location.state?.event);
        const cachedByParam = readRunDetailCache(eventId);
        const cachedById = seeded?._id || seeded?.id
            ? readRunDetailCache(String(seeded._id || seeded.id))
            : null;
        const cachedEvent = cachedByParam || cachedById;
        const fallback = pickRunFallback(seeded, cachedEvent, id);

        // Paint seed/cache immediately so deep links / hub → detail do not wait on API
        if (fallback) {
            setEvent(fallback);
            setLoading(false);
            setLoadError('');
        } else {
            setEvent(null);
            setLoadError('');
            setLoading(true);
        }

        setImgPg(0);
        setOverviewExpanded(false);
        setActiveRunTab('Details');
        setOpenInfo(null);
        setTermsOpen(false);
        setTierSheetOpen(false);

        const controller = new AbortController();
        publicFetchJSONRetry(`/sports/${encodeURIComponent(eventId)}`, {
            signal: controller.signal,
            ...DETAIL_FETCH_OPTS,
            headers: getBearerAuthHeaders(resolveAuthToken(authToken)),
        })
            .then((res) => {
                if (controller.signal.aborted) return;
                const d = res?.data;
                if (d?.event) {
                    setEvent(d.event);
                    writeRunDetailCache(eventId, d.event);
                    if (d.event._id) writeRunDetailCache(String(d.event._id), d.event);
                    if (d.event.slug) writeRunDetailCache(String(d.event.slug), d.event);
                    (d.event.previousSlugs || []).forEach((s) => {
                        if (s) writeRunDetailCache(String(s), d.event);
                    });
                    setLoadError('');
                } else if (fallback) {
                    setEvent(fallback);
                    setLoadError('');
                } else {
                    setEvent(null);
                    setLoadError('not_found');
                }
                const ur = d?.userRegistration;
                if (ur?.registrationId) {
                    setUserRegistration({
                        registrationId: String(ur.registrationId),
                        status: ur.status || 'confirmed',
                    });
                } else {
                    setUserRegistration(null);
                }
            })
            .catch((err) => {
                if (controller.signal.aborted) return;
                if (fallback) {
                    setEvent(fallback);
                    setLoadError('');
                    return;
                }
                setEvent(null);
                setLoadError(classifyDetailLoadError(err));
            })
            .finally(() => {
                // Always clear — abort+skip left StrictMode remounts stuck on “Loading run”
                setLoading(false);
            });
        return () => controller.abort();

    }, [id]);

    useEffect(() => {
        if (!event || !id) return;
        if (!entityMatchesRouteParam(event, id, ['title', 'name'])) return;
        const canonical = sportRunPath(event);
        if (!canonical || location.pathname === canonical) return;
        navigate(`${canonical}${location.search || ''}`, {
            replace: true,
            state: location.state?.event ? { event: location.state.event } : undefined,
        });
    }, [event, id, navigate, location.pathname, location.search]);

    const showPageLoader = (loading && !event)
        || (Boolean(event) && Boolean(id) && !entityMatchesRouteParam(event, id, ['title', 'name']));

    useDetailLoaderFailsafe(showPageLoader, () => {
        setLoading(false);
        if (!event) setLoadError((prev) => prev || 'network');
    });

    useEffect(() => {
        if (!showPageLoader && event) signalDetailPageReady();
    }, [showPageLoader, event]);

    if (showPageLoader) {
        return <DetailPageLoader label="Loading run" variant="run" />;
    }

    if (!event) {
        const isNotFound = loadError === 'not_found';
        const isRetryable = !isNotFound;
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isRetryable ? "Couldn't load this run" : 'This run is no longer available'}
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
                    onClick={() => (isRetryable ? navigate('/sports') : goBack())}
                    className="text-[#0ECCEE] text-sm font-semibold"
                >
                    {isRetryable ? 'Browse sports' : '← Go back'}
                </button>
            </div>
        );
    }

    const club = event.runClub || null;
    const coverImg = resolveCoverImage(event, 'hero') || event.coverImage || null;
    const shareRaw =
        resolveCoverImage(event, 'cardPortrait')
        || primaryCoverUrl(event.coverImages || {}, event.coverImage)
        || coverImg;
    const shareImage = toOgShareImageUrl(shareRaw, { contain: true, portrait: true });
    // Gallery uploads only — strip any card/cover URLs that leaked into images[]
    const coverSlots = event.coverImages || {};
    const coverSet = new Set(
        [coverImg, coverSlots.portrait, coverSlots.wide, coverSlots.hero, coverSlots.square, coverSlots.landscape, coverSlots.video]
            .filter(Boolean),
    );
    const galleryImages = (event.images || []).filter((u) => u && !coverSet.has(u));
    // Lead with the event poster, then community gallery shots
    const posterUrl = coverSlots.portrait || coverSlots.page || coverImg || null;
    const images = galleryImages.length
        ? (posterUrl ? [posterUrl, ...galleryImages.filter((u) => u !== posterUrl)] : galleryImages)
        : (posterUrl ? [posterUrl] : [null]);
    const communityName = club?.name || event.organizer || '';
    const contactPhone = club?.contactPhone || event.emergencyContact || event.phone || null;
    const contactInsta = club?.contactInstagram || event.contactInstagram || event.instagram || null;
    const instaHandle = contactInsta ? String(contactInsta).replace('@', '').trim() : '';
    const mapPin = resolveRunMapPin(event);
    const mapQuery = mapPin.query;
    const mapUrl = mapPin.mapUrl;
    const mapCaption = mapPin.caption;
    const locationText = event.venue || event.location || event.meetingPoint || mapCaption || mapQuery || event.city || event.runClub?.basedIn || '';
    const desc =
        event.description?.trim() ||
        `${event.title || 'This run'} is hosted by ${communityName}. Join fellow runners for a great session.`;
    const shortDesc = desc.slice(0, 150);
    const terms = event.termsAndConditions?.length
        ? event.termsAndConditions
        : [
            'Participants must be medically fit for the scheduled run distance.',
            'Follow all safety instructions from run leaders at all times.',
            'Cancellation policy varies by organiser — contact the club for details.',
            'The organiser reserves the right to modify or cancel due to weather or safety.',
        ];
    const termSections = groupTermsAndConditions(terms);

    const handleShare = () => {
        shareContent({ title: event.title, url: window.location.href });
    };

    const canonicalPath = sportRunPath(event || { id });

    const eventDateObj = (event.eventDate || event.date) ? new Date(event.eventDate || event.date) : null;
    const formattedDate = eventDateObj && !isNaN(eventDateObj.getTime())
        ? eventDateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        : '';

    const detailCards = normalizeRunDetailBoxes(event.detailBoxes, event);

    // Clean & deduplicate detail cards (e.g. duplicate times, generic fitness, redundant venue/city)
    const cleanDetailCards = deduplicateRunDetailCards(detailCards);

    const eventTime = event.reportingTime || event.time || event.startTime || event.departureTime || (
        detailCards.find((b) => /timing|time|start|depart/i.test(b?.label || ''))?.value
    ) || '';

    const distanceVal = (
        detailCards.find((b) => /distance|route|km/i.test(b?.label || ''))?.value
    ) || event.distance || '';

    const inclusions = event.inclusions || [];
    const infoSections = event.infoSections || [];

    const handleBookNow = () => {
        trackBookNowClick(event);
        const extLink = event.registration?.mode === 'external_link' ? event.registrationLink : null;
        const tiers = getSportsTiers(event);
        if (extLink) {
            window.open(extLink, '_blank', 'noopener,noreferrer');
            return;
        }
        if (tiers.length) {
            setExpandedTierId(null);
            setSelectingTierId(null);
            setTierSheetOpen(true);
            return;
        }
        navigate(`${sportRunPath(event)}/book`, { state: { event, runClub: club } });
    };

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <ScrollProgress color="#0ECCEE" />
            <Seo
                title={event.title || 'Run Event'}
                description={desc}
                canonical={canonicalPath}
                image={shareImage}
                type="article"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Sports', path: '/sports' },
                        { name: event.title || 'Run Event', path: canonicalPath },
                    ]),
                    eventSchema({
                        name: event.title || 'Run Event',
                        description: desc,
                        url: canonicalPath,
                        image: shareImage,
                        location: mapQuery || undefined,
                        price: minSportsFee(event),
                        organizerName: communityName || undefined,
                        availabilityUrl: `${canonicalPath}/book`,
                    }),
                ]}
            />
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-2.5 lg:py-3.5 pb-16 sm:pb-24 flex flex-col flex-1 gap-2.5 sm:gap-3">

                {/* TOP HEADER ROW: Title + Share/Favorite Action Icons */}
                <div className="flex items-center justify-between gap-4">
                    <h1 className={`text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title || 'Run Event'}
                    </h1>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label="Share"
                            className={`size-9 rounded-full flex items-center justify-center border transition cursor-pointer ${isDark ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                                }`}
                        >
                            <Share2 size={16} strokeWidth={2} />
                        </button>
                        <button
                            type="button"
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className={`size-9 rounded-full flex items-center justify-center border transition cursor-pointer ${isDark ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                                }`}
                        >
                            <Heart size={16} strokeWidth={2} className={liked ? 'fill-red-500 text-red-500' : ''} />
                        </button>
                    </div>
                </div>

                {/* HERO SPLIT SECTION: Left Media Carousel & Right Book Now Card (Equal Height) */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-start">

                    {/* LEFT COLUMN (md:col-span-7): Media Slider with floating tag pills */}
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
                                    {images.map((img, i) => (
                                        <div key={i} className="shrink-0 w-full h-full snap-start relative">
                                            {img ? (
                                                <>
                                                    {!heroLoaded && i === 0 && (
                                                        <div aria-hidden className="absolute inset-0 bg-[#1A1B1D]" />
                                                    )}
                                                    <img
                                                        src={getImageUrl(img, { preset: 'eventHeroFit' })}
                                                        alt={event.title}
                                                        className={`w-full h-full object-cover object-center ${i === 0 && !heroLoaded ? 'opacity-0' : 'opacity-100'
                                                            }`}
                                                        loading={i === 0 ? 'eager' : 'lazy'}
                                                        fetchPriority={i === 0 ? 'high' : 'auto'}
                                                        decoding="async"
                                                        onLoad={() => { if (i === 0) setHeroLoaded(true); }}
                                                        onError={(e) => {
                                                            if (i === 0) setHeroLoaded(true);
                                                            handleImageErrorWithFallback(e, 800, 440, '#1A1B1D', event.title);
                                                        }}
                                                    />
                                                </>
                                            ) : (
                                                <div className="w-full h-full bg-[#1A1B1D]" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Slider Navigation Controls (< >) */}
                            {images.length > 1 && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imgRef.current) imgRef.current.scrollBy({ left: -imgRef.current.clientWidth, behavior: 'smooth' });
                                        }}
                                        className="absolute left-3 top-1/2 -translate-y-1/2 size-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition z-20 backdrop-blur-xs cursor-pointer text-lg font-bold"
                                        aria-label="Previous image"
                                    >
                                        ‹
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (imgRef.current) imgRef.current.scrollBy({ left: imgRef.current.clientWidth, behavior: 'smooth' });
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

                    {/* RIGHT COLUMN (md:col-span-5): Equal-height Event Summary & Book Now Card */}
                    <div className="md:col-span-5 flex flex-col">
                        <div className={`w-full h-[260px] sm:h-[275px] md:h-[280px] rounded-3xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between ${isDark ? 'bg-[#111213] border-white/10 shadow-xl' : 'bg-white border-gray-200 shadow-md'
                            }`}>
                            {/* Card Details Top Section */}
                            <div className="space-y-2.5">
                                {/* Date & Time + Status Chip */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-amber-400' : 'bg-amber-50 text-amber-600'
                                            }`}>
                                            <Hourglass size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {formattedDate || 'Date TBA'}
                                            </p>
                                            {eventTime ? (
                                                <p className={`text-[11px] font-medium leading-none mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {eventTime}
                                                </p>
                                            ) : null}
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
                                        <p className={`text-xs sm:text-sm font-semibold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`} title={locationText}>
                                            {locationText || 'Location TBA'}
                                        </p>
                                    </div>

                                    {mapUrl ? (
                                        <a
                                            href={mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="size-7 rounded-lg flex items-center justify-center text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0 cursor-pointer transition border border-[#0ECCEE]/20"
                                            title="Open in Maps"
                                        >
                                            <ExternalLink size={13} />
                                        </a>
                                    ) : null}
                                </div>

                                {/* Event Key Chips: Distance, Skill, Category */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                    {distanceVal ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            🏃 {distanceVal}
                                        </span>
                                    ) : null}
                                    {event.skillLevel ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            🎯 {SKILL_LABELS[event.skillLevel] || event.skillLevel}
                                        </span>
                                    ) : null}
                                    {event.eventType ? (
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                            ⚡ {event.eventType}
                                        </span>
                                    ) : null}
                                </div>

                                {/* Compact Organizer Contact Row */}
                                {(communityName || contactPhone || instaHandle) && (
                                    <div className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="min-w-0 flex items-center gap-1.5">
                                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0ECCEE]">BY</span>
                                            <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {communityName || 'Organizer'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {contactPhone && (
                                                <a
                                                    href={`tel:${contactPhone}`}
                                                    className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-[#0ECCEE]' : 'bg-white text-gray-700 hover:text-[#0ECCEE] shadow-xs'}`}
                                                    title={`Call ${contactPhone}`}
                                                >
                                                    <Phone size={13} />
                                                </a>
                                            )}
                                            {instaHandle && (
                                                <a
                                                    href={`https://instagram.com/${instaHandle}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-pink-400' : 'bg-white text-gray-700 hover:text-pink-500 shadow-xs'}`}
                                                    title={`Instagram @${instaHandle}`}
                                                >
                                                    <Instagram size={13} />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Divider & Price / Book Now Row */}
                            <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between gap-3`}>
                                <div>
                                    {(() => {
                                        const fromFee = minSportsFee(event);
                                        if (fromFee > 0) {
                                            return (
                                                <div>
                                                    <div className="flex items-baseline gap-1">
                                                        <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                            {formatInr(fromFee)}
                                                        </span>
                                                        <span className={`text-[11px] font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                            onwards
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] font-semibold text-emerald-400">Verified Pricing</p>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div>
                                                <p className="text-xl sm:text-2xl font-black text-emerald-400">Free</p>
                                                <p className="text-[10px] font-semibold text-emerald-400">Instant Entry</p>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleBookNow}
                                    className="px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-extrabold shadow-lg bg-[#0ECCEE] text-black hover:bg-[#0cb8d6] active:scale-[0.98] transition cursor-pointer shrink-0"
                                >
                                    Book Now
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full-width About / Description Card */}
                {desc && (
                    <div className={`w-full rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <h2 className={`text-sm sm:text-base font-bold leading-snug mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            About This Event
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

                {/* DETAILS & MAP BALANCED SECTION (High-density space-efficient layout) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start mt-0.5">

                    {/* LEFT COLUMN (lg:col-span-7): Run Facts, Inclusions & Info Sections */}
                    <div className="lg:col-span-7 flex flex-col gap-3.5">
                        {(detailCards.length > 0 || inclusions.length > 0 || infoSections.length > 0) && (
                            <div className={`rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-3.5">
                                    <h2 className={`text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        Run Info
                                    </h2>

                                    {/* Tabs */}
                                    <div className={`flex rounded-xl p-1 gap-1 ${isDark ? 'bg-[#1A1B1D]' : 'bg-gray-100'}`}>
                                        {['Details', 'Included'].map((tab) => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setActiveRunTab(tab)}
                                                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${activeRunTab === tab
                                                        ? isDark ? 'bg-[#252629] text-[#0ECCEE] shadow-xs' : 'bg-white text-gray-900 shadow-xs'
                                                        : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                                                    }`}
                                            >
                                                {tab === 'Included' ? `Included (${inclusions.length})` : tab}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {activeRunTab === 'Details' && (
                                    <div className="space-y-3">
                                        {/* Compact Quick Facts Grid */}
                                        {cleanDetailCards.length > 0 ? (
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                {cleanDetailCards.map((row, idx) => (
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
                                            <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No specific details listed.</p>
                                        )}
                                    </div>
                                )}

                                {activeRunTab === 'Included' && (
                                    inclusions.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {inclusions.map((item, i) => (
                                                <div
                                                    key={i}
                                                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5 text-gray-200' : 'bg-gray-50 border-gray-100 text-gray-800'
                                                        }`}
                                                >
                                                    <span className="size-5 rounded-md bg-[#0ECCEE]/15 text-[#0ECCEE] flex items-center justify-center shrink-0">
                                                        <Check size={11} strokeWidth={3} />
                                                    </span>
                                                    <span className="text-xs font-semibold leading-snug truncate">
                                                        {String(item).replace(/^[-*•\s]+/, '')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No experience inclusions listed.</p>
                                    )
                                )}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN (lg:col-span-5): Route Map & Gallery */}
                    <div className="lg:col-span-5 flex flex-col gap-2.5 sm:gap-3">
                        {/* Map Card */}
                        {(mapQuery || mapUrl) && (
                            <div className={`rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={16} className="text-[#0ECCEE]" />
                                        <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            Location &amp; Route Map
                                        </p>
                                    </div>
                                    {mapUrl ? (
                                        <a
                                            href={mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs font-bold text-[#0ECCEE] hover:underline flex items-center gap-1 cursor-pointer"
                                        >
                                            Directions <ExternalLink size={12} />
                                        </a>
                                    ) : null}
                                </div>
                                <div className="w-full h-[145px] sm:h-[155px] rounded-2xl overflow-hidden relative border border-white/5">
                                    <LazyMap query={mapQuery} mapUrl={mapUrl || undefined} isDark={isDark} title="Run Location Map" />
                                </div>
                                {mapCaption && (
                                    <p className={`text-xs mt-2 font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        📍 {mapCaption}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Event Gallery Preview Card */}
                        {galleryImages.length > 0 && (
                            <div className={`rounded-3xl border overflow-hidden p-3 sm:p-3.5 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                        Event Gallery
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
                                                onClick={() => {
                                                    setGalleryIndex(i);
                                                    setGalleryOpen(true);
                                                }}
                                                className="relative h-[65px] sm:h-[75px] rounded-xl overflow-hidden border border-white/5 cursor-pointer hover:opacity-90 transition group text-left"
                                            >
                                                <img src={getImageUrl(img, { preset: 'square' })} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
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

                {/* FULL-WIDTH EXPANDABLE SECTION (Terms & Custom Info across navbar length) */}
                <div className="flex flex-col gap-3.5 w-full mt-1">

                    {/* Full-width Custom Info Sections (e.g. Highlights, Guidelines) */}
                    {Array.isArray(infoSections) && infoSections.length > 0 && infoSections.map((section, i) => {
                        const isOpen = openInfo === i;
                        return (
                            <div
                                key={`full-info-${i}`}
                                className={`w-full rounded-3xl border overflow-hidden transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'
                                    }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenInfo(isOpen ? null : i)}
                                    className="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-cyan-50 text-cyan-600'
                                            }`}>
                                            <TrekDetailIcon icon="default" size={16} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs sm:text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {section.title || `Section ${i + 1}`}
                                            </p>
                                            <p className={`text-[10px] sm:text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                Tap to {isOpen ? 'collapse' : 'view details'}
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronRight
                                        size={18}
                                        className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'
                                            }`}
                                    />
                                </button>
                                {isOpen && section.details && (
                                    <div className={`px-4 sm:px-5 pb-4 pt-1 border-t text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${isDark ? 'border-white/5 text-gray-300' : 'border-gray-200 text-gray-700'
                                        }`}>
                                        {section.details}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Full-width Terms & Participation Policy Card */}
                    {termSections.length > 0 && (
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
                                        <p className={`text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {termSections.length} Policy Points · Tap to {termsOpen ? 'collapse' : 'view'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight
                                    size={18}
                                    className={`transition-transform duration-200 shrink-0 ${termsOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                                />
                            </button>

                            {termsOpen && (
                                <div className={`border-t px-4 sm:px-5 py-4 space-y-3 ${isDark ? 'border-white/5 bg-[#0E0F10]/50' : 'border-gray-100 bg-gray-50/50'}`}>
                                    {termSections.map((section, i) => (
                                        <div key={i} className="text-xs">
                                            {section.title && <p className={`font-bold text-xs sm:text-[13px] mb-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{section.title}</p>}
                                            {section.bullets.map((b, bi) => (
                                                <p key={bi} className={`text-[11px] sm:text-xs mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>• {b}</p>
                                            ))}
                                        </div>
                                    ))}
                                    <p className={`text-[11px] pt-1 font-medium ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>
                                        ⚠️ By registering, you agree to all the above participant terms.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Similar Events (Full Width at bottom) */}
                {similarEvents.length > 0 && (
                    <div className={`w-full rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-2.5">
                            <h3 className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Similar Events
                            </h3>
                            <button
                                type="button"
                                onClick={() => navigate('/sports')}
                                className="text-[11px] font-bold text-[#0ECCEE] hover:underline cursor-pointer flex items-center gap-0.5"
                            >
                                View all <ChevronRight size={12} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                            {similarEvents.map((sim) => {
                                const simImg = sim.coverImage || sim.images?.[0] || sim.image;
                                const simFee = minSportsFee(sim);
                                const simDate = sim.eventDate || sim.date;
                                const formattedSimDate = simDate
                                    ? new Date(simDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                                    : '';
                                const simLocation = sim.city || sim.venue || sim.runClub?.basedIn || '';

                                return (
                                    <div
                                        key={sim._id || sim.id || sim.slug}
                                        onClick={() => {
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                            navigate(sportRunPath(sim), { state: { event: sim } });
                                        }}
                                        className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all cursor-pointer group ${isDark
                                                ? 'bg-[#161718] border-white/5 hover:border-[#0ECCEE]/35 hover:bg-[#1D1E20]'
                                                : 'bg-gray-50 border-gray-100 hover:border-[#0ECCEE]/45 hover:bg-white shadow-2xs'
                                            }`}
                                    >
                                        <div className="size-12 sm:size-13 rounded-xl overflow-hidden shrink-0 bg-gray-800 relative">
                                            {simImg ? (
                                                <img
                                                    src={getImageUrl(simImg, { preset: 'cardSm' })}
                                                    alt={sim.title}
                                                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                                                    onError={(e) => handleImageErrorWithFallback(e, 100, 100, '#1A1B1D', sim.title)}
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                                                    🏃
                                                </div>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <h4 className={`text-xs font-bold leading-snug truncate group-hover:text-[#0ECCEE] transition-colors ${isDark ? 'text-white' : 'text-gray-900'
                                                }`}>
                                                {sim.title}
                                            </h4>

                                            <p className={`text-[10px] mt-0.5 truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                {formattedSimDate ? `${formattedSimDate}` : ''}
                                                {formattedSimDate && simLocation ? ' · ' : ''}
                                                {simLocation}
                                            </p>

                                            <div className="flex items-center justify-between mt-0.5">
                                                <span className={`text-[11px] font-bold ${simFee > 0
                                                        ? (isDark ? 'text-gray-200' : 'text-gray-900')
                                                        : 'text-emerald-400'
                                                    }`}>
                                                    {simFee > 0 ? formatInr(simFee) : 'Free'}
                                                </span>

                                                <span className="text-[10px] font-bold text-[#0ECCEE] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                                                    View <ChevronRight size={10} />
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ORGANIZERS STORY SLIDER (Above footer / bottom of page, seamless without box) */}
                <OrganizersStorySlider
                    title="Organizers"
                    realOrganizer={event.organizer ? { name: event.organizer } : (communityName ? { name: communityName, image: club?.logo || club?.image } : null)}
                    eventKey={event.id || 'run'}
                    isDark={isDark}
                />
            </div>

            {/* Tier Selection Sheet Modal */}
            {typeof document !== 'undefined' && createPortal(
                <>
                    {tierSheetOpen ? (
                        <div className="fixed inset-0 z-100055 flex items-end justify-center">
                            <button
                                type="button"
                                aria-label="Close"
                                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                                onClick={() => {
                                    if (selectingTierId) return;
                                    setTierSheetOpen(false);
                                    setExpandedTierId(null);
                                }}
                            />
                            <div
                                className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,var(--safe-bottom))] tier-sheet-in ${isDark ? 'bg-[#161718]' : 'bg-white'
                                    }`}
                            >
                                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-500/40" />
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div>
                                        <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose a tier</h3>
                                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                            Tap a plan, expand what’s included, then continue.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={Boolean(selectingTierId)}
                                        onClick={() => {
                                            setTierSheetOpen(false);
                                            setExpandedTierId(null);
                                        }}
                                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
                                    >
                                        Close
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {getSportsTiers(event).map((tier) => {
                                        const tierInclusions = Array.isArray(tier.inclusions) ? tier.inclusions.filter(Boolean) : [];
                                        const expanded = expandedTierId === tier.id;
                                        const selecting = selectingTierId === tier.id;
                                        const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';

                                        return (
                                            <div
                                                key={tier.id}
                                                className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer ${selecting
                                                    ? 'border-[#0ECCEE] ring-2 ring-[#0ECCEE]/35 scale-[0.985] shadow-[0_0_0_4px_rgba(14,204,238,0.12)]'
                                                    : isDark
                                                        ? 'bg-[#111213] border-white/10 hover:border-[#0ECCEE]/45 active:scale-[0.99]'
                                                        : 'bg-white border-gray-200 hover:border-[#0ECCEE]/55 shadow-sm active:scale-[0.99]'
                                                    } ${isDark && !selecting ? 'bg-[#111213]' : ''}`}
                                            >
                                                <button
                                                    type="button"
                                                    disabled={Boolean(selectingTierId)}
                                                    onClick={() => {
                                                        setSelectingTierId(tier.id);
                                                        window.setTimeout(() => {
                                                            setTierSheetOpen(false);
                                                            setExpandedTierId(null);
                                                            setSelectingTierId(null);
                                                            navigate(`${sportRunPath(event)}/book?tier=${encodeURIComponent(tier.id)}`, {
                                                                state: { event, runClub: club, tierId: tier.id },
                                                            });
                                                        }, 320);
                                                    }}
                                                    className="w-full text-left p-4 cursor-pointer disabled:cursor-wait"
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <span
                                                            className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${selecting
                                                                ? 'border-[#0ECCEE] bg-[#0ECCEE] scale-110'
                                                                : isDark
                                                                    ? 'border-gray-600'
                                                                    : 'border-gray-300'
                                                                }`}
                                                            aria-hidden
                                                        >
                                                            {selecting ? <Check size={12} className="text-black" strokeWidth={3} /> : null}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <p className={`text-base font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                                    {tier.name}
                                                                </p>
                                                                <p className={`text-base font-bold shrink-0 tabular-nums ${Number(tier.fee) > 0
                                                                    ? (isDark ? 'text-white' : 'text-gray-900')
                                                                    : 'text-green-500'
                                                                    }`}>
                                                                    {feeLabel}
                                                                </p>
                                                            </div>
                                                            {tier.description ? (
                                                                <p className={`text-xs mt-1 leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                                    {tier.description}
                                                                </p>
                                                            ) : null}
                                                            <p className={`text-[11px] mt-2 font-medium ${selecting ? 'text-[#0ECCEE]' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                {selecting ? 'Opening registration…' : 'Tap to select'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </button>

                                                {tierInclusions.length > 0 ? (
                                                    <div className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                                                        <button
                                                            type="button"
                                                            disabled={Boolean(selectingTierId)}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedTierId((prev) => (prev === tier.id ? null : tier.id));
                                                            }}
                                                            className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold cursor-pointer ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                                                                }`}
                                                        >
                                                            <span>
                                                                What’s included
                                                                <span className={`ml-1.5 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                    ({tierInclusions.length})
                                                                </span>
                                                            </span>
                                                            <ChevronDown
                                                                size={16}
                                                                className={`shrink-0 text-[#0ECCEE] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                                            />
                                                        </button>
                                                        <div
                                                            className={`grid transition-[grid-template-rows] duration-200 ease-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                                                }`}
                                                        >
                                                            <div className="overflow-hidden">
                                                                <ul className={`px-4 pb-3 space-y-2 ${isDark ? 'bg-[#0E0F10]/60' : 'bg-gray-50/80'}`}>
                                                                    {tierInclusions.map((item, i) => (
                                                                        <li key={i} className={`flex gap-2.5 text-xs leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                                            <span className="mt-0.5 size-4 rounded-md bg-[#0ECCEE]/15 text-[#0ECCEE] flex items-center justify-center shrink-0">
                                                                                <Check size={10} strokeWidth={3} />
                                                                            </span>
                                                                            <span>{item}</span>
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </>,
                document.body,
            )}
            {galleryOpen && galleryImages.length > 0 && (
                <GalleryLightbox
                    images={galleryImages}
                    index={galleryIndex}
                    name={event?.title || 'Event Gallery'}
                    onClose={() => setGalleryOpen(false)}
                    onIndexChange={setGalleryIndex}
                />
            )}
        </div>
    );
}

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight, ChevronDown, Check } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import Seo from '../../components/Seo';
import LazyMap from '../../components/LazyMap';
import TrekDetailIcon from '../../components/TrekDetailIcon';
import DetailPageLoader from '../../components/DetailPageLoader';
import { primaryCoverUrl } from '../../utils/coverImages';
import { absoluteUrl, breadcrumbSchema, eventSchema } from '../../utils/seo';
import { shareContent } from '../../utils/externalLink';
import { eventCommunityEventPath, entityMatchesRouteParam } from '../../utils/slugRoutes';
import { eventDetailTabBoxes, eventMapSideFacts, resolveRunMapPin } from '../../utils/trekDetailBoxes';
import { resolveRunContacts, instagramHandle } from '../../utils/runContacts';
import { getSportsTiers, isTiersPricing, minSportsFee, formatInr } from '../../utils/sportsTiers';
import { groupTermsAndConditions } from '../../utils/termsAndConditions';
import { useInAppBack } from '../../hooks/useInAppBack';

import { publicFetchJSONRetry } from '../../services/api/client';
import { DETAIL_FETCH_OPTS, classifyDetailLoadError } from '../../utils/detailPageLoad';
import { trackBookNowClick } from '../../services/analyticsService';
import { organizerHubCopy } from '../../utils/listingHubCopy';
import { usePageContentLoading } from '../../hooks/usePageContentLoading';
import InAppOpenChromeGate, { shouldShowInAppChromeGate } from '../../components/InAppOpenChromeGate';
import { getExternalBrowserTargetUrl } from '../../utils/openInExternalBrowser';

const RUN_DETAIL_CACHE_PREFIX = 'crwdctrl_event_community_detail_v18_';
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

function seedEventFromNav(navEvent) {
    if (!navEvent) return null;
    return navEvent;
}

/** Full event payload — pricing + enough fields that the page won't flash stubs/demo */
function hasPricingSnapshot(ev) {
    if (!ev) return false;
    if (ev.pricingMode === 'tiers') return Array.isArray(ev.tiers);
    return typeof ev.registrationFee === 'number';
}

function eventCoverHint(ev) {
    if (!ev) return '';
    return (
        primaryCoverUrl(ev.coverImages || {}, ev.coverImage || ev.image)
        || (Array.isArray(ev.images) ? ev.images.find(Boolean) : '')
        || ''
    );
}

/** Thin card seed from listing — enough to paint hero + title without the branded loader */
function isPreviewEvent(ev) {
    if (!ev) return false;
    const title = String(ev.title || ev.name || '').trim();
    return Boolean(title && (eventCoverHint(ev) || ev._id || ev.id || ev.slug));
}

/** Real body copy (not empty listing stubs) + pricing so we never invent “demo” overview text */
function isHydratedEvent(ev) {
    if (!hasPricingSnapshot(ev)) return false;
    const desc = typeof ev.description === 'string' ? ev.description.trim() : '';
    const overview = typeof ev.overview === 'string' ? ev.overview.trim() : '';
    return Boolean(desc || overview || ev.formSchema || ev.runClub || (ev.venue != null && String(ev.venue).trim()));
}

function pickRunFallback(seeded, cachedEvent, routeParam, keepEvent = null) {
    const seedOk = entityMatchesRouteParam(seeded, routeParam, ['title', 'name']);
    const cacheOk = entityMatchesRouteParam(cachedEvent, routeParam, ['title', 'name']);
    const keepOk = entityMatchesRouteParam(keepEvent, routeParam, ['title', 'name']);
    if (keepOk && isHydratedEvent(keepEvent)) return keepEvent;
    if (seedOk && isHydratedEvent(seeded)) return seeded;
    if (cacheOk && isHydratedEvent(cachedEvent)) return cachedEvent;
    if (keepOk && keepEvent) return keepEvent;
    // Prefer richer cache over a thin title/image stub
    if (cacheOk && cachedEvent) return cachedEvent;
    if (seedOk && isPreviewEvent(seeded)) return seeded;
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

const GridIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#0ECCEE" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" fill="#0ECCEE" />
        <polygon points="12,3 14,10 12,12 10,10" fill="#0ECCEE" opacity="0.9" />
    </svg>
);

const CafeIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M6 8h10v6a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V8z" fill="#C4A484" />
        <path d="M16 9h2.2a2.3 2.3 0 0 1 0 4.6H16" stroke="#A67C52" strokeWidth="1.6" strokeLinecap="round" />
        <rect x="7" y="19" width="8" height="1.6" rx="0.8" fill="#8B6914" />
        <path d="M9 4c.4 1.2-.2 2 .4 3M12 3.5c.4 1.2-.2 2.2.4 3.2" stroke="#94A3B8" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
);

const MAP_SIDE_ICONS = {
    clock: ClockIcon,
    star: GridIcon,
    food: CafeIcon,
    calendar: ({ size }) => <TrekDetailIcon icon="calendar" size={size} />,
    'map-pin': ({ size }) => <TrekDetailIcon icon="map-pin" size={size} />,
};

export default function EventCommunityEventPage() {
    const navigate = useNavigate();
    const goBack = useInAppBack();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();

    const [event, setEvent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [fetchingDetail, setFetchingDetail] = useState(true);
    const [loadError, setLoadError] = useState('');
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
    const [chromeGateUrl, setChromeGateUrl] = useState('');
    const imgRef = useRef(null);
    const eventRef = useRef(null);
    eventRef.current = event;

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
            setFetchingDetail(false);
            return undefined;
        }

        const seeded = seedEventFromNav(location.state?.event);
        const cachedByParam = readRunDetailCache(eventId);
        const cachedById = seeded?._id || seeded?.id
            ? readRunDetailCache(String(seeded._id || seeded.id))
            : null;
        const cachedEvent = cachedByParam || cachedById;
        // Keep already-loaded event across id→slug canonicalize (avoids loader remount flash)
        const existing = eventRef.current;
        const existingReady = entityMatchesRouteParam(existing, id, ['title', 'name']) && isHydratedEvent(existing);
        if (existingReady) {
            setEvent(existing);
            setLoading(false);
            setFetchingDetail(false);
            return undefined;
        }
        const fallback = pickRunFallback(seeded, cachedEvent, id, existing);

        setFetchingDetail(true);
        if (fallback) {
            setEvent(fallback);
            setLoading(false);
        } else {
            setEvent(null);
            setLoading(true);
        }

        setImgPg(0);
        setOverviewExpanded(false);
        setActiveRunTab('Details');
        setOpenInfo(null);
        setTermsOpen(false);
        setTierSheetOpen(false);
        if (!fallback || eventCoverHint(fallback) !== eventCoverHint(eventRef.current)) {
            setHeroLoaded(false);
        }

        const controller = new AbortController();
        publicFetchJSONRetry(`/sports/${encodeURIComponent(eventId)}`, {
            signal: controller.signal,
            ...DETAIL_FETCH_OPTS,
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
                if (!controller.signal.aborted) {
                    setLoading(false);
                    setFetchingDetail(false);
                }
            });
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (!event || !id) return;
        const canonical = eventCommunityEventPath(event);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, {
                replace: true,
                state: {
                    ...location.state,
                    event,
                    runClub: event.runClub || location.state?.runClub || null,
                },
            });
        }
    }, [event, id, navigate, location.state]);

    const showPageLoader = (loading && !event)
        || (event && id && !entityMatchesRouteParam(event, id, ['title', 'name']));
    usePageContentLoading(showPageLoader);

    if (showPageLoader) {
        return <DetailPageLoader label="Loading event" variant="event" />;
    }

    if (!event) {
        const isNotFound = loadError === 'not_found';
        const isRetryable = !isNotFound;
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3 px-6">
                <p className={`text-sm text-center font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {isRetryable ? "Couldn't load this event" : 'This event is no longer available'}
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
                    onClick={() => (isRetryable ? navigate('/events') : goBack())}
                    className="text-[#0ECCEE] text-sm font-semibold"
                >
                    {isRetryable ? 'Browse events' : '← Go back'}
                </button>
            </div>
        );
    }

    const club = event.runClub || null;
    const goToBookPage = (tierId = '') => {
        const path = `${eventCommunityEventPath(event)}/book${tierId ? `?tier=${encodeURIComponent(tierId)}` : ''}`;
        if (shouldShowInAppChromeGate()) {
            setChromeGateUrl(getExternalBrowserTargetUrl(`${window.location.origin}${path}`));
            return;
        }
        navigate(path, {
            state: {
                event,
                runClub: club,
                ...(tierId ? { tierId, freshBooking: true } : { freshBooking: true }),
            },
        });
    };
    const shareImage = primaryCoverUrl(event.coverImages || {}, event.coverImage || event.image);
    const coverImg = shareImage || null;
    // Gallery uploads only — strip any card/cover URLs that leaked into images[]
    const coverSlots = event.coverImages || {};
    const coverSet = new Set(
        [coverImg, coverSlots.portrait, coverSlots.wide, coverSlots.hero, coverSlots.square, coverSlots.landscape, coverSlots.video]
            .filter(Boolean),
    );
    const galleryImages = (event.images || []).filter((u) => u && !coverSet.has(u));
    // Top slider = gallery uploads only (cover/card stays out). Fall back to cover if no gallery yet.
    const images = galleryImages.length ? galleryImages : (coverImg ? [coverImg] : [null]);
    const communityName = club?.name || event.organizer || '';
    const copy = organizerHubCopy(true);
    const mapPin = resolveRunMapPin(event);
    const mapQuery = mapPin.query;
    const mapUrl = mapPin.mapUrl;
    const mapCaption = mapPin.caption;
    const rawDesc = (event.description?.trim() || event.overview?.trim() || '');
    // While the detail API is in flight, never invent overview/terms — that “demo” copy flashes then swaps
    const desc = rawDesc || (!fetchingDetail
        ? `${event.title || 'This event'} is hosted by ${communityName || 'the community'}. Join for a great session.`
        : '');
    const firstBlock = desc ? (desc.split(/\n\s*\n/)[0]?.trim() || desc) : '';
    const shortDesc = firstBlock.length > 180 ? `${firstBlock.slice(0, 150).replace(/\s+\S*$/, '')}...` : firstBlock;
    const terms = Array.isArray(event.termsAndConditions) && event.termsAndConditions.length
        ? event.termsAndConditions
        : (!fetchingDetail
            ? [
                'Follow all safety instructions from organizers at all times.',
                'Cancellation policy varies by organiser — contact the community for details.',
                'The organiser reserves the right to modify or cancel due to weather or safety.',
            ]
            : []);
    const termSections = groupTermsAndConditions(terms);

    const handleShare = () => {
        shareContent({
            title: event.title,
            url: window.location.href,
            imageUrl: shareImage ? absoluteUrl(shareImage) : undefined,
        });
    };

    const canonicalPath = eventCommunityEventPath(event || { id });

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <Seo
                title={event.title || 'Event'}
                description={desc}
                canonical={canonicalPath}
                image={shareImage || images?.[0]}
                type="article"
                jsonLd={[
                    breadcrumbSchema([
                        { name: 'Home', path: '/' },
                        { name: 'Events', path: '/events' },
                        { name: event.title || 'Event', path: canonicalPath },
                    ]),
                    eventSchema({
                        name: event.title || 'Event',
                        description: desc,
                        url: canonicalPath,
                        image: shareImage || images?.[0],
                        location: mapQuery || undefined,
                        price: minSportsFee(event),
                        organizerName: communityName || undefined,
                        availabilityUrl: `${canonicalPath}/book`,
                    }),
                ]}
            />
            <div className="mx-auto w-full md:max-w-2xl flex flex-col flex-1">
            <div className="relative w-full h-[396px] shrink-0 overflow-hidden bg-[#1A1B1D]">
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
                            <div key={i} className="relative shrink-0 w-full h-full snap-start bg-[#1A1B1D]">
                                {img ? (
                                    <>
                                        {!heroLoaded && i === 0 && (
                                            <div aria-hidden className="absolute inset-0 bg-[#1A1B1D]" />
                                        )}
                                        <img
                                        src={getImageUrl(img, { preset: 'eventHeroFit' })}
                                        alt={event.title}
                                        className={`absolute inset-0 w-full h-full object-contain content-image pointer-events-none select-none ${
                                            i === 0 && !heroLoaded ? 'opacity-0' : 'opacity-100'
                                        }`}
                                        draggable={false}
                                        loading={i === 0 ? 'eager' : 'lazy'}
                                        fetchPriority={i === 0 ? 'high' : 'auto'}
                                        decoding="async"
                                        onLoad={() => { if (i === 0) setHeroLoaded(true); }}
                                        onError={(e) => {
                                            if (i === 0) setHeroLoaded(true);
                                            handleImageErrorWithFallback(e, 393, 396, '#1A1B1D', event.title);
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

                <div className="absolute inset-0 bg-linear-to-t from-black/55 via-transparent to-black/25 pointer-events-none" />

                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
                    style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
                >
                    <button
                        onClick={goBack}
                        aria-label="Go back"
                        className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                    >
                        <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleShare}
                            aria-label="Share"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                        >
                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                        </button>
                        <button
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className="size-11 rounded-full bg-black/40 flex items-center justify-center"
                        >
                            <Heart size={20} strokeWidth={2.25} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} />
                        </button>
                    </div>
                </div>

                {images.length > 1 && (
                    <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-2 z-10">
                        {images.slice(0, 4).map((_, i) => (
                            <div
                                key={i}
                                className={`rounded-2xl transition-all duration-300
                                    ${i === imgPg ? 'h-2.5 w-6 bg-white' : 'size-2.5 bg-transparent border-2 border-white/60'}`}
                            />
                        ))}
                    </div>
                )}
            </div>

            {typeof document !== 'undefined' && createPortal(
            <>
            {!tierSheetOpen ? (
            <div
                className="fixed inset-x-0 bottom-0 z-100040 px-2 pointer-events-none"
                style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
            >
                <div className={`pointer-events-auto mx-auto w-full max-w-md md:max-w-2xl flex items-center justify-between gap-4 rounded-[30px] px-5 py-3.5 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
                    <div className="min-w-0 shrink-0">
                        <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {isTiersPricing(event) ? 'From' : 'Registration Fee'}
                        </p>
                        {(() => {
                            if (!hasPricingSnapshot(event)) {
                                return (
                                    <p className={`mt-0.5 text-2xl font-bold leading-none ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                        …
                                    </p>
                                );
                            }
                            const fromFee = minSportsFee(event);
                            if (fromFee > 0) {
                                return (
                                    <p className={`mt-0.5 text-2xl font-bold leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {formatInr(fromFee)}
                                    </p>
                                );
                            }
                            return <p className="mt-0.5 text-2xl font-bold leading-none text-green-500">Free</p>;
                        })()}
                    </div>
                    {(() => {
                        const closed = event.registration?.status === 'closed';
                        const full = Boolean(event.isFull) || (event.seatsRemaining === 0 && event.maxParticipants > 0);
                        const extLink = event.registration?.mode === 'external_link'
                            ? event.registrationLink
                            : null;
                        const tiers = getSportsTiers(event);
                        if (closed || full) {
                            return (
                                <button
                                    disabled
                                    className="flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-gray-600 text-gray-300 cursor-not-allowed"
                                >
                                    {closed ? 'Registration Closed' : 'Sold out'}
                                </button>
                            );
                        }
                        return (
                            <button
                                disabled={!hasPricingSnapshot(event) && !extLink}
                                onClick={() => {
                                    if (!hasPricingSnapshot(event) && !extLink) return;
                                    if (extLink) {
                                        trackBookNowClick({
                                            entityType: 'sports',
                                            entityId: event._id || event.id || event.slug || '',
                                            mode: 'external_link',
                                            destination: 'external',
                                        });
                                        window.open(extLink, '_blank', 'noopener,noreferrer');
                                        return;
                                    }
                                    if (tiers.length) {
                                        trackBookNowClick({
                                            entityType: 'sports',
                                            entityId: event._id || event.id || event.slug || '',
                                            mode: event.registration?.mode || 'internal_form',
                                            destination: 'tier_selection',
                                        });
                                        setExpandedTierId(null);
                                        setSelectingTierId(null);
                                        setTierSheetOpen(true);
                                        return;
                                    }
                                    trackBookNowClick({
                                        entityType: 'sports',
                                        entityId: event._id || event.id || event.slug || '',
                                        mode: event.registration?.mode || 'internal_form',
                                        destination: 'internal_book_page',
                                    });
                                    goToBookPage();
                                }}
                                className={`flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg transition ${
                                    !hasPricingSnapshot(event) && !extLink
                                        ? 'bg-[#0ECCEE]/60 text-black/70 cursor-wait'
                                        : 'bg-[#0ECCEE] text-black active:opacity-90'
                                }`}
                            >
                                {!hasPricingSnapshot(event) && !extLink
                                    ? 'Loading…'
                                    : extLink
                                    ? 'Book Now'
                                    : tiers.length
                                        ? 'Register now'
                                        : hasPricingSnapshot(event) && Number(event.registrationFee) <= 0
                                            ? 'Register free'
                                            : event.registration?.mode === 'organizer_qr'
                                                ? 'Pay via UPI'
                                                : 'Book now'}
                                {hasPricingSnapshot(event) || extLink ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                                ) : null}
                            </button>
                        );
                    })()}
                </div>
            </div>
            ) : null}
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
                            className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,var(--safe-bottom))] tier-sheet-in ${
                                isDark ? 'bg-[#161718]' : 'bg-white'
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
                                    const inclusions = Array.isArray(tier.inclusions) ? tier.inclusions.filter(Boolean) : [];
                                    const expanded = expandedTierId === tier.id;
                                    const selecting = selectingTierId === tier.id;
                                    const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';

                                    return (
                                        <div
                                            key={tier.id}
                                            className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                                                selecting
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
                                                        goToBookPage(tier.id);
                                                    }, 320);
                                                }}
                                                className="w-full text-left p-4 cursor-pointer disabled:cursor-wait"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <span
                                                        className={`mt-0.5 size-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-200 ${
                                                            selecting
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
                                                            <p className={`text-base font-bold shrink-0 tabular-nums ${
                                                                Number(tier.fee) > 0
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

                                            {inclusions.length > 0 ? (
                                                <div className={`border-t ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
                                                    <button
                                                        type="button"
                                                        disabled={Boolean(selectingTierId)}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setExpandedTierId((prev) => (prev === tier.id ? null : tier.id));
                                                        }}
                                                        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold cursor-pointer ${
                                                            isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        <span>
                                                            What’s included
                                                            <span className={`ml-1.5 font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                ({inclusions.length})
                                                            </span>
                                                        </span>
                                                        <ChevronDown
                                                            size={16}
                                                            className={`shrink-0 text-[#0ECCEE] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                                                        />
                                                    </button>
                                                    <div
                                                        className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                                                            expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                                                        }`}
                                                    >
                                                        <div className="overflow-hidden">
                                                            <ul className={`px-4 pb-3 space-y-2 ${isDark ? 'bg-[#0E0F10]/60' : 'bg-gray-50/80'}`}>
                                                                {inclusions.map((item, i) => (
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

            <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 pb-28 ${isDark ? 'bg-[#161718]' : 'bg-white'}`}>
                <div className="px-4 pt-5 pb-3">
                    <h1 className={`text-[26px] font-bold leading-8 wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title || 'Event'}
                    </h1>
                    <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{communityName}</p>
                    {club?.tagline && club.tagline !== communityName ? (
                        <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>{club.tagline}</p>
                    ) : null}
                </div>

                <div className="px-4 flex items-start gap-3 mb-5">
                    <div className="flex-1 min-w-0 space-y-3.5 pt-1">
                        {eventMapSideFacts(event).map((row) => {
                            const Icon = MAP_SIDE_ICONS[row.icon] || ClockIcon;
                            return (
                                <div key={row.key} className="flex items-center gap-2.5">
                                    <Icon size={22} />
                                    <div className="min-w-0">
                                        <p className={`text-[15px] font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                        <p className={`text-[11px] font-medium leading-4 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.label}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="w-60 shrink-0 flex flex-col">
                        <div className="w-full h-[132px] rounded-2xl overflow-hidden relative">
                            {(mapQuery || mapUrl) ? (
                                <LazyMap query={mapQuery} mapUrl={mapUrl || undefined} isDark={isDark} title={copy.mapTitle} />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] text-gray-400">No location</span>
                                </div>
                            )}
                        </div>
                        {(mapQuery || mapUrl) && (
                            <p className={`text-[11px] font-semibold text-center mt-1.5 leading-4 tracking-tight w-full ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {mapCaption || mapQuery || 'Open map'}
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-4 mb-5">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Overview</h2>
                    {desc ? (
                        <p className={`text-sm leading-6 whitespace-pre-line ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {overviewExpanded ? desc : shortDesc}
                            {desc !== shortDesc && (
                                <>
                                    <button onClick={() => setOverviewExpanded((v) => !v)} className="text-[#0ECCEE] text-sm font-medium ml-0.5">
                                        {overviewExpanded ? ' show less' : 'read more'}
                                    </button>
                                </>
                            )}
                        </p>
                    ) : (
                        <div className="space-y-2 animate-pulse" aria-hidden>
                            <div className={`h-3.5 rounded-md w-full ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                            <div className={`h-3.5 rounded-md w-[92%] ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                            <div className={`h-3.5 rounded-md w-[78%] ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
                        </div>
                    )}
                </div>

                {(() => {
                    const detailCards = eventDetailTabBoxes(event);
                    const inclusions = event.inclusions || [];
                    const infoSections = event.infoSections || [];
                    if (!detailCards.length && !inclusions.length && !infoSections.length) return null;
                    return (
                        <div className="px-4 mb-5">
                            <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{copy.infoTitle}</h2>
                            <div className={`rounded-2xl p-1 mb-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                                <div className="flex rounded-xl p-1 gap-0.5">
                                    {['Details', 'Included'].map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveRunTab(tab)}
                                            className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200
                                                ${activeRunTab === tab
                                                    ? isDark ? 'bg-[#1D1E20] text-white shadow-sm' : 'bg-gray-100 text-gray-900 shadow-sm'
                                                    : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                                                }`}
                                        >
                                            {tab === 'Included' ? 'Experience Included' : tab}
                                            {activeRunTab === tab && (
                                                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#0ECCEE]" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                {activeRunTab === 'Details' && (
                                    <>
                                        {detailCards.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {detailCards.map((row) => (
                                                    <div key={row.id || row.label} className={`rounded-2xl p-3 border ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                        <TrekDetailIcon icon={row.icon || 'default'} size={22} />
                                                        <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.label}</p>
                                                        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className={`text-sm px-1 py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No details added yet.</p>
                                        )}

                                        {infoSections.map((section, i) => {
                                            const isOpen = openInfo === i;
                                            return (
                                                <div key={i}>
                                                    <button
                                                        type="button"
                                                        onClick={() => setOpenInfo(isOpen ? null : i)}
                                                        className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${isDark ? 'bg-[#111213] border-white/5 hover:bg-[#1D1E20]' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'}`}
                                                    >
                                                        <p className={`text-sm font-semibold text-left ${isDark ? 'text-white' : 'text-gray-900'}`}>{section.title || `Section ${i + 1}`}</p>
                                                        <ChevronRight size={16} className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
                                                    </button>
                                                    {isOpen && section.details && (
                                                        <div className={`mt-2 rounded-2xl border px-4 py-3.5 ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                            <p className={`text-sm leading-6 whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{section.details}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </>
                                )}

                                {activeRunTab === 'Included' && (
                                    inclusions.length > 0 ? (
                                        <ul className="space-y-2.5 px-0.5">
                                            {inclusions.map((item, i) => (
                                                <li key={i} className={`flex gap-2.5 text-sm leading-6 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                                                    <span className={`mt-0.5 size-5 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-cyan-50 text-[#0891b2]'}`}>
                                                        {i + 1}
                                                    </span>
                                                    <span>{String(item).replace(/^[-*•\s]+/, '')}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className={`text-sm px-1 py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No experience items listed.</p>
                                    )
                                )}
                            </div>
                        </div>
                    );
                })()}

                {terms.length > 0 ? (
                <div className="px-4 mb-6">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        Terms &amp; Conditions
                    </h2>
                    <button
                        onClick={() => setTermsOpen((o) => !o)}
                        className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${isDark ? 'bg-[#111213] border-white/5 hover:bg-[#1D1E20]' : 'bg-white border-gray-100 shadow-sm hover:bg-gray-50'}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-amber-50'}`}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#FCD34D' : '#D97706'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                </svg>
                            </div>
                            <div className="text-left">
                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Terms &amp; Conditions</p>
                                <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                    {termSections.length} {termSections.length === 1 ? 'section' : 'sections'} — tap to {termsOpen ? 'collapse' : 'read'}
                                </p>
                            </div>
                        </div>
                        <ChevronRight
                            size={16}
                            className={`transition-transform duration-200 shrink-0 ${termsOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                        />
                    </button>
                    {termsOpen && (
                        <div className={`mt-2 rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                            {termSections.map((section, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-3 px-4 py-3 ${i < termSections.length - 1 ? `border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                                >
                                    <span
                                        className={`text-xs font-bold mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-amber-50 text-amber-600'}`}
                                    >
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        {section.title ? (
                                            <p className={`text-sm font-semibold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                {section.title}
                                            </p>
                                        ) : null}
                                        {section.bullets.length > 0 ? (
                                            <ul className={`${section.title ? 'mt-1.5' : ''} space-y-1 list-disc pl-4`}>
                                                {section.bullets.map((bullet, bi) => (
                                                    <li
                                                        key={bi}
                                                        className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                                                    >
                                                        {bullet}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : null}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                ) : null}

                <div className="px-4 pb-28">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
                    <div className="space-y-2.5">
                        {(() => {
                            const { phones, instagrams } = resolveRunContacts(event, club);
                            const phoneRows = phones.length ? phones : [null];
                            const instaRows = instagrams.length ? instagrams : [null];
                            return (
                                <>
                                    {phoneRows.map((phone, idx) => (
                                        <a
                                            key={`phone-${idx}-${phone || 'empty'}`}
                                            href={phone ? `tel:${phone}` : undefined}
                                            className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                                        >
                                            <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                                </svg>
                                            </div>
                                            <div>
                                                <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                    {phones.length > 1 ? `Phone ${idx + 1}` : 'Phone'}
                                                </p>
                                                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{phone || 'Not set'}</p>
                                            </div>
                                        </a>
                                    ))}
                                    {instaRows.map((insta, idx) => {
                                        const handle = instagramHandle(insta);
                                        return (
                                            <a
                                                key={`insta-${idx}-${handle || 'empty'}`}
                                                href={handle ? `https://instagram.com/${handle}` : undefined}
                                                target={handle ? '_blank' : undefined}
                                                rel="noopener noreferrer"
                                                className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                                            >
                                                <div
                                                    className="size-10 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ background: 'linear-gradient(135deg, #FCD34D 0%, #EC4899 50%, #7C3AED 100%)' }}
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                                                        {instagrams.length > 1 ? `Instagram ${idx + 1}` : 'Instagram'}
                                                    </p>
                                                    <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {handle ? `@${handle}` : 'Not set'}
                                                    </p>
                                                </div>
                                            </a>
                                        );
                                    })}
                                </>
                            );
                        })()}
                    </div>
                </div>
            </div>
            </div>
            <InAppOpenChromeGate
                open={Boolean(chromeGateUrl)}
                actionLabel="register"
                eventName={event?.title || event?.name || ''}
                isDark={isDark}
                pageUrl={chromeGateUrl}
                onDismiss={() => setChromeGateUrl('')}
            />
        </div>
    );
}

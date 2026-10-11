import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight, ChevronDown, Check, ExternalLink, Hourglass, MapPin } from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useAuth } from '../../../context/AuthContext';
import { getImageUrl } from '../../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import Seo from '../../../components/Seo';
import LazyMap from '../../../components/LazyMap';
import TrekDetailIcon from '../../../components/TrekDetailIcon';
import DetailPageLoader, { DetailLoader3DIcon } from '../../../components/DetailPageLoader';
import OrganizersStorySlider from '../../../components/OrganizersStorySlider';
import { primaryCoverUrl, resolveCoverImage } from '../../../utils/coverImages';
import { toOgShareImageUrl, breadcrumbSchema, eventSchema } from '../../../utils/seo';
import { shareContent } from '../../../utils/externalLink';
import { entityMatchesRouteParam, eventCommunityEventPath } from '../../../utils/slugRoutes';
import {
  eventMapSideFacts,
  eventDetailTabBoxes,
  resolveRunMapPin,
} from '../../../utils/trekDetailBoxes';
import { resolveRunContacts } from '../../../utils/runContacts';
import { getSportsTiers, minSportsFee, formatInr, hasPricingSnapshot } from '../../../utils/sportsTiers';
import { groupTermsAndConditions } from '../../../utils/termsAndConditions';
import { useInAppBack } from '../../../hooks/useInAppBack';
import { resolveAuthToken, getBearerAuthHeaders } from '../../../utils/authToken';

import { publicFetchJSONRetry } from '../../../services/api/client';
import { DETAIL_FETCH_OPTS, classifyDetailLoadError } from '../../../utils/detailPageLoad';
import { organizerHubCopy } from '../../../utils/listingHubCopy';
import { usePageContentLoading } from '../../../hooks/usePageContentLoading';
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import InAppOpenChromeGate, { shouldShowInAppChromeGate } from '../../../components/InAppOpenChromeGate';
import { getExternalBrowserTargetUrl } from '../../../utils/openInExternalBrowser';
import { isInAppBrowser } from '../../../config/apiBase';
import { signalDetailPageReady } from '../../../utils/bootSplash';

const RUN_DETAIL_CACHE_PREFIX = 'crwdctrl_event_community_detail_v19_';
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

function eventCoverHint(ev) {
    if (!ev) return '';
    return (
        resolveCoverImage(ev, 'hero')
        || primaryCoverUrl(ev.coverImages || {}, ev.coverImage || ev.image)
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
    const hasBody = Boolean(desc || overview || ev.formSchema || ev.runClub);
    if (!hasBody) return false;
    const hasDetailValues = Array.isArray(ev.detailBoxes)
        && ev.detailBoxes.some((box) => String(box?.value || '').trim());
    const hasTerms = Array.isArray(ev.termsAndConditions) && ev.termsAndConditions.length > 0;
    const hasClub = Boolean(ev.runClub && (ev.runClub.name || ev.runClub._id || ev.runClub.id));
    return hasDetailValues || hasTerms || hasClub || Boolean(ev.formSchema);
}

function pickRunFallback(seeded, cachedEvent, routeParam, keepEvent = null) {
    const seedOk = entityMatchesRouteParam(seeded, routeParam, ['title', 'name']);
    const cacheOk = entityMatchesRouteParam(cachedEvent, routeParam, ['title', 'name']);
    const keepOk = entityMatchesRouteParam(keepEvent, routeParam, ['title', 'name']);
    if (keepOk && isHydratedEvent(keepEvent)) return keepEvent;
    if (seedOk && isHydratedEvent(seeded)) return seeded;
    if (cacheOk && isHydratedEvent(cachedEvent)) return cachedEvent;
    if (keepOk && keepEvent) return keepEvent;
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
    const { token: authToken, isAuthenticated } = useAuth();

    const [event, setEvent] = useState(() => {
        const seeded = seedEventFromNav(location.state?.event);
        if (seeded && entityMatchesRouteParam(seeded, id, ['title', 'name']) && isPreviewEvent(seeded)) {
            return seeded;
        }
        const cached = id ? readRunDetailCache(id) : null;
        if (cached && entityMatchesRouteParam(cached, id, ['title', 'name'])) return cached;
        return null;
    });
    const [_loading, setLoading] = useState(() => !event);
    const [fetchingDetail, setFetchingDetail] = useState(true);
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
    const [chromeGateUrl, setChromeGateUrl] = useState('');
    const imgRef = useRef(null);
    const eventRef = useRef(null);
    const fetchGenRef = useRef(0);
    const authFetchGenRef = useRef(0);
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

        const gen = ++fetchGenRef.current;
        const seeded = seedEventFromNav(location.state?.event);
        const cachedByParam = readRunDetailCache(eventId);
        const cachedById = seeded?._id || seeded?.id
            ? readRunDetailCache(String(seeded._id || seeded.id))
            : null;
        const cachedEvent = cachedByParam || cachedById;
        const existing = eventRef.current;
        const existingReady = entityMatchesRouteParam(existing, id, ['title', 'name']) && isHydratedEvent(existing);
        const fallback = existingReady
            ? existing
            : pickRunFallback(seeded, cachedEvent, id, existing);

        if (fallback) {
            setEvent(fallback);
            setLoading(false);
            setFetchingDetail(!isHydratedEvent(fallback));
            setLoadError('');
        } else {
            setEvent(null);
            setLoading(true);
            setFetchingDetail(true);
            setLoadError('');
        }

        setImgPg(0);
        setOverviewExpanded(false);
        setActiveRunTab('Details');
        setOpenInfo(null);
        setTermsOpen(false);
        setTierSheetOpen(false);
        if (!fallback || !eventCoverHint(fallback)) setHeroLoaded(false);

        const controller = new AbortController();
        const inApp = isInAppBrowser();
        publicFetchJSONRetry(`/sports/${encodeURIComponent(eventId)}`, {
            signal: controller.signal,
            ...DETAIL_FETCH_OPTS,
            cacheBust: false,
            retries: fallback ? 1 : (inApp ? 2 : DETAIL_FETCH_OPTS.retries),
            timeout: inApp ? 12000 : DETAIL_FETCH_OPTS.timeout,
            headers: getBearerAuthHeaders(resolveAuthToken(authToken)),
        })
            .then((res) => {
                if (fetchGenRef.current !== gen) return;
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
                        paymentStatus: ur.paymentStatus || '',
                    });
                } else {
                    setUserRegistration(null);
                }
            })
            .catch((err) => {
                if (fetchGenRef.current !== gen) return;
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
                if (fetchGenRef.current !== gen) return;
                setLoading(false);
                setFetchingDetail(false);
            });
        return () => {
            controller.abort();
        };
    }, [id]);

    useEffect(() => {
        const eventId = id || eventRef.current?._id || eventRef.current?.id;
        if (!eventId || !eventRef.current) return undefined;
        const gen = ++authFetchGenRef.current;
        const controller = new AbortController();
        publicFetchJSONRetry(`/sports/${encodeURIComponent(eventId)}`, {
            signal: controller.signal,
            ...DETAIL_FETCH_OPTS,
            headers: getBearerAuthHeaders(resolveAuthToken(authToken)),
        })
            .then((res) => {
                if (authFetchGenRef.current !== gen || controller.signal.aborted) return;
                const d = res?.data;
                if (d?.event && entityMatchesRouteParam(d.event, id, ['title', 'name'])) {
                    setEvent(d.event);
                }
                const ur = d?.userRegistration;
                if (ur?.registrationId) {
                    setUserRegistration({
                        registrationId: String(ur.registrationId),
                        status: ur.status || 'confirmed',
                        paymentStatus: ur.paymentStatus || '',
                    });
                } else if (isAuthenticated) {
                    setUserRegistration(null);
                }
            })
            .catch(() => { /* keep current page */ });
        return () => controller.abort();
    }, [isAuthenticated, authToken]);

    useEffect(() => {
        if (!event || !id) return;
        if (!entityMatchesRouteParam(event, id, ['title', 'name'])) return;
        const canonical = eventCommunityEventPath(event);
        if (!canonical || location.pathname === canonical) return;
        navigate(`${canonical}${location.search || ''}`, {
            replace: true,
            state: {
                event,
                runClub: event.runClub || null,
            },
        });
    }, [event, id, navigate, location.pathname, location.search]);

    const showPageLoader = Boolean(id) && !loadError && (
        (_loading && !event)
        || (event && !entityMatchesRouteParam(event, id, ['title', 'name']))
    );
    usePageContentLoading(showPageLoader);
    useDetailLoaderFailsafe(showPageLoader, () => {
        setLoading(false);
        setFetchingDetail(false);
        if (!eventRef.current) {
            setLoadError((prev) => prev || 'network');
        }
    });

    useEffect(() => {
        if (showPageLoader || !event) return;
        signalDetailPageReady();
    }, [showPageLoader, event]);

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
                        className="px-5 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-bold cursor-pointer"
                    >
                        Retry
                    </button>
                ) : null}
                <button
                    type="button"
                    onClick={() => (isRetryable ? navigate('/events') : goBack())}
                    className="text-[#0ECCEE] text-sm font-semibold cursor-pointer"
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

    const handleBookingClick = () => {
        if (userRegistration?.registrationId) {
            navigate(`/qr-ticket/${userRegistration.registrationId}`);
            return;
        }
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
        goToBookPage();
    };

    const coverImg = resolveCoverImage(event, 'hero')
        || primaryCoverUrl(event.coverImages || {}, event.coverImage || event.image)
        || null;
    const shareRaw =
        resolveCoverImage(event, 'cardPortrait')
        || primaryCoverUrl(event.coverImages || {}, event.coverImage)
        || coverImg;
    const shareImage = toOgShareImageUrl(shareRaw, { contain: true, portrait: true });
    const coverSlots = event.coverImages || {};
    const coverSet = new Set(
        [coverImg, coverSlots.portrait, coverSlots.wide, coverSlots.hero, coverSlots.square, coverSlots.landscape, coverSlots.video]
            .filter(Boolean),
    );
    const galleryImages = (event.images || []).filter((u) => u && !coverSet.has(u));
    const images = galleryImages.length ? galleryImages : (coverImg ? [coverImg] : [null]);
    const communityName = club?.name || event.organizer || '';
    const contactPhone = club?.contactPhone || event.emergencyContact || event.phone || null;
    const contactInsta = club?.contactInstagram || event.contactInstagram || event.instagram || null;
    const instaHandle = contactInsta ? String(contactInsta).replace('@', '').trim() : '';
    const copy = organizerHubCopy(true);
    const mapPin = resolveRunMapPin(event);
    const mapQuery = mapPin.query;
    const mapUrl = mapPin.mapUrl;
    const mapCaption = mapPin.caption;
    const rawDesc = (event.description?.trim() || event.overview?.trim() || '');
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
    const canonicalPath = eventCommunityEventPath(event || { id });
    const fromFee = minSportsFee(event);

    const handleShare = () => {
        const shareUrl = `${window.location.origin}${canonicalPath || window.location.pathname}`;
        shareContent({
            title: event.title,
            url: shareUrl,
            imageUrl: shareImage || undefined,
        });
    };

    const sideFactRows = eventMapSideFacts(event);
    const contacts = resolveRunContacts(event, club);

    const eventDateObj = (event.eventDate || event.date) ? new Date(event.eventDate || event.date) : null;
    const formattedDate = eventDateObj && !isNaN(eventDateObj.getTime())
        ? eventDateObj.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
        : (event.dateLabel || event.date || '');

    const eventTime = event.reportingTime || event.time || event.startTime || event.departureTime || (
        event.timeLabel || ''
    );

    const locationText = mapCaption || event.venue || event.meetingPoint || mapQuery || event.city || 'Location TBA';

    const eventCategory = event.displayType || event.runCategory || event.category || '';
    const skillLevel = event.skillLevel || '';
    const duration = event.duration || '';

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen pb-6 md:pb-6" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
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
                                        className={`text-xs font-medium px-2.5 py-1.5 rounded-lg cursor-pointer ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
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
                                                            goToBookPage(tier.id);
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

                                                {inclusions.length > 0 ? (
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
                                                                    ({inclusions.length})
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

            {/* MAIN DESKTOP & MOBILE CONTAINER */}
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-2.5 lg:py-4 flex flex-col flex-1 gap-3.5">

                {/* TOP HEADER ROW (Matching Reference: Title + Share/Favorite Action Icons) */}
                <div className="flex items-center justify-between gap-4">
                    <h1 className={`text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title || 'Event'}
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
                                    {images.map((img, i) => (
                                        <div key={i} className="relative shrink-0 w-full h-full snap-start bg-[#1A1B1D]">
                                            {img ? (
                                                <>
                                                    {!heroLoaded && i === 0 && (
                                                        <div
                                                            aria-hidden
                                                            className="absolute inset-0 z-1 flex items-center justify-center bg-[#1A1B1D]"
                                                        >
                                                            <DetailLoader3DIcon variant="event" tone="dark" />
                                                        </div>
                                                    )}
                                                    <img
                                                        src={getImageUrl(img, { preset: 'eventHeroFit' }) || img}
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

                            {/* Arrow controls */}
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

                                    {/* Carousel Pagination Dots */}
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
                                            {locationText}
                                        </p>
                                    </div>

                                    {(mapQuery || mapUrl) ? (
                                        <a
                                            href={mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="size-7 rounded-lg flex items-center justify-center text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0 cursor-pointer transition border border-[#0ECCEE]/20"
                                            title="Open in Maps"
                                        >
                                            <ExternalLink size={13} />
                                        </a>
                                    ) : null}
                                </div>

                                {/* Event Key Chips: Category, Skill, Duration */}
                                {(eventCategory || skillLevel || duration) ? (
                                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                        {eventCategory ? (
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                                ⚡ {eventCategory}
                                            </span>
                                        ) : null}
                                        {skillLevel ? (
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                                🎯 {skillLevel}
                                            </span>
                                        ) : null}
                                        {duration ? (
                                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                                                ⏳ {duration}
                                            </span>
                                        ) : null}
                                    </div>
                                ) : null}

                                {/* Organizer Contact Row */}
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

                            {/* Divider & Price / Booking CTA row */}
                            <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between gap-3`}>
                                <div>
                                    {userRegistration?.registrationId ? (
                                        <div>
                                            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Registered</p>
                                            <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                                ID: #{userRegistration.registrationId.slice(-6)}
                                            </p>
                                        </div>
                                    ) : fromFee != null && Number(fromFee) > 0 ? (
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
                                    ) : (
                                        <div>
                                            <p className="text-xl sm:text-2xl font-black text-emerald-400">Free</p>
                                            <p className="text-[10px] font-semibold text-emerald-400">Instant Entry</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleBookingClick}
                                    className="px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-extrabold shadow-lg bg-[#0ECCEE] text-black hover:bg-[#0cb8d6] active:scale-[0.98] transition cursor-pointer shrink-0"
                                >
                                    {userRegistration?.registrationId ? 'View Ticket' : 'Book Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full-width Overview Card */}
                {desc && (
                    <div className={`w-full rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <h2 className={`text-sm sm:text-base font-bold leading-snug mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Overview
                        </h2>
                        <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            {overviewExpanded ? desc : shortDesc}
                            {desc !== shortDesc && (
                                <button
                                    type="button"
                                    onClick={() => setOverviewExpanded((v) => !v)}
                                    className="ml-1 text-xs font-bold text-[#0ECCEE] hover:underline cursor-pointer"
                                >
                                    {overviewExpanded ? 'Show less' : 'Read more'}
                                </button>
                            )}
                        </p>
                    </div>
                )}

                {/* DETAILS & MAP BALANCED SECTION */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start mt-0.5">

                    {/* LEFT COLUMN (lg:col-span-7): Tabs & Organizer Contact */}
                    <div className="lg:col-span-7 flex flex-col gap-3.5">
                        {/* Tabs (Details & Included) */}
                        {(() => {
                            const detailCards = eventDetailTabBoxes(event);
                            const inclusions = event.inclusions || [];
                            const infoSections = event.infoSections || [];
                            if (!detailCards.length && !inclusions.length && !infoSections.length) return null;
                            return (
                                <div className={`rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                    <div className="flex items-center justify-between mb-3.5">
                                        <h2 className={`text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>{copy.infoTitle || 'Event Info'}</h2>
                                        <div className={`flex rounded-xl p-1 gap-1 ${isDark ? 'bg-[#1A1B1D]' : 'bg-gray-100'}`}>
                                            {['Details', 'Included'].map((tab) => (
                                                <button
                                                    key={tab}
                                                    type="button"
                                                    onClick={() => setActiveRunTab(tab)}
                                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                                                        activeRunTab === tab
                                                            ? isDark ? 'bg-[#252629] text-[#0ECCEE] shadow-xs' : 'bg-white text-gray-900 shadow-xs'
                                                            : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                                                    }`}
                                                >
                                                    {tab === 'Included' ? `Included (${inclusions.length})` : tab}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {activeRunTab === 'Details' && (
                                            <>
                                                {detailCards.length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                        {detailCards.map((row) => (
                                                            <div key={row.id || row.label} className={`rounded-2xl p-2.5 border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                                                <TrekDetailIcon icon={row.icon || 'default'} size={18} />
                                                                <p className={`text-[11px] mt-1.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{row.label}</p>
                                                                <p className={`text-xs font-bold mt-0.5 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className={`text-xs py-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No details added yet.</p>
                                                )}
                                            </>
                                        )}

                                        {activeRunTab === 'Included' && (
                                            inclusions.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {inclusions.map((item, i) => (
                                                        <div
                                                            key={i}
                                                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5 text-gray-200' : 'bg-gray-50 border-gray-100 text-gray-800'}`}
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
                                                <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No experience items listed.</p>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })()}

                    </div>

                    {/* RIGHT COLUMN (lg:col-span-5): Location Map & Organizer Contact */}
                    <div className="lg:col-span-5 flex flex-col gap-2.5 sm:gap-3">
                        {(mapQuery || mapUrl) && (
                            <div className={`rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <div className="flex items-center justify-between mb-2.5">
                                    <div className="flex items-center gap-2">
                                        <MapPin size={15} className="text-[#0ECCEE]" />
                                        <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                                            {copy.mapTitle || 'Location & Route Map'}
                                        </p>
                                    </div>
                                    <a
                                        href={mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs font-bold text-[#0ECCEE] hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        Directions <ExternalLink size={12} />
                                    </a>
                                </div>
                                <div className="w-full h-[145px] sm:h-[155px] rounded-2xl overflow-hidden relative border border-white/5">
                                    <LazyMap query={mapQuery} mapUrl={mapUrl || undefined} isDark={isDark} title={copy.mapTitle} />
                                </div>
                                {mapCaption && (
                                    <p className={`text-xs mt-2 font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        📍 {mapCaption}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ORGANIZER CONTACT SECTION */}
                        {(communityName || contactPhone || instaHandle) && (
                            <div className={`rounded-3xl p-3.5 sm:p-4 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <h2 className={`text-xs sm:text-sm font-bold leading-snug mb-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    Organizer Contact
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {communityName && (
                                        <div className={`p-2.5 rounded-2xl border space-y-1 ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-[#0ECCEE]">ORGANIZED BY</p>
                                            <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{communityName}</p>
                                        </div>
                                    )}
                                    {contactPhone && (
                                        <a
                                            href={`tel:${contactPhone}`}
                                            className={`p-2.5 rounded-2xl border space-y-1 transition hover:opacity-90 ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}
                                        >
                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">PHONE / SUPPORT</p>
                                            <p className={`text-xs font-bold text-[#0ECCEE] truncate`}>{contactPhone}</p>
                                        </a>
                                    )}
                                    {instaHandle && (
                                        <a
                                            href={`https://instagram.com/${instaHandle}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`p-2.5 rounded-2xl border space-y-1 transition hover:opacity-90 ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}
                                        >
                                            <p className="text-[10px] font-extrabold uppercase tracking-wider text-pink-400">INSTAGRAM</p>
                                            <p className={`text-xs font-bold text-pink-400 truncate`}>@{instaHandle}</p>
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* FULL-WIDTH EXPANDABLE SECTION (Terms & Custom Info across navbar length) */}
                <div className="flex flex-col gap-3.5 w-full mt-1">

                    {/* Full-width Custom Info Sections (e.g. What You'll Create, Who Can Join?) */}
                    {Array.isArray(event.infoSections) && event.infoSections.length > 0 && event.infoSections.map((section, i) => {
                        const isOpen = openInfo === i;
                        return (
                            <div
                                key={`full-info-${i}`}
                                className={`w-full rounded-3xl border overflow-hidden transition-all ${
                                    isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => setOpenInfo(isOpen ? null : i)}
                                    className="w-full flex items-center justify-between p-4 sm:p-4.5 cursor-pointer text-left"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`size-8 rounded-xl flex items-center justify-center shrink-0 ${
                                            isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-cyan-50 text-cyan-600'
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
                                        className={`transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-90' : ''} ${
                                            isDark ? 'text-gray-500' : 'text-gray-400'
                                        }`}
                                    />
                                </button>
                                {isOpen && section.details && (
                                    <div className={`px-4 sm:px-5 pb-4 pt-1 border-t text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${
                                        isDark ? 'border-white/5 text-gray-300' : 'border-gray-200 text-gray-700'
                                    }`}>
                                        {section.details}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* Full-width Terms & Participation Policy Card */}
                    {terms.length > 0 && (
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
                                            {termSections.length} {termSections.length === 1 ? 'section' : 'sections'} · Tap to {termsOpen ? 'collapse' : 'view'}
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
                                    {termSections.map((section, i) => (
                                        <div key={i} className="text-xs">
                                            {section.title && <p className={`font-bold text-xs sm:text-[13px] mb-0.5 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{section.title}</p>}
                                            {section.bullets.map((b, bi) => (
                                                <div key={bi} className="flex gap-2 text-xs py-0.5">
                                                    <span className={`text-[10px] font-bold mt-0.5 shrink-0 size-4 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1A1B1D] text-[#0ECCEE]' : 'bg-amber-100 text-amber-700'}`}>{bi + 1}</span>
                                                    <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{b}</p>
                                                </div>
                                            ))}
                                        </div>
                                    ))}
                                    <p className={`text-[11px] pt-1 font-medium ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>
                                        ⚠️ By registering, you agree to all the above event terms.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ORGANIZERS STORY SLIDER (Above footer / bottom of page, seamless without box) */}
                <OrganizersStorySlider
                    title="Organizers"
                    realOrganizer={event.organizer || (communityName ? { name: communityName } : null) || (event.contacts?.[0]?.name ? { name: event.contacts[0].name } : null)}
                    eventKey={event.id || event.slug || event.type || 'event'}
                    isDark={isDark}
                />
            </div>

            {/* Fixed Bottom Booking Bar for Mobile */}
            <div className={`fixed bottom-0 left-0 right-0 z-40 p-4 border-t backdrop-blur-xl shadow-2xl block md:hidden transition-all ${isDark ? 'bg-[#111213]/95 border-white/10' : 'bg-white/95 border-gray-200'
                }`}>
                <div className="mx-auto w-full max-w-md flex items-center justify-between gap-4">
                    <div>
                        {userRegistration?.registrationId ? (
                            <div>
                                <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Registered</p>
                                <p className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    ID: #{userRegistration.registrationId.slice(-6)}
                                </p>
                            </div>
                        ) : fromFee != null && Number(fromFee) > 0 ? (
                            <div>
                                <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {formatInr(fromFee)} <span className="text-xs font-normal text-gray-400">onwards</span>
                                </p>
                                <p className="text-xs font-bold text-amber-500 mt-0.5">Filling Fast</p>
                            </div>
                        ) : (
                            <div>
                                <p className="text-xl font-black text-emerald-500">Free</p>
                                <p className="text-xs font-bold text-emerald-500 mt-0.5">Instant Entry</p>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleBookingClick}
                        className="px-7 py-3.5 rounded-2xl text-sm font-extrabold shadow-lg bg-[#0ECCEE] text-black hover:bg-[#0cb8d6] active:scale-[0.98] transition cursor-pointer shrink-0"
                    >
                        {userRegistration?.registrationId ? 'View Ticket' : 'Book Now'}
                    </button>
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


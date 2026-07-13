import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import Seo from '../../components/Seo';
import LazyMap from '../../components/LazyMap';
import { breadcrumbSchema, eventSchema } from '../../utils/seo';
import { shareContent } from '../../utils/externalLink';
import { sportRunPath } from '../../utils/slugRoutes';

import { API_BASE_URL as API } from '../../services/api/client';

const SKILL_LABELS = {
    all: 'All Levels',
    beginner: 'Beginner',
    intermediate: 'Moderate',
    advanced: 'Advanced',
};

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

const PersonIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="6" r="3" fill="#2DD4BF" />
        <path d="M3 20 Q3 14 9 14 Q15 14 15 20" fill="#0D9488" />
        <circle cx="17" cy="7" r="2.5" fill="#5EEAD4" opacity="0.8" />
        <path d="M14 20 Q14 15.5 17 15.5 Q21 15.5 21 20" fill="#0D9488" opacity="0.7" />
    </svg>
);

const SunIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="5" fill="#FCD34D" />
        <circle cx="12" cy="12" r="3.5" fill="#FBBF24" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
            const r = 8.5;
            const r2 = 10.5;
            const rad = (deg * Math.PI) / 180;
            return (
                <line
                    key={i}
                    x1={12 + r * Math.cos(rad)}
                    y1={12 + r * Math.sin(rad)}
                    x2={12 + r2 * Math.cos(rad)}
                    y2={12 + r2 * Math.sin(rad)}
                    stroke="#F59E0B"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            );
        })}
    </svg>
);

const MoonIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="url(#re-moon-grad)" />
        <defs><linearGradient id="re-moon-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#C4B5FD" /><stop offset="100%" stopColor="#7C3AED" /></linearGradient></defs>
    </svg>
);

const MapPinIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="url(#re-pin-grad)" />
        <circle cx="12" cy="9" r="3" fill="white" opacity="0.9" />
        <defs><linearGradient id="re-pin-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F87171" /><stop offset="100%" stopColor="#DC2626" /></linearGradient></defs>
    </svg>
);

const AgeIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.2" />
        <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1D4ED8">18+</text>
    </svg>
);

const FitnessIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <path d="M3 12h3l2-6 3 12 3-8 2 4h5" stroke="#F43F5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function RunEventDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();

    const [event, setEvent] = useState(location.state?.event || null);
    const [loading, setLoading] = useState(() => !(location.state?.event));
    const [liked, setLiked] = useState(false);
    const [imgPg, setImgPg] = useState(0);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [activeRunTab, setActiveRunTab] = useState('Details');
    const [openInfo, setOpenInfo] = useState(null);
    const [termsOpen, setTermsOpen] = useState(false);
    const [heroLoaded, setHeroLoaded] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        const eventId = id || location.state?.event?._id || location.state?.event?.id;
        if (!eventId) {
            setLoading(false);
            return;
        }
        // Keep showing seeded event while refreshing — no full-page spinner flash
        if (!location.state?.event) setLoading(true);
        const controller = new AbortController();
        fetch(`${API}/sports/${eventId}`, { signal: controller.signal })
            .then((r) => r.json())
            .then((d) => {
                if (d.event) setEvent(d.event);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [id, location.state?.event]);

    useEffect(() => {
        if (!event || !id) return;
        const canonical = sportRunPath(event);
        if (canonical && window.location.pathname !== canonical) {
            navigate(`${canonical}${window.location.search || ''}`, { replace: true, state: location.state });
        }
    }, [event, id, navigate, location.state]);

    if (loading) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 rounded-full border-4 border-[#0ECCEE] border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className="crwdctrl-page crwdctrl-page--content flex flex-col items-center justify-center min-h-screen gap-3 px-6">
                <span className="text-4xl">🏃</span>
                <p className="text-gray-500 text-sm text-center">Run not found</p>
                <button onClick={() => navigate(-1)} className="text-[#0ECCEE] text-sm font-semibold">
                    ← Go back
                </button>
            </div>
        );
    }

    const club = event.runClub || null;
    const coverImg = event.coverImage || null;
    const rawImages = event.images?.filter(Boolean) || [];
    const allImages = coverImg ? [coverImg, ...rawImages.filter((u) => u !== coverImg)] : rawImages;
    const images = allImages.length ? allImages : [null];
    const communityName = club?.name || event.organizer || 'Community Name';
    const mapQuery = event.venue || event.city || club?.basedIn || '';
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

    const handleShare = () => {
        shareContent({ title: event.title, url: window.location.href });
    };

    const canonicalPath = sportRunPath(event || { id });

    return (
        <div className="crwdctrl-page flex flex-col min-h-screen" style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}>
            <Seo
                title={event.title || 'Run Event'}
                description={desc}
                canonical={canonicalPath}
                image={coverImg || images?.[0]}
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
                        image: coverImg || images?.[0],
                        location: mapQuery || undefined,
                        price: event.registrationFee != null ? event.registrationFee : undefined,
                        organizerName: communityName !== 'Community Name' ? communityName : undefined,
                        availabilityUrl: `${canonicalPath}/book`,
                    }),
                ]}
            />
            <div className="mx-auto w-full md:max-w-2xl flex flex-col flex-1">
            <div className="relative w-full h-[396px] shrink-0 overflow-hidden">
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
                            <div key={i} className="shrink-0 w-full h-full snap-start">
                                {img ? (
                                    <>
                                        {!heroLoaded && i === 0 && (
                                            <div aria-hidden className="absolute inset-0 bg-[#1A1B1D]" />
                                        )}
                                        <img
                                        src={getImageUrl(img, { preset: 'hero' })}
                                        alt={event.title}
                                        className={`w-full h-full object-cover content-image pointer-events-none select-none ${
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

                <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/30 pointer-events-none" />

                <div
                    className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
                    style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 0px) + 2.5rem)' }}
                >
                    <button
                        onClick={() => navigate(-1)}
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

            <div
                className="fixed bottom-0 left-0 right-0 z-50 px-2"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
            >
                <div className={`mx-auto w-full max-w-md md:max-w-2xl flex items-center justify-between gap-4 rounded-[30px] px-5 py-3.5 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
                    <div className="min-w-0 shrink-0">
                        <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Registration Fee</p>
                        {Number(event.registrationFee) > 0 ? (
                            <p className={`mt-0.5 text-2xl font-bold leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                ₹{Number(event.registrationFee).toLocaleString('en-IN')}
                            </p>
                        ) : (
                            <p className="mt-0.5 text-2xl font-bold leading-none text-green-500">Free</p>
                        )}
                    </div>
                    {(() => {
                        const closed = event.registration?.status === 'closed';
                        const full = Boolean(event.isFull) || (event.seatsRemaining === 0 && event.maxParticipants > 0);
                        const extLink = event.registration?.mode === 'external_link'
                            ? event.registrationLink
                            : null;
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
                                onClick={() => {
                                    if (extLink) {
                                        window.open(extLink, '_blank', 'noopener,noreferrer');
                                        return;
                                    }
                                    navigate(`${sportRunPath(event)}/book`, { state: { event, runClub: club } });
                                }}
                                className="flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg bg-[#0ECCEE] text-black active:opacity-90 transition"
                            >
                                {extLink
                                    ? 'Book Now'
                                    : Number(event.registrationFee) <= 0
                                        ? 'Register free'
                                        : event.registration?.mode === 'organizer_qr'
                                            ? 'Pay via UPI'
                                            : 'Book now'}
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m9 18 6-6-6-6" />
                                </svg>
                            </button>
                        );
                    })()}
                </div>
            </div>

            <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 ${isDark ? 'bg-[#161718]' : 'bg-slate-100'}`}>
                <div className="px-4 pt-5 pb-3">
                    <h1 className={`text-[26px] font-bold leading-8 wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title || 'Run Name'}
                    </h1>
                    <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{communityName}</p>
                    {event.seatsRemaining != null ? (
                        <p className={`text-xs mt-1.5 ${
                            event.seatsRemaining === 0
                                ? 'text-red-400'
                                : event.seatsRemaining <= 5
                                    ? 'text-amber-400'
                                    : (isDark ? 'text-gray-400' : 'text-gray-500')
                        }`}>
                            {event.seatsRemaining === 0
                                ? 'No seats left'
                                : `${event.seatsRemaining} seat${event.seatsRemaining === 1 ? '' : 's'} left`}
                        </p>
                    ) : null}
                </div>

                <div className="px-4 flex items-start gap-3 mb-5">
                    <div className="flex-1 min-w-0 space-y-3.5">
                        {[
                            { Icon: ClockIcon, label: 'Distance', value: event.distance || '—' },
                            { Icon: ChartIcon, label: 'Run Level', value: SKILL_LABELS[event.skillLevel] || event.skillLevel || '—' },
                            { Icon: GridIcon, label: 'Run Style', value: event.runCategory || event.displayType || '—' },
                        ].map((row) => (
                            <div key={row.label} className="flex items-center gap-2.5">
                                <row.Icon size={22} />
                                <div>
                                    <p className={`text-[15px] font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                                    <p className={`text-[11px] font-medium leading-4 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{row.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="w-60 shrink-0 flex flex-col">
                        <div className="w-full h-[132px] rounded-2xl overflow-hidden relative">
                            {mapQuery ? (
                                <LazyMap query={mapQuery} isDark={isDark} title="run-location" />
                            ) : (
                                <div className="w-full h-full bg-linear-to-br from-green-50 to-blue-50 flex flex-col items-center justify-center gap-1">
                                    <span className="text-[10px] text-gray-400">No location</span>
                                </div>
                            )}
                        </div>
                        {mapQuery && (
                            <p className={`text-[11px] font-semibold text-center mt-1.5 leading-4 tracking-tight w-full ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                {mapQuery}
                            </p>
                        )}
                    </div>
                </div>

                <div className="px-4 mb-5">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Overview</h2>
                    <p className={`text-sm leading-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        {overviewExpanded ? desc : shortDesc}
                        {desc.length > 150 && (
                            <>
                                {!overviewExpanded && '...'}
                                <button onClick={() => setOverviewExpanded((v) => !v)} className="text-[#0ECCEE] text-sm font-medium ml-0.5">
                                    {overviewExpanded ? ' show less' : 'read more'}
                                </button>
                            </>
                        )}
                    </p>
                </div>

                {(() => {
                    const detailCards = [
                        { show: event.maxParticipants > 0, Icon: PersonIcon, label: 'Max People', value: event.maxParticipants },
                        { show: !!event.reportingTime, Icon: SunIcon, label: 'Run Timing', value: event.reportingTime },
                        { show: !!event.returnTime, Icon: MoonIcon, label: 'Return Time', value: event.returnTime },
                        { show: !!event.meetingPoint, Icon: MapPinIcon, label: 'Meeting Point', value: event.meetingPoint },
                        { show: !!event.ageLimit, Icon: AgeIcon, label: 'Age Limit', value: event.ageLimit },
                        { show: !!event.fitnessLevel, Icon: FitnessIcon, label: 'Fitness', value: event.fitnessLevel },
                    ].filter((r) => r.show);
                    const inclusions = event.inclusions || [];
                    const infoSections = event.infoSections || [];
                    if (!detailCards.length && !inclusions.length && !infoSections.length) return null;
                    return (
                        <div className="px-4 mb-5">
                            <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Run Info</h2>
                            <div className={`rounded-2xl p-1 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                                <div className="flex rounded-xl p-1 gap-0.5">
                                    {['Details', 'Included'].map((tab) => (
                                        <button
                                            key={tab}
                                            type="button"
                                            onClick={() => setActiveRunTab(tab)}
                                            className={`relative flex-1 py-2 text-xs font-semibold rounded-xl transition-all duration-200
                                                ${activeRunTab === tab
                                                    ? isDark ? 'bg-[#1D1E20] text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
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

                                <div className="p-3 pt-2 space-y-2">
                                {activeRunTab === 'Details' && (
                                    <>
                                        {detailCards.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-2">
                                                {detailCards.map((row) => (
                                                    <div key={row.label} className={`rounded-2xl p-3 border ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                                        <row.Icon size={22} />
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
                                        <div className={`rounded-xl p-3 ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                                            <ul className="space-y-1.5">
                                                {inclusions.map((item, i) => (
                                                    <li key={i} className={`flex gap-2 text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                                        <span className="mt-[5px] size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                                                        <span>{String(item).replace(/^[-*•\s]+/, '')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    ) : (
                                        <p className={`text-sm px-1 py-2 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>No experience items listed.</p>
                                    )
                                )}
                                </div>
                            </div>
                        </div>
                    );
                })()}

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
                                    {terms.length} points — tap to {termsOpen ? 'collapse' : 'read'}
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
                            {terms.map((term, i) => (
                                <div
                                    key={i}
                                    className={`flex gap-3 px-4 py-3 ${i < terms.length - 1 ? `border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                                >
                                    <span
                                        className={`text-xs font-bold mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-amber-50 text-amber-600'}`}
                                    >
                                        {i + 1}
                                    </span>
                                    <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{term}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 pb-28">
                    <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact Details</h2>
                    <div className="space-y-2.5">
                        {(() => {
                            const phone = event.contactPhone || club?.contactPhone;
                            return (
                                <a
                                    href={phone ? `tel:${phone}` : undefined}
                                    className={`flex items-center gap-3 p-3.5 rounded-2xl border ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}
                                >
                                    <div className="size-10 rounded-xl bg-[#0ECCEE] flex items-center justify-center shrink-0">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white" stroke="none">
                                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                        </svg>
                                    </div>
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Phone</p>
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{phone || 'Not set'}</p>
                                    </div>
                                </a>
                            );
                        })()}
                        {(() => {
                            const insta = event.contactInstagram || club?.contactInstagram;
                            return (
                                <a
                                    href={insta ? `https://instagram.com/${insta.replace('@', '')}` : undefined}
                                    target={insta ? '_blank' : undefined}
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
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Instagram</p>
                                        <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{insta || 'Not set'}</p>
                                    </div>
                                </a>
                            );
                        })()}
                    </div>
                </div>
            </div>
            </div>
        </div>
    );
}

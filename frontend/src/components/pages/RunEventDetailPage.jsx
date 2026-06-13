import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, Share2, Heart, ChevronRight } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { getImageUrl } from '../../utils/imageImports';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

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

const ListIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#DCFCE7" />
        <path d="M7 8h10M7 12h10M7 16h6" stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="19" cy="16" r="3.5" fill="#22C55E" />
        <path d="M17.2 16l1 1.2 2-2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default function RunEventDetailPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id } = useParams();
    const { isDark } = useDarkMode();

    const [event, setEvent] = useState(location.state?.event || null);
    const [loading, setLoading] = useState(true);
    const [liked, setLiked] = useState(false);
    const [imgPg, setImgPg] = useState(0);
    const [overviewExpanded, setOverviewExpanded] = useState(false);
    const [inclusionOpen, setInclusionOpen] = useState(false);
    const [termsOpen, setTermsOpen] = useState(false);
    const imgRef = useRef(null);

    useEffect(() => {
        const eventId = id || location.state?.event?._id || location.state?.event?.id;
        if (!eventId) {
            setLoading(false);
            return;
        }
        fetch(`${API}/sports/${eventId}`)
            .then((r) => r.json())
            .then((d) => {
                if (d.event) setEvent(d.event);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id, location.state?.event]);

    if (loading) {
        return (
            <div className={`flex items-center justify-center min-h-screen ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
                <div className="w-8 h-8 rounded-full border-4 border-[#0ECCEE] border-t-transparent animate-spin" />
            </div>
        );
    }

    if (!event) {
        return (
            <div className={`flex flex-col items-center justify-center min-h-screen gap-3 px-6 ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
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
        if (navigator.share) navigator.share({ title: event.title, url: window.location.href }).catch(() => {});
    };

    const eventId = id || event._id || event.id;

    return (
        <div className={`crwdctrl-page crwdctrl-mobile-page flex flex-col min-h-screen ${isDark ? 'bg-[#161718]' : 'bg-[#EDEDF2]'}`}>
            <div className="relative w-full h-[396px] shrink-0 overflow-hidden">
                <div
                    ref={imgRef}
                    className="overflow-x-auto scrollbar-hide snap-x snap-mandatory w-full h-full"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    onScroll={(e) => setImgPg(Math.round(e.target.scrollLeft / e.target.clientWidth))}
                >
                    <div className="flex h-full">
                        {images.map((img, i) => (
                            <div key={i} className="shrink-0 w-full h-full snap-start">
                                {img ? (
                                    <img
                                        src={getImageUrl(img, { preset: 'hero' })}
                                        alt={event.title}
                                        className="w-full h-full object-cover content-image"
                                        loading="lazy"
                                        decoding="async"
                                        onError={(e) => handleImageErrorWithFallback(e, 393, 396, '#14532d', event.title)}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-linear-to-br from-green-900 via-emerald-800 to-teal-700 flex items-center justify-center">
                                        <span className="text-7xl opacity-40">🏃</span>
                                    </div>
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
                        className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                    >
                        <ArrowLeft size={22} strokeWidth={2.25} className="text-white" />
                    </button>
                    <div className="flex items-center gap-2.5">
                        <button
                            onClick={handleShare}
                            aria-label="Share"
                            className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Share2 size={20} strokeWidth={2.25} className="text-white" />
                        </button>
                        <button
                            onClick={() => setLiked((l) => !l)}
                            aria-label="Favourite"
                            className="size-11 rounded-full bg-stone-900/20 backdrop-blur-sm flex items-center justify-center"
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
                className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
            >
                <div
                    className={`px-4 py-2.5 flex items-center gap-4 border-t
                    ${isDark ? 'bg-[#111213] border-gray-800' : 'bg-white border-gray-100'}`}
                >
                    <div className="flex-1 min-w-0 pl-4">
                        {Number(event.registrationFee) > 0 ? (
                            <>
                                <p className={`text-[10px] font-medium ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Price</p>
                                <div className="flex items-baseline gap-0.5">
                                    <span className={`text-base font-bold ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>₹</span>
                                    <span className={`text-3xl font-extrabold leading-none ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                        {Number(event.registrationFee).toLocaleString('en-IN')}
                                    </span>
                                    <span className={`text-[10px] ml-1 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>/ person</span>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-center gap-1.5 pl-4">
                                <span className="text-3xl font-extrabold text-green-500 leading-none">FREE</span>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => navigate(`/sports/run/${eventId}/book`, { state: { event, runClub: club } })}
                        className="flex items-center justify-center gap-2 w-52 py-2.5 rounded-xl bg-[#0ECCEE] text-black font-bold text-sm shadow-md shadow-[#0ECCEE]/20 active:scale-95 transition-all shrink-0"
                    >
                        Check Availability
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 ${isDark ? 'bg-[#161718]' : 'bg-slate-100'}`}>
                <div className="px-4 pt-5 pb-3">
                    <h1 className={`text-[26px] font-bold leading-8 wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {event.title || 'Run Name'}
                    </h1>
                    <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{communityName}</p>
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

                    <div className="flex flex-col shrink-0">
                        <div className="w-60 h-33 rounded-2xl overflow-hidden relative">
                            {mapQuery ? (
                                <>
                                    <div className={`absolute inset-0 animate-pulse ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-200'}`} />
                                    <iframe
                                        title="run-location"
                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&zoom=11`}
                                        width="100%"
                                        height="100%"
                                        style={{ border: 0, display: 'block', position: 'relative' }}
                                        loading="eager"
                                        referrerPolicy="no-referrer-when-downgrade"
                                    />
                                </>
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

                <div className="px-4 mb-5">
                    <div className="grid grid-cols-2 gap-2">
                        {event.maxParticipants > 0 && (
                            <div className={`rounded-2xl p-3 border ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <PersonIcon size={22} />
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Max People</p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.maxParticipants}</p>
                            </div>
                        )}
                        {event.reportingTime && (
                            <div className={`rounded-2xl p-3 border ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-sm'}`}>
                                <SunIcon size={22} />
                                <p className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Run Timing</p>
                                <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.reportingTime}</p>
                            </div>
                        )}
                    </div>

                    {event.inclusions?.length > 0 && (
                        <button
                            onClick={() => setInclusionOpen((o) => !o)}
                            className={`w-full mt-2 rounded-2xl p-3 border text-left ${isDark ? 'bg-[#111213] border-white/5' : 'bg-gray-50 border-gray-100'}`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <ListIcon />
                                    <div>
                                        <p className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Experience Included</p>
                                        <p className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                            {inclusionOpen ? event.inclusions.join(', ') : event.inclusions.slice(0, 2).join(', ')}
                                            {!inclusionOpen && event.inclusions.length > 2 && '…'}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight
                                    size={16}
                                    className={`shrink-0 transition-transform ${inclusionOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                                />
                            </div>
                        </button>
                    )}
                </div>

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
    );
}

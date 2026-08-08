import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, Heart, Calendar, MapPin,
  Phone, Instagram, Mail, ChevronRight, ChevronLeft, X, Check,
} from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import { useDialog } from '../../context/DialogContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useAuth } from '../../context/AuthContext';
import CrwdCtrlLogin from '../auth/login';
import { getImageUrl } from '../../utils/imageImports';
import { getCoverImageUrl, normalizeCoverImages, primaryCoverUrl } from '../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../utils/fallbackImageGenerator';
import { shareContent, openExternalUrl } from '../../utils/externalLink';
import { publicFetchJSONRetry as fetchJSON } from '../../services/api/client';
import { EVENT_TYPE_LABELS, formatEventShowDate } from '../../constants/eventsPage';
import Seo from '../../components/Seo';
import { breadcrumbSchema, eventSchema } from '../../utils/seo';
import { eventShowPath } from '../../utils/slugRoutes';
import { trackBookNowClick } from '../../services/analyticsService';
import { getEventShowTiers, isEventShowTiersPricing, formatInr } from '../../utils/eventShowTiers';
import DetailPageLoader from '../../components/DetailPageLoader';
import PrizePoolPodium from '../../components/PrizePoolPodium';
import { getSuggestedCouponCode, getSuggestedCouponLabel } from '../../utils/suggestedCoupon';

function ordinalDay(n) {
  const d = Number(n);
  const j = d % 10;
  const k = d % 100;
  if (j === 1 && k !== 11) return `${d}st`;
  if (j === 2 && k !== 12) return `${d}nd`;
  if (j === 3 && k !== 13) return `${d}rd`;
  return `${d}th`;
}

function formatEventDateTime(showTimings) {
  if (!showTimings?.length) return 'Date & time TBA';
  const dates = showTimings
    .filter((s) => s.date)
    .map((s) => new Date(s.date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (!dates.length) return 'Date & time TBA';

  // Two+ days in same month → "22nd and 23rd Aug"
  if (dates.length >= 2) {
    const first = dates[0];
    const last = dates[dates.length - 1];
    const sameMonth =
      first.getFullYear() === last.getFullYear()
      && first.getMonth() === last.getMonth();
    if (sameMonth) {
      const month = first.toLocaleDateString('en-IN', { month: 'short' });
      if (dates.length === 2) {
        return `${ordinalDay(first.getDate())} and ${ordinalDay(last.getDate())} ${month}`;
      }
      const days = dates.map((d) => ordinalDay(d.getDate())).join(', ');
      return `${days} ${month}`;
    }
  }

  const firstTiming = showTimings.find((s) => s.date) || showTimings[0];
  const dateStr = formatEventShowDate(showTimings);
  const time = String(firstTiming?.time || '').trim();
  // Skip placeholder day labels like "Day 1"
  if (time && !/^day\s*\d+$/i.test(time)) {
    return `${dateStr} · ${time}`;
  }
  return dateStr;
}

function mapEventDetail(raw) {
  if (!raw) return null;
  const coverImages = normalizeCoverImages(raw.coverImages);
  const poster = primaryCoverUrl(coverImages, raw.poster);
  return {
    id: raw._id,
    title: raw.title || 'Event',
    displayName: raw.displayName || '',
    organizer: raw.organizer || '',
    type: raw.eventHeading || EVENT_TYPE_LABELS[raw.eventType] || raw.eventType || 'Event',
    dateTime: formatEventDateTime(raw.showTimings),
    venue: raw.venue || raw.city || 'Venue TBA',
    mapUrl: (raw.mapUrl || '').trim(),
    meetingPoints: Array.isArray(raw.meetingPoints)
      ? raw.meetingPoints
        .map((p) => ({
          label: String(p?.label || p?.name || '').trim(),
          mapUrl: String(p?.mapUrl || p?.url || '').trim(),
        }))
        .filter((p) => p.label)
      : [],
    ticketPrice: raw.ticketPrice,
    priceLabel: raw.priceLabel || '',
    pricingMode: raw.pricingMode === 'tiers' ? 'tiers' : 'single',
    tiers: Array.isArray(raw.tiers) ? raw.tiers : [],
    about: raw.description || '',
    whatsIncluded: raw.whatsIncluded || '',
    benefits: raw.benefits || '',
    eligibility: raw.eligibility || '',
    slots: raw.slots || '',
    registrationProcess: raw.registrationProcess || '',
    generalRules: raw.generalRules || '',
    process: raw.process || '',
    prizePool: raw.prizePool || '',
    registrationLink: raw.registrationLink || '',
    bookingLink: raw.bookingLink || '',
    rounds: Array.isArray(raw.rounds) ? raw.rounds.filter((r) => r?.title || r?.content) : [],
    contacts: Array.isArray(raw.contacts) ? raw.contacts.filter((c) => c?.name || c?.phone || c?.email || c?.instagramId) : [],
    galleryImages: Array.isArray(raw.galleryImages) ? raw.galleryImages.filter(Boolean) : [],
    coverImages,
    image: poster || '',
    poster,
    banner: raw.banner || '',
    registration: raw.registration || {},
    raw,
  };
}

function toLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/** Strip leading "1. " / "1) " so Terms-style UI can number cleanly */
function toNumberedLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.replace(/^\d+[.)]\s*/, '').replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

const RULE_SECTION_HEADINGS = [
  'eligibility',
  'registration',
  'match rules',
  'fair play',
  'internet & technical',
  'internet and technical',
  'prizes',
  'organizer rights',
  'general rules',
  'rules',
  'prize pool',
  'process',
  "what's included",
  'whats included',
  'benefits',
  'how to register',
];

function isRuleHeading(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  if (/:\s*$/.test(trimmed)) return true;
  return RULE_SECTION_HEADINGS.includes(trimmed.replace(/:\s*$/, '').toLowerCase());
}

/** Split general rules text into { title, lines } sections by headings. */
function splitRuleSections(text) {
  const lines = toLines(text);
  if (!lines.length) return [];
  const sections = [];
  let current = null;
  for (const line of lines) {
    if (isRuleHeading(line)) {
      current = { title: line.replace(/:\s*$/, '').trim(), lines: [] };
      sections.push(current);
      continue;
    }
    if (!current) {
      current = { title: 'General', lines: [] };
      sections.push(current);
    }
    current.lines.push(line);
  }
  return sections.filter((s) => s.lines.length > 0 || s.title);
}

/** Keep exactly 4 general boxes — merge leftovers into the last card. */
function toFourRuleBoxes(sections) {
  if (!sections.length) return [];
  if (sections.length <= 4) return sections.slice(0, 4);
  const firstThree = sections.slice(0, 3);
  const rest = sections.slice(3);
  return [
    ...firstThree,
    {
      title: rest[0]?.title || 'More Rules',
      lines: rest.flatMap((s, i) => (i === 0 ? s.lines : [s.title, ...s.lines])),
    },
  ];
}

function isTermsStyleRound(title = '') {
  const t = String(title).toLowerCase();
  return t.includes('safety') || t.includes('indemnity') || t.includes('terms');
}

export default function EventDetailsPage() {
  const { isDark } = useDarkMode();
  const { toast } = useDialog();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [showLogin, setShowLogin] = useState(false);

  const isLoggedIn = () => isAuthenticated || !!localStorage.getItem('crwdctrl_token');

  const handleBack = () => {
    // If the user navigated here within the app, go back normally.
    // If they opened a shared link directly (no in-app history), send them
    // to the dashboard/home page instead of leaving the site.
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [tierSheetOpen, setTierSheetOpen] = useState(false);
  const [expandedTierId, setExpandedTierId] = useState(null);
  const [selectingTierId, setSelectingTierId] = useState(null);
  const [openInfoRound, setOpenInfoRound] = useState({});
  const [activeRound, setActiveRound] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!eventId) {
        navigate('/events');
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await fetchJSON(`/events/${eventId}?t=${Date.now()}`);
        const mapped = mapEventDetail(res.data?.show);
        if (!active) return;
        if (mapped) setEvent(mapped);
        else setError('Event not found');
      } catch (err) {
        if (!active) return;
        setError(err?.status === 404 ? 'Event not found' : 'Failed to load event');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [eventId, navigate]);

  useEffect(() => {
    if (!event || !eventId) return;
    const canonical = eventShowPath(event);
    if (canonical && window.location.pathname !== canonical) {
      navigate(`${canonical}${window.location.search || ''}`, { replace: true });
    }
  }, [event, eventId, navigate]);

  const competitionRounds = event
    ? event.rounds.filter((r) => !isTermsStyleRound(r.title))
    : [];
  const termsRounds = event
    ? event.rounds.filter((r) => isTermsStyleRound(r.title))
    : [];
  const hasCompetitionRounds = competitionRounds.length > 0;

  // Competition-style events: Prize Pool replaces About; General Rules shown as 4 boxes
  const tabs = event && !hasCompetitionRounds
    ? [
        { key: 'general', label: 'General Rules', content: event.generalRules, type: 'list' },
        { key: 'process', label: 'Process', content: event.process, type: 'list' },
        { key: 'prize', label: 'Prize Pool', content: event.prizePool, type: 'list' },
        { key: 'included', label: "What's Included", content: event.whatsIncluded, type: 'list' },
        { key: 'eligibility', label: 'Eligibility', content: event.eligibility, type: 'list' },
      ].filter((t) => Boolean(t.content && String(t.content).trim()))
    : [];

  const generalRuleBoxes = event && hasCompetitionRounds
    ? toFourRuleBoxes(splitRuleSections(event.generalRules))
    : [];
  const hasPrizePool = event && hasCompetitionRounds && Boolean(String(event.prizePool || '').trim());

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  useEffect(() => {
    setActiveRound(0);
  }, [event?.id]);

  const handleShare = async () => {
    const shareImage =
      getCoverImageUrl(event, 'eventPage')
      || getCoverImageUrl(event, 'hero')
      || getCoverImageUrl(event, 'portrait')
      || getImageUrl(event?.image, { preset: 'eventPage' })
      || event?.image
      || '';
    const result = await shareContent({
      title: event?.title,
      text: event?.about?.slice(0, 120),
      url: window.location.href,
      imageUrl: shareImage,
    });
    if (result === 'copied') toast('Event link copied to clipboard!');
  };

  const handleFavorite = () => {
    if (!event) return;
    toggleFavorite(event.id, {
      id: event.id,
      _id: event.id,
      _type: 'events',
      type: 'events',
      title: event.title,
      subtitle: event.organizer,
      image: event.image,
    });
  };

  const handleRegister = () => {
    const r = event?.registration || {};
    if (['internal_form', 'organizer_qr'].includes(r.mode)) {
      if (r.status !== 'open') {
        toast('Registration is currently closed');
        return;
      }
      if (!isLoggedIn()) {
        toast('Please log in to register');
        setShowLogin(true);
        return;
      }
      const formFields = [
        ...(Array.isArray(r.formSchema) ? r.formSchema : []),
        ...((Array.isArray(r.steps) ? r.steps : []).flatMap((s) => s.fields || [])),
      ];
      const asksDriveFirst = formFields.some((f) =>
        /join_drive|independence_day_drive/i.test(String(f?.fieldName || ''))
        || /independence day drive/i.test(String(f?.label || '')),
      );
      const tiers = isEventShowTiersPricing(event) ? getEventShowTiers(event) : [];
      // Drive Yes/No must come before package — skip the package sheet
      if (tiers.length && !asksDriveFirst) {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: 'internal_form',
          destination: 'tier_selection',
        });
        setExpandedTierId(null);
        setSelectingTierId(null);
        setTierSheetOpen(true);
        return;
      }
      trackBookNowClick({
        entityType: 'events',
        entityId: event?.id || '',
        mode: 'internal_form',
        destination: 'internal_register_page',
      });
      navigate(`${eventShowPath(event)}/register`, {
        state: {
          event: event.raw || event,
          suggestedCoupon: getSuggestedCouponCode(event),
        },
      });
      return;
    }
    const link = event?.registrationLink || event?.bookingLink;
    if (link) {
      const trimmed = String(link).trim();
      const isInternalPath = trimmed.startsWith('/') && !trimmed.startsWith('//');
      trackBookNowClick({
        entityType: 'events',
        entityId: event?.id || '',
        mode: 'external_link',
        destination: isInternalPath ? 'internal_app_path' : 'external',
      });
      // Competition-backed event listings use in-app paths (e.g. /competition-registration/:id)
      if (isInternalPath) {
        navigate(trimmed);
        return;
      }
      openExternalUrl(trimmed);
    }
    else toast('Registration link not available yet');
  };

  if (loading) {
    return <DetailPageLoader />;
  }

  if (error || !event) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{error || 'Event not found'}</h2>
          <button
            onClick={() => navigate('/events')}
            className="px-6 py-3 rounded-xl bg-[#0ECCEE] text-black font-semibold"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const gallery = event.galleryImages;
  const galleryPreview = gallery.slice(0, 4);
  const galleryExtra = Math.max(0, gallery.length - 4);
  const activeTabObj = tabs.find((t) => t.key === activeTab);
  const tiersPricing = isEventShowTiersPricing(event);
  const packageTiers = tiersPricing ? getEventShowTiers(event) : [];
  const aboutLong = event.about.length > 180;
  const benefitsList = toLines(event.benefits);
  const hasRegistrationInfo = event.slots || event.registrationProcess;

  const reg = event.registration || {};
  const registrationClosed = ['internal_form', 'organizer_qr'].includes(reg.mode)
    ? reg.status !== 'open'
    : !(event.registrationLink || event.bookingLink);

  const suggestedCoupon = getSuggestedCouponCode(event);
  const suggestedCouponLabel = getSuggestedCouponLabel(suggestedCoupon);

  const cardBg = isDark ? 'bg-[#111213]' : 'bg-white border border-gray-100 shadow-md';
  const sheetBg = isDark ? 'bg-[#161718]' : 'bg-white';
  const factCard = isDark ? 'bg-[#111213]' : 'bg-white border border-gray-100 shadow-md';
  const sectionCard = isDark ? 'bg-[#111213]' : 'bg-white border border-gray-100 shadow-md';

  // Prefer organizer-pasted Maps pin; fall back to Google search on venue text
  const hasVenue = Boolean(event.venue) && event.venue !== 'Venue TBA';
  const isOnlineOrDiscordVenue = /discord|online/i.test(String(event.venue || ''));
  const discordInvite =
    event.meetingPoints?.map((p) => p.mapUrl).find((u) => /discord\.(gg|com)/i.test(u || ''))
    || (/discord\.(gg|com)/i.test(event.bookingLink || '') ? event.bookingLink : '')
    || (/discord\.(gg|com)/i.test(event.registrationLink || '') ? event.registrationLink : '')
    || '';
  const directionsUrl = discordInvite || isOnlineOrDiscordVenue
    ? null
    : (event.mapUrl
      || (hasVenue
        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`
        : null));
  const showEventType = Boolean(event.type) && !/^other$/i.test(String(event.type).trim());

  return (
    <div className="crwdctrl-page min-h-screen pb-28">
      <Seo
        title={event.title}
        description={event.about ? event.about.slice(0, 160) : `${event.title} — ${event.type}`}
        canonical={eventShowPath(event)}
        image={
          event.coverImages?.page
          || event.coverImages?.hero
          || event.coverImages?.portrait
          || event.image
        }
        type="article"
        jsonLd={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Events', path: '/events' },
            { name: event.title, path: eventShowPath(event) },
          ]),
          eventSchema({
            name: event.title,
            description: event.about,
            url: eventShowPath(event),
            image:
              event.coverImages?.page
              || event.coverImages?.hero
              || event.coverImages?.portrait
              || event.image,
            location: event.venue !== 'Venue TBA' ? event.venue : undefined,
            price: event.ticketPrice,
            organizerName: event.organizer || undefined,
          }),
        ]}
      />

      <div className="mx-auto w-full md:max-w-2xl">
        {/* Hero — 5:4 matches admin “Event page top image” crop / Adjust */}
        <div className="relative w-full aspect-[5/4] max-h-[28rem]">
          {event.image ? (
            <img
              src={
                getCoverImageUrl(event, 'eventPage')
                || getCoverImageUrl(event, 'hero')
                || getImageUrl(event.image, { preset: 'eventPage' })
              }
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => handleImageErrorWithFallback(e, 400, 320, '#2A2B2E', event.title)}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-purple-800 to-indigo-600 flex items-center justify-center">
              <span className="text-6xl">🎭</span>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,var(--safe-top))] pb-3 bg-linear-to-b from-black/35 to-transparent">
            <button
              type="button"
              onClick={handleBack}
              className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
              aria-label="Go back"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm text-white"
                aria-label="Share"
              >
                <Share2 size={20} />
              </button>
              <button
                type="button"
                onClick={handleFavorite}
                className="p-2 rounded-full bg-black/30 backdrop-blur-sm"
                aria-label="Add to favourites"
              >
                <Heart size={20} className={isFavorite(event.id) ? 'fill-red-500 text-red-500' : 'text-white'} />
              </button>
            </div>
          </div>

          {gallery.length > 1 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
              {gallery.slice(0, 5).map((_, idx) => (
                <span key={idx} className={`h-1.5 rounded-full transition-all ${idx === 0 ? 'w-5 bg-white' : 'w-1.5 bg-white/60'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Content sheet */}
        <div className={`relative -mt-5 rounded-t-3xl px-5 pt-6 ${sheetBg}`}>
          <h1 className={`text-2xl font-semibold leading-8 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {event.title}
          </h1>
          {event.displayName && event.displayName.toLowerCase() !== event.title.toLowerCase() && (
            <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
              {event.displayName}
            </p>
          )}
          {showEventType && (
            <span className="block mt-2 text-sm font-semibold uppercase tracking-wide text-[#0ECCEE]">
              {event.type}
            </span>
          )}
          {event.organizer && (
            <p className={`text-sm font-semibold mt-2 ${isDark ? 'text-gray-400' : 'text-gray-700'}`}>
              Organized by {event.organizer}
            </p>
          )}

          {/* Quick facts */}
          <div className="mt-4 space-y-2.5">
            <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${factCard}`}>
              <Calendar size={18} className="text-[#0ECCEE] shrink-0" />
              <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{event.dateTime}</span>
            </div>
            {discordInvite ? (
              <>
                <button
                  type="button"
                  onClick={() => openExternalUrl(discordInvite)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition active:opacity-80 ${factCard}`}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0 text-[#5865F2]">
                    <path
                      fill="currentColor"
                      d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0 12.6 12.6 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.09.09 0 0 0-.041.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.373-.292a.074.074 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .079.01c.12.098.247.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.8 19.8 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.041-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"
                    />
                  </svg>
                  <span className={`flex-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Join Discord
                  </span>
                  <span className="text-xs font-semibold text-[#5865F2]">Open</span>
                </button>
                {event.venue && event.venue !== 'Venue TBA' ? (
                  <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${factCard}`}>
                    <MapPin size={18} className="text-[#0ECCEE] shrink-0" />
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{event.venue}</span>
                  </div>
                ) : null}
              </>
            ) : event.meetingPoints?.length > 0 ? (
              <div className={`rounded-xl px-3 py-2.5 ${factCard}`}>
                <div className="flex items-center gap-2.5 mb-2">
                  <MapPin size={18} className="text-[#0ECCEE] shrink-0" />
                  <p className={`text-sm font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                    Meeting points
                  </p>
                </div>
                <div className="space-y-1.5">
                  {event.meetingPoints.map((point, idx) => {
                    const canOpen = Boolean(point.mapUrl);
                    const RowTag = canOpen ? 'button' : 'div';
                    return (
                      <RowTag
                        key={`${point.label}-${idx}`}
                        type={canOpen ? 'button' : undefined}
                        onClick={canOpen ? () => openExternalUrl(point.mapUrl) : undefined}
                        className={`w-full flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left ${
                          isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                        } ${canOpen ? 'cursor-pointer' : ''}`}
                      >
                        <p className={`min-w-0 flex-1 truncate text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                          <span className={`mr-1.5 font-semibold ${isDark ? 'text-[#0ECCEE]' : 'text-cyan-700'}`}>{idx + 1}.</span>
                          {point.label}
                        </p>
                        {canOpen ? (
                          <span className="shrink-0 text-[11px] font-semibold text-[#0ECCEE]">
                            Open map
                          </span>
                        ) : null}
                      </RowTag>
                    );
                  })}
                </div>

                {event.venue && event.venue !== 'Venue TBA' ? (
                  <div className={`flex items-start gap-2.5 pt-2 mt-1 border-t ${isDark ? 'border-white/10 text-gray-400' : 'border-gray-200 text-gray-600'}`}>
                    <MapPin size={14} className="shrink-0 mt-0.5 opacity-70" />
                    {directionsUrl ? (
                      <button
                        type="button"
                        onClick={() => openExternalUrl(directionsUrl)}
                        className="text-xs font-medium text-left underline-offset-2 hover:underline hover:text-[#0ECCEE]"
                      >
                        Venue: {event.venue}
                      </button>
                    ) : (
                      <span className="text-xs font-medium">Venue: {event.venue}</span>
                    )}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${factCard}`}>
                <MapPin size={18} className="text-[#0ECCEE] shrink-0" />
                {directionsUrl ? (
                  <button
                    type="button"
                    onClick={() => openExternalUrl(directionsUrl)}
                    className="text-sm font-medium text-left text-[#0ECCEE] underline-offset-2 hover:underline active:opacity-80"
                  >
                    {event.venue}
                  </button>
                ) : (
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{event.venue}</span>
                )}
              </div>
            )}
          </div>

          {/* Prize Pool (competition-style) OR About */}
          {hasPrizePool ? (
            <div className="mt-6">
              <PrizePoolPodium prizeText={event.prizePool} isDark={isDark} />
            </div>
          ) : event.about ? (
            <div className={`mt-6 rounded-2xl p-4 ${sectionCard}`}>
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>About</h2>
              <p className={`text-sm font-medium leading-5 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {showFullAbout || !aboutLong ? event.about : `${event.about.slice(0, 180)}...`}
                {aboutLong && (
                  <button
                    type="button"
                    onClick={() => setShowFullAbout((v) => !v)}
                    className="ml-1 font-semibold text-[#0ECCEE]"
                  >
                    {showFullAbout ? 'read less' : 'read more'}
                  </button>
                )}
              </p>
            </div>
          ) : null}

          {/* Competition-style stage boxes (Stage 1 / 2 / 3 / …) */}
          {hasCompetitionRounds && (
            <div className="mt-6">
              <div className={`rounded-2xl p-4 ${sectionCard}`}>
                <h2 className={`text-lg font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Tournament Stages
                </h2>

                <div
                  className="grid gap-1.5 sm:gap-2 mb-4"
                  style={{ gridTemplateColumns: `repeat(${competitionRounds.length}, minmax(0, 1fr))` }}
                >
                  {competitionRounds.map((r, idx) => {
                    const label = r.title || `Stage ${idx + 1}`;
                    const selected = activeRound === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveRound(idx)}
                        className={`w-full min-w-0 py-2 sm:py-2.5 px-0.5 sm:px-1 rounded-xl text-[10px] sm:text-xs font-semibold transition leading-tight text-center ${
                          selected
                            ? `border-2 border-[#0ECCEE] ${isDark ? 'bg-[#1D1E20] text-white' : 'bg-cyan-50 text-gray-900'}`
                            : isDark
                              ? 'bg-[#1D1E20] text-gray-300 border border-transparent'
                              : 'bg-gray-100 text-gray-700 border border-transparent'
                        }`}
                      >
                        <span className="block whitespace-normal break-words">{label}</span>
                      </button>
                    );
                  })}
                </div>

                {(() => {
                  const round = competitionRounds[activeRound] || competitionRounds[0];
                  if (!round) return null;
                  const lines = toLines(round.content);
                  return (
                    <div className={`rounded-xl p-4 ${isDark ? 'bg-[#1D1E20]' : 'bg-gray-50'}`}>
                      <h3 className={`font-bold text-base mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {round.title || `Stage ${activeRound + 1}`}
                      </h3>
                      {lines.length > 0 ? (
                        <ul className="space-y-2">
                          {lines.map((item, i) => (
                            <li
                              key={i}
                              className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                            >
                              <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Details coming soon</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* General Rules — 4 boxes below stages (competition-style) */}
          {generalRuleBoxes.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                General Rules
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {generalRuleBoxes.map((box, idx) => (
                  <div key={idx} className={`rounded-2xl p-3.5 ${sectionCard}`}>
                    <h3 className={`text-sm font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {box.title}
                    </h3>
                    <ul className="space-y-1.5">
                      {box.lines.map((item, i) => (
                        <li
                          key={i}
                          className={`flex items-start gap-1.5 text-xs leading-snug ${isDark ? 'text-gray-300' : 'text-gray-700'}`}
                        >
                          <span className="mt-1 size-1 rounded-full bg-[#0ECCEE] shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab box — non-competition events only */}
          {tabs.length > 0 && (
            <div className="mt-6">
              <div className={`rounded-2xl p-1 mb-4 border ${isDark ? 'bg-[#111213] border-transparent' : 'bg-white border-gray-100 shadow-md'}`}>
                <div className="flex justify-center gap-1 overflow-x-auto scrollbar-hide rounded-xl p-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`relative shrink-0 whitespace-nowrap py-2 px-4 text-xs font-semibold rounded-xl transition-all duration-200 ${
                        activeTab === t.key
                          ? isDark ? 'bg-[#1D1E20] text-white shadow-sm' : 'bg-gray-50 text-gray-900 shadow-sm'
                          : isDark ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                      }`}
                    >
                      {t.label}
                      {activeTab === t.key && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[#0ECCEE]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`rounded-2xl p-4 ${sectionCard}`}>
                {activeTabObj?.type === 'list' ? (
                  <ul className="space-y-2">
                    {toLines(activeTabObj.content).map((item, idx) => {
                      const trimmed = item.trim();
                      const isHeading = isRuleHeading(trimmed);
                      if (isHeading) {
                        return (
                          <li key={idx} className={`text-sm font-bold ${idx > 0 ? 'mt-3' : ''} ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {trimmed.replace(/:\s*$/, '')}
                          </li>
                        );
                      }
                      return (
                        <li key={idx} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                          {item}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className={`text-sm leading-6 whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    {activeTabObj?.content}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Terms / safety info rounds only */}
          {termsRounds.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Important information
              </h2>
              <div className="space-y-3">
                {termsRounds.map((r, idx) => {
                  const lines = toNumberedLines(r.content);
                  const open = Boolean(openInfoRound[idx]);
                  return (
                    <div key={idx}>
                      <button
                        type="button"
                        onClick={() => setOpenInfoRound((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                        className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${
                          isDark
                            ? 'bg-[#111213] border-white/5 hover:bg-[#1D1E20]'
                            : 'bg-white border-gray-100 shadow-md hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 text-left">
                          <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-amber-50'}`}>
                            <span className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                              {idx + 1}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className={`text-sm font-semibold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                              {r.title || `Section ${idx + 1}`}
                            </p>
                            <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                              {lines.length} points — tap to {open ? 'collapse' : 'read'}
                            </p>
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className={`transition-transform duration-200 shrink-0 ${open ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                        />
                      </button>
                      {open ? (
                        <div className={`mt-2 rounded-2xl border overflow-hidden ${isDark ? 'bg-[#111213] border-white/5' : 'bg-white border-gray-100 shadow-md'}`}>
                          {lines.map((line, i) => (
                            <div
                              key={i}
                              className={`flex gap-3 px-4 py-3 ${i < lines.length - 1 ? `border-b ${isDark ? 'border-gray-800' : 'border-gray-100'}` : ''}`}
                            >
                              <span className={`text-xs font-bold mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1D1E20] text-amber-300' : 'bg-amber-50 text-amber-600'}`}>
                                {i + 1}
                              </span>
                              <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{line}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Benefits */}
          {benefitsList.length > 0 && (
            <div className={`mt-6 rounded-2xl p-4 ${sectionCard}`}>
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Benefits</h2>
              <ul className="space-y-1.5">
                {benefitsList.map((item, idx) => (
                  <li key={idx} className={`flex items-start gap-2 text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Registration info */}
          {hasRegistrationInfo && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration</h2>
              <div className={`rounded-2xl p-4 space-y-2 ${cardBg}`}>
                {event.slots && (
                  <div className="flex justify-between gap-3">
                    <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Slots</span>
                    <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.slots}</span>
                  </div>
                )}
                {event.registrationProcess && (
                  <div>
                    <span className={`text-sm block ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Process</span>
                    <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{event.registrationProcess}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Registration link */}
          {event.registrationLink && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Registration link</h2>
              <a
                href={event.registrationLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#0ECCEE] break-all hover:underline"
              >
                {event.registrationLink}
              </a>
            </div>
          )}

          {/* Contact details */}
          {event.contacts.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Contact details</h2>
              <div className="space-y-3">
                {event.contacts.map((contact, idx) => (
                  <div key={idx} className={`rounded-2xl p-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-md border border-gray-100'}`}>
                    {(contact.name || contact.role) && (
                      <div className="mb-2">
                        <span className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{contact.name || 'Contact'}</span>
                        {contact.role && <span className={`text-xs ml-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>- {contact.role}</span>}
                      </div>
                    )}
                    <div className="space-y-2">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone.replace(/[\s-]/g, '')}`}
                          className="flex items-center gap-3"
                        >
                          <span className="size-9 rounded-full bg-[#0ECCEE] flex items-center justify-center shrink-0">
                            <Phone size={16} className="text-white" />
                          </span>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{contact.phone}</span>
                        </a>
                      )}
                      {contact.instagramId && (
                        <a
                          href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3"
                        >
                          <span className="size-9 rounded-full bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center shrink-0">
                            <Instagram size={16} className="text-white" />
                          </span>
                          <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>@{contact.instagramId.replace('@', '')}</span>
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-3"
                        >
                          <span className="size-9 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
                            <Mail size={16} className="text-white" />
                          </span>
                          <span className={`text-sm font-medium break-all ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{contact.email}</span>
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Banner — show the full image (no crop) */}
          {event.banner && (
            <div className="mt-6 rounded-2xl overflow-hidden">
              <img
                src={getImageUrl(event.banner, { preset: 'detail' })}
                alt={`${event.title} banner`}
                className="w-full h-auto"
                onError={(e) => handleImageErrorWithFallback(e, 400, 160, '#2A2B2E', event.title)}
              />
            </div>
          )}

          {/* Gallery */}
          {gallery.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Gallery</h2>
              <div className="grid grid-cols-4 gap-2">
                {galleryPreview.map((img, idx) => {
                  const isLast = idx === 3 && galleryExtra > 0;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxIndex(idx)}
                      className="relative aspect-square rounded-2xl overflow-hidden"
                    >
                      <img
                        src={getImageUrl(img, { preset: 'thumb' })}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => handleImageErrorWithFallback(e, 80, 80, '#2A2B2E', 'Gallery')}
                      />
                      {isLast && (
                        <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white text-lg font-semibold">
                          +{galleryExtra}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom bar — coupon chip + Register */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-2"
        style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
      >
        <div className={`mx-auto w-full max-w-md md:max-w-2xl rounded-[30px] px-5 py-3 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
          {suggestedCoupon && !registrationClosed ? (
            <div className="mb-2 flex items-center justify-center">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(suggestedCoupon);
                    toast(`Copied ${suggestedCoupon}`);
                  } catch {
                    toast(`Use ${suggestedCoupon} at checkout`);
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-full pl-2.5 pr-2 py-1 text-[11px] font-bold ${
                  isDark ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <span className="tracking-wide">{suggestedCoupon}</span>
                {suggestedCouponLabel ? (
                  <span className={`font-semibold ${isDark ? 'text-emerald-200/80' : 'text-emerald-600'}`}>
                    {suggestedCouponLabel}
                  </span>
                ) : null}
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  isDark ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white text-emerald-700'
                }`}>
                  Copy
                </span>
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={handleRegister}
            disabled={registrationClosed}
            className={`flex w-full items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg transition ${
              registrationClosed
                ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                : 'bg-[#0ECCEE] text-black active:opacity-90'
            }`}
          >
            {registrationClosed ? 'Registration Closed' : 'Register Now'}
            {!registrationClosed && <ChevronRight size={20} />}
          </button>
        </div>
      </div>

      {/* Package sheet — same pattern as run clubs */}
      {tierSheetOpen && packageTiers.length > 0 && (
        <div className="fixed inset-0 z-60 flex items-end justify-center">
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
            className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,var(--safe-bottom))] ${
              isDark ? 'bg-[#161718]' : 'bg-white'
            }`}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-500/40" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose a package</h3>
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
              {packageTiers.map((tier) => {
                const inclusions = Array.isArray(tier.inclusions) ? tier.inclusions.filter(Boolean) : [];
                const expanded = expandedTierId === tier.id;
                const selecting = selectingTierId === tier.id;
                const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';

                return (
                  <div
                    key={tier.id}
                    className={`rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer ${
                      selecting
                        ? 'border-[#0ECCEE] ring-2 ring-[#0ECCEE]/35 scale-[0.985]'
                        : isDark
                          ? 'bg-[#111213] border-white/10 hover:border-[#0ECCEE]/45'
                          : 'bg-white border-gray-100 hover:border-[#0ECCEE]/55 shadow-md'
                    }`}
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
                          navigate(`${eventShowPath(event)}/register?tier=${encodeURIComponent(tier.id)}`, {
                            state: {
                              tierId: tier.id,
                              event: event.raw || event,
                              suggestedCoupon: getSuggestedCouponCode(event),
                            },
                          });
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
                          className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 text-xs font-semibold ${
                            isDark ? 'text-gray-300 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          <span>What’s included</span>
                          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </button>
                        {expanded ? (
                          <ul className={`px-4 pb-3 space-y-1 text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {inclusions.map((line) => (
                              <li key={line}>• {line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Gallery lightbox */}
      {lightboxIndex != null && gallery[lightboxIndex] && (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 p-2 rounded-full bg-white/15 text-white backdrop-blur-sm"
            style={{ top: 'max(1rem, var(--safe-top))' }}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          <img
            src={getImageUrl(gallery[lightboxIndex], { preset: 'hero' })}
            alt={`Gallery ${lightboxIndex + 1}`}
            className="max-w-[92vw] max-h-[82vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
            onError={(e) => handleImageErrorWithFallback(e, 600, 600, '#2A2B2E', 'Gallery')}
          />
          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((p) => (p === 0 ? gallery.length - 1 : p - 1)); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur-sm flex items-center justify-center"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((p) => (p === gallery.length - 1 ? 0 : p + 1)); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/15 text-white backdrop-blur-sm flex items-center justify-center"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
              <div className="absolute bottom-6 left-0 right-0 text-center text-white/80 text-sm">
                {lightboxIndex + 1} / {gallery.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Login prompt — shown when a logged-out user taps Register */}
      {showLogin && (
        <div className="fixed inset-0 z-70">
          <CrwdCtrlLogin
            googleOnly
            title="Sign in to register"
            subtitle="One tap with Google — then finish registration"
            onClose={() => {
              setShowLogin(false);
              if (isLoggedIn()) {
                navigate(`${eventShowPath(event)}/register`, {
                  state: {
                    event: event.raw || event,
                    suggestedCoupon: getSuggestedCouponCode(event),
                  },
                });
              }
            }}
          />
        </div>
      )}
    </div>
  );
}

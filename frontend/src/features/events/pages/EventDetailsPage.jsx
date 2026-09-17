import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, Heart, Phone, Instagram, Mail,
  ChevronRight, ChevronLeft, X, Check, Clock3, MapPin, LayoutGrid, Percent, Loader,
} from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { useDialog } from '../../../context/DialogContext';
import { useFavorites } from '../../../context/FavoritesContext';
import { useAuth } from '../../../context/AuthContext';
import CrwdCtrlLogin from '../../../pages/auth/login';
import { getImageUrl } from '../../../utils/imageImports';
import { normalizeCoverImages, primaryCoverUrl } from '../../../utils/coverImages';
import { handleImageErrorWithFallback } from '../../../utils/fallbackImageGenerator';
import { shareContent, openExternalUrl } from '../../../utils/externalLink';
import { publicFetchJSONRetry as fetchJSON } from '../../../services/api/client';
import { EVENT_TYPE_LABELS, formatEventShowDate } from '../../../constants/eventsPage';
import { useInAppBack } from '../../../hooks/useInAppBack';
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import Seo from '../../../components/Seo';
import LazyMap from '../../../components/LazyMap';
import { breadcrumbSchema, eventSchema } from '../../../utils/seo';
import { eventShowPath } from '../../../utils/slugRoutes';
import DetailPageLoader, { DetailLoader3DIcon } from '../../../components/DetailPageLoader';
import TrekDetailIcon from '../../../components/TrekDetailIcon';
import PosterFitImage from '../../../components/PosterFitImage';
import { signalDetailPageReady } from '../../../utils/bootSplash';
import { trackBookNowClick } from '../../../services/analyticsService';
import {
  getEventShowTiers,
  isEventShowTiersPricing,
  formatInr,
  minEventShowFee,
} from '../../../utils/eventShowTiers';

function formatShortDate(showTimings) {
  if (!showTimings?.length) return 'TBA';
  const upcoming = showTimings
    .filter((s) => s.date)
    .map((s) => new Date(s.date))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);
  if (!upcoming.length) return 'TBA';
  return upcoming[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function formatShowTime(showTimings) {
  if (!showTimings?.length) return 'TBA';
  const first = showTimings.find((s) => s.time) || showTimings[0];
  return first?.time ? String(first.time) : 'TBA';
}

function mapEventDetail(raw) {
  if (!raw) return null;
  const coverImages = normalizeCoverImages(raw.coverImages);
  const poster = primaryCoverUrl(coverImages, raw.poster);
  return {
    id: raw._id,
    _id: raw._id,
    title: raw.title || 'Event',
    displayName: raw.displayName || '',
    organizer: raw.organizer || '',
    type: raw.eventHeading || EVENT_TYPE_LABELS[raw.eventType] || raw.eventType || 'Event',
    dateLabel: formatShortDate(raw.showTimings),
    timeLabel: formatShowTime(raw.showTimings),
    dateFull: formatEventShowDate(raw.showTimings),
    showTimings: Array.isArray(raw.showTimings) ? raw.showTimings : [],
    venue: raw.venue || raw.city || 'Venue TBA',
    city: raw.city || '',
    mapUrl: (raw.mapUrl || '').trim(),
    duration: raw.duration || '',
    gatesOpen: raw.gatesOpen || '',
    endsAt: raw.endsAt || '',
    language: raw.language || '',
    ageRating: raw.ageRating || '',
    ticketPrice: raw.ticketPrice,
    priceLabel: raw.priceLabel || '',
    pricingMode: raw.pricingMode === 'tiers' ? 'tiers' : 'single',
    tiers: Array.isArray(raw.tiers) ? raw.tiers : [],
    addOns: Array.isArray(raw.addOns) ? raw.addOns : [],
    platformFeePercent: raw.platformFeePercent,
    about: raw.description || '',
    whatsIncluded: raw.whatsIncluded || '',
    benefits: raw.benefits || '',
    eligibility: raw.eligibility || '',
    dressCode: raw.dressCode || '',
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

/** Parse "💃 Women: tip text" style dress-code lines into structured rows. */
function parseDressCodeLines(text) {
  return toLines(text).map((line, idx) => {
    const m = line.match(/^(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)\s*(.+)$/u);
    const emoji = m?.[1] || '';
    const rest = (m?.[2] || line).trim();
    const split = rest.match(/^([^:—\-]+)[:—\-]\s*(.+)$/);
    const title = split ? split[1].trim() : (idx === 0 ? 'Look' : 'Tip');
    const body = split ? split[2].trim() : rest;
    return { id: `dress-${idx}`, emoji, title, body };
  });
}

function usesInAppEventRegistration(reg = {}) {
  const mode = String(reg?.mode || '').toLowerCase();
  if (['internal_form', 'organizer_qr'].includes(mode)) return true;
  if (reg?.formType === 'MULTI_STEP' && Array.isArray(reg?.steps) && reg.steps.length > 0) return true;
  if (Array.isArray(reg?.formSchema) && reg.formSchema.length > 0) return true;
  return false;
}

function isEventRegistrationExplicitlyClosed(reg = {}) {
  return String(reg?.status || '').trim().toLowerCase() === 'closed';
}

function shortVenueName(venue) {
  const v = String(venue || '').trim();
  if (!v || v === 'Venue TBA') return '';
  // Prefer first meaningful place name: "Vardhaman Lawns, Pune" → "Vardhaman"
  const primary = v.split(',')[0].trim();
  const withoutSuffix = primary
    .replace(/\b(lawns?|ground|hall|arena|stadium|club|resort|hotel)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const name = withoutSuffix || primary;
  return name.length > 16 ? `${name.slice(0, 14)}…` : name;
}

function buildDetailCards(event) {
  const cards = [];
  const isGarbaNight = /garba|jalsa|navratri|dandiya/i.test(
    `${event.title || ''} ${event.type || ''} ${event.eventHeading || ''}`,
  );

  if (event.gatesOpen) {
    cards.push({ id: 'gates', label: 'Gates open', value: event.gatesOpen, icon: 'gates' });
  }
  if (event.timeLabel && event.timeLabel !== 'TBA') {
    cards.push({
      id: 'starts',
      label: isGarbaNight ? 'Garba Starts' : 'Starts',
      value: event.timeLabel,
      icon: 'moon',
    });
  }
  if (event.endsAt) {
    cards.push({ id: 'ends', label: 'Event Ends', value: event.endsAt, icon: 'clock' });
  } else if (event.duration) {
    cards.push({
      id: 'ends',
      label: isGarbaNight ? 'Event Ends' : 'Duration',
      value: event.duration,
      icon: 'clock',
    });
  }
  const venueName = shortVenueName(event.venue);
  if (venueName) {
    cards.push({ id: 'venue', label: 'Venue', value: venueName, icon: 'map-pin' });
  }
  return cards.slice(0, 4);
}

function buildInfoTabs(event) {
  const tabs = [];
  const detailCards = buildDetailCards(event);
  const entryLines = toLines(event.registrationProcess);
  if (detailCards.length || entryLines.length) {
    tabs.push({ key: 'details', label: 'Details' });
  }
  if (event.showTimings.some((s) => s?.date || s?.time) || event.process || event.rounds.length) {
    tabs.push({ key: 'schedule', label: 'Schedule' });
  }
  if (event.whatsIncluded || event.benefits) {
    tabs.push({ key: 'included', label: 'Included' });
  }
  if (event.dressCode) {
    tabs.push({ key: 'dress', label: 'Dress Code' });
  }
  if (event.prizePool) {
    tabs.push({ key: 'prize', label: 'Prize' });
  }
  return tabs;
}

const FACT_ICONS = {
  date: Clock3,
  time: LayoutGrid,
  venue: MapPin,
};

/** Group ticket tiers into Solo / Couple / Group for simpler browsing. */
function tierPeopleCount(tier) {
  const n = Number(tier?.participantCount);
  if (Number.isFinite(n) && n > 0) return n;
  const name = String(tier?.name || '').toLowerCase();
  if (/\bcouple\b/.test(name) || /\b2\b/.test(name)) return 2;
  const group = name.match(/group\s*(?:of\s*)?(\d+)/i);
  if (group) return Number(group[1]);
  return 1;
}

function tierBucket(tier) {
  const n = tierPeopleCount(tier);
  if (n <= 1) return 'solo';
  if (n === 2) return 'couple';
  return 'group';
}

function tierShortLabel(tier) {
  const name = String(tier?.name || 'Ticket').trim();
  // Prefer short zone name: "Group of 5 · VIP" → "VIP"
  const parts = name.split(/[·•|–—-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/^(ga|vip|vvip|premium|general)$/i.test(last) || last.length <= 12) return last;
  }
  if (/vip/i.test(name) && !/ga/i.test(name)) return 'VIP';
  if (/\bga\b/i.test(name)) return 'GA';
  return name.length > 22 ? `${name.slice(0, 20)}…` : name;
}

function tierPeopleLabel(n) {
  if (n <= 1) return '1 person';
  if (n === 2) return 'Couple · 2';
  return `Group · ${n}`;
}

export default function EventDetailsPage() {
  const { isDark } = useDarkMode();
  const { toast } = useDialog();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { eventId } = useParams();
  const navigate = useNavigate();
  const handleBack = useInAppBack();
  const imgRef = useRef(null);

  const [showLogin, setShowLogin] = useState(false);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(null);
  const [showFullAbout, setShowFullAbout] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [tierSheetOpen, setTierSheetOpen] = useState(false);
  const [selectedTierId, setSelectedTierId] = useState(null);
  const [tierNavigating, setTierNavigating] = useState(false);
  const [tierBucketFilter, setTierBucketFilter] = useState('solo');
  const [imgPg, setImgPg] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);

  const isLoggedIn = () => isAuthenticated || !!localStorage.getItem('crwdctrl_token');

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

  useDetailLoaderFailsafe(loading, () => {
    setLoading(false);
    setError((prev) => prev || 'Failed to load event');
  });

  useEffect(() => {
    if (!loading && event) signalDetailPageReady();
  }, [loading, event]);

  useEffect(() => {
    if (!tierSheetOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [tierSheetOpen]);

  useEffect(() => {
    if (!event || !eventId) return;
    const canonical = eventShowPath(event);
    if (canonical && window.location.pathname !== canonical) {
      navigate(`${canonical}${window.location.search || ''}`, { replace: true });
    }
  }, [event, eventId, navigate]);

  const infoTabs = event ? buildInfoTabs(event) : [];

  useEffect(() => {
    if (infoTabs.length > 0 && !infoTabs.some((t) => t.key === activeTab)) {
      setActiveTab(infoTabs[0].key);
    }
  }, [infoTabs, activeTab]);

  const handleShare = async () => {
    const result = await shareContent({
      title: event?.title,
      text: event?.about?.slice(0, 120),
      url: window.location.href,
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
    if (usesInAppEventRegistration(r)) {
      if (isEventRegistrationExplicitlyClosed(r)) {
        toast('Registration is currently closed');
        return;
      }

      const goToForm = ({ tierId = '', openLoginAfter = false } = {}) => {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: r.mode || 'internal_form',
          destination: 'internal_register_page',
        });
        const qs = tierId ? `?tier=${encodeURIComponent(tierId)}` : '';
        navigate(`${eventShowPath(event)}/register${qs}`, {
          state: {
            event: event.raw || event,
            ...(tierId ? { tierId } : {}),
            openLogin: openLoginAfter,
          },
        });
      };

      // Book now → choose tier first (login happens on register page after)
      const tiers = isEventShowTiersPricing(event) ? getEventShowTiers(event) : [];
      if (tiers.length) {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: r.mode,
          destination: 'tier_selection',
        });
        setSelectedTierId(null);
        setTierNavigating(false);
        // Default chip to the cheapest bucket that has options
        const buckets = new Set(tiers.map(tierBucket));
        setTierBucketFilter(
          buckets.has('solo') ? 'solo' : buckets.has('couple') ? 'couple' : 'group',
        );
        setTierSheetOpen(true);
        return;
      }

      goToForm({ openLoginAfter: !isLoggedIn() });
      return;
    }
    const link = event?.registrationLink || event?.bookingLink;
    if (link) {
      trackBookNowClick({
        entityType: 'events',
        entityId: event?.id || '',
        mode: 'external_link',
        destination: 'external',
      });
      openExternalUrl(link);
    } else toast('Registration link not available yet');
  };

  if (loading) {
    return <DetailPageLoader label="Loading event" variant="event" />;
  }

  if (error || !event) {
    return (
      <div className="crwdctrl-page crwdctrl-page--flat min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className={`text-xl font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{error || 'Event not found'}</h2>
          <button
            type="button"
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
  const heroSlides = (() => {
    const slides = [];
    if (event.image) slides.push(event.image);
    gallery.forEach((img) => {
      if (img && !slides.includes(img)) slides.push(img);
    });
    return slides.length ? slides : [null];
  })();
  const galleryPreview = gallery.slice(0, 4);
  const galleryExtra = Math.max(0, gallery.length - 4);

  const tiersPricing = isEventShowTiersPricing(event);
  const packageTiers = tiersPricing ? getEventShowTiers(event) : [];
  const aboutLong = event.about.length > 180;
  const shortAbout = aboutLong
    ? `${event.about.slice(0, 150).replace(/\s+\S*$/, '')}...`
    : event.about;

  const reg = event.registration || {};
  const registrationClosed = usesInAppEventRegistration(reg)
    ? isEventRegistrationExplicitlyClosed(reg)
    : !(event.registrationLink || event.bookingLink);
  const couponsOn = reg.allowCoupons !== false;
  const fromFee = minEventShowFee(event);
  const hasVenue = Boolean(event.venue) && event.venue !== 'Venue TBA';
  const mapQuery = hasVenue ? event.venue : (event.city || '');
  const directionsUrl = event.mapUrl
    || (hasVenue
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`
      : null);

  const sheetBg = isDark ? 'bg-[#161718]' : 'bg-slate-100';
  const cardBg = isDark ? 'bg-[#111213]' : 'bg-white';
  const cardBorder = isDark ? 'border-white/5' : 'border-gray-100';
  const detailCards = buildDetailCards(event);
  const entryLines = toLines(event.registrationProcess);
  const termsLines = toLines(event.generalRules);
  const includedLines = [...toLines(event.whatsIncluded), ...toLines(event.benefits)];

  const factRows = [
    { key: 'date', label: 'Date', value: event.dateLabel, icon: 'date' },
    { key: 'time', label: 'Time', value: event.timeLabel, icon: 'time' },
    { key: 'venue', label: 'Venue', value: event.venue, icon: 'venue' },
  ];

  const renderList = (lines) => (
    <ul className="space-y-2">
      {lines.map((item, idx) => {
        const trimmed = item.trim();
        const isHeading = /:\s*$/.test(trimmed);
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
  );

  return (
    <div className="crwdctrl-page flex flex-col min-h-screen pb-[max(7.5rem,calc(var(--safe-bottom)+6.5rem))] animate-detail-enter">
      <Seo
        title={event.title}
        description={event.about ? event.about.slice(0, 160) : `${event.title} — ${event.type}`}
        canonical={eventShowPath(event)}
        image={event.image}
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
            image: event.image,
            location: event.venue !== 'Venue TBA' ? event.venue : undefined,
            price: event.ticketPrice,
            organizerName: event.organizer || undefined,
          }),
        ]}
      />

      <div className="mx-auto w-full md:max-w-2xl flex flex-col flex-1">
        {/* Hero — vertical frame; long poster kept intact (no crop / pad rewrite) */}
        <div className="relative w-full aspect-[3/4] max-h-[min(70vh,560px)] shrink-0 overflow-hidden bg-[#1A1B1D]">
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
              {heroSlides.map((img, i) => (
                <div key={i} className="relative shrink-0 w-full h-full snap-start bg-[#1A1B1D] overflow-hidden">
                  {img ? (
                    <>
                      {!heroLoaded && i === 0 && (
                        <div aria-hidden className="absolute inset-0 z-1 flex items-center justify-center bg-[#1A1B1D]">
                          <DetailLoader3DIcon variant="event" tone="dark" />
                        </div>
                      )}
                      <PosterFitImage
                        src={img}
                        alt={event.title}
                        preset="eventHeroPad"
                        loading={i === 0 ? 'eager' : 'lazy'}
                        fetchPriority={i === 0 ? 'high' : 'auto'}
                        fallbackW={393}
                        fallbackH={520}
                        fallbackBg="#5c0a12"
                        className={i === 0 && !heroLoaded ? 'opacity-0' : 'opacity-100 transition-opacity duration-500 ease-out'}
                        onLoad={() => { if (i === 0) setHeroLoaded(true); }}
                        onError={() => { if (i === 0) setHeroLoaded(true); }}
                      />
                    </>
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-slate-800 to-slate-950 flex items-center justify-center">
                      <span className="text-white/40 text-sm font-medium">No cover yet</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

          <div
            className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 z-10"
            style={{ paddingTop: 'calc(max(var(--safe-top), 0px) + 2.5rem)' }}
          >
            <button
              type="button"
              onClick={handleBack}
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
                onClick={handleFavorite}
                aria-label="Add to favourites"
                className="size-11 rounded-full bg-black/40 flex items-center justify-center"
              >
                <Heart size={20} strokeWidth={2.25} className={isFavorite(event.id) ? 'fill-red-500 text-red-500' : 'text-white'} />
              </button>
            </div>
          </div>

          {heroSlides.length > 1 && (
            <div className="absolute bottom-14 left-0 right-0 flex justify-center items-center gap-2 z-10">
              {heroSlides.slice(0, 4).map((_, i) => (
                <div
                  key={i}
                  className={`rounded-2xl transition-all duration-300 ${
                    i === imgPg ? 'h-2.5 w-6 bg-white' : 'size-2.5 bg-transparent border-2 border-white/60'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Content sheet */}
        <div className={`relative -mt-10 flex-1 rounded-t-3xl z-10 ${sheetBg}`}>
          <div className="px-4 pt-5 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className={`text-[26px] font-semibold leading-8 wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {event.title}
                </h1>
                {event.organizer ? (
                  <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
                    {event.organizer}
                  </p>
                ) : null}
                {event.displayName && event.displayName !== event.title ? (
                  <p className={`text-xs font-medium mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    {event.displayName}
                  </p>
                ) : null}
              </div>
              {couponsOn ? (
                <div className="shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-3xl border border-[#0ECCEE]/40 bg-linear-to-r from-[#0ECCEE]/15 to-cyan-400/25 px-2.5 py-1.5">
                  <Percent size={14} className="text-[#0ECCEE]" strokeWidth={2.5} />
                  <span className={`text-xs font-normal leading-4 tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>
                    Offers available
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Date / Time / Venue + map — same layout as community event pages */}
          <div className="px-4 flex items-start gap-2 mb-5">
            <div className="flex-1 min-w-0 space-y-3.5 pt-1">
              {factRows.map((row) => {
                const Icon = FACT_ICONS[row.icon] || Clock3;
                return (
                  <div key={row.key} className="flex items-center gap-2.5">
                    <Icon size={22} className="text-[#0ECCEE] shrink-0" strokeWidth={2.25} />
                    <div className="min-w-0">
                      <p className={`text-[15px] font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {row.value}
                      </p>
                      <p className={`text-[11px] font-medium leading-4 mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        {row.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="w-[55%] max-w-[220px] sm:max-w-[260px] shrink-0 flex flex-col self-start -ml-1">
              <div className="w-full h-[148px] sm:h-[156px] rounded-2xl overflow-hidden relative">
                {(mapQuery || event.mapUrl) ? (
                  <LazyMap query={mapQuery} mapUrl={event.mapUrl || undefined} isDark={isDark} title="event-venue-map" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center ${isDark ? 'bg-[#111213]' : 'bg-linear-to-br from-green-50 to-blue-50'}`}>
                    <span className="text-[10px] text-gray-400">No location</span>
                  </div>
                )}
              </div>
              {directionsUrl ? (
                <button
                  type="button"
                  onClick={() => openExternalUrl(directionsUrl)}
                  className={`text-[11px] font-semibold text-center mt-1.5 leading-4 tracking-tight w-full truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}
                >
                  {event.venue}
                </button>
              ) : (mapQuery || event.mapUrl) ? (
                <p className={`text-[11px] font-semibold text-center mt-1.5 leading-4 tracking-tight w-full truncate ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {event.venue}
                </p>
              ) : null}
            </div>
          </div>

          {/* Overview */}
          {event.about ? (
            <div className="px-4 mb-5">
              <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Overview
              </h2>
              <p className={`text-sm font-medium leading-5 tracking-tight ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                {showFullAbout || !aboutLong ? event.about : shortAbout}
                {aboutLong ? (
                  <button
                    type="button"
                    onClick={() => setShowFullAbout((v) => !v)}
                    className="ml-1 font-medium text-[#0ECCEE]"
                  >
                    {showFullAbout ? 'read less' : 'read more'}
                  </button>
                ) : null}
              </p>
            </div>
          ) : null}

          {/* Info tabs */}
          {infoTabs.length > 0 ? (
            <div className="px-4 mb-5">
              <div className={`rounded-2xl mb-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.12)] ${isDark ? 'bg-[#111213]' : 'bg-white'}`}>
                <div className="flex items-center justify-center gap-1 overflow-x-auto scrollbar-hide px-2 py-3">
                  {infoTabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`relative shrink-0 whitespace-nowrap px-3.5 py-1 text-sm font-medium tracking-tight transition-colors duration-200 ${
                        activeTab === t.key
                          ? 'text-blue-700'
                          : isDark ? 'text-gray-400' : 'text-gray-800'
                      }`}
                    >
                      {t.label}
                      {activeTab === t.key ? (
                        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-px bg-blue-700 transition-opacity duration-200" />
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>

              <div key={activeTab} className="animate-step-enter">
              {activeTab === 'details' ? (
                <div className="space-y-2.5">
                  {detailCards.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      {detailCards.map((card) => (
                        <div
                          key={card.id}
                          className={`rounded-2xl px-3 py-3.5 flex items-start gap-2.5 shadow-sm ${
                            isDark ? 'bg-[#111213]' : 'bg-white'
                          }`}
                        >
                          <span className="shrink-0 mt-0.5" aria-hidden>
                            <TrekDetailIcon icon={card.icon || 'default'} size={24} />
                          </span>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium leading-5 tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {card.label}
                            </p>
                            <p className={`text-xs font-semibold leading-4 tracking-tight mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {card.value}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {entryLines.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => setEntryOpen((o) => !o)}
                        className={`w-full rounded-2xl flex items-center justify-between px-4 py-3.5 shadow-sm transition-colors ${
                          isDark ? 'bg-[#111213] hover:bg-[#1D1E20]' : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <LayoutGrid size={18} className={isDark ? 'text-gray-400' : 'text-gray-500'} />
                          <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            Entry &amp; Check-in
                          </p>
                        </div>
                        <ChevronRight
                          size={16}
                          className={`transition-transform duration-200 shrink-0 ${entryOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                        />
                      </button>
                      {entryOpen ? (
                        <div className={`mt-2 rounded-2xl px-4 py-3.5 shadow-sm ${isDark ? 'bg-[#111213]' : 'bg-white'}`}>
                          {renderList(entryLines)}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeTab === 'schedule' ? (
                <div className={`rounded-2xl border p-4 space-y-4 ${cardBg} ${cardBorder}`}>
                  {event.showTimings.filter((s) => s?.date || s?.time).map((slot, idx) => {
                    const d = slot.date ? new Date(slot.date) : null;
                    const dateStr = d && !Number.isNaN(d.getTime())
                      ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                      : 'Date TBA';
                    return (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="size-9 rounded-xl bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                          <Clock3 size={16} className="text-[#0ECCEE]" />
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{dateStr}</p>
                          <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {slot.time || 'Time TBA'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  {event.process ? (
                    <div>
                      <p className={`text-sm font-semibold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Process</p>
                      <p className={`text-sm leading-6 whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                        {event.process}
                      </p>
                    </div>
                  ) : null}
                  {event.rounds.map((r, idx) => (
                    <div key={idx}>
                      <p className={`text-sm font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {r.title || `Round ${idx + 1}`}
                      </p>
                      {r.content ? renderList(toLines(r.content)) : null}
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === 'included' && includedLines.length > 0 ? (
                <div className={`rounded-2xl border p-4 ${cardBg} ${cardBorder}`}>
                  {renderList(includedLines)}
                </div>
              ) : null}

              {activeTab === 'dress' && event.dressCode ? (
                <div className="space-y-2.5">
                  {parseDressCodeLines(event.dressCode).map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-2xl px-3.5 py-3.5 flex items-start gap-3 shadow-sm ${
                        isDark ? 'bg-[#111213]' : 'bg-white'
                      }`}
                    >
                      {row.emoji ? (
                        <span className="text-[22px] leading-none mt-0.5 shrink-0 select-none" aria-hidden>
                          {row.emoji}
                        </span>
                      ) : (
                        <span className="mt-0.5 shrink-0" aria-hidden>
                          <TrekDetailIcon icon="dress" size={22} />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {row.title}
                        </p>
                        <p className={`text-xs font-medium leading-5 mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {row.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {activeTab === 'prize' && event.prizePool ? (
                <div className={`rounded-2xl border p-4 ${cardBg} ${cardBorder}`}>
                  {renderList(toLines(event.prizePool))}
                </div>
              ) : null}
              </div>
            </div>
          ) : null}

          {/* Terms */}
          {termsLines.length > 0 ? (
            <div className="px-4 mb-6">
              <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Terms &amp; Conditions
              </h2>
              <button
                type="button"
                onClick={() => setTermsOpen((o) => !o)}
                className={`w-full rounded-2xl border flex items-center justify-between px-4 py-3.5 transition-colors ${cardBg} ${cardBorder}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`size-8 rounded-full flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20]' : 'bg-slate-100'}`}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isDark ? 'text-gray-300' : 'text-gray-700'}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <p className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Terms and Conditions
                  </p>
                </div>
                <ChevronRight
                  size={16}
                  className={`transition-transform duration-200 shrink-0 ${termsOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
                />
              </button>
              {termsOpen ? (
                <div className={`mt-2 rounded-2xl border px-4 py-3.5 ${cardBg} ${cardBorder}`}>
                  {renderList(termsLines)}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Contacts */}
          {event.contacts.length > 0 ? (
            <div className="px-4 mb-6">
              <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Contact Details
              </h2>
              <div className="space-y-3">
                {event.contacts.map((contact, idx) => (
                  <div key={idx} className="space-y-2.5">
                    {(contact.name || contact.role) ? (
                      <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {contact.name || 'Contact'}
                        {contact.role ? (
                          <span className={`font-normal ml-1.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                            · {contact.role}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    {contact.phone ? (
                      <a href={`tel:${contact.phone.replace(/[\s-]/g, '')}`} className="flex items-center gap-3">
                        <span className="size-8 rounded-full bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                          <Phone size={14} className="text-[#0ECCEE]" />
                        </span>
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>{contact.phone}</span>
                      </a>
                    ) : null}
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="flex items-center gap-3">
                        <span className="size-8 rounded-full bg-[#0ECCEE]/10 flex items-center justify-center shrink-0">
                          <Mail size={14} className="text-[#0ECCEE]" />
                        </span>
                        <span className={`text-sm font-medium underline underline-offset-2 ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          {contact.email}
                        </span>
                      </a>
                    ) : null}
                    {contact.instagramId ? (
                      <a
                        href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3"
                      >
                        <span className="size-8 rounded-full bg-linear-to-br from-[#f58529] via-[#dd2a7b] to-[#8134af] flex items-center justify-center shrink-0">
                          <Instagram size={14} className="text-white" />
                        </span>
                        <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                          @{contact.instagramId.replace('@', '')}
                        </span>
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Gallery */}
          {gallery.length > 0 ? (
            <div className="px-4 pb-8">
              <h2 className={`text-lg font-semibold leading-7 tracking-wide mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Gallery
              </h2>
              <div className="grid grid-cols-4 gap-2.5">
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
                      {isLast ? (
                        <span className="absolute inset-0 bg-stone-900/40 flex items-center justify-center text-white text-lg font-semibold">
                          {galleryExtra}+
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-6" />
          )}
        </div>
      </div>

      {typeof document !== 'undefined' && createPortal(
        <>
          {!tierSheetOpen && !showLogin && lightboxIndex == null ? (
            <div
              className="fixed inset-x-0 bottom-0 z-100040 px-2 pointer-events-none"
              style={{ paddingBottom: 'max(var(--safe-bottom), 6px)' }}
            >
              <div className={`pointer-events-auto mx-auto w-full max-w-md md:max-w-2xl flex items-center justify-between gap-4 rounded-[30px] px-5 py-3.5 ${
                isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'
              }`}>
                <div className="min-w-0 shrink-0">
                  <p className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {tiersPricing ? 'From' : 'Registration Fee'}
                  </p>
                  {fromFee > 0 ? (
                    <p className={`mt-0.5 text-2xl font-bold leading-none truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {formatInr(fromFee)}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-2xl font-bold leading-none text-green-500">Free</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={registrationClosed}
                  className={`flex flex-1 items-center justify-center gap-2 h-14 px-8 rounded-3xl text-lg font-medium shadow-lg transition-all duration-200 ease-out ${
                    registrationClosed
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                      : 'bg-[#0ECCEE] text-black active:scale-[0.98] active:opacity-90'
                  }`}
                >
                  {registrationClosed
                    ? 'Registration Closed'
                    : packageTiers.length
                      ? 'Register now'
                      : fromFee > 0
                        ? 'Book now'
                        : 'Register free'}
                  {!registrationClosed ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  ) : null}
                </button>
              </div>
            </div>
          ) : null}

          {tierSheetOpen && packageTiers.length > 0 ? (
            <div className="fixed inset-0 z-100055 flex items-end justify-center">
              <button
                type="button"
                aria-label="Close"
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px] tier-sheet-backdrop-in"
                onClick={() => {
                  if (tierNavigating) return;
                  setTierSheetOpen(false);
                  setSelectedTierId(null);
                }}
              />
              <div
                className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] flex flex-col rounded-t-3xl pt-3 tier-sheet-in ${
                  isDark ? 'bg-[#161718]' : 'bg-white'
                }`}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-500/40 shrink-0" />
                <div className="flex items-start justify-between gap-3 px-4 mb-3 shrink-0">
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose tickets</h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      Pick your ticket, then continue to register.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={tierNavigating}
                    onClick={() => {
                      setTierSheetOpen(false);
                      setSelectedTierId(null);
                    }}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-200 ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Close
                  </button>
                </div>

                {(() => {
                  const buckets = [
                    { key: 'solo', label: 'Solo' },
                    { key: 'couple', label: 'Couple' },
                    { key: 'group', label: 'Group' },
                  ].filter((b) => packageTiers.some((t) => tierBucket(t) === b.key));
                  const visible = packageTiers.filter((t) => tierBucket(t) === tierBucketFilter);
                  const sorted = [...visible].sort((a, b) => {
                    const pn = tierPeopleCount(a) - tierPeopleCount(b);
                    if (pn !== 0) return pn;
                    return (Number(a.fee) || 0) - (Number(b.fee) || 0);
                  });
                  const selectedTier = packageTiers.find((t) => t.id === selectedTierId) || null;

                  const goNext = () => {
                    if (!selectedTier || tierNavigating) return;
                    setTierNavigating(true);
                    const tierId = selectedTier.id;
                    // Brief pause so Next feels acknowledged before the page shift
                    window.setTimeout(() => {
                      navigate(`${eventShowPath(event)}/register?tier=${encodeURIComponent(tierId)}`, {
                        state: {
                          event: event.raw || event,
                          tierId,
                          openLogin: !isLoggedIn(),
                        },
                      });
                      setTierSheetOpen(false);
                      setTierNavigating(false);
                      setSelectedTierId(null);
                    }, 220);
                  };

                  return (
                    <>
                      {buckets.length > 1 ? (
                        <div className="px-4 mb-3 shrink-0">
                          <div className={`flex rounded-2xl p-1 gap-1 ${isDark ? 'bg-[#111213]' : 'bg-gray-100'}`}>
                            {buckets.map((b) => (
                              <button
                                key={b.key}
                                type="button"
                                disabled={tierNavigating}
                                onClick={() => {
                                  setTierBucketFilter(b.key);
                                  setSelectedTierId(null);
                                }}
                                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ease-out ${
                                  tierBucketFilter === b.key
                                    ? 'bg-[#0ECCEE] text-black shadow-sm'
                                    : isDark
                                      ? 'text-gray-400 hover:text-gray-200'
                                      : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                {b.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div
                        key={tierBucketFilter}
                        className="px-4 overflow-y-auto space-y-2 flex-1 min-h-0 animate-step-enter"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        {sorted.map((tier) => {
                          const people = tierPeopleCount(tier);
                          const selected = selectedTierId === tier.id;
                          const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';
                          const perPerson = people > 1 && Number(tier.fee) > 0
                            ? Math.round(Number(tier.fee) / people)
                            : null;

                          return (
                            <button
                              key={tier.id}
                              type="button"
                              disabled={tierNavigating}
                              onClick={() => setSelectedTierId(tier.id)}
                              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-out active:scale-[0.99] ${
                                selected
                                  ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                                  : isDark
                                    ? 'bg-[#111213] border-white/10 hover:border-white/20'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <span
                                className={`size-4.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${
                                  selected
                                    ? 'border-[#0ECCEE] bg-[#0ECCEE]'
                                    : isDark ? 'border-gray-600' : 'border-gray-300'
                                }`}
                                aria-hidden
                              >
                                {selected ? <Check size={10} className="text-black" strokeWidth={3} /> : null}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[15px] font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {tierShortLabel(tier)}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {tierPeopleLabel(people)}
                                  {perPerson != null ? ` · ~${formatInr(perPerson)} / person` : ''}
                                </p>
                              </div>
                              <p className={`text-[15px] font-bold tabular-nums shrink-0 ${
                                Number(tier.fee) > 0
                                  ? (isDark ? 'text-white' : 'text-gray-900')
                                  : 'text-green-500'
                              }`}>
                                {feeLabel}
                              </p>
                            </button>
                          );
                        })}
                        {sorted.length === 0 ? (
                          <p className={`text-sm text-center py-6 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                            No tickets in this category.
                          </p>
                        ) : null}
                      </div>

                      <div
                        className="px-4 pt-2.5 shrink-0"
                        style={{ paddingBottom: 'max(0.85rem, var(--safe-bottom))' }}
                      >
                        <button
                          type="button"
                          disabled={!selectedTier || tierNavigating}
                          onClick={goNext}
                          className={`w-full h-12 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ease-out ${
                            !selectedTier
                              ? isDark
                                ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : tierNavigating
                                ? 'bg-[#0ECCEE]/80 text-black'
                                : 'bg-[#0ECCEE] text-black active:scale-[0.98] shadow-md shadow-[#0ECCEE]/25'
                          }`}
                        >
                          {tierNavigating ? (
                            <>
                              <Loader size={16} className="animate-spin" />
                              Continuing…
                            </>
                          ) : (
                            <>
                              Next
                              {selectedTier ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="m9 18 6-6-6-6" />
                                </svg>
                              ) : null}
                            </>
                          )}
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </>,
        document.body,
      )}

      {lightboxIndex != null && gallery[lightboxIndex] ? (
        <div className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-4 p-2 rounded-full bg-white/15 text-white backdrop-blur-sm"
            style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
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
          {gallery.length > 1 ? (
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
          ) : null}
        </div>
      ) : null}

      {showLogin ? (
        <div className="fixed inset-0 z-70">
          <CrwdCtrlLogin
            googleOnly
            title="Sign in to register"
            subtitle="Tap Sign in with Google — then finish registration"
            onClose={() => {
              setShowLogin(false);
              if (isLoggedIn()) {
                navigate(`${eventShowPath(event)}/register`, {
                  state: { event: event.raw || event },
                });
              }
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

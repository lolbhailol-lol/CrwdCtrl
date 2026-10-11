import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Share2, Heart, Phone, Instagram, Mail,
  ChevronRight, ChevronLeft, X, Check, Clock3, MapPin, Hourglass, LayoutGrid, Percent, Loader,
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
import { useDetailLoaderFailsafe } from '../../../hooks/useDetailLoaderFailsafe';
import Seo from '../../../components/Seo';
import LazyMap from '../../../components/LazyMap';
import { breadcrumbSchema, eventSchema } from '../../../utils/seo';
import { eventShowPath, entityMatchesRouteParam } from '../../../utils/slugRoutes';
import { fetchCatalogJSON } from '../../../services/api/catalogCache';
import DetailPageLoader, { DetailLoader3DIcon } from '../../../components/DetailPageLoader';
import OrganizersStorySlider from '../../../components/OrganizersStorySlider';
import GalleryLightbox from '../../../components/GalleryLightbox';
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
    tiersMultiSelect: Boolean(raw.tiersMultiSelect),
    tiers: Array.isArray(raw.tiers) ? raw.tiers : [],
    addOns: Array.isArray(raw.addOns) ? raw.addOns : [],
    platformFeePercent: raw.platformFeePercent,
    about: raw.description || raw.about || raw.overview || '',
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
    const split = rest.match(/^([^:—-]+)[:—-]\s*(.+)$/);
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

function tierDisplayLabel(tier, { multi = false } = {}) {
  const name = String(tier?.name || 'Ticket').trim();
  if (multi) return name.length > 56 ? `${name.slice(0, 54)}…` : name;
  return tierShortLabel(tier);
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

function deduplicateEventDetailCards(cards) {
  if (!cards || cards.length === 0) return [];
  const seenLabels = new Set();
  return cards.filter((card) => {
    const rawLabel = String(card?.label || '').trim().toLowerCase();
    const rawVal = String(card?.value || '').trim();
    if (!rawLabel || !rawVal) return false;
    if (seenLabels.has(rawLabel)) return false;
    seenLabels.add(rawLabel);
    return true;
  });
}

export default function EventDetailsPage() {
  const { isDark } = useDarkMode();
  const { toast } = useDialog();
  const { toggleFavorite, isFavorite } = useFavorites();
  const { isAuthenticated } = useAuth();
  const { eventId } = useParams();
  const navigate = useNavigate();
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
  const [selectedTierIds, setSelectedTierIds] = useState([]);
  const [tierNavigating, setTierNavigating] = useState(false);
  const [tierBucketFilter, setTierBucketFilter] = useState('solo');
  const [imgPg, setImgPg] = useState(0);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [similarEvents, setSimilarEvents] = useState([]);

  useEffect(() => {
    let active = true;
    fetchCatalogJSON('/events')
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data?.events) ? res.data.events : [];
        const currentId = String(event?._id || event?.id || eventId || '');
        const currentTitle = String(event?.title || '').trim().toLowerCase();
        const others = list.filter((item) => {
          const itemId = String(item._id || item.id || '');
          const itemTitle = String(item.title || '').trim().toLowerCase();
          return itemId !== currentId && item.slug !== eventId && itemTitle !== currentTitle;
        });
        setSimilarEvents(others.slice(0, 3));
      })
      .catch(() => { });
    return () => { active = false; };
  }, [eventId, event?._id, event?.id, event?.title]);

  const isLoggedIn = () => isAuthenticated || !!localStorage.getItem('crwdctrl_token');

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!eventId) {
        navigate('/events');
        return;
      }
      try {
        setEvent(null);
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
    if (!entityMatchesRouteParam(event, eventId, ['title', 'displayName'])) return;
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

      // Book now → choose tier first (login happens on register page after).
      // Multi-class events (Dirt Drag): collect details first; class pick is inside the form.
      const tiers = isEventShowTiersPricing(event) ? getEventShowTiers(event) : [];
      if (tiers.length && !event.tiersMultiSelect) {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: r.mode,
          destination: 'tier_selection',
        });
        setSelectedTierId(null);
        setSelectedTierIds([]);
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
  const fromFee = (() => {
    if (event.tiersMultiSelect && packageTiers.length) {
      const paid = packageTiers
        .map((t) => Math.max(0, Number(t.fee) || 0))
        .filter((fee) => fee > 0);
      if (paid.length) return Math.min(...paid);
    }
    return minEventShowFee(event);
  })();
  const hasVenue = Boolean(event.venue) && event.venue !== 'Venue TBA';
  const mapQuery = hasVenue ? event.venue : (event.city || '');
  const directionsUrl = event.mapUrl
    || (hasVenue
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`
      : null);
  const detailCards = buildDetailCards(event);
  const cleanDetailCards = deduplicateEventDetailCards(detailCards);
  const entryLines = toLines(event.registrationProcess);
  const termsLines = toLines(event.generalRules);
  const includedLines = [...toLines(event.whatsIncluded), ...toLines(event.benefits)];

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
    <div className="crwdctrl-page flex flex-col min-h-screen pb-6 animate-detail-enter">
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

      <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-2.5 lg:py-4 flex flex-col flex-1 gap-3.5">

        {/* TOP HEADER ROW (Matching Reference: Title + Share/Favorite Action Icons) */}
        <div className="flex items-center justify-between gap-4">
          <h1 className={`text-xl sm:text-2xl lg:text-3xl font-extrabold leading-tight wrap-break-word ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {event.title}
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
              onClick={handleFavorite}
              aria-label="Add to favourites"
              className={`size-9 rounded-full flex items-center justify-center border transition cursor-pointer ${isDark ? 'bg-[#111213] text-gray-200 border-white/10 hover:bg-[#1D1E20]' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 shadow-xs'
                }`}
            >
              <Heart size={16} strokeWidth={2} className={isFavorite(event.id) ? 'fill-red-500 text-red-500' : ''} />
            </button>
          </div>
        </div>

        {/* REFERENCE-STYLE HERO SPLIT SECTION (Left: Media Carousel | Right: Info & Booking Card) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 lg:gap-5 items-start">

          {/* LEFT COLUMN (md:col-span-7): Media Slider with Badges Overlay */}
          <div className="md:col-span-7 flex flex-col">
            <div className={`relative w-full h-[320px] sm:h-[360px] md:h-[380px] lg:h-[400px] overflow-hidden rounded-3xl border shadow-lg ${isDark ? 'bg-[#1A1B1D] border-white/5' : 'bg-gray-900 border-gray-200'
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

              {/* Navigation Arrows */}
              {heroSlides.length > 1 && (
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
                    {heroSlides.slice(0, 5).map((_, i) => (
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
            <div className={`w-full h-[320px] sm:h-[360px] md:h-[380px] lg:h-[400px] rounded-3xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between ${isDark ? 'bg-[#111213] border-white/10 shadow-xl' : 'bg-white border-gray-200 shadow-md'
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
                        {event.dateFull || event.dateLabel || 'Date TBA'}
                      </p>
                      {event.timeLabel ? (
                        <p className={`text-[11px] font-medium leading-none mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                          {event.timeLabel}
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
                    <p className={`text-xs sm:text-sm font-semibold truncate ${isDark ? 'text-gray-200' : 'text-gray-800'}`} title={event.venue || ''}>
                      {event.venue || event.city || 'Location TBA'}
                    </p>
                  </div>

                  {directionsUrl ? (
                    <button
                      type="button"
                      onClick={() => openExternalUrl(directionsUrl)}
                      className="size-7 rounded-lg flex items-center justify-center text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0 cursor-pointer transition border border-[#0ECCEE]/20"
                      title="Open in Maps"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M7 17L17 7M17 7H7M17 7V17" />
                      </svg>
                    </button>
                  ) : null}
                </div>

                {/* Event Key Chips: Duration, Age, Category */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  {event.duration ? (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                      ⏳ {event.duration}
                    </span>
                  ) : null}
                  {event.ageRating ? (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                      🎯 Age: {event.ageRating}
                    </span>
                  ) : null}
                  {event.type ? (
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${isDark ? 'bg-[#1D1E20] text-gray-300 border border-white/5' : 'bg-gray-100 text-gray-700'}`}>
                      ⚡ {event.type}
                    </span>
                  ) : null}
                </div>

                {/* Organizer Contact Row */}
                {(() => {
                  const contact = event.contacts?.[0];
                  const phone = contact?.phone;
                  const insta = contact?.instagramId?.replace('@', '');
                  if (!event.organizer && !phone && !insta) return null;
                  return (
                    <div className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#0ECCEE]">BY</span>
                        <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {event.organizer || 'Event Organizer'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {phone && (
                          <a
                            href={`tel:${phone.replace(/[\s-]/g, '')}`}
                            className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-[#0ECCEE]' : 'bg-white text-gray-700 hover:text-[#0ECCEE] shadow-xs'}`}
                            title={`Call ${phone}`}
                          >
                            <Phone size={13} />
                          </a>
                        )}
                        {insta && (
                          <a
                            href={`https://instagram.com/${insta}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`size-7 rounded-lg flex items-center justify-center transition cursor-pointer ${isDark ? 'bg-[#222326] text-gray-200 hover:text-pink-400' : 'bg-white text-gray-700 hover:text-pink-500 shadow-xs'}`}
                            title={`Instagram @${insta}`}
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
                  {fromFee == null ? (
                    <p className={`text-xl sm:text-2xl font-black ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>—</p>
                  ) : Number(fromFee) > 0 ? (
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl sm:text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          ₹{Number(fromFee).toLocaleString('en-IN')}
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

                {registrationClosed ? (
                  <button disabled className="px-5 py-2.5 sm:py-3 rounded-2xl text-xs sm:text-sm font-bold bg-gray-600 text-gray-300 cursor-not-allowed shrink-0">
                    Closed
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRegister}
                    className="px-6 py-2.5 sm:py-3 rounded-2xl text-sm font-extrabold shadow-lg bg-[#0ECCEE] text-black hover:bg-[#0cb8d6] active:scale-[0.98] transition cursor-pointer shrink-0"
                  >
                    Book Now
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Full-width About / Overview Card */}
        {event.about && (
          <div className={`w-full rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
            <h2 className={`text-sm sm:text-base font-bold leading-snug mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              About This Event
            </h2>
            <p className={`text-xs sm:text-[13px] leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {showFullAbout || !aboutLong ? event.about : shortAbout}
              {aboutLong && (
                <button
                  type="button"
                  onClick={() => setShowFullAbout((v) => !v)}
                  className="ml-1 text-xs font-bold text-[#0ECCEE] hover:underline cursor-pointer"
                >
                  {showFullAbout ? 'Show less' : 'Read more'}
                </button>
              )}
            </p>
          </div>
        )}

        {/* DETAILS & MAP BALANCED SECTION (High-density space-efficient layout) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start mt-0.5">

          {/* LEFT COLUMN (lg:col-span-7): Event Info (Tabs), Overview & Contacts */}
          <div className="lg:col-span-7 flex flex-col gap-3.5">
            {infoTabs.length > 0 && (
              <div className={`rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-3.5">
                  <h2 className={`text-base font-bold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    Event Info
                  </h2>

                  {/* Tabs */}
                  <div className={`flex rounded-xl p-1 gap-1 overflow-x-auto scrollbar-hide ${isDark ? 'bg-[#1A1B1D]' : 'bg-gray-100'}`}>
                    {infoTabs.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setActiveTab(t.key)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${activeTab === t.key
                            ? isDark ? 'bg-[#252629] text-[#0ECCEE] shadow-xs' : 'bg-white text-gray-900 shadow-xs'
                            : isDark ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-800'
                          }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* TAB 1: DETAILS */}
                {activeTab === 'details' && (
                  <div className="space-y-3">
                    {cleanDetailCards.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {cleanDetailCards.map((card, idx) => (
                          <div
                            key={`fact-${card.label}-${idx}`}
                            className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border transition-all ${isDark ? 'bg-[#161718] border-white/5 hover:border-white/10' : 'bg-gray-50 border-gray-100 shadow-2xs hover:border-gray-200'
                              }`}
                          >
                            <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 ${isDark ? 'bg-[#1D1E20] text-[#0ECCEE]' : 'bg-white text-[#0ECCEE] shadow-xs'
                              }`}>
                              <TrekDetailIcon icon={card.icon || 'default'} size={15} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-[10px] font-semibold leading-none truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{card.label}</p>
                              <p className={`text-xs sm:text-[13px] font-bold leading-tight mt-0.5 truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{card.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className={`text-xs py-2 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>No specific details listed.</p>
                    )}

                    {/* Entry & Check-in Accordion */}
                    {entryLines.length > 0 && (
                      <div className={`rounded-2xl border overflow-hidden transition-all ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                        <button
                          type="button"
                          onClick={() => setEntryOpen((o) => !o)}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <LayoutGrid size={15} className="text-[#0ECCEE]" />
                            <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              Entry &amp; Check-in Details
                            </p>
                          </div>
                          <ChevronRight
                            size={15}
                            className={`transition-transform duration-200 shrink-0 ${entryOpen ? 'rotate-90' : ''} ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
                          />
                        </button>
                        {entryOpen && (
                          <div className={`px-3.5 pb-3 pt-1 border-t text-xs leading-relaxed ${isDark ? 'border-white/5 text-gray-300' : 'border-gray-200 text-gray-700'}`}>
                            {renderList(entryLines)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: SCHEDULE */}
                {activeTab === 'schedule' && (
                  <div className="space-y-3.5">
                    {event.showTimings.filter((s) => s?.date || s?.time).map((slot, idx) => {
                      const d = slot.date ? new Date(slot.date) : null;
                      const dateStr = d && !Number.isNaN(d.getTime())
                        ? d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
                        : 'Date TBA';
                      return (
                        <div key={idx} className={`flex items-center gap-3 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                          <div className="size-8 rounded-lg bg-[#0ECCEE]/15 flex items-center justify-center shrink-0">
                            <Clock3 size={15} className="text-[#0ECCEE]" />
                          </div>
                          <div>
                            <p className={`text-xs sm:text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{dateStr}</p>
                            <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                              {slot.time || 'Time TBA'}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {event.process && (
                      <div className="mt-2">
                        <p className={`text-xs font-bold uppercase tracking-wider mb-1 text-[#0ECCEE]`}>Process</p>
                        <p className={`text-xs leading-relaxed whitespace-pre-line ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {event.process}
                        </p>
                      </div>
                    )}
                    {event.rounds.map((r, idx) => (
                      <div key={idx} className="mt-2">
                        <p className={`text-xs font-bold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {r.title || `Round ${idx + 1}`}
                        </p>
                        {r.content ? renderList(toLines(r.content)) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 3: INCLUDED */}
                {activeTab === 'included' && includedLines.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {includedLines.map((item, i) => (
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
                )}

                {/* TAB 4: DRESS CODE */}
                {activeTab === 'dress' && event.dressCode && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {parseDressCodeLines(event.dressCode).map((row) => (
                      <div
                        key={row.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'
                          }`}
                      >
                        {row.emoji ? (
                          <span className="text-lg leading-none mt-0.5 shrink-0 select-none" aria-hidden>
                            {row.emoji}
                          </span>
                        ) : (
                          <span className="mt-0.5 shrink-0" aria-hidden>
                            <TrekDetailIcon icon="dress" size={16} />
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {row.title}
                          </p>
                          <p className={`text-[11px] leading-relaxed mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {row.body}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB 5: PRIZE POOL */}
                {activeTab === 'prize' && event.prizePool && (
                  <div className={`p-3 rounded-2xl border ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                    {renderList(toLines(event.prizePool))}
                  </div>
                )}
              </div>
            )}

            {/* Contact Details Card */}
            {event.contacts.length > 0 && (
              <div className={`rounded-3xl p-3.5 sm:p-4 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                <h2 className={`text-xs sm:text-sm font-bold leading-snug mb-2.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Organizer Contact
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {event.contacts.map((contact, idx) => (
                    <div key={idx} className={`p-2.5 rounded-2xl border space-y-1.5 ${isDark ? 'bg-[#161718] border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      {(contact.name || contact.role) && (
                        <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {contact.name || 'Contact'}
                          {contact.role && (
                            <span className="font-normal text-[11px] text-gray-400 ml-1">
                              · {contact.role}
                            </span>
                          )}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {contact.phone && (
                          <a href={`tel:${contact.phone.replace(/[\s-]/g, '')}`} className="flex items-center gap-1.5 text-xs text-[#0ECCEE] hover:underline">
                            <Phone size={12} />
                            <span>{contact.phone}</span>
                          </a>
                        )}
                        {contact.email && (
                          <a href={`mailto:${contact.email}`} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white">
                            <Mail size={12} />
                            <span className="truncate max-w-[130px]">{contact.email}</span>
                          </a>
                        )}
                        {contact.instagramId && (
                          <a
                            href={`https://instagram.com/${contact.instagramId.replace('@', '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-pink-400 hover:underline"
                          >
                            <Instagram size={12} />
                            <span>@{contact.instagramId.replace('@', '')}</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (lg:col-span-5): Location Map & Event Gallery */}
          <div className="lg:col-span-5 flex flex-col gap-2.5 sm:gap-3">
            {/* Map Card */}
            {(mapQuery || event.mapUrl) && (
              <div className={`rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={15} className="text-[#0ECCEE]" />
                    <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                      Location &amp; Route Map
                    </p>
                  </div>
                  {directionsUrl ? (
                    <button
                      type="button"
                      onClick={() => openExternalUrl(directionsUrl)}
                      className="text-xs font-bold text-[#0ECCEE] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Directions ↗
                    </button>
                  ) : null}
                </div>
                <div className="w-full h-[145px] sm:h-[160px] rounded-2xl overflow-hidden relative border border-white/5">
                  <LazyMap query={mapQuery} mapUrl={event.mapUrl || undefined} isDark={isDark} title="Event Location Map" />
                </div>
                {event.venue && event.venue !== 'Venue TBA' && (
                  <p className={`text-xs mt-2 font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    📍 {event.venue}
                  </p>
                )}
              </div>
            )}

            {/* Event Gallery Preview Card */}
            {gallery.length > 0 && (
              <div className={`rounded-3xl border overflow-hidden p-3.5 sm:p-4 transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-2.5">
                  <p className={`text-xs font-bold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                    Event Gallery
                  </p>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-[#1D1E20] text-gray-400' : 'bg-gray-100 text-gray-600'}`}>
                    {gallery.length} Photos
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {galleryPreview.map((img, idx) => {
                    const isLast = idx === 3 && galleryExtra > 0;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setLightboxIndex(idx)}
                        className="relative h-[70px] sm:h-[80px] rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition border border-white/5"
                      >
                        <img
                          src={getImageUrl(img, { preset: 'thumb' })}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => handleImageErrorWithFallback(e, 80, 80, '#2A2B2E', 'Gallery')}
                        />
                        {isLast && (
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-white text-[11px] font-bold">
                            +{galleryExtra}
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

        {/* FULL-WIDTH TERMS & PARTICIPATION POLICY */}
        {termsLines.length > 0 && (
          <div className="flex flex-col gap-3.5 w-full mt-1">
            {/* Full-width Terms & Participation Policy Card */}
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
                      {termsLines.length} Policy Points · Tap to {termsOpen ? 'collapse' : 'view'}
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
                  {termsLines.map((line, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs">
                      <span className={`text-[10px] font-bold mt-0.5 shrink-0 size-4 rounded-full flex items-center justify-center ${isDark ? 'bg-[#1A1B1D] text-[#0ECCEE]' : 'bg-amber-100 text-amber-700'}`}>{idx + 1}</span>
                      <p className={`text-[11px] sm:text-xs leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>{line}</p>
                    </div>
                  ))}
                  <p className={`text-[11px] pt-1 font-medium ${isDark ? 'text-gray-500' : 'text-amber-700'}`}>
                    ⚠️ By registering, you agree to all the above event terms.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SIMILAR EVENTS FULL-WIDTH SHELF */}
        {similarEvents.length > 0 && (
          <div className={`mt-2 rounded-3xl p-4 sm:p-5 border transition-all ${isDark ? 'bg-[#111213] border-white/5 shadow-md' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <h3 className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Explore Other Events
                </h3>
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  More performances, shows, and campus gatherings
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/events')}
                className="text-xs font-bold text-[#0ECCEE] hover:underline cursor-pointer flex items-center gap-1"
              >
                View all <ChevronRight size={14} />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {similarEvents.map((sim) => {
                const simImg = sim.poster || sim.image || sim.coverImages?.hero || sim.coverImages?.portrait;
                const simDate = formatShortDate(sim.showTimings);
                const simFee = minEventShowFee(sim);
                return (
                  <div
                    key={sim._id || sim.id || sim.slug}
                    onClick={() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                      navigate(eventShowPath(sim));
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
                          alt={sim.title || 'Event'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                          onError={(e) => handleImageErrorWithFallback(e, 80, 80, '#1A1B1D', sim.title || 'Event')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">🎪</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#0ECCEE] transition-colors ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {sim.title}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-400">
                        {simDate && <span>📅 {simDate}</span>}
                        {sim.city && <span className="truncate">📍 {sim.city}</span>}
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

        {/* ORGANIZERS STORY SLIDER (Above footer / bottom of page, seamless without box) */}
        <OrganizersStorySlider
          title="Organizers"
          realOrganizer={event.organizer || (event.contacts?.[0]?.name ? { name: event.contacts[0].name, image: event.contacts[0].image } : null)}
          eventKey={event.id || event.slug || event.type || event.category}
          isDark={isDark}
        />
      </div>

      {typeof document !== 'undefined' && createPortal(
        <>
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
                  setSelectedTierIds([]);
                }}
              />
              <div
                className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] flex flex-col rounded-t-3xl pt-3 tier-sheet-in ${isDark ? 'bg-[#161718]' : 'bg-white'
                  }`}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-500/40 shrink-0" />
                <div className="flex items-start justify-between gap-3 px-4 mb-3 shrink-0">
                  <div>
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Choose tickets</h3>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                      {event.tiersMultiSelect
                        ? 'Select one or more classes — fee adds up per class.'
                        : 'Pick your ticket, then continue to register.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={tierNavigating}
                    onClick={() => {
                      setTierSheetOpen(false);
                      setSelectedTierId(null);
                      setSelectedTierIds([]);
                    }}
                    className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors duration-200 ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    Close
                  </button>
                </div>

                {(() => {
                  const multiSelect = Boolean(event.tiersMultiSelect);
                  const buckets = [
                    { key: 'solo', label: 'Solo' },
                    { key: 'couple', label: 'Couple' },
                    { key: 'group', label: 'Group' },
                  ].filter((b) => packageTiers.some((t) => tierBucket(t) === b.key));
                  const visible = multiSelect
                    ? packageTiers
                    : packageTiers.filter((t) => tierBucket(t) === tierBucketFilter);
                  const sorted = [...visible].sort((a, b) => {
                    const ao = Number(a.order);
                    const bo = Number(b.order);
                    if (Number.isFinite(ao) && Number.isFinite(bo) && ao !== bo) return ao - bo;
                    const pn = tierPeopleCount(a) - tierPeopleCount(b);
                    if (pn !== 0) return pn;
                    return (Number(a.fee) || 0) - (Number(b.fee) || 0);
                  });
                  const selectedTier = packageTiers.find((t) => t.id === selectedTierId) || null;
                  const selectedMulti = packageTiers.filter((t) => selectedTierIds.includes(t.id));
                  const multiTotal = selectedMulti.reduce((sum, t) => sum + Math.max(0, Number(t.fee) || 0), 0);
                  const canContinue = multiSelect ? selectedMulti.length > 0 : Boolean(selectedTier);

                  const toggleMulti = (tierId) => {
                    setSelectedTierIds((prev) => (
                      prev.includes(tierId)
                        ? prev.filter((id) => id !== tierId)
                        : [...prev, tierId]
                    ));
                  };

                  const goNext = () => {
                    if (!canContinue || tierNavigating) return;
                    setTierNavigating(true);
                    const ids = multiSelect
                      ? selectedMulti.map((t) => t.id)
                      : [selectedTier.id];
                    const tierId = ids[0];
                    const tiersQuery = ids.map(encodeURIComponent).join(',');
                    window.setTimeout(() => {
                      const qs = multiSelect && ids.length
                        ? `?tier=${encodeURIComponent(tierId)}&tiers=${tiersQuery}`
                        : `?tier=${encodeURIComponent(tierId)}`;
                      navigate(`${eventShowPath(event)}/register${qs}`, {
                        state: {
                          event: event.raw || event,
                          tierId,
                          selectedTierIds: ids,
                          openLogin: !isLoggedIn(),
                        },
                      });
                      setTierSheetOpen(false);
                      setTierNavigating(false);
                      setSelectedTierId(null);
                      setSelectedTierIds([]);
                    }, 220);
                  };

                  return (
                    <>
                      {!multiSelect && buckets.length > 1 ? (
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
                                className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 ease-out ${tierBucketFilter === b.key
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
                        key={multiSelect ? 'multi' : tierBucketFilter}
                        className="px-4 overflow-y-auto space-y-2 flex-1 min-h-0 animate-step-enter"
                        style={{ WebkitOverflowScrolling: 'touch' }}
                      >
                        {sorted.map((tier) => {
                          const people = tierPeopleCount(tier);
                          const selected = multiSelect
                            ? selectedTierIds.includes(tier.id)
                            : selectedTierId === tier.id;
                          const feeLabel = Number(tier.fee) > 0 ? formatInr(tier.fee) : 'Free';
                          const perPerson = !multiSelect && people > 1 && Number(tier.fee) > 0
                            ? Math.round(Number(tier.fee) / people)
                            : null;

                          return (
                            <button
                              key={tier.id}
                              type="button"
                              disabled={tierNavigating}
                              onClick={() => (
                                multiSelect
                                  ? toggleMulti(tier.id)
                                  : setSelectedTierId(tier.id)
                              )}
                              className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all duration-200 ease-out active:scale-[0.99] ${selected
                                ? 'border-[#0ECCEE] bg-[#0ECCEE]/10 shadow-[0_0_0_1px_rgba(14,204,238,0.25)]'
                                : isDark
                                  ? 'bg-[#111213] border-white/10 hover:border-white/20'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                                }`}
                            >
                              <span
                                className={`${multiSelect ? 'rounded-md' : 'rounded-full'} size-4.5 border-2 flex items-center justify-center shrink-0 transition-colors duration-200 ${selected
                                  ? 'border-[#0ECCEE] bg-[#0ECCEE]'
                                  : isDark ? 'border-gray-600' : 'border-gray-300'
                                  }`}
                                aria-hidden
                              >
                                {selected ? <Check size={10} className="text-black" strokeWidth={3} /> : null}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className={`text-[15px] font-semibold leading-5 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                  {tierDisplayLabel(tier, { multi: multiSelect })}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                                  {multiSelect ? 'Competition class' : tierPeopleLabel(people)}
                                  {perPerson != null ? ` · ~${formatInr(perPerson)} / person` : ''}
                                </p>
                              </div>
                              <p className={`text-[15px] font-bold tabular-nums shrink-0 ${Number(tier.fee) > 0
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
                        {multiSelect && selectedMulti.length > 0 ? (
                          <p className={`text-xs mb-2 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                            {selectedMulti.length} class{selectedMulti.length === 1 ? '' : 'es'} · Total{' '}
                            <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {formatInr(multiTotal)}
                            </span>
                          </p>
                        ) : null}
                        <button
                          type="button"
                          disabled={!canContinue || tierNavigating}
                          onClick={goNext}
                          className={`w-full h-12 rounded-2xl text-[15px] font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ease-out ${!canContinue
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
                              {multiSelect && selectedMulti.length > 0
                                ? ` · ${formatInr(multiTotal)}`
                                : null}
                              {canContinue ? (
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

      {lightboxIndex != null && gallery.length > 0 && (
        <GalleryLightbox
          images={gallery}
          index={lightboxIndex}
          name={event?.title || 'Event Gallery'}
          onClose={() => setLightboxIndex(null)}
          onIndexChange={setLightboxIndex}
        />
      )}

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

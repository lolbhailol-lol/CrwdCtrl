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
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { trackBookNowClick } from '../../services/analyticsService';
import { getEventShowTiers, isEventShowTiersPricing, formatInr } from '../../utils/eventShowTiers';

function formatEventDateTime(showTimings) {
  if (!showTimings?.length) return 'Date & time TBA';
  const first = showTimings.find((s) => s.date) || showTimings[0];
  const dateStr = formatEventShowDate(showTimings);
  return first?.time ? `${dateStr} · ${first.time}` : dateStr;
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
    dateTime: formatEventDateTime(raw.showTimings),
    venue: raw.venue || raw.city || 'Venue TBA',
    mapUrl: (raw.mapUrl || '').trim(),
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

function usesInAppEventRegistration(reg = {}) {
  const mode = String(reg?.mode || '').toLowerCase();
  if (['internal_form', 'organizer_qr'].includes(mode)) return true;
  // Partial payloads sometimes omit mode but still carry the in-app form
  if (reg?.formType === 'MULTI_STEP' && Array.isArray(reg?.steps) && reg.steps.length > 0) return true;
  if (Array.isArray(reg?.formSchema) && reg.formSchema.length > 0) return true;
  return false;
}

function isEventRegistrationExplicitlyClosed(reg = {}) {
  return String(reg?.status || '').trim().toLowerCase() === 'closed';
}

function eventHasGuidedRegistrationForm(reg = {}) {
  if (reg?.formType === 'MULTI_STEP' && Array.isArray(reg?.steps) && reg.steps.length > 0) return true;
  if (Array.isArray(reg?.formSchema) && reg.formSchema.length > 0) return true;
  return false;
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

  const tabs = event
    ? [
        { key: 'general', label: 'General Rules', content: event.generalRules, type: 'list' },
        { key: 'process', label: 'Process', content: event.process, type: 'text' },
        { key: 'prize', label: 'Prize Pool', content: event.prizePool, type: 'list' },
        { key: 'included', label: "What's Included", content: event.whatsIncluded, type: 'list' },
        { key: 'eligibility', label: 'Eligibility', content: event.eligibility, type: 'list' },
      ].filter((t) => Boolean(t.content && t.content.trim()))
    : [];

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

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

      const goToForm = ({ openLoginAfter = false } = {}) => {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: r.mode || 'internal_form',
          destination: 'internal_register_page',
        });
        navigate(`${eventShowPath(event)}/register`, {
          state: {
            event: event.raw || event,
            openLogin: openLoginAfter,
          },
        });
      };

      // Multi-step forms (Independence Day Drive, etc.): open form page 1 first
      // so users pick Drive / Spectators / Trackday — not a package sheet that skips step 1.
      if (eventHasGuidedRegistrationForm(r)) {
        if (!isLoggedIn()) {
          goToForm({ openLoginAfter: true });
          return;
        }
        goToForm();
        return;
      }

      if (!isLoggedIn()) {
        toast('Please log in to register');
        setShowLogin(true);
        return;
      }
      const tiers = isEventShowTiersPricing(event) ? getEventShowTiers(event) : [];
      if (tiers.length) {
        trackBookNowClick({
          entityType: 'events',
          entityId: event?.id || '',
          mode: r.mode,
          destination: 'tier_selection',
        });
        setExpandedTierId(null);
        setSelectingTierId(null);
        setTierSheetOpen(true);
        return;
      }
      goToForm();
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
    }
    else toast('Registration link not available yet');
  };

  if (loading) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen">
        <InlinePageLoader label="Loading event…" variant="event" />
      </div>
    );
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
  const registrationClosed = usesInAppEventRegistration(reg)
    ? isEventRegistrationExplicitlyClosed(reg)
    : !(event.registrationLink || event.bookingLink);

  const cardBg = isDark ? 'bg-[#111213]' : 'bg-white';
  const sheetBg = isDark ? 'bg-[#161718]' : 'bg-slate-100';

  // Prefer organizer-pasted Maps pin; fall back to Google search on venue text
  const hasVenue = Boolean(event.venue) && event.venue !== 'Venue TBA';
  const directionsUrl = event.mapUrl
    || (hasVenue
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.venue)}`
      : null);

  return (
    <div className="crwdctrl-page min-h-screen pb-28">
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

      <div className="mx-auto w-full md:max-w-2xl">
        {/* Hero — full-width on phones, aligned with content on desktop */}
        <div className="relative h-80 sm:h-96 w-full">
          {event.image ? (
            <img
              src={getCoverImageUrl(event, 'hero') || getImageUrl(event.image, { preset: 'hero' })}
              alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              onError={(e) => handleImageErrorWithFallback(e, 400, 384, '#2A2B2E', event.title)}
            />
          ) : (
            <div className="absolute inset-0 bg-linear-to-br from-purple-800 to-indigo-600 flex items-center justify-center">
              <span className="text-6xl">🎭</span>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 bg-linear-to-b from-black/35 to-transparent">
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
          {event.displayName && (
            <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>
              {event.displayName}
            </p>
          )}
          {event.type && (
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
          <div className="mt-5 space-y-3">
            <div className="flex items-center gap-3">
              <Calendar size={32} className="text-[#0ECCEE] shrink-0" />
              <span className={`text-base font-medium ${isDark ? 'text-gray-200' : 'text-black'}`}>{event.dateTime}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin size={32} className="text-[#0ECCEE] shrink-0" />
              {directionsUrl ? (
                <button
                  type="button"
                  onClick={() => openExternalUrl(directionsUrl)}
                  className="text-base font-medium text-left text-[#0ECCEE] underline-offset-2 hover:underline active:opacity-80"
                >
                  {event.venue}
                </button>
              ) : (
                <span className={`text-base font-medium ${isDark ? 'text-gray-200' : 'text-black'}`}>{event.venue}</span>
              )}
            </div>
          </div>

          {/* About */}
          {event.about && (
            <div className="mt-6">
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
          )}

          {/* Tab box (trek-style): General Rules / Process / Prize Pool / What's Included */}
          {tabs.length > 0 && (
            <div className="mt-6">
              <div className={`rounded-2xl p-1 mb-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                <div className="flex justify-center gap-1 overflow-x-auto scrollbar-hide rounded-xl p-1">
                  {tabs.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setActiveTab(t.key)}
                      className={`relative shrink-0 whitespace-nowrap py-2 px-4 text-xs font-semibold rounded-xl transition-all duration-200 ${
                        activeTab === t.key
                          ? isDark ? 'bg-[#1D1E20] text-white shadow-sm' : 'bg-white text-gray-900 shadow-sm'
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

              <div className={`rounded-2xl p-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                {activeTabObj?.type === 'list' ? (
                  <ul className="space-y-2">
                    {toLines(activeTabObj.content).map((item, idx) => {
                      // A line is a bold heading (no bullet dot) if it ends with ":"
                      // or matches a known section word like "Eligibility".
                      const trimmed = item.trim();
                      const HEADING_WORDS = ['eligibility', 'general rules', 'rules', 'prize pool', 'process', "what's included", 'whats included', 'benefits', 'registration', 'how to register'];
                      const isHeading = /:\s*$/.test(trimmed)
                        || HEADING_WORDS.includes(trimmed.replace(/:\s*$/, '').toLowerCase());
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

          {/* Competition Rounds — separate box per round */}
          {event.rounds.length > 0 && (
            <div className="mt-6">
              <h2 className={`text-lg font-semibold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {event.rounds.length > 1 ? 'Competition Rounds' : 'Rounds'}
              </h2>

              <div className="space-y-3">
                {event.rounds.map((r, idx) => (
                  <div key={idx} className={`rounded-2xl p-4 ${isDark ? 'bg-[#111213]' : 'bg-white shadow-sm'}`}>
                    <h3 className={`font-bold text-lg mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                      {r.title || `Round ${idx + 1}`}
                    </h3>
                    {r.content && (
                      <ul className="space-y-2">
                        {toLines(r.content).map((item, i) => (
                          <li key={i} className={`flex items-start gap-2 text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            <span className="mt-1.5 size-1.5 rounded-full bg-[#0ECCEE] shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Benefits */}
          {benefitsList.length > 0 && (
            <div className="mt-6">
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

      {/* Sticky bottom bar: Register only */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 px-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 6px)' }}
      >
        <div className={`mx-auto w-full max-w-md md:max-w-2xl rounded-[30px] px-5 py-3.5 ${isDark ? 'bg-[#111213] shadow-lg' : 'bg-white shadow-[0_-2px_20px_rgba(0,0,0,0.15)] border border-gray-100'}`}>
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
            className={`relative w-full max-w-md md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] ${
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
                          : 'bg-white border-gray-200 hover:border-[#0ECCEE]/55 shadow-sm'
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
                            state: { tierId: tier.id },
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
      )}
    </div>
  );
}
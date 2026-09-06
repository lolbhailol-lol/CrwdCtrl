import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Ticket, CalendarDays, MapPin, Users, CalendarPlus } from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import LocalQRCode from '../../components/LocalQRCode';
import { buildGoogleCalendarUrl } from '../../utils/calendar';
import { openExternalUrl } from '../../utils/externalLink';

import { API_BASE_URL } from '../../services/api/client';
import { authenticatedFetchJSON } from '../../services/api/auth.api';
import { useAuth } from '../../context/AuthContext';
import { InlinePageLoader } from '../../components/DetailPageLoader';

const ticketCacheKey = (type, id) => `crwdctrl_ticket_${type || 'fest'}_${id}`;

const readCachedTicket = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeCachedTicket = (key, data) => {
  if (!data) return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* private mode or quota — the ticket still works while online */
  }
};

const formatTicketDate = (date) => {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return String(date);
  return parsed.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const TICKET_POLL_MS = [400, 700, 1000, 1500, 2000, 2500, 3000];
const sleep = (ms) => new Promise((resolve) => { window.setTimeout(resolve, ms); });

function isTicketNotFoundError(err) {
  const msg = String(err?.message || '');
  return err?.code === 'NOT_FOUND'
    || err?.status === 404
    || /registration not found/i.test(msg)
    || /sports registration not found/i.test(msg);
}

function ticketEndpoints(registrationId) {
  const base = API_BASE_URL;
  return [
    `${base}/qr/sports-registrations/${registrationId}/qr`,
    `${base}/qr/event-registrations/${registrationId}/qr`,
    `${base}/qr/registrations/${registrationId}/qr`,
  ];
}

function preferredTicketUrl(registrationId, { isTrekTicket, isSportsTicket, isEventTicket, ticketHub }) {
  const treatAsSports = isSportsTicket || ticketHub === 'events';
  if (isTrekTicket) return `${API_BASE_URL}/qr/trek-bookings/${registrationId}/qr`;
  if (isEventTicket) return `${API_BASE_URL}/qr/event-registrations/${registrationId}/qr`;
  if (treatAsSports) return `${API_BASE_URL}/qr/sports-registrations/${registrationId}/qr`;
  return `${API_BASE_URL}/qr/registrations/${registrationId}/qr`;
}

export default function QRTicketPage() {
  const { isDark } = useDarkMode();
  const { token: authToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketType = searchParams.get('type');
  const ticketHub = searchParams.get('hub') || '';
  const bookingAccess = searchParams.get('access') || '';
  const isTrekTicket = ticketType === 'trek';
  const isSportsTicket = ticketType === 'sports' || ticketHub === 'events';
  const isEventTicket = ticketType === 'event';
  const fromPayment = Boolean(location.state?.fromPayment);
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    if (authLoading) return;

    const canGuestTrek = isTrekTicket && Boolean(bookingAccess);
    if (!isAuthenticated && !canGuestTrek) {
      navigate('/login', { state: { from: location.pathname + location.search }, replace: true });
      return;
    }

    // Paint the last saved ticket straight away, then refresh behind it. At a venue gate the
    // network is the least reliable part of the queue, and the QR hash stays valid server-side.
    const cacheKey = ticketCacheKey(ticketType, registrationId);
    const cached = readCachedTicket(cacheKey);
    if (cached) {
      setTicket(cached);
      setFromCache(true);
      setLoading(false);
    }

    const fetchTicket = async () => {
      try {
        if (!cached) setLoading(true);
        setError(null);

        const primaryUrl = preferredTicketUrl(registrationId, {
          isTrekTicket,
          isSportsTicket,
          isEventTicket,
          ticketHub,
        });

        const loadAuthed = async (url) => {
          const data = await authenticatedFetchJSON(url, {
            token: authToken,
            headers: bookingAccess ? { 'x-booking-access': bookingAccess } : undefined,
          });
          return data.data;
        };

        const tryLoadTicket = async () => {
          if (canGuestTrek && !isAuthenticated) {
            const res = await fetch(`${primaryUrl}?access=${encodeURIComponent(bookingAccess)}`, {
              headers: {
                'Content-Type': 'application/json',
                'x-booking-access': bookingAccess,
              },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              const err = new Error(data.message || data.error || 'Failed to load ticket');
              err.status = res.status;
              if (res.status === 404) err.code = 'NOT_FOUND';
              throw err;
            }
            return { payload: data.data, resolvedUrl: primaryUrl };
          }

          const urls = [primaryUrl];
          if (!isTrekTicket) {
            for (const url of ticketEndpoints(registrationId)) {
              if (!urls.includes(url)) urls.push(url);
            }
          }

          let lastErr = null;
          for (const url of urls) {
            try {
              const payload = await loadAuthed(url);
              return { payload, resolvedUrl: url };
            } catch (err) {
              lastErr = err;
              if (!isTicketNotFoundError(err)) throw err;
            }
          }
          throw lastErr || new Error('Registration not found');
        };

        let result = null;
        const shouldPoll = fromPayment || !ticketType || ticketHub === 'events';
        const attempts = shouldPoll ? TICKET_POLL_MS.length + 1 : 1;

        for (let attempt = 0; attempt < attempts; attempt += 1) {
          try {
            result = await tryLoadTicket();
            break;
          } catch (err) {
            const retryable = isTicketNotFoundError(err);
            if (!retryable || attempt >= attempts - 1) throw err;
            await sleep(TICKET_POLL_MS[attempt] || 1500);
          }
        }

        const { payload, resolvedUrl } = result;
        setTicket(payload);

        const resolvedSports = resolvedUrl.includes('/sports-registrations/');
        const resolvedEvent = resolvedUrl.includes('/event-registrations/');
        const needsQueryFix = resolvedSports && !isSportsTicket && ticketType !== 'sports';
        const hubSuffix = (ticketHub === 'events' || payload?.listingHub === 'events') ? '&hub=events' : '';
        if (needsQueryFix) {
          const qs = `type=sports${hubSuffix}`;
          navigate(`/qr-ticket/${registrationId}?${qs}`, {
            replace: true,
            state: location.state,
          });
        } else if (resolvedSports && ticketHub === 'events' && ticketType !== 'sports') {
          navigate(`/qr-ticket/${registrationId}?type=sports&hub=events`, {
            replace: true,
            state: location.state,
          });
        } else if (resolvedEvent && !isEventTicket) {
          navigate(`/qr-ticket/${registrationId}?type=event`, { replace: true, state: location.state });
        }

        const cacheType = resolvedSports ? 'sports' : resolvedEvent ? 'event' : ticketType;
        writeCachedTicket(ticketCacheKey(cacheType, registrationId), payload);
        setFromCache(false);
      } catch (err) {
        // A saved ticket beats bouncing someone to a login screen while they stand at the gate.
        if (cached) return;
        if (err.code === 'AUTH_401' && !canGuestTrek) {
          navigate('/login', { state: { from: location.pathname + location.search }, replace: true });
          return;
        }
        if (isTicketNotFoundError(err) && (fromPayment || !ticketType)) {
          setError('Your booking is still confirming. Open My Bookings — your ticket will appear in a moment.');
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [registrationId, ticketType, ticketHub, isTrekTicket, isSportsTicket, isEventTicket, authToken, authLoading, isAuthenticated, navigate, location.pathname, location.search, location.state, bookingAccess, fromPayment]);

  const cardClass = isDark
    ? 'bg-[#111213] border-gray-800'
    : 'bg-white border-gray-200 shadow-sm';
  const sectionBorderClass = isDark ? 'border-gray-800' : 'border-gray-200';
  const footerClass = isDark
    ? 'border-gray-800 bg-gray-900/50'
    : 'border-gray-200 bg-gray-50';
  const titleClass = isDark ? 'text-white' : 'text-gray-900';
  const bodyTextClass = isDark ? 'text-white' : 'text-gray-900';
  const mutedTextClass = isDark ? 'text-gray-500' : 'text-gray-500';
  const backLinkClass = isDark
    ? 'text-gray-400 hover:text-white'
    : 'text-gray-600 hover:text-gray-900';

  if (loading) {
    return (
      <InlinePageLoader label="Loading ticket…" variant="booking" fullScreen />
    );
  }

  if (error) {
    const stillConfirming = /still confirming/i.test(error);
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className={`mb-4 ${stillConfirming ? 'text-amber-300' : 'text-red-400'}`}>{error}</p>
          <Link to="/booking" className="text-[#0ECCEE] hover:underline font-semibold">
            {stillConfirming ? 'Open My Bookings' : 'Back to Bookings'}
          </Link>
        </div>
      </div>
    );
  }

  const eventTitle = isTrekTicket
    ? ticket.trekName || ticket.festName || 'Trek'
    : (ticket.listingHub === 'events' || ticketHub === 'events')
      ? ticket.eventTitle || ticket.festName || 'Event'
      : isSportsTicket
        ? ticket.eventTitle || ticket.festName || 'Sports Event'
        : isEventTicket
          ? ticket.eventTitle || ticket.festName || 'Event'
          : ticket.festName || 'Event';
  const isEventCommunityTicket = ticket.listingHub === 'events' || ticketHub === 'events';
  const ticketLabel = isTrekTicket
    ? 'Trek Ticket'
    : isEventCommunityTicket
      ? 'Event Ticket'
      : isSportsTicket
        ? 'Sports Ticket'
        : isEventTicket
          ? 'Event Ticket'
          : 'Event Ticket';
  const formattedDate = formatTicketDate(ticket.festDate);

  const calendarUrl = ticket.festDate
    ? buildGoogleCalendarUrl({
        title: eventTitle,
        start: ticket.festDate,
        location: ticket.venue || '',
        details: `Your CrwdCtrl ${isTrekTicket ? 'trek booking' : 'event registration'}${
          ticket.competitionName ? ` — ${ticket.competitionName}` : ''
        }. Show your QR ticket at the venue for check-in.`,
      })
    : null;

  return (
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[max(2rem,calc(var(--safe-top)+1rem))] pb-8 px-4">
      <div className="max-w-md mx-auto">
        <Link
          to="/booking"
          className={`inline-flex items-center gap-1.5 mb-6 text-sm transition-colors ${backLinkClass}`}
        >
          <ArrowLeft size={16} />
          Back to Bookings
        </Link>

        <div className={`rounded-2xl border overflow-hidden ${cardClass}`}>
          <div className={`bg-linear-to-r from-[#0ECCEE]/20 to-[#0ECCEE]/5 px-6 py-4 border-b ${sectionBorderClass}`}>
            <div className="flex items-center gap-2 text-[#0ECCEE] mb-1">
              <Ticket size={18} />
              <span className="text-sm font-semibold uppercase tracking-wide">{ticketLabel}</span>
            </div>
            <h1 className={`text-xl font-bold ${titleClass}`}>{eventTitle}</h1>
            {!isTrekTicket && ticket.competitionName && (
              <p className={`text-sm mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                {ticket.competitionName}
              </p>
            )}
          </div>

          <div className={`px-6 py-4 space-y-3 border-b ${sectionBorderClass}`}>
            {ticket.userName && (
              <div>
                <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>Attendee</p>
                <p className={`font-medium ${bodyTextClass}`}>{ticket.userName}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-6">
              {formattedDate && (
                <div className="flex items-start gap-2">
                  <CalendarDays size={14} className={`mt-0.5 ${mutedTextClass}`} />
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>Date</p>
                    <p className={`text-sm ${bodyTextClass}`}>
                      {formattedDate}
                      {isTrekTicket && ticket.trekTime ? ` · ${ticket.trekTime}` : ''}
                    </p>
                  </div>
                </div>
              )}
              {ticket.venue && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className={`mt-0.5 ${mutedTextClass}`} />
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>Location</p>
                    <p className={`text-sm ${bodyTextClass}`}>{ticket.venue}</p>
                  </div>
                </div>
              )}
              {isTrekTicket && ticket.people > 1 && (
                <div className="flex items-start gap-2">
                  <Users size={14} className={`mt-0.5 ${mutedTextClass}`} />
                  <div>
                    <p className={`text-xs uppercase tracking-wide ${mutedTextClass}`}>People</p>
                    <p className={`text-sm ${bodyTextClass}`}>{ticket.people}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-6 flex flex-col items-center">
            {ticket.checkedIn ? (
              <div className="text-center py-4">
                <CheckCircle size={48} className="text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-semibold">Already Checked In</p>
                {ticket.checkedInAt && (
                  <p className="text-gray-500 text-xs mt-1">
                    {new Date(ticket.checkedInAt).toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            ) : (
              <>
                <LocalQRCode
                  data={{
                    hash: ticket.qrHash,
                    registrationId: ticket.registrationId,
                    type: isTrekTicket
                      ? 'crwdctrl-trek-checkin'
                      : isSportsTicket
                        ? 'crwdctrl-sports-checkin'
                        : isEventTicket
                          ? 'crwdctrl-event-checkin'
                          : 'crwdctrl-checkin',
                  }}
                  size={200}
                />
                <p className="text-gray-500 text-xs mt-3 text-center">
                  Show this QR code at the venue for check-in
                </p>
                {fromCache && (
                  <p className="text-amber-400 text-xs mt-1 text-center">
                    Saved ticket — works offline, no need to reload
                  </p>
                )}
              </>
            )}
          </div>

          <div className={`px-6 py-3 border-t ${footerClass}`}>
            <p className={`text-center text-xs ${isDark ? 'text-gray-600' : 'text-gray-500'}`}>
              {isTrekTicket ? 'Booking' : 'Registration'} ID:{' '}
              {ticket.registrationId?.slice(-8) || registrationId?.slice(-8)}
            </p>
          </div>
        </div>

        {calendarUrl && !ticket.checkedIn && (
          <button
            type="button"
            onClick={() => openExternalUrl(calendarUrl)}
            className={`mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-colors ${
              isDark
                ? 'bg-[#161718] border border-gray-800 text-white hover:bg-gray-800'
                : 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50'
            }`}
          >
            <CalendarPlus size={18} className="text-[#0ECCEE]" />
            Add to Calendar
          </button>
        )}
      </div>
    </div>
  );
}

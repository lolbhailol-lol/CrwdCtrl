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

export default function QRTicketPage() {
  const { isDark } = useDarkMode();
  const { token: authToken, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketType = searchParams.get('type');
  const isTrekTicket = ticketType === 'trek';
  const isSportsTicket = ticketType === 'sports';
  const isEventTicket = ticketType === 'event';
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname + location.search }, replace: true });
      return;
    }

    const fetchTicket = async () => {
      try {
        setLoading(true);
        setError(null);

        const url = isTrekTicket
          ? `${API_BASE_URL}/qr/trek-bookings/${registrationId}/qr`
          : isSportsTicket
            ? `${API_BASE_URL}/qr/sports-registrations/${registrationId}/qr`
            : isEventTicket
              ? `${API_BASE_URL}/qr/event-registrations/${registrationId}/qr`
              : `${API_BASE_URL}/qr/registrations/${registrationId}/qr`;

        const data = await authenticatedFetchJSON(url, { token: authToken });
        setTicket(data.data);
      } catch (err) {
        if (err.code === 'AUTH_401') {
          navigate('/login', { state: { from: location.pathname + location.search }, replace: true });
          return;
        }
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [registrationId, isTrekTicket, isSportsTicket, isEventTicket, authToken, authLoading, isAuthenticated, navigate, location.pathname, location.search]);

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
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading ticket...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crwdctrl-page crwdctrl-page--content min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/booking" className="text-[#0ECCEE] hover:underline">Back to Bookings</Link>
        </div>
      </div>
    );
  }

  const eventTitle = isTrekTicket
    ? ticket.trekName || ticket.festName || 'Trek'
    : isSportsTicket
      ? ticket.eventTitle || ticket.festName || 'Sports Event'
      : isEventTicket
        ? ticket.eventTitle || ticket.festName || 'Event'
        : ticket.festName || 'Event';
  const ticketLabel = isTrekTicket
    ? 'Trek Ticket'
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
    <div className="crwdctrl-page crwdctrl-page--content min-h-screen pt-[max(2rem,calc(env(safe-area-inset-top)+1rem))] pb-8 px-4">
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

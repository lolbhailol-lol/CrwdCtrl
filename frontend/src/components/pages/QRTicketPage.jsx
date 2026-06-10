import { useState, useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Ticket, CalendarDays, MapPin, Users } from 'lucide-react';
import LocalQRCode from '../LocalQRCode';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const getToken = () => localStorage.getItem('crwdctrl_token');

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
  const { registrationId } = useParams();
  const [searchParams] = useSearchParams();
  const ticketType = searchParams.get('type');
  const isTrekTicket = ticketType === 'trek';
  const isSportsTicket = ticketType === 'sports';
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const token = getToken();
        const url = isTrekTicket
          ? `${API_BASE_URL}/qr/trek-bookings/${registrationId}/qr`
          : isSportsTicket
            ? `${API_BASE_URL}/qr/sports-registrations/${registrationId}/qr`
            : `${API_BASE_URL}/qr/registrations/${registrationId}/qr`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load ticket');
        setTicket(data.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [registrationId, isTrekTicket, isSportsTicket]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading ticket...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
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
      : ticket.festName || 'Event';
  const ticketLabel = isTrekTicket
    ? 'Trek Ticket'
    : isSportsTicket
      ? 'Sports Ticket'
      : 'Event Ticket';
  const formattedDate = formatTicketDate(ticket.festDate);

  return (
    <div className="min-h-screen bg-[#111214] py-8 px-4">
      <div className="max-w-md mx-auto">
        <Link
          to="/booking"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white mb-6 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Bookings
        </Link>

        <div className="bg-[#111213] rounded-2xl border border-gray-800 overflow-hidden">
          <div className="bg-linear-to-r from-[#0ECCEE]/20 to-[#0ECCEE]/5 px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2 text-[#0ECCEE] mb-1">
              <Ticket size={18} />
              <span className="text-sm font-semibold uppercase tracking-wide">{ticketLabel}</span>
            </div>
            <h1 className="text-xl font-bold text-white">{eventTitle}</h1>
            {!isTrekTicket && ticket.competitionName && (
              <p className="text-gray-400 text-sm mt-0.5">{ticket.competitionName}</p>
            )}
          </div>

          <div className="px-6 py-4 space-y-3 border-b border-gray-800">
            {ticket.userName && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Attendee</p>
                <p className="text-white font-medium">{ticket.userName}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-6">
              {formattedDate && (
                <div className="flex items-start gap-2">
                  <CalendarDays size={14} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Date</p>
                    <p className="text-white text-sm">
                      {formattedDate}
                      {isTrekTicket && ticket.trekTime ? ` · ${ticket.trekTime}` : ''}
                    </p>
                  </div>
                </div>
              )}
              {ticket.venue && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Location</p>
                    <p className="text-white text-sm">{ticket.venue}</p>
                  </div>
                </div>
              )}
              {isTrekTicket && ticket.people > 1 && (
                <div className="flex items-start gap-2">
                  <Users size={14} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">People</p>
                    <p className="text-white text-sm">{ticket.people}</p>
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

          <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-800">
            <p className="text-center text-gray-600 text-xs">
              {isTrekTicket ? 'Booking' : 'Registration'} ID:{' '}
              {ticket.registrationId?.slice(-8) || registrationId?.slice(-8)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

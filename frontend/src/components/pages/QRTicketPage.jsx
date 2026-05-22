import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle, Ticket, CalendarDays, MapPin } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';
const getToken = () => localStorage.getItem('crwdctrl_token');

// Simple QR Code generator using a free API (no dependency needed)
function QRCodeImage({ data, size = 200 }) {
  const encodedData = encodeURIComponent(JSON.stringify(data));
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodedData}&bgcolor=111213&color=ffffff&format=svg`;

  return (
    <img
      src={url}
      alt="QR Code"
      width={size}
      height={size}
      className="rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

export default function QRTicketPage() {
  const { registrationId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTicket();
  }, [registrationId]);

  const fetchTicket = async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/qr/registrations/${registrationId}/qr`, {
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
          <Link to="/" className="text-[#0ECCEE] hover:underline">Go Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111214] py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Back Link */}
        <Link
          to="/my-registrations"
          className="inline-flex items-center gap-1.5 text-gray-400 hover:text-white mb-6 text-sm transition-colors"
        >
          <ArrowLeft size={16} />
          Back to Registrations
        </Link>

        {/* Ticket Card */}
        <div className="bg-[#111213] rounded-2xl border border-gray-800 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0ECCEE]/20 to-[#0ECCEE]/5 px-6 py-4 border-b border-gray-800">
            <div className="flex items-center gap-2 text-[#0ECCEE] mb-1">
              <Ticket size={18} />
              <span className="text-sm font-semibold uppercase tracking-wide">Event Ticket</span>
            </div>
            <h1 className="text-xl font-bold text-white">
              {ticket.festName || 'Event'}
            </h1>
            {ticket.competitionName && (
              <p className="text-gray-400 text-sm mt-0.5">{ticket.competitionName}</p>
            )}
          </div>

          {/* Details */}
          <div className="px-6 py-4 space-y-3 border-b border-gray-800">
            {ticket.userName && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide">Attendee</p>
                <p className="text-white font-medium">{ticket.userName}</p>
              </div>
            )}
            <div className="flex gap-6">
              {ticket.festDate && (
                <div className="flex items-start gap-2">
                  <CalendarDays size={14} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Date</p>
                    <p className="text-white text-sm">
                      {new Date(ticket.festDate).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
              {ticket.venue && (
                <div className="flex items-start gap-2">
                  <MapPin size={14} className="text-gray-500 mt-0.5" />
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wide">Venue</p>
                    <p className="text-white text-sm">{ticket.venue}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* QR Code */}
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
                <QRCodeImage
                  data={{ hash: ticket.qrHash, registrationId: ticket.registrationId }}
                  size={200}
                />
                <p className="text-gray-500 text-xs mt-3 text-center">
                  Show this QR code at the venue for check-in
                </p>
              </>
            )}
          </div>

          {/* Footer  */}
          <div className="px-6 py-3 bg-gray-900/50 border-t border-gray-800">
            <p className="text-center text-gray-600 text-xs">
              Registration ID: {ticket.registrationId?.slice(-8) || registrationId?.slice(-8)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

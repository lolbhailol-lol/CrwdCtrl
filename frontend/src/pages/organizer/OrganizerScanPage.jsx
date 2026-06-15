import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Mountain, PartyPopper, Trophy } from 'lucide-react';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';
import {
  getFestScannerSession,
  clearFestScannerSession,
  isTrekScannerSession,
  isSportScannerSession,
} from '../../utils/festScannerSession';
import { getApiBaseUrl } from '../../config/apiBase';

export default function OrganizerScanPage() {
  const navigate = useNavigate();
  const [session] = useState(() => getFestScannerSession());

  useEffect(() => {
    if (!session) navigate('/organizer/login', { replace: true });
  }, [session, navigate]);

  if (!session) return null;

  const isTrek = isTrekScannerSession(session);
  const isSport = isSportScannerSession(session);
  const eventLabel = isTrek
    ? session.trekName || session.city || 'Your trek'
    : isSport
      ? session.eventTitle || session.city || 'Your sports event'
      : session.festName || session.collegeName || 'Your fest';
  const api = getApiBaseUrl();

  const handleLogout = () => {
    clearFestScannerSession();
    navigate('/organizer/login', { replace: true });
  };

  const scannerProps = isTrek
    ? {
        mode: 'trek_scanner',
        trekId: session.trekId,
        festName: eventLabel,
        checkinUrl: `${api}/scanner/trek/${session.trekId}/checkin`,
        statsUrl: `${api}/scanner/trek/${session.trekId}/stats`,
        exportUrl: `${api}/scanner/trek/${session.trekId}/export`,
        subtitle: 'Scan trek ticket QR from My Bookings → Download ticket',
      }
    : isSport
      ? {
          mode: 'sport_scanner',
          sportEventId: session.sportEventId,
          festName: eventLabel,
          checkinUrl: `${api}/scanner/sport/${session.sportEventId}/checkin`,
          statsUrl: `${api}/scanner/sport/${session.sportEventId}/stats`,
          exportUrl: `${api}/scanner/sport/${session.sportEventId}/export`,
          subtitle: 'Scan sports/run club ticket QR from My Bookings → Download ticket',
        }
      : {
          mode: 'scanner',
          festId: session.festId,
          festName: eventLabel,
          checkinUrl: `${api}/scanner/${session.festId}/checkin`,
          statsUrl: `${api}/scanner/${session.festId}/stats`,
          exportUrl: `${api}/scanner/${session.festId}/export`,
          subtitle: 'Scan attendee QR from My Bookings → Download ticket',
        };

  return (
    <div className="min-h-screen bg-[#161718] flex flex-col">
      <header className="sticky top-0 z-20 border-b border-gray-800/80 bg-[#161718]/95 backdrop-blur-md safe-area-top">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div
            className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
              isTrek ? 'bg-[#0ECCEE]/10' : 'bg-[#0ECCEE]/10'
            }`}
          >
            {isTrek ? (
              <Mountain size={18} className="text-[#0ECCEE]" />
            ) : isSport ? (
              <Trophy size={18} className="text-[#0ECCEE]" />
            ) : (
              <PartyPopper size={18} className="text-[#0ECCEE]" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wider text-gray-500 font-medium">
              {isTrek ? 'Trek scanner' : isSport ? 'Sports scanner' : 'Fest scanner'}
            </p>
            <p className="text-sm font-semibold text-white truncate">{eventLabel}</p>
            {session.scannerCode && (
              <p className="text-xs text-[#0ECCEE] font-mono">{session.scannerCode}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-700 text-gray-400 text-xs hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Log out</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        <CheckinScannerPage
          embedded
          showStats
          getAuthToken={() => session.token}
          title="Scan ticket"
          {...scannerProps}
        />
      </main>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { QrCode, Loader, Mountain, PartyPopper, Trophy, Home } from 'lucide-react';
import { getApiBaseUrl } from '../../config/apiBase';
import { setFestScannerSession } from '../../utils/festScannerSession';

export default function OrganizerScannerLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState(() =>
    (searchParams.get('code') || '').trim().toUpperCase(),
  );
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/scanner/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Login failed');

      setFestScannerSession(
        data.eventType === 'trek'
          ? {
              eventType: 'trek',
              token: data.token,
              trekId: data.trekId,
              trekName: data.trekName,
              city: data.city,
              scannerCode: data.scannerCode,
              label: data.label,
            }
          : data.eventType === 'sport'
            ? {
                eventType: 'sport',
                token: data.token,
                sportEventId: data.sportEventId,
                eventTitle: data.eventTitle,
                city: data.city,
                sportType: data.sportType,
                scannerCode: data.scannerCode,
                label: data.label,
              }
            : {
                eventType: 'fest',
                token: data.token,
                festId: data.festId,
                festName: data.festName,
                collegeName: data.collegeName,
                scannerCode: data.scannerCode,
                label: data.label,
              },
      );

      navigate('/organizer/scan', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not log in');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full bg-[#1D1E20] border border-gray-700 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE] transition-colors';

  return (
    <div className="min-h-screen bg-[#161718] text-white flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0ECCEE]/10 border border-[#0ECCEE]/20 mb-5">
            <QrCode className="text-[#0ECCEE]" size={30} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Check-in Scanner</h1>
          <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto leading-relaxed">
            Enter the event code and password shared by your organizer to start scanning tickets.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl border border-gray-800 bg-[#111213] p-3 text-center">
            <PartyPopper size={18} className="text-[#0ECCEE] mx-auto mb-1.5" />
            <p className="text-xs font-medium text-gray-300">Fest</p>
            <p className="text-[10px] text-gray-500 mt-0.5">University events</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#111213] p-3 text-center">
            <Mountain size={18} className="text-[#0ECCEE] mx-auto mb-1.5" />
            <p className="text-xs font-medium text-gray-300">Trek</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Outdoor bookings</p>
          </div>
          <div className="rounded-xl border border-gray-800 bg-[#111213] p-3 text-center">
            <Trophy size={18} className="text-[#0ECCEE] mx-auto mb-1.5" />
            <p className="text-xs font-medium text-gray-300">Sports</p>
            <p className="text-[10px] text-gray-500 mt-0.5">Run clubs & events</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 bg-[#111213] border border-gray-800 rounded-2xl p-6 shadow-xl shadow-black/20"
        >
          <div>
            <label htmlFor="event-code" className="block text-xs font-medium text-gray-400 mb-2">
              Event code
            </label>
            <input
              id="event-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. DU-FEST26"
              autoCapitalize="characters"
              autoComplete="username"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label htmlFor="event-password" className="block text-xs font-medium text-gray-400 mb-2">
              Password
            </label>
            <input
              id="event-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Scanner password"
              autoComplete="current-password"
              className={inputClass}
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-[#0ECCEE] text-black font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-opacity"
          >
            {loading && <Loader className="animate-spin" size={18} />}
            Open Scanner
          </button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <p className="text-center text-xs text-gray-500 leading-relaxed">
            Don&apos;t have a code? Ask your event organizer for the login details.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-300 hover:text-white hover:border-gray-500 hover:bg-[#111213] transition-colors"
          >
            <Home size={16} className="text-[#0ECCEE]" />
            Back to CrwdCtrl
          </Link>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { QrCode, Loader, Mountain, PartyPopper, Copy, Check, ChevronRight, Trophy } from 'lucide-react';
import FestScannerSetup from './FestScannerSetup';
import TrekScannerSetup from './TrekScannerSetup';
import SportScannerSetup from './SportScannerSetup';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

const STEPS = [
  'Pick a fest, trek, or sports event below',
  'Set a unique code + password',
  'Add Google Sheet URL (optional)',
  'Share login link with organizers',
];

export default function ScannerAccessPage() {
  const [tab, setTab] = useState('fests');
  const [fests, setFests] = useState([]);
  const [treks, setTreks] = useState([]);
  const [sportsEvents, setSportsEvents] = useState([]);
  const [selectedFestId, setSelectedFestId] = useState('');
  const [selectedTrekId, setSelectedTrekId] = useState('');
  const [selectedSportId, setSelectedSportId] = useState('');
  const [loadingFests, setLoadingFests] = useState(true);
  const [loadingTreks, setLoadingTreks] = useState(true);
  const [loadingSports, setLoadingSports] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`${API}/admin/fests?limit=500`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.fests || [];
        setFests(list);
        if (list.length > 0) setSelectedFestId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingFests(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/admin/treks?limit=500`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.treks || [];
        setTreks(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) setSelectedTrekId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingTreks(false));
  }, []);

  useEffect(() => {
    fetch(`${API}/admin/sports?limit=500`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const list = data.events || [];
        setSportsEvents(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) setSelectedSportId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingSports(false));
  }, []);

  const selectedFest = fests.find((f) => f._id === selectedFestId);
  const selectedTrek = treks.find((t) => t._id === selectedTrekId);
  const selectedSport = sportsEvents.find((s) => s._id === selectedSportId);
  const loginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/organizer/login` : '/organizer/login';

  const copyLogin = () => {
    navigator.clipboard?.writeText(loginUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFest = tab === 'fests';
  const isTrek = tab === 'treks';
  const isSport = tab === 'sports';
  const loading = isFest ? loadingFests : isTrek ? loadingTreks : loadingSports;
  const empty = isFest ? fests.length === 0 : isTrek ? treks.length === 0 : sportsEvents.length === 0;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-[#0ECCEE]/10">
              <QrCode className="text-[#0ECCEE]" size={24} />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Scanner Access</h1>
              <p className="text-gray-400 text-sm mt-0.5">
                Volunteer login for fest, trek & sports check-in
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={copyLogin}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 text-sm text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Link copied' : 'Copy organizer login'}
        </button>
      </div>

      <div className="grid lg:grid-cols-[1fr_220px] gap-6">
        <div className="space-y-4">
          <div className="inline-flex p-1 rounded-xl bg-[#111213] border border-gray-800">
            <button
              type="button"
              onClick={() => setTab('fests')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isFest ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <PartyPopper size={15} />
              Fests
            </button>
            <button
              type="button"
              onClick={() => setTab('treks')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isTrek ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Mountain size={15} />
              Treks
            </button>
            <button
              type="button"
              onClick={() => setTab('sports')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isSport ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy size={15} />
              Sports
            </button>
          </div>

          <div className="bg-[#111213] border border-gray-800 rounded-2xl p-5 sm:p-6 space-y-5">
            <div>
              <label className="text-sm font-medium text-white">
                {isFest ? 'Select fest' : isTrek ? 'Select trek' : 'Select sports / run club event'}
              </label>
              {loading ? (
                <div className="mt-2 flex items-center gap-2 text-gray-400 text-sm">
                  <Loader className="animate-spin" size={16} />
                  Loading…
                </div>
              ) : empty ? (
                <p className="mt-2 text-sm text-gray-500">
                  No {isFest ? 'fests' : isTrek ? 'treks' : 'sports events'} yet. Create one under Admin →{' '}
                  {isFest ? 'Fests' : isTrek ? 'Treks' : 'Sports'}.
                </p>
              ) : (
                <select
                  value={isFest ? selectedFestId : isTrek ? selectedTrekId : selectedSportId}
                  onChange={(e) => {
                    if (isFest) setSelectedFestId(e.target.value);
                    else if (isTrek) setSelectedTrekId(e.target.value);
                    else setSelectedSportId(e.target.value);
                  }}
                  className="mt-2 w-full bg-[#1D1E20] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0ECCEE]"
                >
                  {isFest
                    ? fests.map((fest) => (
                        <option key={fest._id} value={fest._id}>
                          {fest.festName} — {fest.collegeName}
                        </option>
                      ))
                    : isTrek
                      ? treks.map((trek) => (
                          <option key={trek._id} value={trek._id}>
                            {trek.trekName}
                            {trek.city ? ` — ${trek.city}` : ''}
                          </option>
                        ))
                      : sportsEvents.map((event) => (
                          <option key={event._id} value={event._id}>
                            {event.title}
                            {event.city ? ` — ${event.city}` : ''}
                            {event.sportType === 'run_club' ? ' (Run club)' : ''}
                          </option>
                        ))}
                </select>
              )}
            </div>

            {isFest && selectedFest && (
              <FestScannerSetup festId={selectedFest._id} festName={selectedFest.festName} />
            )}
            {isTrek && selectedTrek && (
              <TrekScannerSetup trekId={selectedTrek._id} trekName={selectedTrek.trekName} />
            )}
            {isSport && selectedSport && (
              <SportScannerSetup
                sportEventId={selectedSport._id}
                eventTitle={selectedSport.title}
              />
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 bg-[#111213] border border-gray-800 rounded-2xl p-5 space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Quick guide</p>
            <ol className="space-y-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 text-sm text-gray-400">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#0ECCEE]/15 text-[#0ECCEE] text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
            <div className="pt-3 border-t border-gray-800">
              <p className="text-xs text-gray-500 mb-1">Organizer URL</p>
              <p className="text-xs text-[#0ECCEE] break-all">{loginUrl}</p>
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden bg-[#111213] border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
          Organizer login <ChevronRight size={12} className="text-gray-600" />
        </p>
        <p className="text-xs text-[#0ECCEE] break-all">{loginUrl}</p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { QrCode, Loader, Mountain, PartyPopper, Copy, Check, Trophy, Search } from 'lucide-react';
import FestScannerSetup from './FestScannerSetup';
import TrekScannerSetup from './TrekScannerSetup';
import SportScannerSetup from './SportScannerSetup';
import { adminFetchJSON } from '../../utils/adminApi';

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
  const [search, setSearch] = useState('');

  useEffect(() => {
    adminFetchJSON('/admin/fests?limit=500')
      .then((data) => {
        const list = data.fests || [];
        setFests(list);
        if (list.length > 0) setSelectedFestId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingFests(false));
  }, []);

  useEffect(() => {
    adminFetchJSON('/admin/treks?limit=500')
      .then((data) => {
        const list = data.treks || [];
        setTreks(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) setSelectedTrekId(list[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingTreks(false));
  }, []);

  useEffect(() => {
    adminFetchJSON('/admin/sports?limit=500')
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

  // Normalize the active tab's items into a single list shape for the picker
  const items = useMemo(() => {
    if (isFest) {
      return fests.map((f) => ({ id: f._id, title: f.festName, subtitle: f.collegeName || '' }));
    }
    if (isTrek) {
      return treks.map((t) => ({ id: t._id, title: t.trekName, subtitle: t.city || '' }));
    }
    return sportsEvents.map((s) => ({
      id: s._id,
      title: s.title,
      subtitle: [s.city, s.sportType === 'run_club' ? 'Run club' : null].filter(Boolean).join(' · '),
    }));
  }, [isFest, isTrek, fests, treks, sportsEvents]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) || item.subtitle?.toLowerCase().includes(q)
    );
  }, [items, search]);

  const selectedId = isFest ? selectedFestId : isTrek ? selectedTrekId : selectedSportId;
  const selectItem = (id) => {
    if (isFest) setSelectedFestId(id);
    else if (isTrek) setSelectedTrekId(id);
    else setSelectedSportId(id);
  };

  const TABS = [
    { key: 'fests', label: 'Fests', icon: PartyPopper, count: fests.length },
    { key: 'treks', label: 'Treks', icon: Mountain, count: treks.length },
    { key: 'sports', label: 'Sports', icon: Trophy, count: sportsEvents.length },
  ];

  return (
    <div className="max-w-5xl space-y-6">
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
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/5 text-sm text-[#0ECCEE] hover:bg-[#0ECCEE]/10 shrink-0 transition-colors"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Link copied' : 'Copy organizer login'}
        </button>
      </div>

      <div className="space-y-4">
        <div className="inline-flex p-1 rounded-xl bg-[#111213] border border-gray-800">
            {TABS.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setSearch(''); }}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  tab === key ? 'bg-[#0ECCEE] text-black' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={15} />
                {label}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab === key ? 'bg-black/15 text-black' : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-[260px_1fr] gap-4">
            {/* Event picker */}
            <div className="bg-[#111213] border border-gray-800 rounded-2xl p-4 space-y-3 self-start">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${isFest ? 'fests' : isTrek ? 'treks' : 'events'}...`}
                  className="w-full pl-9 pr-3 py-2 bg-[#1D1E20] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#0ECCEE] focus:outline-none"
                />
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
                  <Loader className="animate-spin" size={16} />
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">
                  No {isFest ? 'fests' : isTrek ? 'treks' : 'sports events'} yet. Create one under
                  Admin → {isFest ? 'Fests' : isTrek ? 'Treks' : 'Run Clubs'}.
                </p>
              ) : filteredItems.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No matches for "{search}"</p>
              ) : (
                <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
                  {filteredItems.map((item) => {
                    const active = item.id === selectedId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectItem(item.id)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors border ${
                          active
                            ? 'bg-[#0ECCEE]/10 border-[#0ECCEE]/50'
                            : 'border-transparent hover:bg-[#1D1E20]'
                        }`}
                      >
                        <div className={`text-sm font-medium truncate ${active ? 'text-[#0ECCEE]' : 'text-white'}`}>
                          {item.title}
                        </div>
                        {item.subtitle && (
                          <div className="text-xs text-gray-500 truncate mt-0.5">{item.subtitle}</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Setup form */}
            <div className="bg-[#111213] border border-gray-800 rounded-2xl p-5 sm:p-6">
              {isFest && selectedFest ? (
                <FestScannerSetup festId={selectedFest._id} festName={selectedFest.festName} />
              ) : isTrek && selectedTrek ? (
                <TrekScannerSetup trekId={selectedTrek._id} trekName={selectedTrek.trekName} />
              ) : isSport && selectedSport ? (
                <SportScannerSetup
                  sportEventId={selectedSport._id}
                  eventTitle={selectedSport.title}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-500 gap-2">
                  <QrCode size={32} className="opacity-30" />
                  <p className="text-sm">Select an event on the left to configure scanner access</p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>
  );
}

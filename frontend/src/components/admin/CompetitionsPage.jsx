import { useEffect, useMemo, useState } from 'react';
import { Loader, RefreshCw, Search } from 'lucide-react';
import CompetitionModal from './Competition_Modal';
import { adminFetchJSON } from '../../utils/adminApi';

export default function CompetitionsPage() {
  const [fests, setFests] = useState([]);
  const [selectedFest, setSelectedFest] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const fetchFests = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminFetchJSON('/admin/fests');
      const list = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
      setFests(list);
    } catch (err) {
      setError(err.message || 'Failed to load fests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFests();
  }, []);

  const filteredFests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fests;
    return fests.filter(
      (fest) =>
        fest.festName?.toLowerCase().includes(q) ||
        fest.collegeName?.toLowerCase().includes(q)
    );
  }, [fests, search]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold mb-2">Competition Management</h1>
          <p className="text-gray-400">Manage competitions across all fests</p>
        </div>
        <button
          type="button"
          onClick={fetchFests}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 bg-[#1D1E20] border border-gray-700 hover:border-gray-500 rounded-lg text-sm text-gray-300 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={fetchFests} className="underline hover:text-red-200 shrink-0">
            Retry
          </button>
        </div>
      )}

      <div className="bg-[#111213] rounded-xl p-6 border border-gray-800">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h2 className="text-xl font-semibold">Select a Fest to Manage Competitions</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search fests..."
              className="pl-9 pr-3 py-2 bg-[#1D1E20] border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:border-[#0ECCEE] focus:outline-none w-56"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
          </div>
        ) : filteredFests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {fests.length === 0
              ? 'No fests found. Create a fest first!'
              : `No fests match "${search}"`}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFests.map((fest) => (
              <button
                key={fest._id}
                type="button"
                className="text-left bg-[#1D1E20] p-4 rounded-lg border border-gray-700 hover:border-[#0ECCEE] transition-colors"
                onClick={() => {
                  setSelectedFest(fest);
                  setShowModal(true);
                }}
              >
                <h3 className="font-semibold text-lg mb-2">{fest.festName}</h3>
                <p className="text-gray-400 text-sm">{fest.collegeName}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-gray-500 text-xs capitalize">{fest.festType}</p>
                  <p className="text-xs text-[#0ECCEE]">
                    {fest.competitions?.length || 0} competition{(fest.competitions?.length || 0) === 1 ? '' : 's'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {showModal && selectedFest && (
        <CompetitionModal
          fest={selectedFest}
          onClose={() => {
            setShowModal(false);
            setSelectedFest(null);
          }}
        />
      )}
    </div>
  );
}

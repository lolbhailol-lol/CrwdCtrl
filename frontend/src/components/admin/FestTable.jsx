import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader, Search } from 'lucide-react';
import FestFormModal from './FestFormModal';
import CompetitionModal from './Competition_Modal';
import { adminFetch, adminFetchJSON } from '../../services/api/admin.api.js';
import { useDialog } from '../../context/DialogContext';

const STATUS_LABELS = {
  ongoing: { label: 'Featured', cls: 'bg-green-900/60 text-green-300' },
  upcoming: { label: 'Listed', cls: 'bg-orange-900/60 text-orange-300' },
  beyondcampus: { label: 'Beyond Campus', cls: 'bg-cyan-900/60 text-cyan-300' },
  lastyearhit: { label: 'Last Year Hit', cls: 'bg-purple-900/60 text-purple-300' },
  completed: { label: 'Completed', cls: 'bg-gray-700 text-gray-300' },
};

const clearServerCache = async () => {
  try {
    await adminFetch('/admin/clear-cache', { method: 'POST' });
  } catch (_) { /* ignore */ }
};

export default function FestTable() {
  const navigate = useNavigate();
  const [fests, setFests] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [selectedFest, setSelectedFest] = useState(null);
  const [showCompetition, setShowCompetition] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { confirm } = useDialog();

  const fetchFests = () => {
    setError('');
    adminFetchJSON('/admin/fests?limit=500')
      .then((data) => {
        const list = Array.isArray(data?.fests) ? data.fests : Array.isArray(data) ? data : [];
        setFests(list);
      })
      .catch((err) => setError(err.message || 'Failed to load fests'))
      .finally(() => setLoading(false));
  };

  useEffect(fetchFests, []);

  const deleteFest = async (id) => {
    try {
      await adminFetchJSON(`/admin/fests/${id}`, { method: 'DELETE' });
      await clearServerCache();
    } catch (err) {
      setError(err.message || 'Failed to delete fest');
    }
    fetchFests();
  };

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = fests.filter(
      (f) => !q || [f.festName, f.collegeName, f.festType].some((v) => String(v || '').toLowerCase().includes(q)),
    );
    return list.sort((a, b) => String(a.festName || '').localeCompare(String(b.festName || '')));
  }, [fests, q]);

  return (
    <div className="bg-[#111213] rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xl font-semibold">Fests</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/sections')}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[#0ECCEE]/30 text-[#0ECCEE] rounded-lg hover:bg-[#0ECCEE]/10 transition-colors"
          >
            <ExternalLink size={14} />
            Page placement & order
          </button>
          <button
            type="button"
            onClick={() => { setSelectedFest(null); setShowForm(true); }}
            className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
          >
            + Create Fest
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-4">
        Drag-reorder and home/fest-page sections are managed in Home & Sections.
      </p>

      <div className="relative max-w-md mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search fests…"
          className="w-full bg-[#1D1E20] border border-gray-600 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-[#0ECCEE]"
        />
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-lg px-4 py-3 mb-4 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button type="button" onClick={fetchFests} className="underline hover:text-red-200 shrink-0">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader className="w-6 h-6 animate-spin text-[#0ECCEE]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">No fests found.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-gray-400 border-b border-gray-700 text-sm">
              <tr>
                <th className="pb-3">Fest</th>
                <th className="pb-3">College</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Section</th>
                <th className="pb-3">Date</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fest) => {
                const status = STATUS_LABELS[fest.status] || STATUS_LABELS.upcoming;
                return (
                  <tr key={fest._id} className="border-b border-gray-800 hover:bg-gray-800/30">
                    <td className="py-3 font-medium">{fest.festName}</td>
                    <td className="py-3 text-gray-300 text-sm">{fest.collegeName}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700 capitalize">{fest.festType}</span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${status.cls}`}>{status.label}</span>
                    </td>
                    <td className="py-3 text-gray-400 text-sm">{fest.festDate || '—'}</td>
                    <td className="py-3">
                      <div className="flex gap-2 justify-end flex-wrap">
                        <a
                          href={`/view-details/${fest._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 text-xs border border-gray-600 rounded hover:border-[#0ECCEE]/50 text-gray-400 hover:text-[#0ECCEE]"
                          title="Preview public page"
                        >
                          Preview
                        </a>
                        <button
                          type="button"
                          onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm"
                        >
                          Competitions
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirm({ title: 'Delete fest?', message: `Delete "${fest.festName}"?`, confirmText: 'Delete', tone: 'danger' })) deleteFest(fest._id);
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FestFormModal fest={selectedFest} onClose={() => setShowForm(false)} onSaved={fetchFests} />
      )}
      {showCompetition && (
        <CompetitionModal fest={selectedFest} onClose={() => setShowCompetition(false)} onSaved={fetchFests} />
      )}
    </div>
  );
}

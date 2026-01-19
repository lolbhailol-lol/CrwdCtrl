import { useEffect, useState } from 'react';
import FestFormModal from './FestFormModal';
import CompetitionModal from './Competition_Modal';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function FestTable() {
  const [fests, setFests] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedFest, setSelectedFest] = useState(null);
  const [showCompetition, setShowCompetition] = useState(false);

  const fetchFests = () => {
    fetch(`${API_BASE_URL}/admin/fests`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`
      }
    })
      .then(res => res.json())
      .then(data => setFests(data.fests || data))
      .catch(err => console.error('Error fetching fests:', err));
  };

  useEffect(fetchFests, []);

  const deleteFest = async (id) => {
    await fetch(`${API_BASE_URL}/admin/fests/${id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`
      }
    });
    fetchFests();
  };

  return (
    <div className="bg-[#1B1C1E] rounded-xl p-6">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-semibold">Fests</h2>
        <button
          onClick={() => { setSelectedFest(null); setShowForm(true); }}
          className="bg-[#0ECCEE] text-black px-4 py-2 rounded-lg font-semibold"
        >
          + Create Fest
        </button>
      </div>

      {fests.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          No fests found. Create your first fest!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-gray-400 border-b border-gray-700">
              <tr>
                <th className="pb-3">Fest Name</th>
                <th className="pb-3">College</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Start Date</th>
                <th className="pb-3">End Date</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fests.map(fest => (
                <tr key={fest._id} className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors">
                  <td className="py-4 font-medium">{fest.festName}</td>
                  <td className="py-4 text-gray-300">{fest.collegeName}</td>
                  <td className="py-4">
                    <span className="px-2 py-1 rounded text-xs bg-gray-700 capitalize">
                      {fest.festType}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      fest.status === 'ongoing' ? 'bg-green-900/50 text-green-400' :
                      fest.status === 'upcoming' ? 'bg-blue-900/50 text-blue-400' :
                      'bg-purple-900/50 text-purple-400'
                    }`}>
                      {fest.status || 'upcoming'}
                    </span>
                  </td>
                  <td className="py-4 text-gray-400 text-sm">
                    {fest.startDate ? new Date(fest.startDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-4 text-gray-400 text-sm">
                    {fest.endDate ? new Date(fest.endDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="py-4">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setSelectedFest(fest); setShowForm(true); }}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { setSelectedFest(fest); setShowCompetition(true); }}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm transition-colors"
                      >
                        Competitions
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${fest.festName}"?`)) {
                            deleteFest(fest._id);
                          }
                        }}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <FestFormModal
          fest={selectedFest}
          onClose={() => setShowForm(false)}
          onSaved={fetchFests}
        />
      )}

      {showCompetition && (
        <CompetitionModal
          fest={selectedFest}
          onClose={() => setShowCompetition(false)}
        />
      )}
    </div>
  );
}

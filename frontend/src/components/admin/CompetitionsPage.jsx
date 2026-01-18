import { useEffect, useState } from 'react';
import CompetitionModal from './Competition_Modal';

// Configure API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api';

export default function CompetitionsPage() {
  const [fests, setFests] = useState([]);
  const [selectedFest, setSelectedFest] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Add cache busting timestamp to prevent browser caching
    const timestamp = Date.now();
    fetch(`${API_BASE_URL}/admin/fests?_t=${timestamp}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
        'Cache-Control': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => setFests(data.fests || data || []))
      .catch(err => console.error('Error fetching fests:', err));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Competition Management</h1>
        <p className="text-gray-400">Manage competitions across all fests</p>
      </div>

      <div className="bg-[#1B1C1E] rounded-xl p-6">
        <h2 className="text-xl font-semibold mb-4">Select a Fest to Manage Competitions</h2>
        
        {fests.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            No fests found. Create a fest first!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {fests.map(fest => (
              <div
                key={fest._id}
                className="bg-[#2A2B2D] p-4 rounded-lg border border-gray-700 hover:border-[#0ECCEE] transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedFest(fest);
                  setShowModal(true);
                }}
              >
                <h3 className="font-semibold text-lg mb-2">{fest.festName}</h3>
                <p className="text-gray-400 text-sm">{fest.collegeName}</p>
                <p className="text-gray-500 text-xs mt-2 capitalize">{fest.festType}</p>
              </div>
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




import { useNavigate } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import FestTable from './FestTable';

export default function FestsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fest Management</h1>
          <p className="text-gray-400">Create, edit, and manage fests. Use Home & Sections for ordering.</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin/sections')}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-[#0ECCEE]/30 text-[#0ECCEE] rounded-lg hover:bg-[#0ECCEE]/10"
        >
          <ExternalLink size={14} />
          Section placement
        </button>
      </div>
      <FestTable />
    </div>
  );
}




import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { InlinePageLoader } from '../../components/DetailPageLoader';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../config/apiBase';
import CheckinScannerPage from '../../components/admin/CheckinScannerPage';

export default function OrganizerCheckinPage() {
  const { festId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [festName, setFestName] = useState('');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    const authToken = token || localStorage.getItem('crwdctrl_token');
    if (!authToken || !festId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/scanner/${festId}/stats`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (res.status === 403) {
          setDenied(true);
          return;
        }
        if (!res.ok) throw new Error('Could not load fest');
        const data = await res.json();
        setFestName(data.festName || 'Your fest');
      } catch {
        setDenied(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [festId, token]);

  const authToken = token || localStorage.getItem('crwdctrl_token');
  const exportUrl = `${getApiBaseUrl()}/scanner/${festId}/export`;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#161718]">
        <InlinePageLoader variant="fest" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen bg-[#161718] text-white flex flex-col items-center justify-center px-6 gap-4">
        <p className="text-center text-gray-300">You do not have access to scan check-ins for this fest.</p>
        <Link to="/organizer/account" className="text-[#0ECCEE] text-sm font-semibold">
          Back to my fests
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161718]">
      <header className="border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/organizer/account')}
          className="p-2 rounded-lg hover:bg-gray-800"
          aria-label="Back to fest list"
        >
          <ArrowLeft size={20} className="text-white" />
        </button>
        <span className="text-sm text-gray-400">Organizer scanner</span>
      </header>
      <div className="p-4">
        <CheckinScannerPage
          mode="organizer"
          festId={festId}
          festName={festName}
          getAuthToken={() => authToken}
          checkinUrl={`${getApiBaseUrl()}/scanner/${festId}/checkin`}
          showStats
          statsUrl={`${getApiBaseUrl()}/scanner/${festId}/stats`}
          exportUrl={exportUrl}
        />
      </div>
    </div>
  );
}

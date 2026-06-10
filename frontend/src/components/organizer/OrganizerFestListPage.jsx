import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { QrCode, ArrowLeft, Loader, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getApiBaseUrl } from '../../config/apiBase';

export default function OrganizerFestListPage() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [fests, setFests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const authToken = token || localStorage.getItem('crwdctrl_token');
    if (!authToken) return;

    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/fest-organizer/my-fests`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || data.error || 'Could not load your fests');
        }
        const data = await res.json();
        setFests(Array.isArray(data) ? data : data.fests || []);
      } catch (err) {
        setError(err.message || 'Failed to load fests');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-[#161718] text-white">
      <header className="border-b border-gray-800 px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-800"
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold">Organizer Scanner</h1>
          <p className="text-xs text-gray-400">Pick a fest to scan attendee tickets</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader className="animate-spin text-[#0ECCEE]" size={32} />
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && fests.length === 0 && (
          <div className="rounded-xl border border-gray-800 bg-[#111213] p-8 text-center">
            <p className="text-gray-400 text-sm">
              No fests linked to your organizer account yet. Contact CrwdCtrl admin to assign your
              fest.
            </p>
          </div>
        )}

        {fests.map((fest) => {
          const festId = fest._id || fest.id;
          const exportHref = `${getApiBaseUrl()}/fest-organizer/${festId}/checkins/export`;
          return (
            <div
              key={festId}
              className="rounded-xl border border-gray-800 bg-[#111213] p-4 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1 min-w-0">
                <h2 className="font-semibold truncate">{fest.festName}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  {fest.collegeName || fest.venue || 'Fest'}
                  {fest.registration?.googleSheetsUrl ? ' · Sheets connected' : ' · No sheet URL yet'}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <Link
                  to={`/organizer/${festId}/checkin`}
                  state={{ fromAccount: true }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0ECCEE] text-black rounded-lg text-sm font-semibold"
                >
                  <QrCode size={16} />
                  Open Scanner
                </Link>
                <a
                  href={exportHref}
                  onClick={(e) => {
                    e.preventDefault();
                    const authToken = token || localStorage.getItem('crwdctrl_token');
                    fetch(exportHref, {
                      headers: { Authorization: `Bearer ${authToken}` },
                    })
                      .then((r) => r.blob())
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${fest.festName || 'fest'}_checkins.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      })
                      .catch(() => {});
                  }}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-600 rounded-lg text-sm text-gray-200 hover:bg-gray-800"
                >
                  <Download size={16} />
                  Export CSV
                </a>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

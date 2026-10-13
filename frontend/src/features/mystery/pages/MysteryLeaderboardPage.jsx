import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { fetchPublicLeaderboard } from '../services/mystery.api';

export default function MysteryLeaderboardPage() {
  const { eventId } = useParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublicLeaderboard(eventId)
      .then((res) => setRows(res.data?.rankings || res.rankings || []))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <div className="min-h-screen bg-[#0b0c0d] px-5 py-10 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        {loading && <p className="mt-6 text-white/40">Loading…</p>}
        <div className="mt-6 space-y-2">
          {rows.map((row, i) => (
            <div key={row.teamId || i} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-mono text-[#0ECCEE]">#{i + 1}</span>
                <span className="font-semibold">{row.teamName}</span>
              </div>
              <span className="font-mono text-white/70">{row.totalScore ?? row.points ?? 0} pts</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
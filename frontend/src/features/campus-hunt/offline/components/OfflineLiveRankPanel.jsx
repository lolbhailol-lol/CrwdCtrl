import { useCallback, useEffect, useState } from 'react';
import { fetchPublicLeaderboard } from '../../services/campusHunt.api';
import { pullOfflineBoardState } from '../offlineBoardSync';

/**
 * Live rank for offline play — signed pull (works without public board)
 * with public leaderboard fallback. No per-clue points shown.
 */
export default function OfflineLiveRankPanel({
  eventId,
  teamCode,
  teamId,
  bundle = null,
}) {
  const [board, setBoard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [fieldSize, setFieldSize] = useState(0);
  const [updatedAt, setUpdatedAt] = useState('');
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  );
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOffline(true);
      return;
    }
    setOffline(false);

    // Prefer signed offline pull — works even when public leaderboard is off.
    if (bundle?.signingKey && bundle?.event?.id) {
      try {
        const data = await pullOfflineBoardState(bundle);
        if (data) {
          const top = Array.isArray(data.top10) ? data.top10 : [];
          setBoard(top);
          setMyRank(Number(data.rank) || null);
          setFieldSize(Number(data.fieldSize) || top.length || 0);
          setUpdatedAt(new Date().toLocaleTimeString());
          setError('');
          return;
        }
      } catch {
        /* fall through to public board */
      }
    }

    if (!eventId) return;
    try {
      const res = await fetchPublicLeaderboard(eventId);
      const rows = res.data?.leaderboard || res.data?.rows || res.data || [];
      const list = Array.isArray(rows) ? rows : [];
      setBoard(list.slice(0, 10));
      setFieldSize(list.length);
      const mine = list.find((row) => (
        String(row.teamCode || '') === String(teamCode || '')
        || String(row.teamId || row.id || '') === String(teamId || '')
      ));
      setMyRank(Number(mine?.rank || mine?.place) || null);
      setUpdatedAt(new Date().toLocaleTimeString());
      setError('');
    } catch (err) {
      setError(err.message || 'Leaderboard unavailable');
    }
  }, [bundle, eventId, teamCode, teamId]);

  useEffect(() => {
    load();
    const onOnline = () => load();
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const tick = window.setInterval(load, 20000);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.clearInterval(tick);
    };
  }, [load]);

  const top10 = board.slice(0, 10);

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">
            Leaderboard
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-white">
            {myRank ? `#${myRank}` : '—'}
            {fieldSize > 0 ? (
              <span className="ml-2 text-sm font-normal text-white/40">of {fieldSize}</span>
            ) : null}
          </p>
        </div>
        <p className="text-right text-[10px] text-white/35">
          {offline ? 'Offline — rank updates on Wi‑Fi' : (updatedAt ? `Updated ${updatedAt}` : '…')}
        </p>
      </div>

      <p className="mt-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2 text-[12px] leading-snug text-amber-50/85">
        Top <span className="font-semibold text-amber-100">10 teams</span> get a chance to
        volunteer at <span className="font-semibold">Mindspark 2026</span>.
      </p>

      {top10.length > 0 ? (
        <ol className="mt-3 space-y-1">
          {top10.map((row) => {
            const rank = Number(row.rank || row.place) || 0;
            const code = row.teamCode || row.code || '—';
            const mine = String(code) === String(teamCode)
              || String(row.teamId || row.id || '') === String(teamId || '');
            return (
              <li
                key={`${rank}-${code}`}
                className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-sm ${
                  mine ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'text-white/70'
                }`}
              >
                <span className="font-mono text-xs text-white/40">#{rank}</span>
                <span className={`min-w-0 flex-1 truncate font-semibold ${mine ? 'text-[#0ECCEE]' : 'text-white'}`}>
                  {code}
                </span>
                {rank <= 10 ? (
                  <span className="text-[10px] uppercase tracking-wide text-amber-200/70">
                    Top 10
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="mt-3 text-xs text-white/40">
          {error || 'Ranking appears once teams sync on Wi‑Fi.'}
        </p>
      )}
    </section>
  );
}

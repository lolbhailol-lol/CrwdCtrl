import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Moon, Sun } from 'lucide-react';
import {
  fetchCampusHuntColleges,
  fetchPublicLeaderboard,
  fetchPublicFinaleLeaderboard,
  fetchMyTeam,
} from '../services/campusHunt.api';
import { useAuth } from '../../../context/AuthContext';
import { useDarkMode } from '../../../context/DarkModeContext';
import { stageLabel } from '../types/stages';
import { formatDurationMs } from '../utils/format';
import CampusHuntBackLink from '../components/CampusHuntBackLink';

export default function CampusHuntLeaderboardPage() {
  const { isAuthenticated } = useAuth();
  const { isDark, toggleDarkMode } = useDarkMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const collegeParam = searchParams.get('college') || '';

  const [colleges, setColleges] = useState([]);
  const [college, setCollege] = useState(collegeParam);
  const [eventId, setEventId] = useState('');
  const [board, setBoard] = useState(null);
  const [myTeamId, setMyTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [liveOn, setLiveOn] = useState(false);
  const [boardMode, setBoardMode] = useState('round1');

  const selectedCollege = useMemo(
    () => colleges.find((c) => c.college === college) || null,
    [colleges, college],
  );

  const events = selectedCollege?.events || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCampusHuntColleges();
        if (cancelled) return;
        const list = res.data?.colleges || [];
        setColleges(list);
        setLiveOn(list.length > 0);
        const initial =
          collegeParam
          || list[0]?.college
          || '';
        setCollege(initial);
        const evs = list.find((c) => c.college === initial)?.events || list[0]?.events || [];
        setEventId(evs[0]?.id || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load colleges');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [collegeParam]);

  const loadBoard = useCallback(async () => {
    if (!eventId) {
      setBoard(null);
      return;
    }
    try {
      const res = boardMode === 'finale'
        ? await fetchPublicFinaleLeaderboard(eventId)
        : await fetchPublicLeaderboard(eventId);
      setBoard(res.data);
      setUpdatedAt(new Date().toLocaleTimeString());
      setError('');
    } catch (err) {
      if (boardMode === 'finale' && err.status === 403) {
        setBoard(null);
        setError('Finale leaderboard is not public yet.');
      } else {
        setError(err.message || 'Failed to load leaderboard');
      }
    }
  }, [eventId, boardMode]);

  useEffect(() => {
    loadBoard();
    if (!eventId) return undefined;
    const id = setInterval(loadBoard, 12000);
    return () => clearInterval(id);
  }, [eventId, loadBoard]);

  useEffect(() => {
    if (!isAuthenticated || !eventId) {
      setMyTeamId(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchMyTeam(eventId);
        if (!cancelled) setMyTeamId(res.data?.team?.id || null);
      } catch {
        if (!cancelled) setMyTeamId(null);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, eventId]);

  const onCollegeChange = (value) => {
    setCollege(value);
    setSearchParams(value ? { college: value } : {});
    const evs = colleges.find((c) => c.college === value)?.events || [];
    setEventId(evs[0]?.id || '');
  };

  const rows = board?.leaderboard || [];
  const selectedEvent = events.find((e) => e.id === eventId) || board?.event;
  const isFinaleBoard = boardMode === 'finale';

  const pageBg = isDark ? 'bg-[#0b0c0d] text-white' : 'bg-[#F5F6FA] text-gray-900';
  const muted = isDark ? 'text-white/50' : 'text-gray-500';
  const mutedSoft = isDark ? 'text-white/45' : 'text-gray-500';
  const card = isDark
    ? 'border-white/10 bg-white/5'
    : 'border-gray-200 bg-white shadow-sm';
  const selectCls = isDark
    ? 'border-white/20 bg-[#161718] text-white'
    : 'border-gray-200 bg-white text-gray-900';
  const rowDivider = isDark ? 'divide-white/10' : 'divide-gray-100';
  const rowHeader = isDark ? 'bg-white/5 text-white/50' : 'bg-gray-50 text-gray-500';
  const mineRow = isDark ? 'bg-[#0ECCEE]/10' : 'bg-[#0ECCEE]/15';
  const accent = 'text-[#0ECCEE]';

  // iOS Safari: pinch/double-tap while scrolling the board often zooms the page — lock scale here only.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return undefined;
    const prev = meta.getAttribute('content') || '';
    meta.setAttribute(
      'content',
      'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover',
    );
    return () => {
      if (prev) meta.setAttribute('content', prev);
    };
  }, []);

  return (
    <div
      className={`campus-hunt-leaderboard min-h-[100dvh] touch-pan-y overscroll-y-contain px-4 py-6 transition-colors duration-300 ${pageBg}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="mx-auto max-w-lg space-y-5">
        <CampusHuntBackLink
          to="/"
          label="Back"
          className={isDark ? '' : '!text-gray-400 hover:!text-gray-700'}
        />
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className={`text-xs uppercase tracking-widest ${accent}`}>Campus Hunt</p>
            <h1 className="text-2xl font-bold">Live leaderboard</h1>
            <p className={`text-sm ${muted}`}>
              {isFinaleBoard
                ? 'Finale scores — separate from Round 1.'
                : 'Profile-only live scores by college. Updates every ~12s.'}
            </p>
          </div>
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`mt-1 rounded-xl border p-2.5 transition-colors ${
              isDark
                ? 'border-white/15 bg-white/5 text-white hover:bg-white/10'
                : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
            }`}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </header>

        {loading && <p className={muted}>Loading…</p>}
        {error && (
          <p className={`text-sm ${isDark ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
        )}

        {!loading && !liveOn && (
          <p className={`rounded-2xl border px-4 py-6 text-sm ${card} ${muted}`}>
            No live boards right now. An admin must enable “Show live on Profile” for a college event.
          </p>
        )}

        {colleges.length > 0 && (
          <div className={`space-y-3 rounded-2xl border p-4 ${card}`}>
            <label className={`block text-xs uppercase tracking-wide ${muted}`}>
              College
              <select
                value={college}
                onChange={(e) => onCollegeChange(e.target.value)}
                className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-base ${selectCls}`}
              >
                {colleges.map((c) => (
                  <option key={c.college} value={c.college}>
                    {c.college}
                  </option>
                ))}
              </select>
            </label>

            {events.length > 1 && (
              <label className={`block text-xs uppercase tracking-wide ${muted}`}>
                Event
                <select
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                  className={`mt-1 w-full rounded-xl border px-3 py-2.5 text-base ${selectCls}`}
                >
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {selectedEvent && (
              <div>
                <p className="font-semibold">{selectedEvent.name || board?.event?.name}</p>
                <p className={`text-xs ${mutedSoft}`}>{college}</p>
              </div>
            )}
          </div>
        )}

        {eventId && (
          <>
            <div className={`flex rounded-xl border p-1 ${card}`}>
              {[
                ['round1', 'Round 1'],
                ['finale', 'Finale'],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setBoardMode(mode)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-semibold uppercase tracking-wide ${
                    boardMode === mode ? 'bg-[#0ECCEE] text-black' : muted
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

          <section className={`overflow-hidden rounded-2xl border ${card}`}>
            <div className={`flex items-center justify-between px-4 py-2 text-xs ${rowHeader}`}>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live rankings
              </span>
              <span>{updatedAt ? `Updated ${updatedAt}` : '…'}</span>
            </div>
            <div className={`divide-y ${rowDivider} [-webkit-overflow-scrolling:touch]`}>
              {rows.map((row) => {
                const mine = myTeamId && row.teamId === myTeamId;
                return (
                  <div
                    key={row.teamId}
                    className={`flex items-center gap-3 px-4 py-3 ${mine ? mineRow : ''}`}
                  >
                    <span className={`w-8 text-center text-lg font-bold ${accent}`}>
                      {row.rank || '—'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {row.teamName}
                        {mine ? ' · you' : ''}
                      </p>
                      <p className={`truncate text-xs ${mutedSoft}`}>
                        {row.teamCode}
                        {!isFinaleBoard && row.currentStage ? (
                          <> · {stageLabel(row.currentStage)}</>
                        ) : null}
                        {isFinaleBoard && row.completedMissionIds?.length > 0 && (
                          <> · {row.completedMissionIds.length} missions</>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">
                        {isFinaleBoard ? (row.finaleScore ?? row.finalScore) : row.score}
                      </p>
                      {(row.elapsedMs != null || row.totalCompletionMs != null) && (
                        <p className={`text-[10px] tabular-nums ${mutedSoft}`}>
                          {formatDurationMs(row.elapsedMs ?? row.totalCompletionMs)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              {!rows.length && (
                <p className={`px-4 py-6 text-center text-sm ${mutedSoft}`}>
                  No teams on the board yet.
                </p>
              )}
            </div>
          </section>
          </>
        )}

        <Link
          to="/"
          className={`block text-center text-sm underline ${muted}`}
        >
          Back home
        </Link>
      </div>
    </div>
  );
}

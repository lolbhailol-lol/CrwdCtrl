import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Moon, Sun, Trophy } from 'lucide-react';
import {
  fetchCampusHuntColleges,
  fetchPublicLeaderboard,
  fetchMyTeam,
} from '../services/campusHunt.api';
import { CAMPUS_HUNT_PATHS } from '../config';
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
  const eventParam = searchParams.get('event') || '';

  const [colleges, setColleges] = useState([]);
  const [college, setCollege] = useState(collegeParam);
  const [eventId, setEventId] = useState('');
  const [board, setBoard] = useState(null);
  const [myTeamId, setMyTeamId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState('');
  const [liveOn, setLiveOn] = useState(false);
  const boardRequestRef = useRef(null);

  const selectedCollege = useMemo(
    () => colleges.find((c) => c.college === college) || null,
    [colleges, college],
  );

  const events = useMemo(
    () => (selectedCollege?.events || []).filter((ev) => ev.leaderboardLive === true),
    [selectedCollege],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchCampusHuntColleges();
        if (cancelled) return;
        const list = (res.data?.colleges || []).filter((c) =>
          (c.events || []).some((ev) => ev.leaderboardLive === true),
        );
        setColleges(list);
        setLiveOn(list.length > 0);
        const initial =
          (collegeParam && list.some((c) => c.college === collegeParam) ? collegeParam : null)
          || list[0]?.college
          || '';
        setCollege(initial);
        const evs = (list.find((c) => c.college === initial)?.events || [])
          .filter((ev) => ev.leaderboardLive === true);
        const requestedEvent = evs.find((ev) => ev.id === eventParam || ev.slug === eventParam);
        setEventId(requestedEvent?.id || evs[0]?.id || '');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load colleges');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [collegeParam, eventParam]);

  const loadBoard = useCallback(async () => {
    if (!eventId) {
      setBoard(null);
      return;
    }
    if (boardRequestRef.current?.eventId === eventId) {
      return boardRequestRef.current.request;
    }
    let request;
    request = (async () => {
      try {
        const res = await fetchPublicLeaderboard(eventId);
        if (boardRequestRef.current?.request !== request) return;
        setBoard(res.data);
        setUpdatedAt(new Date().toLocaleTimeString());
        setError('');
      } catch (err) {
        if (boardRequestRef.current?.request !== request) return;
        setError(err.message || 'Failed to load leaderboard');
      } finally {
        if (boardRequestRef.current?.request === request) boardRequestRef.current = null;
      }
    })();
    boardRequestRef.current = { eventId, request };
    return request;
  }, [eventId]);

  useEffect(() => {
    void loadBoard();
    if (!eventId) return undefined;
    let stopped = false;
    let timer;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        if (!document.hidden) await loadBoard();
        if (!stopped) schedule();
      }, 12000 + Math.floor(Math.random() * 3000));
    };
    const onVisible = () => {
      if (!document.hidden) void loadBoard();
    };
    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
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
    const evs = (colleges.find((c) => c.college === value)?.events || [])
      .filter((ev) => ev.leaderboardLive === true);
    setEventId(evs[0]?.id || '');
  };

  const onEventChange = (value) => {
    setEventId(value);
    setSearchParams({ college, event: value });
  };

  const rows = board?.leaderboard || [];
  const selectedEvent = events.find((e) => e.id === eventId) || board?.event;
  const completedEvent = Boolean(selectedEvent?.date && new Date(selectedEvent.date) < new Date());

  const pageBg = isDark ? 'bg-[#161718] text-[#F8FAFC]' : 'bg-white text-[#111827]';
  const muted = isDark ? 'text-[#AEB6C2]' : 'text-[#5B6472]';
  const mutedSoft = isDark ? 'text-[#929BA8]' : 'text-[#667085]';
  const card = isDark
    ? 'border-[#292C31] bg-[#0D0E10] shadow-[0_12px_32px_rgba(0,0,0,0.22)]'
    : 'border-[#E1E5EA] bg-[#F5F6FA] shadow-[0_10px_28px_rgba(17,24,39,0.06)]';
  const selectCls = isDark
    ? 'border-[#343941] bg-[#191B20] text-white'
    : 'border-[#D7DCE3] bg-white text-[#111827]';
  const rowDivider = isDark ? 'divide-[#2B3038]' : 'divide-[#EDF0F3]';
  const rowHeader = isDark ? 'bg-[#1A1C21] text-[#AEB6C2]' : 'bg-[#ECEFF3] text-[#5B6472]';
  const mineRow = isDark ? 'bg-[#0ECCEE]/10' : 'bg-[#087A82]/10';
  const accent = isDark ? 'text-[#42D6DF]' : 'text-[#087A82]';

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
      className={`campus-hunt-leaderboard min-h-[100dvh] touch-pan-y overscroll-y-contain px-4 py-5 transition-colors duration-300 ${pageBg}`}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <div className="mx-auto max-w-lg space-y-5">
        <CampusHuntBackLink
          to="/games"
          label="Back to Games"
          className={isDark ? '!text-[#AEB6C2] hover:!text-white' : '!text-[#5B6472] hover:!text-[#111827]'}
        />
        <header className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${accent}`}>COEP Campus Hunt</p>
            <h1 className="text-[1.75rem] font-bold leading-tight">Leaderboard</h1>
            <p className={`text-sm ${muted}`}>
              {completedEvent ? 'Final rankings from the completed game.' : 'Live scores. Updates every ~12s.'}
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
            No live boards right now. An admin must enable “Leaderboard on Profile” for a college event.
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
                  onChange={(e) => onEventChange(e.target.value)}
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
          <section className={`overflow-hidden rounded-2xl border ${card}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 text-xs ${rowHeader}`}>
              <span className="inline-flex items-center gap-2 font-medium">
                {completedEvent ? <Trophy className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />}
                {completedEvent ? 'Final rankings' : 'Live rankings'}
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
                        {row.currentStage ? (
                          <> · {stageLabel(row.currentStage)}</>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold tabular-nums">{row.score}</p>
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
        )}

        {!completedEvent && (
          <Link
            to={CAMPUS_HUNT_PATHS.profileLogin}
            className={`block text-center text-sm underline ${muted}`}
          >
            Hunt login
          </Link>
        )}
      </div>
    </div>
  );
}

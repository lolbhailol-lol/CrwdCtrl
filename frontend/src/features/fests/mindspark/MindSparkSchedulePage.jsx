import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CalendarDays, Clock, MapPin, Search, X,
} from 'lucide-react';
import { useDarkMode } from '../../../context/DarkModeContext';
import { MINDSPARK_SCHEDULE, SCHEDULE_DAY_META } from './mindsparkSchedule';

const DAY_FILTERS = [
  { id: 'all', label: 'All days' },
  { id: '1', label: 'Day 1' },
  { id: '2', label: 'Day 2' },
];
const TOTAL_EVENTS = MINDSPARK_SCHEDULE.reduce((n, g) => n + g.events.length, 0);
const TOTAL_VENUES = new Set(
  MINDSPARK_SCHEDULE.flatMap((g) => g.events.flatMap((e) => e.rounds.map((r) => r.venue)))
    .filter((v) => v && !/online/i.test(v)),
).size;
const moduleAnchor = (name) => `ms-module-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

function roundMatchesDay(round, day) {
  if (day === 'all') return true;
  return String(round.day) === day || round.day === 'both';
}

function DayBadge({ day, isDark }) {
  const meta = SCHEDULE_DAY_META[day];
  if (!meta) return null;
  return (
    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${isDark ? meta.dark : meta.light}`}>
      {meta.label}
    </span>
  );
}

function ScheduleEventCard({ event, isDark }) {
  return (
    <article className={`overflow-hidden rounded-2xl border ${isDark ? 'border-white/8 bg-[#141516]' : 'border-gray-200 bg-white shadow-sm'}`}>
      <div className={`flex items-center justify-between gap-2 border-b px-4 py-3 ${isDark ? 'border-white/5' : 'border-gray-100'}`}>
        <h3 className={`min-w-0 truncate text-[15px] font-bold tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>{event.name}</h3>
        {event.rounds.length > 1 ? (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
            {event.rounds.length} rounds
          </span>
        ) : null}
      </div>
      <ul className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
        {event.rounds.map((r) => (
          <li key={`${r.round}-${r.time}`} className="flex gap-3 px-4 py-3">
            <div className="w-[104px] shrink-0">
              <p className={`text-sm font-bold tabular-nums leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>{r.time}</p>
              {/day|before/i.test(r.time) ? null : <div className="mt-1"><DayBadge day={r.day} isDark={isDark} /></div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#0ECCEE]">
                {r.round}
                {r.tentative ? (
                  <span className={`rounded-md px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide ${isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                    Tentative
                  </span>
                ) : null}
              </p>
              <p className={`mt-1 flex items-start gap-1 text-[13px] ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                <MapPin size={13} className="mt-0.5 shrink-0 text-gray-500" />
                <span>{r.venue}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}

function ScheduleView({ isDark }) {
  const [day, setDay] = useState('all');
  const [query, setQuery] = useState('');

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    return MINDSPARK_SCHEDULE.map((group) => ({
      ...group,
      events: group.events
        .map((event) => {
          const nameHit = !q || event.name.toLowerCase().includes(q) || group.module.toLowerCase().includes(q);
          const rounds = event.rounds.filter((r) => roundMatchesDay(r, day) && (nameHit || r.venue.toLowerCase().includes(q)));
          return { ...event, rounds };
        })
        .filter((event) => event.rounds.length),
    })).filter((group) => group.events.length);
  }, [day, query]);

  const eventCount = groups.reduce((n, g) => n + g.events.length, 0);
  const jumpTo = (name) => {
    document.getElementById(moduleAnchor(name))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      <div className={`sticky top-[57px] z-10 -mx-4 space-y-2.5 border-b px-4 pb-3 pt-3 backdrop-blur-xl ${
        isDark ? 'border-white/5 bg-[#0d0e0f]/90' : 'border-gray-200 bg-gray-50/90'
      }`}
      >
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search an event or room"
            enterKeyHint="search"
            className={`w-full rounded-xl border py-2.5 pl-10 pr-10 text-[15px] outline-none transition focus:border-[#0ECCEE]/60 ${
              isDark ? 'border-white/10 bg-[#161718] text-white placeholder:text-gray-600' : 'border-gray-200 bg-white text-gray-900 placeholder:text-gray-400'
            }`}
          />
          {query ? (
            <button type="button" onClick={() => setQuery('')} className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 active:bg-white/10" aria-label="Clear search">
              <X size={15} />
            </button>
          ) : null}
        </div>

        <div className={`grid grid-cols-3 gap-1 rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-gray-200/70'}`}>
          {DAY_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDay(f.id)}
              className={`rounded-lg py-2 text-[13px] font-semibold transition active:scale-95 ${
                day === f.id
                  ? 'bg-[#0ECCEE] text-black shadow'
                  : isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {groups.length > 1 ? (
          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groups.map((g) => (
              <button
                key={g.module}
                type="button"
                onClick={() => jumpTo(g.module)}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition active:scale-95 ${
                  isDark ? 'border-white/10 text-gray-300 hover:border-[#0ECCEE]/50' : 'border-gray-200 bg-white text-gray-700 hover:border-cyan-300'
                }`}
              >
                {g.module}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <p className="text-xs text-gray-500">
        Showing {eventCount} event{eventCount === 1 ? '' : 's'}. Timings may change on the day.
      </p>

      {groups.length ? groups.map((group) => (
        <section key={group.module} id={moduleAnchor(group.module)} className="scroll-mt-[200px] space-y-3">
          <div className="flex items-baseline gap-2">
            <h2 className={`text-lg font-bold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{group.module}</h2>
            <span className="text-xs text-gray-500">
              {group.events.length} event{group.events.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {group.events.map((event) => (
              <ScheduleEventCard key={event.name} event={event} isDark={isDark} />
            ))}
          </div>
        </section>
      )) : (
        <div className={`rounded-2xl border border-dashed py-14 text-center ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <Search size={22} className="mx-auto text-gray-500" />
          <p className={`mt-2 text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>No events found</p>
          <p className="mt-1 text-xs text-gray-500">Try a different day or search.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, value, label, isDark }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${isDark ? 'bg-black/30' : 'bg-white/80'}`}>
      <span className="text-[#0ECCEE]">{icon}</span>
      <p className="mt-1 text-lg font-black leading-none">{value}</p>
      <p className="mt-0.5 text-[11px] text-gray-500">{label}</p>
    </div>
  );
}

/** MindSpark '26 full event schedule. */
export default function MindSparkSchedulePage() {
  const { eventId } = useParams();
  const { isDark } = useDarkMode();

  useEffect(() => {
    document.title = "MindSpark '26 — Schedule";
  }, []);

  return (
    <div className={`min-h-screen ${isDark ? 'bg-[#0d0e0f] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <header className={`sticky top-0 z-20 border-b backdrop-blur-xl ${isDark ? 'border-white/5 bg-[#0d0e0f]/90' : 'border-gray-200 bg-white/90'}`}>
        <div className="mx-auto flex h-[57px] max-w-3xl items-center gap-3 px-4">
          <Link
            to={`/view-details/${eventId}`}
            className={`flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
            aria-label="Back to MindSpark"
          >
            <ArrowLeft size={17} />
          </Link>
          <p className="text-[15px] font-bold">Schedule</p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 pb-16 pt-4">
        <section className={`relative overflow-hidden rounded-3xl border p-4 sm:p-6 ${
          isDark ? 'border-[#0ECCEE]/20 bg-linear-to-br from-[#0ECCEE]/15 via-[#0d0e0f] to-violet-500/10' : 'border-cyan-100 bg-linear-to-br from-cyan-50 via-white to-violet-50'
        }`}
        >
          <span className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-[#0ECCEE]/20 blur-3xl" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0ECCEE]">MindSpark &apos;26 · COEP Tech</p>
          <h1 className="mt-1 text-[26px] font-black leading-tight tracking-tight sm:text-3xl">Event schedule</h1>
          <p className={`mt-1 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Find when and where each round happens.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat icon={<Clock size={14} />} value={TOTAL_EVENTS} label="Events" isDark={isDark} />
            <Stat icon={<CalendarDays size={14} />} value={2} label="Days" isDark={isDark} />
            <Stat icon={<MapPin size={14} />} value={TOTAL_VENUES} label="Venues" isDark={isDark} />
          </div>
        </section>

        <ScheduleView isDark={isDark} />
      </main>
    </div>
  );
}

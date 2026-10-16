import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { listMyPreRegistrations } from './api';
import { MIT_WPU_CAMPUS_HUNT, comingSoonPath, readPreRegisteredTeam, savePreRegisteredTeam } from './comingSoonGames';

export default function PreRegistrationBookingCard({ isDark }) {
  const game = MIT_WPU_CAMPUS_HUNT;
  const [teamName, setTeamName] = useState(() => readPreRegisteredTeam(game));

  useEffect(() => {
    let cancelled = false;
    listMyPreRegistrations()
      .then((data) => {
        const entry = (data?.preRegistrations || []).find((row) => row.gameKey === game.preRegistrationKey);
        if (cancelled || !entry?.teamName) return;
        savePreRegisteredTeam(game, entry.teamName);
        setTeamName(entry.teamName);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [game]);

  const shell = isDark ? 'border-[#2b2f36] bg-[#1c1e22]' : 'border-[#dbe0eb] bg-[#f4f6fa]';
  const muted = isDark ? 'text-gray-400' : 'text-gray-600';
  const accent = isDark ? 'text-[#42d6df]' : 'text-[#087a82]';

  return (
    <Link
      to={teamName ? comingSoonPath(game) : `${comingSoonPath(game)}/register`}
      className={`mb-4 flex gap-3 overflow-hidden rounded-2xl border p-3 transition hover:opacity-95 ${shell}`}
    >
      <img src={game.shareImage} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            teamName
              ? isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'
              : isDark ? 'bg-amber-500/15 text-amber-200' : 'bg-amber-50 text-amber-800'
          }`}
        >
          {teamName ? <Check size={11} /> : <Sparkles size={11} />}
          {teamName ? 'Pre-registered · Priority access' : 'Pre-registration open'}
        </span>
        <h3 className={`mt-1.5 truncate text-[15px] font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{game.title}</h3>
        <p className={`mt-0.5 flex items-center gap-1 text-xs ${muted}`}>
          <MapPin size={12} />{game.venue} · {game.city}
          <span className="mx-1">·</span>
          <CalendarDays size={12} />Date soon
        </p>
        <p className={`mt-1.5 text-xs ${muted}`}>
          {teamName
            ? <>Team <b className={isDark ? 'text-gray-200' : 'text-gray-800'}>{teamName}</b> gets first access when registration goes live.</>
            : 'Free. Pre-registered teams get first access to slots.'}
        </p>
        <span className={`mt-1.5 inline-flex items-center gap-0.5 text-xs font-semibold ${accent}`}>
          {teamName ? 'View hunt' : 'Pre-register your team'}<ChevronRight size={14} />
        </span>
      </div>
    </Link>
  );
}

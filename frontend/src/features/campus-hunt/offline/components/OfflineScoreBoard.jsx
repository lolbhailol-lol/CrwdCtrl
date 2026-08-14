import { useEffect, useState } from 'react';
import { getOfflineStorageInfo } from '../offlineDb';

export default function OfflineScoreBoard({ state, teamCode, teamName }) {
  const clues = [1, 2, 3, 4, 5].map((n) => {
    const row = state?.clueProgress?.[n] || {};
    return {
      n,
      pts: Number(row.awardedPoints) || 0,
      label: row.state === 'COMPLETED'
        ? (row.failureReason === 'REVEALED_ZERO_POINTS' ? '0' : String(Number(row.awardedPoints) || 0))
        : (row.state === 'ACTIVE' ? '…' : '—'),
    };
  });

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0ECCEE]">
        Local team score
      </p>
      <p className="mt-1 text-2xl font-bold">
        {Number(state?.score) || 0}
        <span className="ml-2 text-sm font-normal text-white/45">pts</span>
      </p>
      <p className="text-xs text-white/50">
        {teamCode}
        {teamName ? ` · ${teamName}` : ''}
        {' · this phone only until Team QR sync'}
      </p>
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px]">
        {clues.map((c) => (
          <div key={c.n} className="rounded-lg bg-black/30 px-1 py-1.5">
            <p className="text-white/40">C{c.n}</p>
            <p className="font-mono font-semibold">{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function OfflineStorageBadge() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getOfflineStorageInfo()
      .then((row) => {
        if (!cancelled) setInfo(row);
      })
      .catch(() => {
        if (!cancelled) setInfo({ backend: 'browser' });
      });
    return () => { cancelled = true; };
  }, []);

  if (!info) return null;

  const label = info.backend === 'sqlite'
    ? (info.encrypted ? 'Encrypted SQLite on this phone' : 'SQLite on this phone')
    : 'Saved in this browser';

  return (
    <p className="mt-2 text-[10px] uppercase tracking-wide text-white/35">
      {label}
    </p>
  );
}

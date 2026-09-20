import { useEffect, useMemo, useState } from 'react';
import { adminListChallenges } from '../services/campusHunt.api';
import { themeForChallengeNumber } from '../types/stageTheme';

/**
 * Organizer strip for one color stage: hint text + (parent slots QR / slips).
 */
export default function ClueOrganizerPack({
  eventId,
  challengeNumber,
  reloadKey = 0,
  children,
}) {
  const n = Number(challengeNumber) || 1;
  const theme = themeForChallengeNumber(n);
  const [hints, setHints] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [cost, setCost] = useState(15);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await adminListChallenges(eventId);
        if (cancelled) return;
        const list = (res.data?.challenges || res.data || [])
          .filter((c) => Number(c.challengeNumber) === n);
        const hintList = [...new Set(
          list.map((c) => String(c.hintText || '').trim()).filter(Boolean),
        )];
        const answerList = [...new Set(
          list.map((c) => String(c.answer || '').trim()).filter(Boolean),
        )];
        setHints(hintList);
        setAnswers(answerList);
        setCost(list[0]?.hintCost ?? 15);
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load hints');
      }
    })();
    return () => { cancelled = true; };
  }, [eventId, n, reloadKey]);

  const title = useMemo(() => (
    `Organizer · ${theme.colorName || `Clue ${n}`}`
  ), [theme.colorName, n]);

  return (
    <section
      className="space-y-3 rounded-2xl border px-3 py-3"
      style={{
        borderColor: `${theme.hex}55`,
        background: `${theme.hex}12`,
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: theme.hex }}
          >
            {title}
          </p>
          <p className="mt-0.5 text-xs text-white/50">
            Desk hint + print QR for this color — keep together when planting.
          </p>
        </div>
        <p className="text-[10px] text-white/40">hint ~−{cost} pts</p>
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">
          Hint (organizer only)
        </p>
        {error && <p className="mt-1 text-xs text-amber-100">{error}</p>}
        {!error && hints.length === 0 && (
          <p className="mt-1 text-xs text-white/40">
            No hint saved — set under clue editor above, then Update this clue.
          </p>
        )}
        {hints.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {hints.slice(0, 8).map((h) => (
              <li key={h} className="text-sm text-amber-50/90">{h}</li>
            ))}
            {hints.length > 8 && (
              <li className="text-[11px] text-white/40">+{hints.length - 8} more variants</li>
            )}
          </ul>
        )}
        {answers.length > 0 && n !== 2 && n !== 4 && (
          <p className="mt-2 text-[11px] text-white/45">
            Sample answer{answers.length > 1 ? 's' : ''}:{' '}
            <span className="font-mono text-emerald-200/90">
              {answers.slice(0, 3).join(' · ')}
            </span>
          </p>
        )}
      </div>

      {children ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Print QR · this color
          </p>
          {children}
        </div>
      ) : null}
    </section>
  );
}

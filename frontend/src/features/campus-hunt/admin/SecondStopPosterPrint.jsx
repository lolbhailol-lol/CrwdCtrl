import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { adminListStationQr } from '../services/campusHunt.api';
import { TARGET_TEAMS_PER_STATION, STATION_TARGET_COUNT } from './campusHuntFormat';
import { STAGE_THEMES, posterPrintCss } from '../types/stageTheme';

const TARGET_POSTERS = STATION_TARGET_COUNT * TARGET_TEAMS_PER_STATION; // 40
const THEME = STAGE_THEMES.clue2;

/**
 * Clue 2 / Checkpoint 2 print: 40 pocket-size green SECOND SCAN cards (10 × 4).
 */
export default function SecondStopPosterPrint({ eventId, reloadKey = 0 }) {
  const [packs, setPacks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminListStationQr(eventId);
      setPacks(result.data?.secondStopPrintPacks || []);
      setSummary(result.data?.printSummary || null);
    } catch (err) {
      setError(err.message || 'Could not load SECOND SCAN posters');
    } finally {
      setBusy(false);
    }
  }, [eventId]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, reloadKey]);

  const stats = useMemo(() => {
    const posterCount = packs.reduce((sum, pack) => sum + (pack.posters?.length || 0), 0);
    const readyPlaces = packs.filter(
      (pack) => (pack.posters?.length || 0) === TARGET_TEAMS_PER_STATION,
    ).length;
    return { posterCount, readyPlaces };
  }, [packs]);

  const printPacks = async (selectedPacks) => {
    if (!selectedPacks?.length) return;
    setMessage('');
    const sheets = [];
    for (const pack of selectedPacks) {
      const posters = [...(pack.posters || [])].sort((a, b) => (
        String(a.teamCode || '').localeCompare(String(b.teamCode || ''), undefined, { numeric: true })
      ));
      // eslint-disable-next-line no-await-in-loop
      const cards = await Promise.all(posters.map(async (poster) => {
        const payload = typeof poster.payload === 'string'
          ? poster.payload
          : JSON.stringify(poster.payload || {});
        const qr = await QRCode.toDataURL(payload, {
          width: 180,
          margin: 1,
          color: { dark: '#111213', light: '#ffffff' },
        });
        const teamTitle = poster.teamName || poster.teamCode || 'TEAM';
        const teamCode = poster.teamCode || '—';
        const startPoint = poster.startLocation || poster.startCode || '';
        const paste = poster.pasteHint || (poster.pasteCode ? `CH-${poster.pasteCode}` : '');
        return `
          <article class="card">
            <p class="badge">Green · SECOND SCAN</p>
            <p class="place">${escapeHtml(pack.locationName)}</p>
            <p class="eyebrow">Your team card</p>
            <h1>${escapeHtml(teamTitle)}</h1>
            <p class="code">${escapeHtml(teamCode)}</p>
            ${startPoint ? `<p class="start">Start: ${escapeHtml(startPoint)}</p>` : ''}
            <img src="${qr}" alt="Station QR" width="180" height="180" />
            <p class="paste">${escapeHtml(paste)}</p>
            <p class="note">After Clue 2 · all 4 scan → take card</p>
          </article>
        `;
      }));
      sheets.push(`
        <section class="sheet">
          <div class="sheet-head">
            <div>
              <p class="badge">Clue 2 · Green · pocket cards</p>
              <h2>${escapeHtml(pack.locationName)}</h2>
              <p>${posters.length} cards · cut on dashed lines · tuck anywhere</p>
            </div>
          </div>
          <div class="grid">${cards.join('')}</div>
          <p class="cut-hint">Cut along dashed lines · leave on a ledge, under a plant, in a notice rack…</p>
        </section>
      `);
    }

    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) {
      setError('Allow popups to print cards');
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>Clue 2 · Green · pocket cards</title>
      <style>${posterPrintCss(THEME)}</style></head><body>${sheets.join('')}<script>window.print()</script></body></html>`);
    popup.document.close();
    const count = selectedPacks.reduce((sum, pack) => sum + (pack.posters?.length || 0), 0);
    setMessage(`Print sheet opened · ${count} green pocket cards`);
  };

  return (
    <section className={`rounded-2xl border ${THEME.borderClass} ${THEME.bgClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${THEME.solidClass} ${THEME.solidTextClass}`}>
              Green
            </span>
            <h2 className="text-base font-semibold text-white">
              SECOND SCAN pocket cards · {TARGET_POSTERS} total
            </h2>
          </div>
          <p className="mt-1 text-xs text-white/50">
            Small green cards — tuck anywhere. Finding them early does nothing until Clue 2.
            After scanning, teams pick up their card so the next groups only see theirs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !eventId}
            onClick={() => refresh()}
            className="rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold disabled:opacity-40"
          >
            {busy ? 'Loading…' : 'Refresh'}
          </button>
          <button
            type="button"
            disabled={busy || stats.posterCount === 0}
            onClick={() => printPacks(packs)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${THEME.buttonClass}`}
          >
            Print {stats.posterCount || TARGET_POSTERS} cards
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${
          stats.posterCount === TARGET_POSTERS
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          {stats.posterCount}/{TARGET_POSTERS} cards
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/60">
          {stats.readyPlaces}/{STATION_TARGET_COUNT} places ready
        </span>
        {summary?.secondSkipped > 0 && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/45">
            {summary.secondSkipped} unwanted hidden
          </span>
        )}
      </div>

      {stats.posterCount < TARGET_POSTERS && (
        <p className="mt-2 text-xs text-amber-200">
          Need {TARGET_POSTERS - stats.posterCount} more — Bootstrap + Save Clue 2, then refresh.
        </p>
      )}
      {error && <p className="mt-2 text-sm text-amber-200">{error}</p>}
      {message && <p className={`mt-2 text-sm ${THEME.textClass}`}>{message}</p>}

      <div className="mt-4 space-y-2">
        {packs.map((pack) => {
          const posters = pack.posters || [];
          const ready = posters.length === TARGET_TEAMS_PER_STATION;
          return (
            <div
              key={pack.code || pack.locationName}
              className={`rounded-xl border ${THEME.borderClass} bg-black/25 px-3 py-2.5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    <span className="mr-2 text-[11px] font-normal text-white/40">
                      {pack.code}
                    </span>
                    {pack.locationName}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/65">
                    {posters.length === 0 && (
                      <span className="text-amber-200">No team cards yet</span>
                    )}
                    {posters.map((poster) => (
                      <span key={poster.checkpointId}>
                        <span className="font-semibold text-white">
                          {poster.teamName || poster.teamCode}
                        </span>
                        {poster.teamCode && poster.teamName ? (
                          <span className="text-white/40"> · {poster.teamCode}</span>
                        ) : null}
                      </span>
                    ))}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>
                    {posters.length}/{TARGET_TEAMS_PER_STATION}
                  </span>
                  <button
                    type="button"
                    disabled={!posters.length}
                    onClick={() => printPacks([pack])}
                    className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] disabled:opacity-40"
                  >
                    Print 4 cards
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

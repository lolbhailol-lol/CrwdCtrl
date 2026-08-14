import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { adminListStationQr } from '../services/campusHunt.api';
import { resolveStations, STATION_TARGET_COUNT } from './campusHuntFormat';
import { posterPrintCss, a3GridPosterPrintCss, posterGridColumns } from '../types/stageTheme';

const POSTERS_PER_PLACE = 1;

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Shared print UI for Orange / Green / Blue station QRs (1 per place).
 */
export default function StationPosterPrint({
  eventId,
  reloadKey = 0,
  theme,
  packsKey,
  colorLabel,
  scanLabel,
  title,
  blurb,
  needMoreHint,
  skippedSummaryKey,
  campusStations,
  stationCount = null,
  teamSize = 4,
  /** 'default' = one page per place · 'a3-single' = all QRs on one A3 cut sheet */
  printLayout = 'default',
}) {
  const [packs, setPacks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [apiStations, setApiStations] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const activeStations = useMemo(() => {
    if (Array.isArray(apiStations) && apiStations.length) return apiStations;
    return resolveStations(campusStations, stationCount);
  }, [apiStations, campusStations, stationCount]);
  const activeCodes = useMemo(
    () => new Set(activeStations.map((s) => String(s.code || '').toUpperCase())),
    [activeStations],
  );
  const placeTarget = Math.max(1, activeStations.length || STATION_TARGET_COUNT);
  const targetPosters = placeTarget * POSTERS_PER_PLACE;
  const people = Math.max(2, Math.min(8, Number(teamSize) || 4));

  const refresh = useCallback(async () => {
    if (!eventId) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminListStationQr(eventId);
      setPacks(result.data?.[packsKey] || []);
      setSummary(result.data?.printSummary || null);
      setApiStations(result.data?.campusStations || null);
    } catch (err) {
      setError(err.message || `Could not load ${scanLabel} posters`);
    } finally {
      setBusy(false);
    }
  }, [eventId, packsKey, scanLabel]);

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh, reloadKey]);

  const visiblePacks = useMemo(() => {
    if (!activeCodes.size) return packs;
    return packs.filter((pack) => activeCodes.has(String(pack.code || '').toUpperCase()));
  }, [packs, activeCodes]);

  const displayPacks = useMemo(() => {
    if (visiblePacks.length) return visiblePacks;
    return activeStations.map((station) => ({
      code: station.code,
      locationName: station.name,
      posters: [],
    }));
  }, [visiblePacks, activeStations]);

  const stats = useMemo(() => {
    const posterCount = displayPacks.reduce((sum, pack) => sum + (pack.posters?.length || 0), 0);
    const readyPlaces = displayPacks.filter(
      (pack) => (pack.posters?.length || 0) >= POSTERS_PER_PLACE,
    ).length;
    return { posterCount, readyPlaces };
  }, [displayPacks]);

  const skippedCount = skippedSummaryKey ? Number(summary?.[skippedSummaryKey] || 0) : 0;
  const heading = title || `${scanLabel} shared QRs · ${placeTarget} place${placeTarget === 1 ? '' : 's'}`;

  const printPacks = async (selectedPacks) => {
    if (!selectedPacks?.length) return;
    setMessage('');
    const allCards = [];
    for (const pack of selectedPacks) {
      const posters = [...(pack.posters || [])];
      // eslint-disable-next-line no-await-in-loop
      for (const poster of posters) {
        const payload = typeof poster.payload === 'string'
          ? poster.payload
          : JSON.stringify(poster.payload || {});
        const cardCountHint = selectedPacks.reduce(
          (sum, p) => sum + (p.posters?.length || 0),
          0,
        );
        const qrPx = cardCountHint <= 4 ? 180 : cardCountHint <= 6 ? 150 : 128;
        // eslint-disable-next-line no-await-in-loop
        const qr = await QRCode.toDataURL(payload, {
          width: qrPx,
          margin: 1,
          color: { dark: '#111213', light: '#ffffff' },
        });
        const paste = poster.pasteHint || (poster.pasteCode ? `CH-${poster.pasteCode}` : '');
        allCards.push({
          pack,
          html: `
            <article class="card">
              <p class="badge">${escapeHtml(colorLabel)} · ${escapeHtml(scanLabel)}</p>
              <p class="place">${escapeHtml(pack.locationName)}</p>
              <p class="eyebrow">Shared station QR</p>
              <h1>${escapeHtml(pack.locationName)}</h1>
              <p class="code">${escapeHtml(pack.code || poster.stationCode || '')}</p>
              <img src="${qr}" alt="Station QR" width="${qrPx}" height="${qrPx}" />
              <p class="paste">${escapeHtml(paste)}</p>
              <p class="note">All ${people} scan → team code → clue</p>
            </article>
          `,
        });
      }
    }

    if (!allCards.length) return;

    let bodyHtml = '';
    let css = posterPrintCss(theme);
    let docTitle = `${colorLabel} · ${scanLabel}`;

    if (printLayout === 'a3-single') {
      const columns = posterGridColumns(allCards.length);
      css = a3GridPosterPrintCss(theme, { columns, cardCount: allCards.length });
      docTitle = `${colorLabel} · ${scanLabel} · A3 cut sheet`;
      bodyHtml = `
        <section class="sheet-a3">
          <div class="sheet-head">
            <div>
              <p class="badge">${escapeHtml(colorLabel)} · ${escapeHtml(scanLabel)} · A3</p>
              <h2>All ${allCards.length} shared QRs — one page</h2>
              <p>Cut along dashed lines · tape one card per campus place</p>
            </div>
          </div>
          <p class="cut-banner">✂ Cut on dashed lines · ${allCards.length} place${allCards.length === 1 ? '' : 's'}</p>
          <div class="grid-a3">${allCards.map((c) => c.html).join('')}</div>
        </section>
      `;
    } else {
      bodyHtml = selectedPacks.map((pack) => {
        const cards = allCards.filter((c) => c.pack === pack).map((c) => c.html);
        return `
          <section class="sheet">
            <div class="sheet-head">
              <div>
                <p class="badge">${escapeHtml(colorLabel)} · ${escapeHtml(scanLabel)} · shared QR</p>
                <h2>${escapeHtml(pack.locationName)}</h2>
                <p>1 QR for this place · all teams scan the same poster</p>
              </div>
            </div>
            <div class="grid">${cards.join('')}</div>
          </section>
        `;
      }).join('');
    }

    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) {
      setError('Allow popups to print cards');
      return;
    }
    popup.document.write(`<!doctype html><html><head><title>${escapeHtml(docTitle)}</title>
      <style>${css}</style></head><body>${bodyHtml}<script>window.print()</script></body></html>`);
    popup.document.close();
    setMessage(
      printLayout === 'a3-single'
        ? `A3 cut sheet opened · ${allCards.length} ${colorLabel} QRs on one page`
        : `Print sheet opened · ${allCards.length} ${colorLabel} QRs`,
    );
  };

  return (
    <section className={`rounded-2xl border ${theme.borderClass} ${theme.bgClass} p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${theme.solidClass} ${theme.solidTextClass}`}>
              {colorLabel}
            </span>
            <h2 className="text-base font-semibold text-white">{heading}</h2>
          </div>
          <p className="mt-1 text-xs text-white/50">{blurb}</p>
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
            onClick={() => printPacks(displayPacks)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-40 ${theme.buttonClass}`}
          >
            {printLayout === 'a3-single'
              ? `Print all on A3 (${stats.posterCount || targetPosters})`
              : `Print ${stats.posterCount || targetPosters} QRs`}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        <span className={`rounded-full px-2.5 py-1 ${
          stats.posterCount === targetPosters
            ? 'bg-emerald-500/15 text-emerald-200'
            : 'bg-amber-500/15 text-amber-100'
        }`}>
          {stats.posterCount}/{targetPosters} shared QRs
        </span>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/60">
          {stats.readyPlaces}/{placeTarget} places ready
        </span>
        {skippedCount > 0 && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/45">
            {skippedCount} unwanted hidden
          </span>
        )}
      </div>

      {stats.posterCount < targetPosters && (
        <p className="mt-2 text-xs text-amber-200">
          Need {targetPosters - stats.posterCount} more — {needMoreHint}
        </p>
      )}
      {error && <p className="mt-2 text-sm text-amber-200">{error}</p>}
      {message && <p className={`mt-2 text-sm ${theme.textClass}`}>{message}</p>}

      <div className="mt-4 space-y-2">
        {displayPacks.map((pack) => {
          const posters = pack.posters || [];
          const ready = posters.length >= POSTERS_PER_PLACE;
          return (
            <div
              key={pack.code || pack.locationName}
              className={`rounded-xl border ${theme.borderClass} bg-black/25 px-3 py-2.5`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-white">
                    <span className="mr-2 text-[11px] font-normal text-white/40">
                      {pack.code}
                    </span>
                    {pack.locationName}
                  </p>
                  <p className="mt-1 text-xs text-white/65">
                    {posters.length === 0
                      ? <span className="text-amber-200">No shared QR yet</span>
                      : <span className="text-emerald-200/90">1 shared QR ready</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] ${ready ? 'text-emerald-300' : 'text-amber-200'}`}>
                    {posters.length}/{POSTERS_PER_PLACE}
                  </span>
                  <button
                    type="button"
                    disabled={!posters.length}
                    onClick={() => printPacks([pack])}
                    className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] disabled:opacity-40"
                  >
                    Print QR
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

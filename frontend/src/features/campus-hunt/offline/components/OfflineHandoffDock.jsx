import { useState } from 'react';
import OfflineQrCard from './OfflineQrCard';

/**
 * Minimal offline footer — export only after score lock.
 * Backup / sync live in Tools on the play page.
 */
export default function OfflineHandoffDock({
  isLeader,
  waiting = false,
  locked,
  resultsPayload,
  onDownloadResults,
}) {
  const [sheet, setSheet] = useState(null);

  if (waiting || !isLeader || !locked) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0c0d]/95 px-3 py-3 backdrop-blur-md">
        <div className="mx-auto max-w-lg">
          <button
            type="button"
            onClick={() => { onDownloadResults?.(); setSheet('results'); }}
            className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-3 py-3 text-sm font-bold text-emerald-100"
          >
            Export results
          </button>
        </div>
      </div>

      {sheet === 'results' ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-3">
            <OfflineQrCard
              value={resultsPayload}
              title="Results"
              hint="Desk can scan this QR, or use the downloaded JSON"
              accent="#34d399"
            />
            <button
              type="button"
              onClick={() => setSheet(null)}
              className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

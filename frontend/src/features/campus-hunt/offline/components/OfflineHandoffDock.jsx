import { useState } from 'react';
import HuntQrScanner from '../../components/HuntQrScanner';
import OfflineQrCard from './OfflineQrCard';

export default function OfflineHandoffDock({
  isLeader,
  atCheckpoint,
  youScanned,
  awaitingConfirm,
  atStartReport,
  locked,
  proofPayload,
  teamSyncPayload,
  resultsPayload,
  onCollectProof,
  onScanTeamSync,
  onMarkReached,
  onDownloadResults,
}) {
  const [sheet, setSheet] = useState(null);
  const [scanMode, setScanMode] = useState(null);
  const [note, setNote] = useState('');

  const close = () => {
    setSheet(null);
    setScanMode(null);
  };

  const onScan = async (raw) => {
    try {
      if (scanMode === 'proof') {
        await onCollectProof(raw);
        setNote('Teammate collected');
      } else if (scanMode === 'sync') {
        await onScanTeamSync(raw);
        setNote('Synced');
        close();
      }
    } catch (err) {
      setNote(err.message || 'Scan failed');
    }
  };

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b0c0d]/95 px-3 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg flex-wrap gap-2">
          {isLeader ? (
            <>
              <button
                type="button"
                onClick={() => setSheet('sync')}
                className="flex-1 rounded-xl bg-[#0ECCEE] px-3 py-2.5 text-xs font-bold text-black"
              >
                Show Team QR
              </button>
              {atCheckpoint ? (
                <button
                  type="button"
                  onClick={() => { setScanMode('proof'); setNote(''); }}
                  className="flex-1 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-white"
                >
                  Collect proofs
                </button>
              ) : null}
              {atStartReport || locked ? (
                <>
                  {!locked ? (
                    <button
                      type="button"
                      onClick={onMarkReached}
                      className="flex-1 rounded-xl bg-emerald-400 px-3 py-2.5 text-xs font-bold text-black"
                    >
                      Reached start
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => { onDownloadResults?.(); setSheet('results'); }}
                    className="flex-1 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-white"
                  >
                    Export results
                  </button>
                </>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setScanMode('sync'); setNote(''); }}
                className="flex-1 rounded-xl bg-[#0ECCEE] px-3 py-2.5 text-xs font-bold text-black"
              >
                Scan leader QR
              </button>
              {youScanned && atCheckpoint && !awaitingConfirm ? (
                <button
                  type="button"
                  onClick={() => setSheet('proof')}
                  className="flex-1 rounded-xl border border-white/20 px-3 py-2.5 text-xs font-bold text-white"
                >
                  My proof QR
                </button>
              ) : null}
            </>
          )}
        </div>
        <p className="mx-auto mt-1.5 max-w-lg text-center text-[10px] text-white/40">
          Airplane mode OK · cameras only · no Wi‑Fi
        </p>
      </div>

      {sheet ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
          <div className="w-full max-w-sm space-y-3">
            {sheet === 'proof' ? (
              <OfflineQrCard
                value={proofPayload}
                title="Member scan proof"
                hint="Leader scans this from your screen"
              />
            ) : null}
            {sheet === 'sync' ? (
              <OfflineQrCard
                value={teamSyncPayload}
                title="Team state"
                hint="Teammates scan this after every step"
              />
            ) : null}
            {sheet === 'results' ? (
              <OfflineQrCard
                value={resultsPayload}
                title="Results"
                hint="Desk can scan this, or use the downloaded JSON"
                accent="#34d399"
              />
            ) : null}
            <button
              type="button"
              onClick={close}
              className="w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {scanMode ? (
        <div className="fixed inset-0 z-50 bg-black/80 p-4">
          <div className="mx-auto max-w-sm space-y-3 pt-8">
            <p className="text-center text-sm font-semibold text-white">
              {scanMode === 'proof' ? 'Scan teammate proof QR' : 'Scan leader Team QR'}
            </p>
            {note ? <p className="text-center text-xs text-emerald-300">{note}</p> : null}
            <HuntQrScanner
              active
              onScan={onScan}
              onClose={() => setScanMode(null)}
              accentHex="#0ECCEE"
            />
            <button
              type="button"
              onClick={() => setScanMode(null)}
              className="w-full rounded-xl bg-white/10 py-2.5 text-sm text-white"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

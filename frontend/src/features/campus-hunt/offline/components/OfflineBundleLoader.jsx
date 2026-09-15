import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { OFFLINE_BUNDLE_TYPE, OFFLINE_BUNDLE_VERSION } from '../constants';
import { saveOfflineBundle } from '../offlineDb';
import { CAMPUS_HUNT_PATHS } from '../../config';

function isValidBundle(raw) {
  return raw
    && raw.bundleVersion === OFFLINE_BUNDLE_VERSION
    && raw.bundleType === OFFLINE_BUNDLE_TYPE
    && raw.team?.teamCode
    && raw.clues?.clue1;
}

function extractSingle(raw) {
  if (isValidBundle(raw)) return raw;
  if (Array.isArray(raw?.bundles) && raw.bundles.length === 1) {
    return raw.bundles[0]?.bundle || null;
  }
  return null;
}

export default function OfflineBundleLoader({ onLoaded }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState(null);

  const commit = async (bundle) => {
    if (!isValidBundle(bundle)) {
      throw new Error('That file is not a Campus Hunt offline pack.');
    }
    await saveOfflineBundle(bundle);
    onLoaded?.(bundle);
  };

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    setChoices(null);
    try {
      const parsed = JSON.parse(await file.text());
      const single = extractSingle(parsed);
      if (single) {
        await commit(single);
        return;
      }
      if (Array.isArray(parsed?.bundles) && parsed.bundles.length > 1) {
        setChoices(parsed.bundles.filter((row) => isValidBundle(row?.bundle)));
        return;
      }
      throw new Error('Pick a team offline pack, or the combined export and choose a team.');
    } catch (err) {
      setError(err.message || 'Could not load offline pack');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/12 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Load team pack</p>
      <p className="mt-1 text-xs text-white/55">
        Load this team’s JSON, or the combined export and pick your team.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="mt-3 block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0ECCEE] file:px-3 file:py-2 file:text-xs file:font-bold file:text-black"
        disabled={busy}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {choices?.length ? (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-white/60">Which team is this phone?</p>
          {choices.map((row) => (
            <button
              key={row.teamCode}
              type="button"
              onClick={() => commit(row.bundle).catch((err) => setError(err.message))}
              className="flex w-full items-center justify-between rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-left text-sm"
            >
              <span className="font-mono font-bold text-[#0ECCEE]">{row.teamCode}</span>
              <span className="text-white/70">{row.teamName || row.bundle?.team?.teamName}</span>
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {busy ? <p className="mt-2 text-xs text-white/45">Saving pack locally…</p> : null}
    </div>
  );
}

export function OfflineNavLinks() {
  return (
    <div className="mt-4 flex flex-wrap gap-3 text-xs">
      <Link to={CAMPUS_HUNT_PATHS.offlineLogin} className="text-[#0ECCEE] underline">
        Already loaded? Open team login
      </Link>
    </div>
  );
}

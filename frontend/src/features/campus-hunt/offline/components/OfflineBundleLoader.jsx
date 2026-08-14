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
    && raw.team?.password
    && raw.clues?.clue1;
}

function extractBundleFromExport(raw) {
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

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const bundle = extractBundleFromExport(parsed);
      if (!bundle) {
        throw new Error('Pick a team offline pack (.offline.bundle.json) or a single-team export.');
      }
      await saveOfflineBundle(bundle);
      onLoaded?.(bundle);
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
        Copy the JSON file for this team from the admin export onto each phone before fest.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="mt-3 block w-full text-xs text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-[#0ECCEE] file:px-3 file:py-2 file:text-xs file:font-bold file:text-black"
        disabled={busy}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
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
      <Link to={CAMPUS_HUNT_PATHS.profileLogin} className="text-white/45 underline">
        Back to online hunt
      </Link>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Image, Loader2, RefreshCw } from 'lucide-react';
import { adminFetchJSON } from '../../services/api/admin.api.js';

const MANIFEST_URL = '/images/catalog-recovery/catalog-image-recovery-manifest.json';
const PAGE_SIZE = 18;

export default function CatalogImageRecoveryPanel() {
  const [manifest, setManifest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    fetch(MANIFEST_URL, { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error('Recovery image list is not included in this build.');
        return response.json();
      })
      .then((data) => { if (active) setManifest(data); })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const images = Array.isArray(manifest?.images) ? manifest.images : [];
  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return images.filter((image) => {
      const kindMatch = filter === 'all'
        || (filter === 'fests' && image.kind.startsWith('fest'))
        || (filter === 'competitions' && image.kind.startsWith('competition'));
      const textMatch = !text || `${image.name} ${image.college || ''} ${image.kind}`.toLowerCase().includes(text);
      return kindMatch && textMatch;
    });
  }, [images, filter, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => setPage(1), [filter, query]);

  const imageKey = (image) => `${image.kind}:${image.id}:${Number.isInteger(image.index) ? image.index : ''}`;

  const toggleImage = (key) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setResult(null);
  };

  const selectImages = (items, replace = false) => {
    setSelected((current) => {
      const next = replace ? new Set() : new Set(current);
      items.forEach((image) => next.add(imageKey(image)));
      return next;
    });
    setResult(null);
  };

  const applySelected = async () => {
    setApplying(true);
    setError('');
    try {
      const data = await adminFetchJSON('/admin/catalog-images/recovery/apply', {
        method: 'POST',
        body: JSON.stringify({ imageKeys: [...selected] }),
      });
      setResult(data);
      setSelected(new Set());
    } catch (err) {
      setError(err.message || 'Could not apply recovered images.');
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="bg-[#111213] border border-gray-800 rounded-2xl p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="size-10 rounded-xl bg-[#0ECCEE]/10 text-[#0ECCEE] flex items-center justify-center shrink-0">
            <Image size={20} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Catalog image recovery</h2>
            <p className="text-sm text-gray-400 mt-1 max-w-3xl">
              Preview CC0 topic photos for broken fest, competition, and gallery images. Apply only the images you select; blank fields and links to the inactive Cloudinary host are replaced, while working images stay untouched.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={applySelected}
          disabled={applying || loading || !selected.size}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#0ECCEE] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#49daf2] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          {applying ? 'Applying images…' : `Apply ${selected.size} selected`}
        </button>
      </div>

      {loading ? <p className="text-sm text-gray-400">Loading recovered image list…</p> : null}
      {error ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-800/60 bg-red-950/30 p-3 text-sm text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" /> {error}
        </div>
      ) : null}
      {result?.success ? (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 p-3 text-sm text-emerald-300">
          <CheckCircle2 size={17} className="mt-0.5 shrink-0" />
          <span>{result.message} Updated {result.updatedFests} fests and {result.updatedCompetitions} competitions ({result.replacedImageFields} image fields). {result.unmatchedImages} unmatched items keep their current fallback artwork.</span>
        </div>
      ) : null}

      {manifest ? (
        <>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-400">
            <span>{manifest.totals?.prepared ?? images.length} photos ready</span>
            <span>{manifest.catalog?.fests ?? 0} fests</span>
            <span>{manifest.catalog?.competitions ?? 0} competitions</span>
            <span>{manifest.totals?.failed ?? manifest.failed?.length ?? 0} unmatched (fallback art kept)</span>
            <a href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#0ECCEE] hover:underline">
              CC0 license <ExternalLink size={12} />
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {['all', 'fests', 'competitions'].map((option) => (
              <button key={option} type="button" onClick={() => setFilter(option)} className={`px-3 py-1.5 rounded-full text-xs capitalize ${filter === option ? 'bg-[#0ECCEE] text-black font-semibold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}>
                {option}
              </button>
            ))}
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a fest or competition" className="ml-auto w-full sm:w-64 bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#0ECCEE]" />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span>{selected.size} selected</span>
            <button type="button" onClick={() => selectImages(visible)} className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700">Select this page</button>
            <button type="button" onClick={() => selectImages(filtered, true)} className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700">Select all {filtered.length} matches</button>
            <button type="button" onClick={() => { setSelected(new Set()); setResult(null); }} disabled={!selected.size} className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 disabled:opacity-40">Clear selection</button>
            <span className="ml-auto">Select the images you want applied to catalog records.</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {visible.map((image) => (
              <article key={imageKey(image)} className={`min-w-0 rounded-xl overflow-hidden border bg-[#1a1b1d] ${selected.has(imageKey(image)) ? 'border-[#0ECCEE]' : 'border-gray-800'}`}>
                <label className="relative block cursor-pointer">
                  <img src={`/images/catalog-recovery/${image.file}`} alt={image.name} loading="lazy" className="w-full aspect-[4/3] object-cover bg-gray-900" />
                  <input type="checkbox" checked={selected.has(imageKey(image))} onChange={() => toggleImage(imageKey(image))} aria-label={`Select image for ${image.name}`} className="absolute right-2 top-2 size-5 accent-[#0ECCEE]" />
                </label>
                <div className="p-2.5 space-y-1.5">
                  <p className="text-xs font-medium text-white line-clamp-2" title={image.name}>{image.name}</p>
                  <p className="text-[10px] text-gray-500 capitalize">{image.kind.replace('-', ' ')} · {image.creator || 'Creator not listed'}</p>
                  <a href={image.sourcePage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-[#0ECCEE] hover:underline">
                    View CC0 source <ExternalLink size={10} />
                  </a>
                </div>
              </article>
            ))}
          </div>

          {filtered.length === 0 ? <p className="py-8 text-center text-sm text-gray-500">No recovered images match this search.</p> : null}
          {filtered.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="px-3 py-1.5 rounded bg-gray-800 disabled:opacity-40">Previous</button>
                <button type="button" disabled={page >= pageCount} onClick={() => setPage((current) => current + 1)} className="px-3 py-1.5 rounded bg-gray-800 disabled:opacity-40">Next</button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

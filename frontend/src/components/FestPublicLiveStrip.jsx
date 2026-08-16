import { useEffect, useState } from 'react';
import { MapPin, Pin, Radio } from 'lucide-react';
import { publicFetchJSONRetry as fetchJSON } from '../../services/api/client';

/**
 * Compact published live feed for MindSpark (and other fests) on the public fest page.
 */
export default function FestPublicLiveStrip({ festId, isDark = true }) {
  const [updates, setUpdates] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!festId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchJSON(`/fests/${festId}/live-updates`);
        const list = res?.data?.updates || res?.updates || [];
        if (!cancelled) setUpdates(Array.isArray(list) ? list.slice(0, 8) : []);
      } catch {
        if (!cancelled) setUpdates([]);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [festId]);

  if (!loaded || !updates.length) return null;

  return (
    <section
      className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
        isDark
          ? 'border-red-400/25 bg-linear-to-br from-red-500/10 to-[#111213]'
          : 'border-red-200 bg-red-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Radio size={16} className={isDark ? 'text-red-300' : 'text-red-600'} />
        <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Live now
        </h2>
      </div>
      <ul className="space-y-2">
        {updates.map((u) => (
          <li
            key={u.id || u._id}
            className={`rounded-xl px-3 py-2.5 border ${
              u.urgent || u.pinned
                ? isDark
                  ? 'border-amber-400/30 bg-amber-500/10'
                  : 'border-amber-300 bg-amber-50'
                : isDark
                  ? 'border-white/10 bg-white/4'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-start gap-2">
              {u.pinned ? <Pin size={12} className="text-amber-300 shrink-0 mt-1" /> : null}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {u.title}
                </p>
                {u.body ? (
                  <p className={`text-xs mt-0.5 line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    {u.body}
                  </p>
                ) : null}
                <div className={`flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {u.competitionName ? <span>{u.competitionName}</span> : null}
                  {u.locationLabel ? (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin size={10} /> {u.locationLabel}
                    </span>
                  ) : null}
                  {u.happensAt ? (
                    <span>
                      {new Date(u.happensAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

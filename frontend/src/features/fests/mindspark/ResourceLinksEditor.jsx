import { Plus, Trash2 } from 'lucide-react';

function normalizeList(list) {
  return Array.isArray(list) ? list.map((l) => ({
    label: String(l?.label || ''),
    url: String(l?.url || ''),
  })) : [];
}

/**
 * Compact editor for label + URL pairs (admin / organizer).
 */
export default function ResourceLinksEditor({
  links,
  onChange,
  title = 'Resource links',
  hint = 'Shown to participants after registration (rulebook, schedule, etc.)',
}) {
  const list = normalizeList(links);

  const update = (next) => onChange?.(next);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-white">{title}</p>
          {hint ? <p className="text-xs text-gray-400 mt-0.5">{hint}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => update([...list, { label: '', url: '' }])}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0ECCEE] text-black text-xs font-semibold hover:bg-[#0ECCEE]/90"
        >
          <Plus size={14} />
          Add link
        </button>
      </div>

      {list.length === 0 ? (
        <p className="text-xs text-gray-500 py-2">No extra links yet.</p>
      ) : (
        <div className="space-y-2">
          {list.map((row, index) => (
            <div key={`link-${index}`} className="flex gap-2 items-start">
              <input
                type="text"
                placeholder="Label"
                value={row.label}
                onChange={(e) => {
                  const next = [...list];
                  next[index] = { ...next[index], label: e.target.value };
                  update(next);
                }}
                className="w-28 shrink-0 px-2.5 py-2 rounded-lg bg-[#111213] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm"
              />
              <input
                type="url"
                placeholder="https://..."
                value={row.url}
                onChange={(e) => {
                  const next = [...list];
                  next[index] = { ...next[index], url: e.target.value };
                  update(next);
                }}
                className="flex-1 min-w-0 px-2.5 py-2 rounded-lg bg-[#111213] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm"
              />
              <button
                type="button"
                onClick={() => update(list.filter((_, i) => i !== index))}
                className="shrink-0 p-2 text-red-400 hover:text-red-300"
                title="Remove"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

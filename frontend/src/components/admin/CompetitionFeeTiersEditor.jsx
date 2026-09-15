import { Plus, Trash2 } from 'lucide-react';

/**
 * Shared fee-category editor for admin + fest-organizer competition forms.
 */
export default function CompetitionFeeTiersEditor({
  value = [],
  onChange,
  className = '',
}) {
  const tiers = Array.isArray(value) ? value : [];

  const setTiers = (next) => onChange?.(next);

  return (
    <div className={`rounded-xl border border-gray-700 bg-[#151617] p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[#0ECCEE]">Fee categories</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Optional. One event, multiple registration fees (e.g. Under 18 / UG / PG).
            Students pick a category at checkout.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTiers([
            ...tiers,
            { id: `tier_${Date.now()}`, label: '', amount: 0 },
          ])}
          className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-700 text-white text-xs hover:bg-gray-600"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      {tiers.map((tier, index) => (
        <div key={tier.id || index} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="e.g. UG students"
            className="flex-1 px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm text-white"
            value={tier.label || ''}
            onChange={(e) => {
              const next = [...tiers];
              next[index] = { ...next[index], label: e.target.value };
              setTiers(next);
            }}
          />
          <input
            type="number"
            min="0"
            step="1"
            placeholder="₹"
            className="w-24 px-3 py-2 rounded-lg bg-[#1D1E20] border border-gray-700 focus:border-[#0ECCEE] focus:outline-none text-sm text-white"
            value={tier.amount ?? 0}
            onChange={(e) => {
              const next = [...tiers];
              next[index] = { ...next[index], amount: Number(e.target.value) || 0 };
              setTiers(next);
            }}
          />
          <button
            type="button"
            onClick={() => setTiers(tiers.filter((_, i) => i !== index))}
            className="text-red-400 hover:text-red-300"
            aria-label="Remove fee category"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useState } from 'react';

/**
 * Dropdown options with optional auto-apply coupon per choice.
 * Used by run club organizer + admin sports form builders.
 */
export default function SelectFieldOptionsEditor({
  options = [],
  optionCoupons = {},
  onChange,
  inputClass = 'w-full rounded-lg bg-[#0f1011] border border-gray-700 px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#0ECCEE]',
}) {
  const [rows, setRows] = useState(() => {
    const labels = Array.isArray(options) ? options : [];
    if (!labels.length) return [{ label: '', couponCode: '' }];
    return labels.map((label) => ({
      label,
      couponCode: optionCoupons?.[label] || '',
    }));
  });

  const emit = (nextRows) => {
    setRows(nextRows.length ? nextRows : [{ label: '', couponCode: '' }]);
    const nextOptions = [];
    const nextCoupons = {};
    nextRows.forEach((row) => {
      const label = String(row.label || '').trim();
      const code = String(row.couponCode || '').trim().toUpperCase();
      if (!label) return;
      nextOptions.push(label);
      if (code) nextCoupons[label] = code;
    });
    onChange({ options: nextOptions, optionCoupons: nextCoupons });
  };

  const updateRow = (idx, patch) => {
    emit(rows.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-gray-500 leading-snug">
        Each choice can auto-apply a coupon on booking page 1. The code is used only if that coupon’s rules pass (people count, event type, expiry).
      </p>
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_minmax(8rem,9.5rem)_auto] gap-2">
          <input
            value={row.label}
            onChange={(e) => updateRow(idx, { label: e.target.value })}
            className={inputClass}
            placeholder={`Option ${idx + 1}`}
          />
          <input
            value={row.couponCode}
            onChange={(e) => updateRow(idx, { couponCode: e.target.value.toUpperCase() })}
            className={inputClass}
            placeholder="Coupon (optional)"
            autoCapitalize="characters"
          />
          <button
            type="button"
            onClick={() => emit(rows.filter((_, i) => i !== idx))}
            className="text-xs text-gray-500 hover:text-red-400 px-2 py-2"
            aria-label="Remove option"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => emit([...rows, { label: '', couponCode: '' }])}
        className="text-[11px] font-medium text-[#0ECCEE]"
      >
        + Add option
      </button>
    </div>
  );
}

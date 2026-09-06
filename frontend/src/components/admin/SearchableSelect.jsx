import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

/**
 * Lightweight searchable dropdown for admin panels.
 * options: [{ id, label, meta? }]
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  disabled = false,
  emptyLabel = 'No matches',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  const selected = useMemo(
    () => options.find((o) => String(o.id) === String(value)) || null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label || ''} ${o.meta || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className="w-full flex items-center gap-2 bg-[#1D1E20] border border-gray-700 rounded-lg px-3 py-2 text-sm text-left text-white disabled:opacity-50 focus:outline-none focus:border-[#0ECCEE]"
      >
        <span className={`flex-1 truncate ${selected ? 'text-white' : 'text-gray-500'}`}>
          {selected ? selected.label : placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            className="text-gray-500 hover:text-gray-300 p-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.('');
              setQuery('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onChange?.('');
              }
            }}
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={14} className="text-gray-500 shrink-0" />
        )}
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-700 bg-[#111213] shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
            <Search size={14} className="text-gray-500 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type to filter…"
              className="w-full bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-500">{emptyLabel}</li>
            ) : (
              filtered.map((o) => {
                const active = String(o.id) === String(value);
                return (
                  <li key={String(o.id)}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange?.(String(o.id));
                        setOpen(false);
                        setQuery('');
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-800 ${
                        active ? 'bg-[#0ECCEE]/10 text-[#0ECCEE]' : 'text-gray-200'
                      }`}
                    >
                      <div className="truncate">{o.label}</div>
                      {o.meta ? (
                        <div className="text-xs text-gray-500 truncate">{o.meta}</div>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

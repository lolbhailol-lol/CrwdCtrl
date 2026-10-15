import { Layers } from 'lucide-react';
import { WORLD_ORDER, WORLD_THEME } from '../worldTheme';

const TABS = [
  { id: 'all', label: 'All', color: '#F8FAFC', Icon: Layers },
  ...WORLD_ORDER.map((id) => ({ id, ...WORLD_THEME[id] })),
];

export default function MysteryWorldTabs({ active, onChange, counts = {} }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {TABS.map((tab) => {
        const { id, label, color } = tab;
        const selected = active === id;
        const count = counts[id];
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            style={selected ? { background: color, color: '#0b0c0d', borderColor: color } : { color, borderColor: `${color}40`, background: `${color}12` }}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-bold transition"
          >
            <tab.Icon size={14} />
            {label}
            {count !== undefined && (
              <span className={`rounded-full px-1.5 text-[10px] ${selected ? 'bg-black/20' : 'bg-white/10'}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

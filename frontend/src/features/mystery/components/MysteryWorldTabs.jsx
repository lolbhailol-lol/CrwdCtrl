const WORLDS = [
  { id: 'all', label: 'All' },
  { id: 'physical', label: 'Physical' },
  { id: 'digital', label: 'Digital' },
  { id: 'human', label: 'Human' },
  { id: 'logic', label: 'Logic' },
];

export default function MysteryWorldTabs({ active, onChange }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {WORLDS.map((w) => (
        <button
          key={w.id}
          type="button"
          onClick={() => onChange(w.id)}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition ${
            active === w.id ? 'bg-[#0ECCEE] text-black' : 'bg-white/5 text-white/60'
          }`}
        >
          {w.label}
        </button>
      ))}
    </div>
  );
}
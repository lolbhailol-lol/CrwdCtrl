import { useDialog } from '../../../context/DialogContext';

/**
 * Accommodation chip on the public Techfest page.
 * Placeholder only — full accommodation page comes later.
 */
export default function TechfestAccommodationBadge({ className = '' }) {
  const { toast } = useDialog();

  return (
    <button
      type="button"
      onClick={() => toast('Accommodation details coming soon')}
      className={`inline-flex items-center gap-2 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 hover:opacity-90 transition ${className}`}
      aria-label="Accommodation coming soon"
    >
      <span className="size-2 rounded-full bg-cyan-400" />
      <span className="text-xs font-semibold tracking-wide text-gray-300">
        Accommodation
      </span>
    </button>
  );
}

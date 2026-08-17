import { useDialog } from '../../../context/DialogContext';

/**
 * Live-updates chip on the public MindSpark page.
 * Looks closed until the organizer feed is wired in.
 */
export default function MindSparkLiveBadge({ className = '' }) {
  const { toast } = useDialog();

  return (
    <button
      type="button"
      onClick={() => toast('Upcoming')}
      className={`inline-flex items-center gap-2 shrink-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2 opacity-55 hover:opacity-70 transition ${className}`}
      aria-label="Live updates — upcoming"
    >
      <span className="size-2 rounded-full bg-red-500/70" />
      <span className="text-[11px] font-semibold tracking-wide text-gray-400">
        Live updates
      </span>
    </button>
  );
}

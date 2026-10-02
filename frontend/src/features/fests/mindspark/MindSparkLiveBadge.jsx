import { Link, useParams } from 'react-router-dom';
import { CalendarDays } from 'lucide-react';

/** Schedule chip on the public MindSpark page — opens the full event schedule. */
export default function MindSparkLiveBadge({ className = '' }) {
  const { eventId } = useParams();

  return (
    <Link
      to={`/view-details/${eventId}/schedule`}
      className={`inline-flex items-center gap-2 shrink-0 rounded-xl border border-[#0ECCEE]/30 bg-[#0ECCEE]/10 px-3 py-2 transition hover:bg-[#0ECCEE]/20 ${className}`}
      aria-label="MindSpark schedule"
    >
      <CalendarDays size={14} className="text-[#0ECCEE]" />
      <span className="text-[11px] font-semibold tracking-wide text-[#7DE8F7]">Schedule</span>
    </Link>
  );
}

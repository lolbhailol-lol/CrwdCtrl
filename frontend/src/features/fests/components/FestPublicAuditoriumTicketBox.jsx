import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';

/**
 * Public MindSpark ticket CTA — sits below Live updates.
 * Hidden only when meta explicitly sets showPublicTicketBox to false.
 * While meta is loading, show a soft CTA so the box is visible immediately.
 */
export default function FestPublicAuditoriumTicketBox({
  meta,
  isDark = true,
}) {
  // Explicit off from organizer → hide completely
  if (meta && meta.showPublicTicketBox === false) return null;

  // null meta (still loading / API miss) → show open CTA; only "Opens soon" when API says closed
  const open = meta == null ? true : Boolean(meta.registrationOpen);
  const left = meta?.totalLeft;

  return (
    <section
      className={`rounded-2xl border p-4 sm:p-5 space-y-3 ${
        isDark
          ? 'border-[#0ECCEE]/25 bg-linear-to-br from-[#0ECCEE]/10 to-[#111213]'
          : 'border-cyan-200 bg-cyan-50'
      }`}
    >
      <div className="flex items-center gap-2">
        <Ticket size={16} className={isDark ? 'text-[#0ECCEE]' : 'text-cyan-700'} />
        <h2 className={`text-base sm:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Auditorium tickets
        </h2>
      </div>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
        Free photo tickets for MindSpark night — year-wise seats.
        {left != null && open ? ` ${left} seats left overall.` : ''}
      </p>
      {open ? (
        <Link
          to={meta?.registerUrl || '/mindspark/auditorium'}
          className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0ECCEE] text-black text-sm font-semibold"
        >
          Get your ticket
        </Link>
      ) : (
        <p className={`text-xs font-medium ${isDark ? 'text-amber-200/90' : 'text-amber-800'}`}>
          Opens soon — registration is closed for now.
        </p>
      )}
    </section>
  );
}

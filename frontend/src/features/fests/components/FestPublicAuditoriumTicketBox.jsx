import { Link } from 'react-router-dom';
import { ArrowRight, Ticket } from 'lucide-react';

/**
 * Public MindSpark auditorium pass CTA — below Live updates.
 * Renders only after meta loads and showPublicTicketBox is explicitly on.
 * (Showing while meta is null caused a one-second flash when the pass is off.)
 */
export default function FestPublicAuditoriumTicketBox({
  meta,
  isDark = true,
}) {
  if (!meta || meta.showPublicTicketBox !== true) return null;

  const open = Boolean(meta.registrationOpen);
  const left = meta.totalLeft;

  return (
    <section
      className={`relative overflow-hidden rounded-[1.35rem] border ${
        isDark
          ? 'border-[#0ECCEE]/28 bg-[#0c0e10]'
          : 'border-cyan-200 bg-cyan-50'
      }`}
    >
      {isDark ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 120% at 0% 50%, rgba(14,204,238,0.16), transparent 55%), radial-gradient(ellipse 50% 80% at 100% 0%, rgba(245,158,11,0.08), transparent 50%)',
          }}
        />
      ) : null}

      <div className="relative p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 space-y-2 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center justify-center size-8 rounded-xl ${
                isDark ? 'bg-[#0ECCEE]/15 text-[#0ECCEE]' : 'bg-cyan-100 text-cyan-700'
              }`}
            >
              <Ticket size={16} />
            </span>
            <div>
              <p
                className={`text-[10px] uppercase tracking-[0.22em] font-semibold ${
                  isDark ? 'text-[#0ECCEE]' : 'text-cyan-700'
                }`}
              >
                Free pass
              </p>
              <h2
                className={`text-lg sm:text-xl font-bold leading-tight ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
                style={{ fontFamily: 'Outfit, Poppins, sans-serif' }}
              >
                Auditorium night
              </h2>
            </div>
          </div>
          <p className={`text-sm ${isDark ? 'text-white/45' : 'text-gray-600'}`}>
            Photo ticket · year-wise seats
            {left != null && open ? (
              <span className={isDark ? ' text-[#7DE8F7]' : ' text-cyan-700'}>
                {' '}· {left} left
              </span>
            ) : null}
          </p>
        </div>

        {open ? (
          <Link
            to={meta?.registerUrl || '/mindspark/auditorium'}
            className={`inline-flex items-center justify-center gap-2 shrink-0 px-5 py-3 rounded-xl text-sm font-bold transition active:scale-[0.98] ${
              isDark
                ? 'bg-[#0ECCEE] text-black shadow-[0_10px_30px_-12px_rgba(14,204,238,0.75)]'
                : 'bg-cyan-600 text-white'
            }`}
          >
            Get your pass
            <ArrowRight size={16} />
          </Link>
        ) : (
          <p
            className={`text-xs font-medium shrink-0 ${
              isDark ? 'text-amber-200/90' : 'text-amber-800'
            }`}
          >
            Opens soon
          </p>
        )}
      </div>
    </section>
  );
}

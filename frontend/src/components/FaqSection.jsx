import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronDown,
  HelpCircle,
  Sparkles,
  Trophy,
  Compass,
  Activity,
  Ticket,
  Building2,
} from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';
import faqsData from '../mock/faqs.json';

const ICON_MAP = {
  Sparkles,
  Trophy,
  Compass,
  Activity,
  Ticket,
  Building2,
  HelpCircle,
};

export default function FaqSection({
  category = 'all',
  limit = 5,
  title = 'Frequently Asked Questions',
  subtitle = 'Find answers to common questions about discovering, registering, and hosting events on CrwdCtrl.',
  showViewAll = true,
  className = '',
}) {
  const { isDark } = useDarkMode();
  const [openId, setOpenId] = useState(null);

  const items = useMemo(() => {
    let list = faqsData.items || [];

    if (category && category !== 'all') {
      list = list.filter((item) => item.category === category);
    }

    return limit ? list.slice(0, limit) : list;
  }, [category, limit]);

  if (!items.length) return null;

  return (
    <section
      aria-labelledby="faq-heading"
      className={`mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 ${className}`}
    >
      <div
        className={`rounded-3xl border p-6 transition-all duration-300 sm:p-8 ${isDark
            ? 'border-white/10 bg-[#0B0D13]/90 shadow-xl'
            : 'border-gray-200 bg-white shadow-sm'
          }`}
      >
        <div className="mb-6 flex flex-col justify-between gap-4 border-b border-white/5 pb-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="h-4 w-2 rounded-full bg-cyan-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Help &amp; Information
              </span>
            </div>

            <h2
              id="faq-heading"
              className={`text-xl font-black sm:text-2xl ${isDark ? 'text-white' : 'text-gray-900'
                }`}
            >
              {title}
            </h2>

            {subtitle && (
              <p
                className={`mt-1 text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
              >
                {subtitle}
              </p>
            )}
          </div>

          {showViewAll && (
            <Link
              to="/faq"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-bold text-cyan-400 transition-colors hover:text-cyan-300"
            >
              <span>View All FAQs</span>
              <span aria-hidden="true">→</span>
            </Link>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const itemId = item.id ?? item.question ?? index;
            const isOpen = openId === itemId;
            const IconComponent = ICON_MAP[item.icon] || HelpCircle;
            const buttonId = `faq-button-${index}`;
            const panelId = `faq-panel-${index}`;

            return (
              <div
                key={itemId}
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${isOpen
                    ? isDark
                      ? 'border-cyan-400/40 bg-white/[0.05]'
                      : 'border-cyan-400/50 bg-cyan-50/50'
                    : isDark
                      ? 'border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                      : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                  }`}
              >
                <h3 className="m-0">
                  <button
                    id={buttonId}
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : itemId)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-xl border ${isOpen
                            ? 'border-cyan-400/40 bg-cyan-400/20 text-cyan-400'
                            : isDark
                              ? 'border-white/10 bg-white/5 text-gray-400'
                              : 'border-gray-300 bg-gray-200/60 text-gray-700'
                          }`}
                      >
                        <IconComponent size={14} aria-hidden="true" />
                      </span>

                      <span
                        className={`text-xs font-bold sm:text-sm ${isOpen
                            ? isDark
                              ? 'text-cyan-300'
                              : 'text-cyan-700'
                            : isDark
                              ? 'text-gray-200'
                              : 'text-gray-800'
                          }`}
                      >
                        {item.question}
                      </span>
                    </span>

                    <ChevronDown
                      size={16}
                      aria-hidden="true"
                      className={`shrink-0 transition-transform duration-300 ${isOpen
                          ? 'rotate-180 text-cyan-400'
                          : isDark
                            ? 'text-gray-500'
                            : 'text-gray-400'
                        }`}
                    />
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="border-t border-white/5 px-4 pb-4 pt-3 text-xs leading-relaxed sm:px-5 sm:text-[13px]"
                >
                  <p className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                    {item.answer}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
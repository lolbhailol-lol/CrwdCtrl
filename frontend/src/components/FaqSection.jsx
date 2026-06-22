import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

/**
 * Reusable, accessible FAQ accordion.
 *
 * Renders the same Q/A content that pages also publish as FAQPage JSON-LD, so
 * visible content and structured data stay in sync — important for SEO rich
 * results and for answer engines that quote on-page text. Questions are real
 * headings (good for AEO/GEO extraction) and the panels are keyboard- and
 * screen-reader-friendly.
 */
export default function FaqSection({
  items = [],
  title = 'Frequently asked questions',
  className = '',
}) {
  const { isDark } = useDarkMode();
  const [openIndex, setOpenIndex] = useState(0);

  if (!items.length) return null;

  return (
    <section
      aria-labelledby="faq-heading"
      className={`mx-auto w-full max-w-3xl px-4 py-10 ${className}`}
    >
      <h2
        id="faq-heading"
        className={`mb-5 text-center text-xl font-bold sm:text-2xl ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}
      >
        {title}
      </h2>

      <div className="space-y-3">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          const panelId = `faq-panel-${index}`;
          const buttonId = `faq-button-${index}`;
          return (
            <div
              key={item.question}
              className={`overflow-hidden rounded-2xl border transition-colors ${
                isDark ? 'border-gray-800 bg-[#161718]' : 'border-gray-200 bg-white'
              }`}
            >
              <h3 className="m-0">
                <button
                  id={buttonId}
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? -1 : index)}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-4 text-left text-sm font-semibold sm:text-base ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#0ECCEE] transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </h3>
              <div
                id={panelId}
                role="region"
                aria-labelledby={buttonId}
                hidden={!isOpen}
                className={`px-4 pb-4 text-sm leading-relaxed ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}
              >
                {item.answer}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

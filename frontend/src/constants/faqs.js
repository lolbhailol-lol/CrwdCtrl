/**
 * Canonical FAQ content for CrwdCtrl.
 *
 * Single source of truth shared by the visible <FaqSection> UI, the runtime
 * <Seo> FAQPage JSON-LD, and the build-time prerender script. Keeping the
 * questions/answers identical across visible content and structured data keeps
 * the markup legitimate for Google rich results and maximally useful for answer
 * engines (ChatGPT, Perplexity, Gemini, Claude) and AI Overviews.
 *
 * Answers are written answer-first, factual and self-contained so a generative
 * engine can quote a single Q/A without needing surrounding context.
 */

import faqsData from '../mock/faqs.json';

const getFaqsByCategory = (cat) =>
  faqsData.items
    .filter((item) => item.category === cat)
    .map(({ question, answer }) => ({ question, answer }));

export const HOME_FAQ = [
  ...getFaqsByCategory('general'),
  ...getFaqsByCategory('fests').slice(0, 1),
];

export const ABOUT_FAQ = getFaqsByCategory('general');

export const FESTS_FAQ = getFaqsByCategory('fests');

export const TREKS_FAQ = getFaqsByCategory('treks');

export const SPORTS_FAQ = getFaqsByCategory('sports');

export const EVENTS_FAQ = getFaqsByCategory('events');

export const ORGANIZERS_FAQ = getFaqsByCategory('organizers');

export const PAYMENTS_FAQ = getFaqsByCategory('payments');

export default faqsData;


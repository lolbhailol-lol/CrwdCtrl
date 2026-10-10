import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  HelpCircle,
  Search,
  Sparkles,
  RotateCw,
  Compass,
  Trophy,
  Activity,
  Ticket,
  Building2,
  Calendar,
  MessageCircle,
  ArrowRight,
  X,
  CheckCircle2,
} from 'lucide-react';
import { useDarkMode } from '../../context/DarkModeContext';
import Seo from '../../components/Seo';
import { breadcrumbSchema, faqSchema, webPageSchema } from '../../utils/seo';

import faqsData from '../../mock/faqs.json';

const ICON_MAP = {
  Sparkles,
  Trophy,
  Compass,
  Activity,
  Ticket,
  Building2,
  Calendar,
  HelpCircle,
};

const FAQ_ITEMS = faqsData.items.map((item) => ({
  ...item,
  icon: ICON_MAP[item.icon] || HelpCircle,
}));

const CATEGORIES = faqsData.categories.map((cat) => ({
  id: cat.id,
  label: cat.label,
  icon:
    cat.id === 'fests'
      ? Trophy
      : cat.id === 'treks'
      ? Compass
      : cat.id === 'sports'
      ? Activity
      : cat.id === 'payments' || cat.id === 'tickets'
      ? Ticket
      : cat.id === 'organizers'
      ? Building2
      : cat.id === 'general'
      ? Sparkles
      : HelpCircle,
}));

function FaqFlipCard({ item, isDark }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const IconComponent = item.icon || HelpCircle;

  return (
    <div
      onClick={() => setIsFlipped((prev) => !prev)}
      className="group [perspective:1000px] relative h-[290px] sm:h-[280px] w-full cursor-pointer select-none"
      aria-label={`Question: ${item.question}`}
    >
      <div
        className={`relative w-full h-full [transform-style:preserve-3d] transition-transform duration-500 will-change-transform ${
          isFlipped ? '[transform:rotateY(180deg)]' : 'group-hover:[transform:rotateY(180deg)]'
        }`}
      >
        {/* ================= FRONT SIDE (Question) ================= */}
        <div
          className={`absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(0deg)] z-10 p-5 sm:p-6 flex flex-col justify-between rounded-2xl border transition-all duration-300 ${
            isDark
              ? 'bg-[#15171C] border-white/10 group-hover:border-[#0ECCEE]/50 group-hover:shadow-[0_0_25px_rgba(14,204,238,0.18)]'
              : 'bg-white border-gray-200 group-hover:border-[#0ECCEE] group-hover:shadow-[0_0_25px_rgba(14,204,238,0.18)] shadow-sm'
          }`}
        >
          {/* Top metadata */}
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase ${
                isDark
                  ? 'bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30'
                  : 'bg-[#0ECCEE]/10 text-[#0094b3] border border-[#0ECCEE]/30'
              }`}
            >
              <IconComponent className="w-3 h-3" />
              <span>{item.categoryLabel}</span>
            </span>

            <span
              className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                isDark ? 'bg-white/5 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}
            >
              Flip ↻
            </span>
          </div>

          {/* Question Text */}
          <div className="my-auto py-2">
            <h3
              className={`text-base sm:text-lg font-bold leading-snug tracking-tight transition-colors line-clamp-3 ${
                isDark
                  ? 'text-white group-hover:text-[#0ECCEE]'
                  : 'text-gray-900 group-hover:text-[#0094b3]'
              }`}
            >
              {item.question}
            </h3>
          </div>

          {/* Bottom Flip Indicator */}
          <div
            className={`flex items-center justify-between pt-3 border-t text-xs font-medium ${
              isDark ? 'border-white/5 text-gray-400' : 'border-gray-100 text-gray-500'
            }`}
          >
            <span className="flex items-center gap-1.5 group-hover:text-[#0ECCEE] transition-colors">
              <span className="hidden sm:inline">Hover to reveal answer</span>
              <span className="sm:hidden">Tap to reveal answer</span>
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#0ECCEE]/10 text-[#0ECCEE] transition-transform duration-500 group-hover:rotate-180">
              <RotateCw className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>

        {/* ================= BACK SIDE (Answer) ================= */}
        <div
          className={`absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)] p-5 sm:p-6 flex flex-col justify-between rounded-2xl border transition-all duration-300 ${
            isDark
              ? 'bg-gradient-to-br from-[#12161E] via-[#151B24] to-[#11141A] border-[#0ECCEE]/40 shadow-[0_0_30px_rgba(14,204,238,0.2)]'
              : 'bg-gradient-to-br from-white via-cyan-50/30 to-blue-50/20 border-[#0ECCEE]/40 shadow-[0_0_30px_rgba(14,204,238,0.15)]'
          }`}
        >
          {/* Top metadata */}
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              <span>Answer</span>
            </span>

            <span
              className={`text-[10px] uppercase font-bold tracking-wider ${
                isDark ? 'text-gray-400' : 'text-gray-500'
              }`}
            >
              {item.categoryLabel}
            </span>
          </div>

          {/* Answer Text */}
          <div className="my-auto py-2 overflow-y-auto max-h-[155px] pr-1">
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                isDark ? 'text-gray-200' : 'text-gray-700'
              }`}
            >
              {item.answer}
            </p>
          </div>

          {/* Bottom Flip Indicator */}
          <div
            className={`flex items-center justify-between pt-3 border-t text-xs font-medium ${
              isDark ? 'border-white/5 text-gray-400' : 'border-gray-100 text-gray-500'
            }`}
          >
            <span className="text-[#0ECCEE]">
              <span className="hidden sm:inline">Hover away to flip back</span>
              <span className="sm:hidden">Tap to flip back</span>
            </span>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#0ECCEE]/15 text-[#0ECCEE] transition-transform duration-500 group-hover:rotate-180">
              <RotateCw className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FAQPage() {
  const { isDark } = useDarkMode();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        item.question.toLowerCase().includes(query) ||
        item.answer.toLowerCase().includes(query) ||
        item.categoryLabel.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [searchQuery, selectedCategory]);

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${
        isDark ? 'bg-[#0B0C0E] text-white' : 'bg-gray-50 text-gray-900'
      }`}
    >
      <Seo
        title="Frequently Asked Questions (FAQ) | CrwdCtrl"
        description="Find answers to all frequently asked questions about booking college fests, trekking trips, running events, QR tickets, refunds, and organizing events on CrwdCtrl."
        canonical="/faq"
        jsonLd={[
          webPageSchema({
            name: 'Frequently Asked Questions (FAQ) — CrwdCtrl',
            description:
              'Answers to questions about college fests, adventure treks, sports runs, ticket passes, and organizer tools on CrwdCtrl.',
            url: '/faq',
          }),
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'FAQ', path: '/faq' },
          ]),
          faqSchema(
            FAQ_ITEMS.map((item) => ({
              question: item.question,
              answer: item.answer,
            }))
          ),
        ]}
      />

      {/* ================= HERO SECTION ================= */}
      <section className="relative pt-12 pb-12 sm:pt-16 sm:pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto overflow-hidden">
        {/* Ambient background glow effects */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-gradient-to-b from-[#0ECCEE]/15 to-transparent blur-3xl opacity-60" />

        <div className="relative text-center max-w-4xl mx-auto">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0ECCEE]/10 text-[#0ECCEE] border border-[#0ECCEE]/30 mb-5 shadow-lg shadow-[#0ECCEE]/10">
            <Sparkles className="w-3.5 h-3.5 text-[#0ECCEE]" />
            <span>Got Questions? We’ve Got Answers</span>
          </div>

          {/* Large Hero Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight sm:leading-tight">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-[#0ECCEE] via-[#38bdf8] to-[#00b4d8] bg-clip-text text-transparent">
              Questions
            </span>
          </h1>

          {/* Short description below heading */}
          <p
            className={`mt-4 text-sm sm:text-base md:text-lg max-w-2xl mx-auto leading-relaxed ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            Find quick answers to common questions about ticket bookings, event registrations, treks, refund policies, and community events on CrwdCtrl.
          </p>

          {/* Quick Search Input */}
          <div className="mt-8 max-w-xl mx-auto relative">
            <div
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-200 shadow-lg ${
                isDark
                  ? 'bg-[#15171C] border-white/10 focus-within:border-[#0ECCEE] focus-within:ring-2 focus-within:ring-[#0ECCEE]/30'
                  : 'bg-white border-gray-200 focus-within:border-[#0ECCEE] focus-within:ring-2 focus-within:ring-[#0ECCEE]/30 shadow-gray-200/50'
              }`}
            >
              <Search className="w-5 h-5 text-[#0ECCEE] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search any question (e.g. what is crwdctrl, fests, refund, organizer)..."
                className={`w-full bg-transparent text-sm outline-none placeholder:text-gray-400 ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Interactive Flip Hint Banner */}
          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#0ECCEE]/5 border border-[#0ECCEE]/20 text-[#0ECCEE]">
            <RotateCw className="w-3.5 h-3.5 animate-spin-slow" />
            <span>Hover on any card below to flip it and read the answer!</span>
          </div>

          {/* Category Filter Pills */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  type="button"
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0ECCEE] to-[#00b4d8] text-black shadow-md shadow-[#0ECCEE]/25 font-extrabold'
                      : isDark
                      ? 'bg-[#15171C] text-gray-300 border border-white/10 hover:border-white/20 hover:text-white'
                      : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:text-gray-900 shadow-2xs'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ================= QUESTION & ANSWER 3D FLIP CARDS GRID ================= */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto pb-16">
        {filteredFaqs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
            {filteredFaqs.map((item) => (
              <FaqFlipCard key={item.id} item={item} isDark={isDark} />
            ))}
          </div>
        ) : (
          <div
            className={`text-center py-16 px-4 rounded-3xl border ${
              isDark ? 'bg-[#15171C] border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <HelpCircle className="w-12 h-12 text-[#0ECCEE] mx-auto mb-3 opacity-60" />
            <h3 className="text-lg font-bold mb-1">No matching questions found</h3>
            <p
              className={`text-sm max-w-md mx-auto mb-5 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              We couldn't find any questions matching "{searchQuery}". Try searching with different keywords or clear the filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0ECCEE] to-[#00b4d8] text-black font-extrabold text-xs shadow-md shadow-[#0ECCEE]/25 cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* ================= STILL HAVE QUESTIONS CTA BOX ================= */}
        <div
          className={`mt-16 p-7 sm:p-10 rounded-3xl border transition-all duration-300 relative overflow-hidden text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-6 ${
            isDark
              ? 'bg-gradient-to-r from-[#11141B] via-[#141A24] to-[#12161F] border-white/10'
              : 'bg-gradient-to-r from-blue-50/60 via-cyan-50/40 to-slate-50 border-gray-200'
          }`}
        >
          <div className="relative z-10 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#0ECCEE]/10 text-[#0ECCEE] mb-2.5">
              <MessageCircle className="w-3.5 h-3.5" />
              <span>24/7 Support</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
              Still have questions? We’re here to help!
            </h3>
            <p
              className={`text-xs sm:text-sm leading-relaxed ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              }`}
            >
              Can’t find what you’re looking for? Reach out to our support team and we will assist you right away.
            </p>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/contact-us"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#0ECCEE] to-[#00b4d8] text-black font-extrabold text-sm shadow-lg shadow-[#0ECCEE]/25 hover:shadow-xl hover:shadow-[#0ECCEE]/35 active:scale-[0.98] transition-all duration-200 inline-flex items-center gap-2 cursor-pointer"
            >
              <span>Contact Support</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a
              href="mailto:support@crwdctrl.com"
              className={`px-5 py-3 rounded-xl border text-sm font-semibold transition-all duration-200 ${
                isDark
                  ? 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              Email Us
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

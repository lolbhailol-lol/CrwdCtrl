import { useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useHeroSearch } from '../hooks/useHeroSearch';
import HeroSearchBar from './HeroSearchBar';
import { getSearchResultSubtitle, getSearchResultTitle } from './HeroSearchDropdown';
import { getImageUrl } from '../utils/imageImports';
import { navigateToSearchResult } from '../utils/searchNavigation';
import {
  mobileSearchHeader,
  mobileSearchPage,
  searchResultRow,
  staggerContainer,
} from '../motion/variants';
import { STAGGER, DURATION } from '../motion/tokens';
import { useMotionSafe } from '../motion/utils';

function getSearchResultDescription(result) {
  const raw = result.description
    || result.subtitle
    || result._subtitle
    || result.organizing_body
    || result.collegeName
    || result.basedIn
    || '';
  const text = String(raw).trim();
  if (text.length > 12) return text;
  return getSearchResultSubtitle(result);
}

function MobileSearchResultRow({ result, isDark, onClick, index = 0 }) {
  const image = result.image || result.coverImage || result._image;
  const title = getSearchResultTitle(result);
  const { reduced } = useMotionSafe();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      custom={index}
      variants={reduced ? undefined : searchResultRow}
      initial={reduced ? false : 'hidden'}
      animate={reduced ? undefined : 'visible'}
      whileTap={{ scale: 0.99 }}
      className={`mobile-search-result w-full flex items-start gap-3.5 px-4 py-3.5 text-left transition-colors
        ${isDark ? 'hover:bg-white/5 border-b border-white/10' : 'hover:bg-gray-50 border-b border-gray-100'}`}
    >
      {image ? (
        <img
          src={getImageUrl(image, { preset: 'thumb' })}
          alt=""
          className="mobile-search-result__thumb shrink-0 rounded-xl object-cover"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      ) : (
        <div className={`mobile-search-result__thumb shrink-0 rounded-xl flex items-center justify-center text-sm font-bold
          ${isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
          {title.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1 pt-0.5">
        <p className={`text-[0.9375rem] font-semibold leading-snug ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {title}
        </p>
        <p className={`mt-1 text-xs leading-relaxed line-clamp-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {getSearchResultDescription(result)}
        </p>
      </div>
    </motion.button>
  );
}

export default function MobileSearchOverlay({ session, onClose }) {
  const { isDark } = useDarkMode();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { reduced } = useMotionSafe();

  const handleNavigate = useCallback((result) => {
    if (session.onResultNavigate) {
      session.onResultNavigate(result);
    } else {
      navigateToSearchResult(navigate, result);
    }
    onClose();
  }, [session, navigate, onClose]);

  const heroSearch = useHeroSearch({
    quickPickItems: session.quickPickItems,
    keywordCatalog: session.keywordCatalog,
    onResultNavigate: handleNavigate,
    maxResults: 20,
  });

  useEffect(() => {
    if (session.initialQuery) {
      heroSearch.setSearchQuery(session.initialQuery);
    }

    const focusDelay = reduced ? 0 : DURATION.normal * 1000 + 40;
    const focusTimer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, focusDelay);

    return () => {
      window.clearTimeout(focusTimer);
    };
  }, []);

  const handleClear = useCallback(() => {
    if (heroSearch.searchQuery.trim()) {
      heroSearch.clearSearch();
      inputRef.current?.focus();
    } else {
      onClose();
    }
  }, [heroSearch, onClose]);

  const hasQuery = heroSearch.searchQuery.trim().length > 0;

  return (
    <motion.div
      className={`mobile-search-overlay lg:hidden ${isDark ? 'mobile-search-overlay--dark' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      variants={reduced ? undefined : mobileSearchPage}
      initial={reduced ? false : 'initial'}
      animate={reduced ? undefined : 'animate'}
      exit={reduced ? undefined : 'exit'}
    >
      <motion.header
        className="mobile-search-overlay__header"
        variants={reduced ? undefined : mobileSearchHeader}
        initial={reduced ? false : 'initial'}
        animate={reduced ? undefined : 'animate'}
        exit={reduced ? undefined : 'exit'}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className="mobile-search-overlay__back touch-target"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={2} aria-hidden />
        </button>
        <div className="mobile-search-overlay__bar">
          <HeroSearchBar
            value={heroSearch.searchQuery}
            inputId="mobile-hero-search-overlay"
            onChange={(e) => heroSearch.setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') heroSearch.handleEnter(); }}
            onClear={handleClear}
            placeholder={session.placeholder}
            isDark={isDark}
            inputRef={inputRef}
            variant="overlay"
            alwaysShowClear
            className="mobile-search-overlay__search-bar"
          />
        </div>
        <span className="mobile-search-overlay__header-spacer" aria-hidden />
      </motion.header>

      <div className="mobile-search-overlay__body">
        {!hasQuery ? (
          <motion.p
            className={`mobile-search-overlay__hint px-4 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}
            initial={reduced ? false : { opacity: 0, y: 8 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: DURATION.fast, delay: 0.08 }}
          >
            Search fests, treks, sports events and more
          </motion.p>
        ) : heroSearch.isSearching && heroSearch.mergedResults.length === 0 ? (
          <div className="flex items-center gap-2 px-4 py-6">
            <Loader2 size={18} className="animate-spin text-gray-400" />
            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Searching…</span>
          </div>
        ) : heroSearch.mergedResults.length > 0 ? (
          <motion.div
            className="mobile-search-overlay__results"
            variants={reduced ? undefined : staggerContainer(STAGGER.fast)}
            initial={reduced ? false : 'hidden'}
            animate={reduced ? undefined : 'visible'}
          >
            {heroSearch.mergedResults.map((result, index) => (
              <MobileSearchResultRow
                key={`${result.resultType || result._type}-${result.id || result._id}`}
                result={result}
                isDark={isDark}
                index={index}
                onClick={() => heroSearch.handleResultClick(result)}
              />
            ))}
          </motion.div>
        ) : (
          <motion.p
            className={`px-4 py-6 text-sm text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? undefined : { opacity: 1 }}
            transition={{ duration: DURATION.fast }}
          >
            No results for &ldquo;{heroSearch.searchQuery.trim()}&rdquo;
          </motion.p>
        )}
      </div>
    </motion.div>
  );
}

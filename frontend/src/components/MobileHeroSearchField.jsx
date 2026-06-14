import { useCallback } from 'react';
import HeroSearchBar from './HeroSearchBar';
import HeroSearchDropdown from './HeroSearchDropdown';
import { useMobileSearchOptional } from '../context/MobileSearchContext';

/**
 * Mobile: tap opens full-screen search. Desktop (lg+): inline bar + dropdown.
 */
export default function MobileHeroSearchField({
  isDark = false,
  placeholder = 'search college, fest',
  quickPickItems = [],
  keywordCatalog = [],
  onResultNavigate,
  desktopRef,
  desktopSearch,
  className = '',
}) {
  const mobileSearch = useMobileSearchOptional();

  const openMobileSearch = useCallback(() => {
    mobileSearch?.openSearch({
      placeholder,
      quickPickItems,
      keywordCatalog,
      onResultNavigate,
    });
  }, [mobileSearch, placeholder, quickPickItems, keywordCatalog, onResultNavigate]);

  const handleMobileFocus = useCallback((e) => {
    e.preventDefault();
    e.target.blur();
    openMobileSearch();
  }, [openMobileSearch]);

  return (
    <>
      <div className={`lg:hidden ${className}`}>
        <HeroSearchBar
          readOnly
          value=""
          inputId="mobile-hero-search-trigger"
          placeholder={placeholder}
          isDark={isDark}
          onFocus={handleMobileFocus}
          onClick={openMobileSearch}
        />
      </div>

      {desktopSearch && (
        <div className={`relative hidden lg:block ${className}`} ref={desktopRef}>
          <HeroSearchBar
            value={desktopSearch.searchQuery}
            inputId="desktop-hero-search"
            onChange={(e) => desktopSearch.setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') desktopSearch.handleEnter(); }}
            onClear={desktopSearch.clearSearch}
            placeholder={placeholder}
            isDark={isDark}
          />
          <HeroSearchDropdown
            isOpen={desktopSearch.isOpen}
            isSearching={desktopSearch.isSearching}
            searchQuery={desktopSearch.searchQuery}
            results={desktopSearch.mergedResults}
            popularTerms={desktopSearch.popularTerms}
            isDark={isDark}
            onResultClick={desktopSearch.handleResultClick}
            onSuggestionClick={desktopSearch.applySuggestion}
            className="absolute left-0 right-0 top-full mt-1"
          />
        </div>
      )}
    </>
  );
}

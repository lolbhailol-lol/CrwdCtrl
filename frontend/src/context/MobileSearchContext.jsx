import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const MobileSearchContext = createContext(null);

export function MobileSearchProvider({ children }) {
  const [session, setSession] = useState(null);
  const sessionIdRef = useRef(0);

  const openSearch = useCallback((options = {}) => {
    sessionIdRef.current += 1;
    setSession({
      id: sessionIdRef.current,
      placeholder: options.placeholder ?? 'search college, fest',
      quickPickItems: options.quickPickItems ?? [],
      keywordCatalog: options.keywordCatalog ?? [],
      onResultNavigate: options.onResultNavigate ?? null,
      initialQuery: options.initialQuery ?? '',
    });
  }, []);

  const closeSearch = useCallback(() => {
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      isOpen: Boolean(session),
      session,
      openSearch,
      closeSearch,
    }),
    [session, openSearch, closeSearch],
  );

  return (
    <MobileSearchContext.Provider value={value}>
      {children}
    </MobileSearchContext.Provider>
  );
}

export function useMobileSearch() {
  const ctx = useContext(MobileSearchContext);
  if (!ctx) {
    throw new Error('useMobileSearch must be used within MobileSearchProvider');
  }
  return ctx;
}

export function useMobileSearchOptional() {
  return useContext(MobileSearchContext);
}

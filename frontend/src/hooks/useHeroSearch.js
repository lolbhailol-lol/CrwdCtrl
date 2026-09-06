import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSearchKeywords, searchAll } from '../services/searchService';
import {
    FALLBACK_SEARCH_TERMS,
    filterItemsByQuery,
    filterPopularTerms,
    getSearchResultTitle,
    saveRecentSearch,
    getRecentSearches,
    clearRecentSearches,
} from '../utils/heroSearchSuggestions';
import { mergeKeywordLists } from '../utils/buildSearchKeywords';

const MIN_SEARCH_CHARS = 1;
const DEBOUNCE_MS = 250;

/**
 * Hero search — suggestions appear only after the user starts typing.
 */
export function useHeroSearch({ quickPickItems = [], keywordCatalog = [], onResultNavigate, maxResults = 8 } = {}) {
    const [searchQuery, setSearchQueryState] = useState('');
    const [apiResults, setApiResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [apiKeywords, setApiKeywords] = useState([]);
    const [recentSearches, setRecentSearches] = useState(() => getRecentSearches());
    const searchRef = useRef(null);

    const refreshRecent = useCallback(() => {
        setRecentSearches(getRecentSearches());
    }, []);

    const clearRecent = useCallback(() => {
        clearRecentSearches();
        setRecentSearches([]);
    }, []);

    useEffect(() => {
        let cancelled = false;
        fetchSearchKeywords().then((keywords) => {
            if (!cancelled) setApiKeywords(keywords);
        });
        return () => { cancelled = true; };
    }, []);

    const allKeywords = useMemo(
        () => mergeKeywordLists(keywordCatalog, apiKeywords, FALLBACK_SEARCH_TERMS),
        [keywordCatalog, apiKeywords],
    );

    const popularTerms = useMemo(
        () => filterPopularTerms(searchQuery, allKeywords),
        [searchQuery, allKeywords],
    );

    const localMatches = useMemo(
        () => filterItemsByQuery(quickPickItems, searchQuery).slice(0, 5),
        [quickPickItems, searchQuery],
    );

    const mergedResults = useMemo(() => {
        const q = searchQuery.trim();
        if (!q) return [];
        const seen = new Set();
        const out = [];
        const add = (item) => {
            const key = `${item.resultType || item._type || 'item'}-${item.id || item._id}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(item);
        };
        localMatches.forEach(add);
        apiResults.forEach(add);
        return out.slice(0, maxResults);
    }, [searchQuery, localMatches, apiResults, maxResults]);

    const setSearchQuery = useCallback((value) => {
        setSearchQueryState(value);
        setIsOpen(Boolean(String(value).trim()));
    }, []);

    const openSuggestions = useCallback(() => {
        refreshRecent();
        setIsOpen(true);
    }, [refreshRecent]);

    useEffect(() => {
        const q = searchQuery.trim();
        if (q.length < MIN_SEARCH_CHARS) {
            setApiResults([]);
            setIsSearching(false);
            return undefined;
        }

        let cancelled = false;
        setIsSearching(true);

        const timer = setTimeout(async () => {
            try {
                const results = await searchAll(q);
                if (cancelled) return;
                const combined = [
                    ...results.fests.map((fest) => ({ ...fest, resultType: 'fest' })),
                    ...results.competitions.map((comp) => ({ ...comp, resultType: 'competition' })),
                ];
                setApiResults(combined);
            } catch {
                if (!cancelled) setApiResults([]);
            } finally {
                if (!cancelled) setIsSearching(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [searchQuery]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
        return undefined;
    }, [isOpen]);

    const applySuggestion = useCallback((term) => {
        setSearchQuery(term);
    }, [setSearchQuery]);

    const handleResultClick = useCallback((result) => {
        const label = getSearchResultTitle(result);
        if (label && label !== 'Untitled') {
            saveRecentSearch(label);
            refreshRecent();
        }
        setSearchQueryState('');
        setIsOpen(false);
        onResultNavigate?.(result);
    }, [onResultNavigate, refreshRecent]);

    const handleEnter = useCallback(() => {
        if (mergedResults.length > 0) {
            handleResultClick(mergedResults[0]);
            return;
        }
        const term = searchQuery.trim();
        if (term) applySuggestion(term);
    }, [mergedResults, searchQuery, handleResultClick, applySuggestion]);

    const clearSearch = useCallback(() => {
        setSearchQueryState('');
        setApiResults([]);
        setIsOpen(false);
    }, []);

    return {
        searchRef,
        searchQuery,
        setSearchQuery,
        isOpen,
        isSearching,
        popularTerms,
        mergedResults,
        recentSearches,
        refreshRecent,
        clearRecent,
        openSuggestions,
        applySuggestion,
        handleResultClick,
        handleEnter,
        clearSearch,
    };
}

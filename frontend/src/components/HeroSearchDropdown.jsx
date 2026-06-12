import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Search } from 'lucide-react';
import { getImageUrl } from '../utils/imageImports';
import { getSearchResultTitle } from '../utils/heroSearchSuggestions';
import { searchPanel, searchResultRow, staggerContainer } from '../motion/variants';
import { STAGGER } from '../motion/tokens';

export { getSearchResultTitle };

export function getSearchResultSubtitle(result) {
    const type = result.resultType || result._type;
    const kind = type === 'competition' ? 'Competition'
        : type === 'trek' ? 'Trek'
        : type === 'community' ? 'Community'
        : type === 'sport' ? 'Sports'
        : 'Fest';
    const org = result.organizing_body || result.collegeName || result.subtitle || result._subtitle || result.basedIn || '';
    return org ? `${kind} · ${org}` : kind;
}

function SuggestionChip({ label, isDark, onClick, index = 0 }) {
    return (
        <motion.button
            type="button"
            onClick={onClick}
            custom={index}
            variants={searchResultRow}
            initial="hidden"
            animate="visible"
            whileTap={{ scale: 0.96 }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0
                ${isDark
                    ? 'bg-[#1D1E20] text-gray-200 border border-gray-600 hover:border-[#0ECCEE]/50'
                    : 'bg-gray-100 text-gray-700 border border-gray-200 hover:border-[#0ECCEE]/40'}`}
        >
            {label}
        </motion.button>
    );
}

function ResultRow({ result, isDark, onClick, index = 0 }) {
    const image = result.image || result.coverImage || result._image;
    const title = getSearchResultTitle(result);
    return (
        <motion.button
            type="button"
            onClick={onClick}
            custom={index}
            variants={searchResultRow}
            initial="hidden"
            animate="visible"
            whileHover={{ x: 2 }}
            whileTap={{ scale: 0.99 }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors
                ${isDark ? 'hover:bg-gray-800 border-b border-gray-700/50 last:border-b-0' : 'hover:bg-gray-50 border-b border-gray-100 last:border-b-0'}`}
        >
            {image ? (
                <img
                    src={getImageUrl(image, { preset: 'thumb' })}
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
            ) : (
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold
                    ${(result.resultType || result._type) === 'competition'
                        ? 'bg-orange-100 text-orange-600'
                        : isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                    {title.charAt(0).toUpperCase()}
                </div>
            )}
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{title}</p>
                <p className={`text-xs truncate ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                    {getSearchResultSubtitle(result)}
                </p>
            </div>
        </motion.button>
    );
}

/**
 * Search dropdown — slide-in panel with staggered results.
 */
export default function HeroSearchDropdown({
    isOpen,
    isSearching,
    searchQuery,
    results = [],
    popularTerms = [],
    isDark,
    onResultClick,
    onSuggestionClick,
    className = 'absolute left-0 right-0 top-full mt-1',
}) {
    const hasQuery = searchQuery.trim().length > 0;
    const panelClass = `rounded-2xl shadow-2xl border z-50 overflow-hidden max-h-[min(70vh,420px)] overflow-y-auto ${
        isDark ? 'bg-[#111213] border-gray-700' : 'bg-white border-gray-200'
    }`;

    return (
        <AnimatePresence>
            {isOpen && hasQuery && (
                <motion.div
                    className={`${className} ${panelClass}`}
                    variants={searchPanel}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                >
                    {isSearching && !results.length && !popularTerms.length ? (
                        <div className="flex items-center gap-2 px-4 py-3">
                            <Loader2 size={14} className="animate-spin text-gray-400" />
                            <span className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Searching…</span>
                        </div>
                    ) : (
                        <>
                            {popularTerms.length > 0 && (
                                <div className="pb-1 border-b border-gray-700/30">
                                    <motion.div
                                        className="flex flex-wrap gap-2 px-4 py-3"
                                        variants={staggerContainer(STAGGER.fast)}
                                        initial="hidden"
                                        animate="visible"
                                    >
                                        {popularTerms.map((term, i) => (
                                            <SuggestionChip
                                                key={term}
                                                label={term}
                                                isDark={isDark}
                                                index={i}
                                                onClick={() => onSuggestionClick?.(term)}
                                            />
                                        ))}
                                    </motion.div>
                                </div>
                            )}

                            {results.length > 0 ? (
                                results.map((result, i) => (
                                    <ResultRow
                                        key={`${result.resultType || result._type}-${result.id || result._id}`}
                                        result={result}
                                        isDark={isDark}
                                        index={i}
                                        onClick={() => onResultClick?.(result)}
                                    />
                                ))
                            ) : !isSearching ? (
                                <motion.div
                                    className="flex flex-col items-center gap-2 px-4 py-5 text-center"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <Search size={20} className="text-gray-400" />
                                    <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                                        No results for &ldquo;{searchQuery.trim()}&rdquo;
                                    </p>
                                </motion.div>
                            ) : null}
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

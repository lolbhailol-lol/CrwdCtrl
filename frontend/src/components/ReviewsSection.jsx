import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Quote } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

/**
 * ReviewsSection component
 * Designed for dynamic API data injection via `reviews` prop or admin config.
 */
export default function ReviewsSection({
    reviews: customReviews,
    title = 'What our users say',
    subheading = "Real experiences from the CrwdCtrl community. See how we're helping people discover, attend and enjoy the best events around them.",
    badgeText = 'Real People, Real Experiences',
    className = '',
}) {
    const { isDark } = useDarkMode();
    const reviewsList = useMemo(() => {
        return (Array.isArray(customReviews) && customReviews.length > 0) ? customReviews : [];
    }, [customReviews]);

    const itemsPerPage = 4;
    const totalPages = Math.ceil(reviewsList.length / itemsPerPage);
    const [currentPage, setCurrentPage] = useState(0);

    const handlePrev = () => {
        setCurrentPage((prev) => (prev > 0 ? prev - 1 : totalPages - 1));
    };

    const handleNext = () => {
        setCurrentPage((prev) => (prev < totalPages - 1 ? prev + 1 : 0));
    };

    const currentItems = useMemo(() => {
        const start = currentPage * itemsPerPage;
        return reviewsList.slice(start, start + itemsPerPage);
    }, [reviewsList, currentPage, itemsPerPage]);

    if (!reviewsList.length) return null;

    return (
        <section className={`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-14 ${className}`}>
            {/* Header section with Title, Subheading & Handwriting badge */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
                <div className="max-w-2xl">
                    <h2 className={`text-3xl sm:text-4xl font-extrabold tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        What our <span className={isDark ? 'text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 'text-[#007BFF]'}>users say</span>
                    </h2>
                    {subheading && (
                        <p className={`mt-3 text-sm sm:text-base font-normal leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            {subheading}
                        </p>
                    )}
                </div>

                {/* Top Right Handwritten Tagline */}
                {badgeText && (
                    <div className="shrink-0 self-start md:self-end">
                        <div className="relative inline-block text-right">
                            <span className={`font-serif italic text-lg sm:text-xl tracking-wide font-light ${isDark ? 'text-gray-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'text-gray-700'}`}>
                                {badgeText}
                            </span>
                            <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-cyan-300 rounded-full mt-1" />
                        </div>
                    </div>
                )}
            </div>

            {/* 2x2 Grid of Review Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6">
                {currentItems.map((review) => {
                    const subtext = [review.role, review.location].filter(Boolean).join(' • ');
                    return (
                        <div
                            key={review.id || review.name}
                            className={`group relative rounded-2xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 overflow-hidden ${
                                isDark
                                    ? 'bg-[#090b12]/90 border border-white/10 hover:border-cyan-500/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]'
                                    : 'bg-white border border-gray-200/90 shadow-sm hover:shadow-md hover:border-cyan-400'
                            }`}
                        >
                            {/* Ambient Cyan Corner Glow */}
                            <div className="absolute -bottom-12 -right-12 w-44 h-44 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-colors duration-500" />

                            <div>
                                {/* Top Header: Avatar, Info & Quote Icon */}
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3.5">
                                        <div className={`relative w-12 h-12 rounded-full overflow-hidden shrink-0 border ${isDark ? 'border-white/20 bg-gray-800' : 'border-gray-200 bg-gray-100'}`}>
                                            {review.avatar ? (
                                                <img
                                                    src={review.avatar}
                                                    alt={review.name}
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        e.target.style.display = 'none';
                                                    }}
                                                />
                                            ) : null}
                                            <div className="absolute inset-0 flex items-center justify-center font-bold text-white bg-cyan-600 text-sm -z-1">
                                                {review.name?.charAt(0) || 'U'}
                                            </div>
                                        </div>

                                        <div className="flex flex-col">
                                            <h3 className={`font-bold text-base sm:text-lg leading-snug transition-colors ${
                                                isDark ? 'text-white group-hover:text-cyan-300' : 'text-gray-900 group-hover:text-cyan-600'
                                            }`}>
                                                {review.name}
                                            </h3>
                                            {subtext && (
                                                <p className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                                    {subtext}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Quote Icon */}
                                    <div className="shrink-0 opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all">
                                        <Quote size={24} className={`rotate-180 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} />
                                    </div>
                                </div>

                                {/* Review Text Quote */}
                                <p className={`mt-5 text-sm sm:text-base font-normal leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                    {review.quote}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-8">
                    <button
                        onClick={handlePrev}
                        aria-label="Previous page"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                                ? 'bg-white/5 border border-white/10 text-white hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-400'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-cyan-500 hover:text-cyan-600 shadow-xs'
                        }`}
                    >
                        <ChevronLeft size={18} />
                    </button>

                    <div className="flex items-center gap-2">
                        {Array.from({ length: totalPages }).map((_, idx) => (
                            <button
                                key={idx}
                                onClick={() => setCurrentPage(idx)}
                                aria-label={`Go to slide ${idx + 1}`}
                                className={`transition-all duration-300 rounded-full cursor-pointer ${
                                    currentPage === idx
                                        ? isDark
                                            ? 'w-3 h-3 bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]'
                                            : 'w-3 h-3 bg-cyan-600'
                                        : isDark
                                            ? 'w-2 h-2 bg-white/20 hover:bg-white/40'
                                            : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                                }`}
                            />
                        ))}
                    </div>

                    <button
                        onClick={handleNext}
                        aria-label="Next page"
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                            isDark
                                ? 'bg-white/5 border border-white/10 text-white hover:border-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-400'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100 hover:border-cyan-500 hover:text-cyan-600 shadow-xs'
                        }`}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            )}
        </section>
    );
}

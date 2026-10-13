import { useRef } from 'react';
import { useMobileHeaderCollapse } from '../hooks/useMobileHeaderCollapse';
import { useDarkMode } from '../context/DarkModeContext';

/**
 * Mobile sticky header: logo + action icons collapse on scroll;
 * search bar and category chips stay pinned at the top.
 */
export default function MobileStickyHeader({
    isDark: customIsDark,
    brandingRow,
    searchRow,
    categoryBar,
    innerClassName = '',
    shellClassName = '',
    onCollapsedChange,
}) {
    const headerRef = useRef(null);
    const { isDark: contextIsDark } = useDarkMode();
    const isDark = customIsDark ?? contextIsDark;
    useMobileHeaderCollapse(headerRef, onCollapsedChange);

    return (
        <header
            ref={headerRef}
            data-scrolling="false"
            className={`lg:hidden sticky top-0 z-[100] mobile-header-shell overflow-visible transition-colors duration-200 ${
                isDark ? 'bg-[#070A13]/65 backdrop-blur-3xl' : 'bg-white/65 backdrop-blur-3xl backdrop-saturate-180 backdrop-brightness-105 border-b border-gray-200/80 text-gray-900'
            } ${shellClassName}`}
        >

            <div
                className={`mobile-header-inner px-(--page-gutter) ${innerClassName}`}
            >
                <div className="mobile-header-branding-clip">
                    <div className="mobile-header-branding-row" aria-hidden="false">
                        <div className="mobile-header-branding-row__inner flex items-center justify-between">
                            {brandingRow}
                        </div>
                    </div>
                </div>

                <div className="mobile-header-search-row">
                    {searchRow}
                </div>

                <div className="mobile-header-category-row">
                    {categoryBar}
                </div>
            </div>
        </header>
    );
}

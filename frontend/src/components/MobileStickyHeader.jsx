import { useRef } from 'react';
import { useMobileHeaderCollapse } from '../hooks/useMobileHeaderCollapse';

/**
 * Mobile sticky header: logo + action icons collapse on scroll;
 * search bar and category chips stay pinned at the top.
 */
export default function MobileStickyHeader({
    isDark,
    brandingRow,
    searchRow,
    categoryBar,
    innerClassName = '',
    shellClassName = '',
    onCollapsedChange,
}) {
    const headerRef = useRef(null);
    useMobileHeaderCollapse(headerRef, onCollapsedChange);

    return (
        <header
            ref={headerRef}
            data-scrolling="false"
            style={{ '--header-collapse': 0 }}
            className={`lg:hidden sticky top-0 z-40 mobile-header-shell overflow-hidden ${shellClassName}`}
        >
            <div
                className={`mobile-header-inner px-[var(--page-gutter)] ${innerClassName}`}
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

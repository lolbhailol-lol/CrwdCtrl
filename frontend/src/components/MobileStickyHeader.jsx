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
    innerClassName = 'pb-4',
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
            className={`lg:hidden sticky top-0 z-40 mobile-header-shell rounded-b-[16px] overflow-hidden ${
                isDark ? 'bg-[#0D0E10]' : 'bg-[#F2F4F7]'
            } ${shellClassName}`}
        >
            <div
                className={`mobile-header-inner rounded-b-[16px] px-4 ${
                    isDark ? 'bg-[#0D0E10]' : 'bg-[#F2F4F7]'
                } ${innerClassName}`}
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

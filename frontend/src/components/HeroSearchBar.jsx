import { X } from 'lucide-react';
import HeroSearchIcon from './HeroSearchIcon';

/**
 * Rounded search bar with District-style magnifier badge.
 */
export default function HeroSearchBar({
    value = '',
    onChange,
    onKeyDown,
    onFocus,
    onClear,
    placeholder = 'search college, fest',
    className = '',
    isDark = false,
    readOnly = false,
    inputRef,
}) {
    const barClass = isDark
        ? 'bg-[#1a1b1e] shadow-[0_2px_10px_rgba(0,0,0,0.4)]'
        : 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)]';

    return (
        <div className={`hero-search-bar flex items-center gap-4 ${barClass} ${className}`}>
            <HeroSearchIcon isDark={isDark} />
            <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                inputMode="search"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                onFocus={onFocus}
                placeholder={placeholder}
                readOnly={readOnly}
                className={`flex-1 min-w-0 bg-transparent text-fluid-sm leading-none outline-none lowercase placeholder:text-[#70757A] placeholder:lowercase ${
                    isDark ? 'text-gray-100' : 'text-[#3c4043]'
                }`}
            />
            {value && onClear && (
                <button type="button" onClick={onClear} aria-label="Clear search" className="touch-target shrink-0">
                    <X size={18} className="text-gray-400" />
                </button>
            )}
        </div>
    );
}

import { Search, X } from 'lucide-react';

/**
 * Pill search bar — white capsule, blue icon, soft shadow (Google-style).
 */
export default function HeroSearchBar({
    value = '',
    onChange,
    onKeyDown,
    onClear,
    placeholder = 'search college, fest',
    className = '',
    isDark = false,
    readOnly = false,
}) {
    const barClass = isDark
        ? 'bg-[#1a1b1e] shadow-[0_2px_10px_rgba(0,0,0,0.4)]'
        : 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)]';

    return (
        <div className={`flex items-center gap-3 rounded-full px-5 py-3.5 ${barClass} ${className}`}>
            <Search size={20} strokeWidth={2.25} className="crisp-icon-svg shrink-0 text-[#1A73E8]" aria-hidden />
            <input
                type="text"
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder={placeholder}
                readOnly={readOnly}
                className={`flex-1 min-w-0 bg-transparent text-[15px] leading-none outline-none lowercase placeholder:text-[#70757A] placeholder:lowercase ${
                    isDark ? 'text-gray-100' : 'text-[#3c4043]'
                }`}
            />
            {value && onClear && (
                <button type="button" onClick={onClear} aria-label="Clear search" className="shrink-0">
                    <X size={18} className="text-gray-400" />
                </button>
            )}
        </div>
    );
}

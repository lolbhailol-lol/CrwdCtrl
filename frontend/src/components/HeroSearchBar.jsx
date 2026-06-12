import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import HeroSearchIcon from './HeroSearchIcon';
import { BRAND } from '../motion/tokens';

const PLACEHOLDERS = [
    'search college, fest',
    'find treks near you',
    'discover run clubs',
    'explore communities',
];

/**
 * Rounded search bar with premium focus expand + cyan glow.
 */
export default function HeroSearchBar({
    value = '',
    onChange,
    onKeyDown,
    onFocus,
    onBlur,
    onClear,
    placeholder = 'search college, fest',
    className = '',
    isDark = false,
    readOnly = false,
    inputRef,
}) {
    const [focused, setFocused] = useState(false);
    const [placeholderIdx, setPlaceholderIdx] = useState(0);

    useEffect(() => {
        if (!focused || value) return undefined;
        const id = setInterval(() => setPlaceholderIdx((i) => i + 1), 2800);
        return () => clearInterval(id);
    }, [focused, value]);

    const barClass = isDark
        ? 'bg-[#1a1b1e] shadow-[0_2px_10px_rgba(0,0,0,0.4)]'
        : 'bg-white shadow-[0_2px_8px_rgba(0,0,0,0.1)]';

    const handleFocus = (e) => {
        setFocused(true);
        onFocus?.(e);
    };

    const handleBlur = (e) => {
        setFocused(false);
        onBlur?.(e);
    };

    const activePlaceholder = focused && !value
        ? PLACEHOLDERS[placeholderIdx % PLACEHOLDERS.length]
        : placeholder;

    return (
        <motion.div
            className={`hero-search-bar flex items-center gap-4 ${barClass} ${className} ${focused ? 'hero-search-bar--focused' : ''}`}
            animate={{
                scale: focused ? 1.015 : 1,
                boxShadow: focused
                    ? `0 0 0 2px ${BRAND.cyan}40, 0 8px 24px ${BRAND.cyan}25`
                    : isDark
                      ? '0 2px 10px rgba(0,0,0,0.4)'
                      : '0 2px 8px rgba(0,0,0,0.1)',
            }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
            <HeroSearchIcon isDark={isDark} />
            <div className="relative flex-1 min-w-0">
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
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                    placeholder={activePlaceholder}
                    readOnly={readOnly}
                    className={`w-full bg-transparent text-fluid-sm leading-none outline-none lowercase placeholder:text-[#70757A] placeholder:lowercase ${
                        isDark ? 'text-gray-100' : 'text-[#3c4043]'
                    }`}
                />
            </div>
            {value && onClear && (
                <motion.button
                    type="button"
                    onClick={onClear}
                    aria-label="Clear search"
                    className="touch-target shrink-0"
                    whileTap={{ scale: 0.9 }}
                >
                    <X size={18} className="text-gray-400" />
                </motion.button>
            )}
        </motion.div>
    );
}

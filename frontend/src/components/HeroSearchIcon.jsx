/**
 * District-style search glyph — rounded magnifier.
 */
export default function HeroSearchIcon({ isDark = false, className = '' }) {
    return (
        <span
            className={`hero-search-icon crisp-icon-svg shrink-0${isDark ? ' hero-search-icon--dark' : ''}${className ? ` ${className}` : ''}`}
            aria-hidden
        >
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle
                    cx="10.75"
                    cy="10.75"
                    r="6.25"
                    stroke="currentColor"
                    strokeWidth="2.35"
                    strokeLinecap="round"
                />
                <path
                    d="M15.4 15.4L20.25 20.25"
                    stroke="currentColor"
                    strokeWidth="2.35"
                    strokeLinecap="round"
                />
                <circle
                    cx="10.75"
                    cy="10.75"
                    r="2.15"
                    fill="currentColor"
                    opacity="0.18"
                />
            </svg>
        </span>
    );
}

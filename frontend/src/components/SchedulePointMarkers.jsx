/** Main schedule bullet — filled cyan dot */
export function ScheduleMainMarker({ className = '' }) {
    return (
        <span
            className={`mt-[5px] size-1.5 rounded-full bg-[#0ECCEE] shrink-0 ${className}`}
            aria-hidden
        />
    );
}

/** Sub schedule bullet — smaller hollow ring, visually distinct from main */
export function ScheduleSubMarker({ isDark = false, className = '' }) {
    return (
        <span
            className={`mt-[6px] size-1 rounded-full border shrink-0 ${
                isDark ? 'border-gray-500' : 'border-gray-400'
            } ${className}`}
            aria-hidden
        />
    );
}

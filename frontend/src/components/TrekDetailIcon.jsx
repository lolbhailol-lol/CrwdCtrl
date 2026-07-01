import React from 'react';

function DefaultIcon({ size }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" fill="#E5E7EB" stroke="#9CA3AF" strokeWidth="1.2" />
            <path d="M12 8v5M12 16h.01" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
        </svg>
    );
}

const ICONS = {
    people: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="6" r="3" fill="#2DD4BF" />
            <path d="M3 20 Q3 14 9 14 Q15 14 15 20" fill="#0D9488" />
            <circle cx="17" cy="7" r="2.5" fill="#5EEAD4" opacity="0.8" />
            <path d="M14 20 Q14 15.5 17 15.5 Q21 15.5 21 20" fill="#0D9488" opacity="0.7" />
        </svg>
    ),
    sun: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="#FCD34D" />
            <circle cx="12" cy="12" r="3.5" fill="#FBBF24" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
                const r = 8.5;
                const r2 = 10.5;
                const rad = (deg * Math.PI) / 180;
                return (
                    <line
                        key={i}
                        x1={12 + r * Math.cos(rad)}
                        y1={12 + r * Math.sin(rad)}
                        x2={12 + r2 * Math.cos(rad)}
                        y2={12 + r2 * Math.sin(rad)}
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                );
            })}
        </svg>
    ),
    moon: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="#A78BFA" />
        </svg>
    ),
    'map-pin': ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#FCA5A5" />
            <circle cx="12" cy="9" r="3" fill="white" opacity="0.9" />
        </svg>
    ),
    age: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.2" />
            <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1D4ED8">18+</text>
        </svg>
    ),
    fitness: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M3 12h3l2-6 3 12 3-8 2 4h5" stroke="#F43F5E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    calendar: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="16" rx="2" fill="#DBEAFE" stroke="#3B82F6" strokeWidth="1.5" />
            <path d="M3 9h18" stroke="#3B82F6" strokeWidth="1.5" />
            <path d="M8 3v4M16 3v4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="7" y="12" width="3" height="3" rx="0.5" fill="#3B82F6" />
        </svg>
    ),
    clock: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.2" />
            <path d="M12 7v5l3 2" stroke="#D97706" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    mountain: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 18 L10 8 L14 13 L20 6 L22 18 Z" fill="#86EFAC" stroke="#16A34A" strokeWidth="1.2" />
        </svg>
    ),
    route: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 6c3 0 3 4 6 4s3-4 6-4 3 4 6 4" stroke="#0EA5E9" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="4" cy="6" r="2" fill="#38BDF8" />
            <circle cx="20" cy="10" r="2" fill="#38BDF8" />
        </svg>
    ),
    tent: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M4 18 L12 6 L20 18 Z" fill="#FDE68A" stroke="#D97706" strokeWidth="1.2" />
            <path d="M12 6 L12 18" stroke="#D97706" strokeWidth="1" />
        </svg>
    ),
    food: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M6 4v8M8 4v8M6 12v8M8 12c2 0 4-2 4-5V4" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M16 4c0 5 2 7 2 12v4" stroke="#EA580C" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
    ),
    weather: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M7 16a4 4 0 1 1 .5-8A5 5 0 0 1 18 10a3.5 3.5 0 1 1 .2 7H7z" fill="#BAE6FD" stroke="#0EA5E9" strokeWidth="1.2" />
        </svg>
    ),
    star: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <path d="M12 3l2.6 5.8L21 10l-4.5 4.2L18 21l-6-3.4L6 21l1.5-6.8L3 10l6.4-1.2L12 3z" fill="#FDE047" stroke="#EAB308" strokeWidth="1" />
        </svg>
    ),
    info: ({ size }) => (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" fill="#E0F2FE" stroke="#0284C7" strokeWidth="1.2" />
            <path d="M12 10v6M12 7h.01" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    default: DefaultIcon,
};

export default function TrekDetailIcon({ icon = 'default', size = 20 }) {
    const Cmp = ICONS[icon] || ICONS.default;
    return <Cmp size={size} />;
}

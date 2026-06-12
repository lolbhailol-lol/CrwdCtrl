/** CrwdCtrl motion design tokens — GPU-friendly, premium feel */

export const BRAND = {
    cyan: '#0ECCEE',
    cyanGlow: 'rgba(14, 204, 238, 0.45)',
    black: '#000000',
    darkBg: '#161718',
};

export const DURATION = {
    instant: 0.12,
    fast: 0.22,
    normal: 0.32,
    slow: 0.48,
    splash: 1.9,
};

export const EASE = {
    /** Apple-style deceleration */
    out: [0.22, 1, 0.36, 1],
    /** Smooth enter */
    inOut: [0.45, 0, 0.55, 1],
    /** Snappy press */
    snap: [0.34, 1.56, 0.64, 1],
    /** Premium page transition */
    page: [0.25, 0.1, 0.25, 1],
};

export const SPRING = {
    card: { type: 'spring', stiffness: 420, damping: 32 },
    soft: { type: 'spring', stiffness: 280, damping: 28 },
};

export const VIEWPORT = {
    once: true,
    amount: 0.18,
    margin: '0px 0px -8% 0px',
};

export const STAGGER = {
    fast: 0.04,
    normal: 0.07,
    slow: 0.1,
};

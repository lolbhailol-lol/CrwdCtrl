/** Trek storytelling motion variants — used only on trek community & detail pages */

export const BRAND_CYAN = '#0ECCEE';

export const EASE = {
    out: [0.22, 1, 0.36, 1],
    inOut: [0.45, 0, 0.55, 1],
};

export const VIEWPORT = {
    once: true,
    amount: 0.15,
    margin: '0px 0px -10% 0px',
};

/** Section fade + slide up + subtle scale */
export const sectionReveal = {
    hidden: { opacity: 0, y: 32, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.55, ease: EASE.out },
    },
};

/** Stagger container for cards / gallery tiles */
export const staggerContainer = (stagger = 0.08) => ({
    hidden: {},
    visible: {
        transition: { staggerChildren: stagger, delayChildren: 0.06 },
    },
});

/** Individual card in a stagger list */
export const staggerItem = {
    hidden: { opacity: 0, y: 20, scale: 0.96 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.4, ease: EASE.out },
    },
};

/** Image scale reveal */
export const imageReveal = {
    hidden: { opacity: 0, scale: 1.08 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.65, ease: EASE.out },
    },
};

/** Floating hero card entrance */
export const heroCardEnter = {
    hidden: { opacity: 0, y: 24, scale: 0.97 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: 0.6, delay: 0.15, ease: EASE.out },
    },
};

/** Sticky booking bar slide up */
export const bookingBarEnter = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: EASE.out },
    },
};

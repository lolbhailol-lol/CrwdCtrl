import { DURATION, EASE, STAGGER } from './tokens';

/** Fade + slide up — scroll reveals, sections */
export const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.normal, ease: EASE.out },
    },
};

/** Fade + slight scale — cards, tiles */
export const fadeScale = {
    hidden: { opacity: 0, scale: 0.96 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: DURATION.fast, ease: EASE.out },
    },
};

/** Stagger container for lists/grids */
export const staggerContainer = (stagger = STAGGER.normal) => ({
    hidden: {},
    visible: {
        transition: { staggerChildren: stagger, delayChildren: 0.04 },
    },
});

/** Page route enter/exit */
export const pageTransition = {
    initial: { opacity: 0, y: 8, scale: 0.995 },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: DURATION.normal, ease: EASE.page },
    },
    exit: {
        opacity: 0,
        y: -6,
        scale: 0.995,
        transition: { duration: DURATION.fast, ease: EASE.inOut },
    },
};

/** Splash logo sequence */
export const splashLogo = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.7, ease: EASE.out },
    },
    exit: {
        opacity: 0,
        scale: 1.02,
        transition: { duration: 0.5, ease: EASE.inOut },
    },
};

/** Full-screen mobile search — matches pageTransition feel */
export const mobileSearchPage = {
    initial: { opacity: 0, y: 14, scale: 0.992 },
    animate: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: DURATION.normal, ease: EASE.page },
    },
    exit: {
        opacity: 0,
        y: 10,
        scale: 0.996,
        transition: { duration: DURATION.fast, ease: EASE.inOut },
    },
};

/** Mobile search header row — subtle follow-through */
export const mobileSearchHeader = {
    initial: { opacity: 0, y: -6 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.fast, ease: EASE.out, delay: 0.04 },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: DURATION.instant, ease: EASE.inOut },
    },
};

/** Search dropdown panel */
export const searchPanel = {
    hidden: { opacity: 0, y: -8, scale: 0.98 },
    visible: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: { duration: DURATION.fast, ease: EASE.out },
    },
    exit: {
        opacity: 0,
        y: -4,
        transition: { duration: DURATION.instant, ease: EASE.inOut },
    },
};

/** Search result row */
export const searchResultRow = {
    hidden: { opacity: 0, x: -8 },
    visible: (i = 0) => ({
        opacity: 1,
        x: 0,
        transition: { delay: i * STAGGER.fast, duration: DURATION.fast, ease: EASE.out },
    }),
};

/** Card hover/press — applied via motion whileHover/whileTap */
export const cardInteraction = {
    rest: { y: 0, scale: 1 },
    hover: { y: -4, scale: 1.01, transition: { duration: DURATION.fast, ease: EASE.out } },
    tap: { y: 0, scale: 0.98, transition: { duration: DURATION.instant } },
};

/** Hero parallax image */
export const parallaxImage = {
    hidden: { scale: 1.08, opacity: 0.85 },
    visible: {
        scale: 1,
        opacity: 1,
        transition: { duration: 0.9, ease: EASE.out },
    },
};

/** Sticky CTA slide up */
export const stickyCta = {
    hidden: { opacity: 0, y: 24 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.normal, ease: EASE.out },
    },
};

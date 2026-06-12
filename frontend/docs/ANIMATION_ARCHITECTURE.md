# CrwdCtrl Animation Architecture

Premium motion system for web, PWA, and Capacitor (Android/iOS). Built on **Framer Motion** with GPU-only transforms and `prefers-reduced-motion` support.

## Principles

1. **Transform + opacity only** — no layout-affecting animations during scroll
2. **Enhance, don't distract** — subtle easing inspired by Apple, Spotify, Airbnb
3. **One source of truth** — shared tokens, variants, and components under `src/motion/`
4. **Performance first** — `will-change`, lazy images, scroll throttling via `useGlobalSmoothScroll`

## Folder Structure

```
frontend/src/motion/
├── tokens.js          # Brand cyan, durations, easings, viewport defaults
├── variants.js        # Reusable Framer Motion variant objects
├── utils.js           # useMotionSafe(), gpuLayer, cn()
├── index.js           # Public exports
└── components/
    ├── AnimatedCard.jsx      # Global card hover/press + image zoom
    ├── ScrollReveal.jsx      # Section fade-up on scroll
    ├── StaggerChildren.jsx   # Staggered list/grid reveals
    ├── ImmersiveHero.jsx     # Parallax hero + gradient overlay
    ├── ScrollProgress.jsx    # Top scroll indicator (detail pages)
    ├── StickyCta.jsx         # Fixed bottom CTA entrance
    ├── SplashScreen.jsx      # React fallback splash (Framer Motion)
    └── AnimatedCounter.jsx   # Stat counters (run clubs, communities)
```

## Layer Map

| Layer | Responsibility | Files |
|-------|----------------|-------|
| **Launch** | Instant HTML splash + 2.4s timer | `index.html`, `bootSplash.js`, `App.jsx` |
| **Routing** | Skeleton overlay + page fade | `PageTransition.jsx` |
| **Global scroll** | Smooth anchors, scroll state | `useGlobalSmoothScroll.js`, `index.css` |
| **Search** | Focus glow, dropdown stagger | `HeroSearchBar.jsx`, `HeroSearchDropdown.jsx` |
| **Cards** | Hover lift, press, image zoom | `AnimatedCard`, `FestCard`, `HappeningCard` |
| **Immersive pages** | Hero, sections, sticky CTA | Community/Trek/RunClub detail pages |

## Tokens

- **Brand cyan**: `#0ECCEE` — glow, focus rings, progress bars
- **Splash duration**: 2400ms (HTML handles paint; React waits before mount)
- **Page transition**: 320ms cubic-bezier Apple-style
- **Viewport reveal**: 18% visible, once per section

## Usage Examples

### Scroll section reveal

```jsx
import { ScrollReveal } from '../../motion';

<ScrollReveal className="mb-5" delay={0.05}>
  <h2>About</h2>
  <p>...</p>
</ScrollReveal>
```

### Animated discovery card

```jsx
import { AnimatedCard } from '../../motion';

<AnimatedCard className="card-surface rounded-2xl" onClick={handleClick}>
  ...
</AnimatedCard>
```

### Immersive hero (community / trek)

```jsx
import { ImmersiveHero, AnimatedCounter } from '../../motion';

<ImmersiveHero imageSrc={coverUrl} imageAlt={name} height="396px">
  <div className="absolute bottom-20 left-4">
    <AnimatedCounter value={trekCount} />
  </div>
</ImmersiveHero>
```

## Page-Specific Integration

| Route | Animations |
|-------|------------|
| `/` (Dashboard) | Search bar focus, card hover, route fade |
| `/treks/community/:id` | Parallax hero, floating stats, scroll sections, sticky Join CTA |
| `/trek/:id` | Scroll progress bar, section reveals, sticky booking CTA |
| `/sports/run-club/:id` | Hero stats counters, scroll sections, sticky Join CTA |
| All routes | Page enter fade via `PageTransitionContent` |

## Performance Checklist

- [x] `transform` / `opacity` only for motion
- [x] Images use `loading="lazy"` on below-fold content
- [x] `prefers-reduced-motion` disables parallax, counters, splash keyframes
- [x] `html.is-scrolling` pauses expensive CSS transitions during scroll
- [x] Capacitor: HTML splash shows before JS bundle loads (no white flash)

## Extending

1. Add new variants to `variants.js` — don't inline magic numbers in pages
2. Wrap new card types with `AnimatedCard` or add `motion-card` class
3. Use `ScrollReveal` for new detail page sections
4. Import motion from `src/motion/index.js` only — keeps tree-shaking clean

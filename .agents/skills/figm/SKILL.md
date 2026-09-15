---
name: figm
description: Extract design tokens (colors, spacing, typography, radii, shadows) from a Figma design screenshot and add them to the CrwdCtrl codebase. Use when the user shares a Figma screenshot/image and wants its design tokens pulled into the project.
disable-model-invocation: true
---

# figm — Figma Screenshot to Design Tokens

Extract reusable design tokens from a Figma design **screenshot** and wire them into the CrwdCtrl token system. This project uses **Tailwind CSS v4** with CSS-based tokens.

## Where tokens live

- `frontend/src/styles/tokens.css`
  - `@theme { ... }` block → tokens that become Tailwind utilities (fonts, breakpoints, and any `--color-*`).
  - `:root { ... }` block → raw CSS custom properties used across components (spacing, sizes, semantic colors, durations).

Always add new tokens to this file. Never hardcode raw hex/px values into components when a token fits.

## Workflow

Copy this checklist and track progress:

```
- [ ] Step 1: Read the screenshot
- [ ] Step 2: Extract token candidates
- [ ] Step 3: Map to existing tokens (avoid duplicates)
- [ ] Step 4: Add new tokens to tokens.css
- [ ] Step 5: Report the token table
```

**Step 1: Read the screenshot**
Use the Read tool on the image path the user provides. If no image is attached, ask for one.

**Step 2: Extract token candidates**
Identify from the design:
- Colors: backgrounds, text, borders, accents (note light vs dark if both shown)
- Typography: font family, sizes, weights, line heights
- Spacing: padding/margins/gaps between elements
- Radii: corner rounding
- Shadows: elevation/blur
Convert px to `rem` (÷16) for spacing, sizes, and radii. Keep colors as hex.

**Step 3: Map to existing tokens (avoid duplicates)**
Read `frontend/src/styles/tokens.css` first. If a value matches (or is within ~1px / ~2% of) an existing token, reuse that token instead of adding a new one. Only create tokens for values that recur or are clearly part of the design system.

**Step 4: Add new tokens to tokens.css**
- Color tokens that should be Tailwind utilities → add to `@theme` as `--color-<name>` (e.g. `--color-brand-500: #0060df;` enables `bg-brand-500`).
- Everything else (spacing, sizes, radii, semantic one-off colors, shadows) → add to `:root`.
- Follow existing naming: kebab-case, grouped with a short comment header.
- Match existing units (`rem`, `clamp(...)` for responsive values).

**Step 5: Report the token table**
Summarize what was added and what was reused.

## Naming conventions

| Kind | Pattern | Example |
|------|---------|---------|
| Color (utility) | `--color-<role>-<weight>` | `--color-brand-500` |
| Semantic color | `--<surface>-<variant>` | `--card-surface-dark` |
| Spacing/gap | `--<context>-<prop>` | `--section-block-gap` |
| Size | `--<element>-<dimension>` | `--detail-hero-h` |
| Radius | `--radius-<scale>` | `--radius-lg` |

## Output format

After editing, report a table:

```
Added:
- --color-brand-500: #0060DF   (accent buttons)
- --radius-card: 1rem          (16px card corners)

Reused (matched existing):
- spacing 24px → --section-heading-gap
```

## Rules

- Use `rem` for spacing/size/radius (px ÷ 16); keep colors as hex.
- Do not invent values not visible in the screenshot — estimate conservatively and say so.
- Never edit components in this skill unless the user explicitly asks; this skill only manages tokens.
- Keep light/dark variants paired when the design shows both.

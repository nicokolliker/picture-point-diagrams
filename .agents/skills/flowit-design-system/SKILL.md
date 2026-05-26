---
name: flowit-design-system
description: Visual language and design conventions for FlowIt — the "Limpio Sereno" system (sky→violet gradient, Outfit/Figtree typography, area-based dashboards, card patterns). Use when creating or redesigning any FlowIt screen, component, modal, sidebar, badge, or marketing surface; when the user mentions "estilo", "look & feel", "diseño", "rediseñar", "branding", or "FlowIt UI"; or when adding a new view that should match the rest of the app.
---

# FlowIt Design System — "Limpio Sereno"

FlowIt is a flowchart / process-capture tool. The visual language is calm, airy, and modern: lots of whitespace, soft shadows, a sky→violet gradient as the brand signature, and a clear separation between **chrome** (white surfaces, neutral borders) and **canvas** (off-white with a dot grid).

## When to use

- Building any new route, modal, sidebar, panel, card, or empty state inside FlowIt.
- Refactoring an existing screen for visual consistency.
- Adding a status badge, progress meter, or person/area chip.
- Generating marketing or onboarding visuals (the gradient + node logo is the brand).

## Core rules (apply on every task)

1. **Never hardcode brand colors in components.** Use semantic tokens from `src/styles.css` (`bg-primary`, `text-accent`, etc.) or the gradient utilities below. Status/priority colors come from `STATUS_COLORS` / `PRIORIDAD_META` in `src/lib/shape-types.ts` — import them, don't redefine.
2. **Two fonts, never more.** `Outfit` for display/headings (`.font-display`), `Figtree` for everything else (default body). Both are preloaded in `__root.tsx`.
3. **All Spanish labels.** The product UI is in Spanish ("Capturar proceso", "Resumen de cambios", "Por persona"). Keep code/types in English.
4. **Cards over panels.** Almost every list item is a rounded-2xl card with `border-[#EBEBEB]`, hover lift, and a soft sky-tinted shadow on hover. Avoid flat tables except in the documents list.
5. **The canvas is sacred.** Use `.flowit-canvas-bg` (off-white with radial dot grid) for any drawing surface. Never put cards directly on canvas color — use white surfaces.

## References — load when relevant

- **Tokens, gradients, typography ramp, spacing scale** → read `references/tokens.md` when picking colors, fonts, or sizing.
- **Component patterns (cards, top nav, sidebar, badges, logo, hero blocks, empty states)** → read `references/components.md` when building any new UI surface.
- **Custom keyframes and motion conventions** → read `references/animations.md` when adding entrances, popups, or hover affordances.
- **Data conventions (areas, status, priority, doc types, shape model)** → read `references/data-conventions.md` when wiring a new view to the diagram store or designing a filter/grouping UI.

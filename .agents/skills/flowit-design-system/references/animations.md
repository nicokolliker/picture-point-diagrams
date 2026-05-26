# Animations

All custom keyframes are defined in `src/styles.css`. Prefer these classes over ad-hoc `transition-` chains so motion stays consistent.

| Class | Duration | Use |
|---|---|---|
| `.flowit-popup` | 150ms | Hover popups, dropdowns, color pickers — fade + scale 0.98→1 |
| `.flowit-pin-in` | 150ms | A control appearing in place (e.g. pin button on shape hover) |
| `.flowit-slide-in-right` | 200ms | Right-side panel or drawer opening |
| `.flowit-fade-in` | 150ms | Modal dim overlay, neutral fade |
| `.flowit-entry` | 150ms | List items appearing (small translateY) |

## Conventions

- **Hover lift** on cards: `transition-all` + `hover:-translate-y-0.5`. Always pair with a soft sky-tinted shadow (see `tokens.md`).
- **Color/border transitions**: 150ms is the house default. Avoid 300ms+ — it feels sluggish for a productivity tool.
- **Modal open**: 260ms zoom-from-origin is reserved for the sub-process modal (animates from the shape's bounding rect). Don't reuse for ordinary dialogs — they use `flowit-fade-in` + `flowit-popup` on the panel.
- **Canvas grid**: never animate. The dot grid (`.flowit-canvas-bg`, 20px radial) must stay static during pan/zoom for spatial reference.
- **Reduced motion**: keep entrances under 200ms so disabling them via `prefers-reduced-motion` (if added later) is a no-op visually.

## When adding a new animation

1. Add the keyframe + class in `src/styles.css` with the `flowit-` prefix.
2. Keep it under 250ms unless it's a spatial transition (modal-from-shape).
3. Use `ease-out` for entrances, `ease-in-out` for state toggles.

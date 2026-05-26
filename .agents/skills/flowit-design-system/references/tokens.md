# Tokens

## Brand gradient (signature)

```
linear-gradient(135deg, #0EA5E9 0%, #22D3EE 55%, #A78BFA 100%)
```

Sky → Cyan → Violet. Used on: logo background, primary CTA on hero, active sidebar item highlight, area chip dot when "all" is selected, doc thumbnail hero cards.

Tailwind shortcut for the same ramp:
```tsx
className="bg-gradient-to-br from-sky-500 via-cyan-400 to-violet-400"
```

## Semantic tokens (defined in `src/styles.css` as oklch)

| Token | Light value | Tailwind class |
|---|---|---|
| `--primary` | sky-500 `#0EA5E9` | `bg-primary` / `text-primary` |
| `--accent` | violet-400 `#A78BFA` | `bg-accent` / `text-accent` |
| `--background` | white | `bg-background` |
| `--foreground` | slate-950-ish | `text-foreground` |
| `--muted-foreground` | slate-500 | `text-muted-foreground` |
| `--border` | `#EBEBEB`-ish slate | `border-border` |
| `--sidebar` | almost-white tinted | `bg-sidebar` |

`--radius` is `0.75rem`. Use `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px). Pills use `rounded-full`.

To add a new semantic color: add the CSS var to both `:root` and `.dark`, register under `@theme inline`, then use as a Tailwind class. Never hardcode oklch/hex in components.

## Surfaces

- **App background**: `#FAFBFF` (very faint sky tint). Use for route wrappers.
- **Card surface**: pure `white` with `border-[#EBEBEB]`.
- **Canvas surface**: `.flowit-canvas-bg` → `#FAFAFA` with radial dot grid (`#E0E0E0`, 20px spacing). Reserved for the diagramming area.
- **Subtle hero wash**: `bg-gradient-to-br from-sky-50 via-white to-violet-50`. Use behind greeting blocks and empty states.

## Typography

Loaded in `src/routes/__root.tsx` from Google Fonts.

- **Display / headings** → `Outfit` (400-800). Apply via `.font-display` class. Use `tracking-tight` and `-0.01em` letter-spacing baked into the class.
- **Body / UI** → `Figtree` (400-700). This is the default `body` font; no class needed.
- **Mono / numeric** → avoid; if needed use `tabular-nums` on Figtree.

Ramp:
| Use | Class |
|---|---|
| Page title | `font-display text-3xl font-semibold tracking-tight` |
| Section heading | `font-display text-xl font-semibold` |
| Card title | `text-sm font-semibold text-foreground` |
| Body | `text-sm text-foreground` |
| Meta / hint | `text-xs text-muted-foreground` |
| Number stat | `font-display text-2xl font-semibold` |

## Shadows

Soft, sky-tinted, never gray:
- Card resting: none (rely on `border-[#EBEBEB]`).
- Card hover: `shadow-[0_8px_24px_-12px_rgba(14,165,233,0.18)]` + `-translate-y-0.5`.
- Floating popover/toolbar: `shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18)]`.
- Modal: `shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)]`.

## Spacing

Standard rhythm: `gap-2` (8px), `gap-3` (12px), `gap-4` (16px), `gap-6` (24px). Top nav height is `h-14`. Left sidebar width is `w-[232px]`. Editor right panel is `w-[320px]`, editor left shapes panel is `w-[68px]` collapsed / `w-[260px]` expanded.

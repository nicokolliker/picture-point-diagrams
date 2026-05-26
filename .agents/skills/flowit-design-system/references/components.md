# Component Patterns

## Logo

`FlowItLogo` lives at `src/components/flowit-logo.tsx`. SVG: rounded-square with the brand gradient, three white circle nodes, two thin connecting curves. Always render via the component — don't inline. Pass `withWordmark` for marketing/hero contexts; omit for compact nav.

```tsx
<FlowItLogo size={32} withWordmark />
```

The wordmark uses Outfit 600 at 22px, color `#0F172A`.

## Top nav

```
h-14 border-b border-[#EBEBEB] bg-white px-6
flex items-center justify-between
```

Left: `FlowItLogo` + breadcrumb. Right: search (rounded-full, `bg-[#F4F5F8]`, no border, `pl-9` with magnifier icon) + avatar.

## Left sidebar (app-level, not editor)

Width `w-[232px]`, full height, `bg-sidebar` with `border-r border-[#EBEBEB]`.

Item shape:
```tsx
<Link className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-[#F4F5F8] data-[active=true]:bg-gradient-to-r data-[active=true]:from-sky-50 data-[active=true]:to-violet-50 data-[active=true]:text-primary">
  <Icon className="size-4" /> Label
</Link>
```

Active state uses the subtle sky→violet wash, not the full brand gradient (reserved for CTAs).

## Cards

Universal pattern for documents, areas, integrations, approval requests:

```tsx
<article className="group rounded-2xl border border-[#EBEBEB] bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(14,165,233,0.18)]">
  {/* 16:10 thumbnail or icon header */}
  <div className="mb-3 aspect-[16/10] overflow-hidden rounded-xl bg-[#FAFBFF]">
    {/* DocThumbnail or gradient block */}
  </div>
  <h3 className="text-sm font-semibold text-foreground">Title</h3>
  <p className="mt-0.5 text-xs text-muted-foreground">Meta · updated 2h ago</p>
</article>
```

For empty-state cards (templates, "start from zero"), add a soft gradient wash and centered icon-in-circle:
```tsx
<div className="size-10 rounded-full bg-gradient-to-br from-sky-500 to-violet-400 text-white grid place-items-center">
  <Plus className="size-5" />
</div>
```

## Doc thumbnail

Use `DocThumbnail` (`src/components/doc-thumbnail.tsx`) to render a real SVG miniature of the first page. Fallback is "Diagrama vacío" muted text. Stroke `#CBD5E1`, fill from shape's own `fill`. Never use raster screenshots.

## Badges and chips

- **Area chip**: `inline-flex items-center gap-1.5 rounded-full bg-white border border-[#EBEBEB] px-2.5 py-1 text-xs`. Leading 8px colored dot using the area's color.
- **Status badge** (publishing): `rounded-full px-2.5 py-0.5 text-[11px] font-medium` with `bg-amber-50 text-amber-700` for draft, `bg-emerald-50 text-emerald-700` for published.
- **Person chip**: small avatar (`size-5 rounded-full`, color derived from name hash, ~42% lightness for legible contrast) + name in `text-xs`.

## Progress meter

Used in summary "Por proceso" and approval cards. Track `bg-[#F1F3F8] rounded-full h-1.5`. Fill `bg-gradient-to-r from-sky-500 to-violet-400 rounded-full`. Compact variant (`h-1`) for dense lists.

## Floating toolbars and popovers

Pill-shaped, white, soft shadow:
```
inline-flex items-center gap-0.5 rounded-full border border-[#EBEBEB] bg-white p-1
shadow-[0_8px_28px_-8px_rgba(15,23,42,0.18)]
```

Each control is `h-7 w-7 grid place-items-center rounded-full hover:bg-[#F4F5F8]`. Use `Popover` (shadcn) for any control that opens a sub-menu (color, font, opacity).

## Modals

Full-screen overlay: `bg-slate-950/40 backdrop-blur-sm`. Panel: `rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.35)] max-w-3xl w-[92vw] max-h-[88vh] overflow-hidden`. Header has tabs (underline style) on left and close button on right. No double border between header and body.

## Hero greeting (home)

```tsx
<section className="rounded-3xl bg-gradient-to-br from-sky-50 via-white to-violet-50 border border-[#EBEBEB] p-8">
  <h1 className="font-display text-3xl font-semibold tracking-tight">Hola, {name} 👋</h1>
  <p className="mt-1 text-sm text-muted-foreground">Tus procesos, organizados por área.</p>
</section>
```

## Empty states

Centered, generous whitespace, illustration or icon-in-gradient-circle, one-line description, single primary CTA. Never two CTAs of equal weight.

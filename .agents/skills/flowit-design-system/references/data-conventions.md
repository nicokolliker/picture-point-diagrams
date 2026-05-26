# Data Conventions

The visual system is tightly coupled to a small set of domain types. Reuse them — don't define parallel enums.

## Source files

- `src/lib/shape-types.ts` — all enums, color maps, and the `Shape` / `Connector` / `Page` / `DiagramDocument` interfaces.
- `src/lib/diagram-store.ts` — Zustand store for documents, pages, and areas. Persisted to localStorage with a `partialize` that strips heavy base64 blobs.

## Areas

`DiagramDocument.areaId?: string` references an `Area` (managed in `/admin`). Each area has `{ id, name, color }`. The color is used for:
- The leading dot on the area chip in dashboard filters.
- The left accent stripe on document cards (`border-l-2`, optional).
- Grouping headers in `/documents`.

Areas are dynamic and user-defined — never hardcode area names ("Marketing", "Ops") in components. Always read from the store.

## Status & priority color maps

Import these directly; do not redefine:

```ts
import { STATUS_COLORS, PRIORIDAD_META, DIAGNOSTICO_META, CATEGORY_META } from "@/lib/shape-types";
```

- `STATUS_COLORS`: `funciona` (#16A34A), `riesgo` (#F59E0B), `roto` (#DC2626), `ninguno` (#9CA3AF).
- `PRIORIDAD_META`: urgente / proximo_sprint / backlog / ok — each with `bg`, `label`, emoji `dot`.
- `DIAGNOSTICO_META`: same shape, used inside shape popups.
- `CATEGORY_META`: improvement categories (proceso, personas, herramienta, documentación, probar) with pastel `bg` / dark `fg` pairs — used as pill badges in the summary panel.

Document publication state: `status: "draft" | "published"`. Render with amber-50 / emerald-50 badges (see `components.md`).

## Shape model essentials (for any view that touches shapes)

- `type`: `rectangle | diamond | oval | parallelogram | cylinder | document | manual | text | sticky | container`.
- `cornerStyle`: `sharp | rounded | pill` (rectangles only).
- `borderStyle`: `solid | dashed | dotted`; `borderWeight`: 1 | 2 | 3.
- `opacity`: 0.1–1, `shadow`: bool.
- `subProcessPageId?`: when present, the shape opens an inline sub-process modal (rendered via portal, zooms from `originRect`).
- `responsableIds?: string[]` — people; `responsable` is a free-text fallback.

## Improvements / changes / docs

Per-shape collections used by the summary aggregator (`computePageSummary` in editor):
- `improvementEntries: ImprovementEntry[]` — has `categories: ImprovementCategory[]` for the "Por categoría" view.
- `changes: ChangeEntry[]` — feed for "Resumen de cambios".
- `documents: DocEntry[]` + `missingDocTypes: MissingDocType[]` — power the "Documentación" view.

The summary panel has six views (General, Por persona, Por prioridad, Por categoría, Documentación, Por proceso). Any new aggregation view should plug into `buildAggregations` rather than re-walking pages.

## Persistence rule

`diagram-store.ts` uses `partialize` to keep `localStorage` under quota — it strips `imageDataUrl` / `fileDataUrl` base64 and trims undo history. When adding any large per-shape field, exclude it from persistence the same way.

## Naming

UI labels are Spanish, code identifiers English. Examples:
- Type: `Prioridad`, label: "Próximo sprint".
- Type: `MissingDocType`, label: "Capacitación".

Keep this split — translating identifiers breaks the store and the existing skill base.

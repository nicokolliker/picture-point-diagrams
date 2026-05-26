
## 1. Logo refinement

- Rework `src/components/flowit-logo.tsx`:
  - Drop the gradient square + Shuffle icon (it competes with the Chill It wordmark).
  - Use the Chill It SVG as the dominant element, slightly larger (`size * 1.0`), with a small Shuffle glyph as a subtle accent **inside** a soft circle on the left at ~`size * 0.7`, using a single-tone sky→violet gradient stroke (not filled chip).
  - Better vertical alignment: align the icon center to the wordmark x-height (translate Y a couple px).
  - Add `aria-label="Chill It"` and ensure the SVG inherits color via `currentColor` so dark surfaces work later.
- Verify in the home header (232px column) and in the editor toolbar.

## 2. Templates

Currently the **Templates** sidebar item is dead and the "New" modal has a Template option that goes nowhere.

- **Data model** (`src/lib/shape-types.ts`): add `isTemplate?: boolean` on `DiagramDocument`.
- **Store** (`src/lib/diagram-store.ts`):
  - `saveAsTemplate(docId)` → deep-clones the doc, sets `isTemplate: true`, `status: "published"`, name `"<name> (template)"`.
  - `createFromTemplate(templateId, opts)` → clones template into a normal doc (no baseline, `status: "draft"`, fresh ids).
  - In `ensureSeed`, when the store is empty also seed 3 generic templates: **Onboarding de cliente**, **Pipeline comercial**, **Soporte / Ticket** (small flows of 4–6 shapes each — reuse `baseShape` helper from `preloaded-demo.ts`, mark `isTemplate: true`).
  - `filtered` lists across the app must exclude templates by default.
- **New route** `src/routes/templates.tsx`: grid view (mirroring home cards) listing all `isTemplate` docs; click → opens a small confirm dialog "Crear proceso desde este template" (with area multi-select like the New dialog) and calls `createFromTemplate`.
- **Sidebar link**: wire the existing Templates item to `/templates`.
- **New-doc modal "Template" option**: link to `/templates` (passing chosen areas in router state so the picker pre-applies them).
- **Editor menu**: in the doc-name dropdown next to the title, add **"Guardar como template"** (calls `saveAsTemplate` and toasts a link to `/templates`).

## 3. Auditar / Modificar choosers

Replace today's "click the hero card → silently filter Recientes" with explicit modals so the choice is obvious.

- New shared component `src/components/PickProcessModal.tsx` with props `{ mode: "audit" | "edit", onClose }`.
  - **Audit mode**: lists `status === "in_review"` docs (cards w/ thumbnail, area chip, requester, time). Click → `/editor?doc=<id>&mode=audit`.
  - **Edit mode**: lists `status !== "in_review"` (drafts + published). Click → `/editor?doc=<id>&mode=edit`.
  - Search box + area filter chips at top; same look as the "Iniciar nuevo proceso" dialog for consistency.
- `home.tsx`: `handleAuditar` / `handleModificar` open this modal instead of mutating `statusFilter`.

## 4. Contextual "Recientes" header

In `home.tsx`, replace the static "Recientes" title with a dynamic line:

- Default: **"Recientes"** + subline *"Tus procesos más recientes"*.
- When `areaId !== "all"`: title becomes **"<Área>"** with the area color dot, subline *"Procesos del área <Área>"*.
- When `statusFilter !== "all"`: append ` · <label>` (Borradores / En auditoría / Publicados).
- When a search is active: append `· "<query>"`.
- Also show a small "Limpiar filtros" link if any filter is active.

## 5. Unified status system

Source of truth: `doc.status` ∈ `draft | in_review | published`, plus dirty bit derived from `baseline` (used by `EditModeBar`).

- Remove the manual **Draft/Published toggle** in `src/routes/editor.tsx` (around line 366) — it bypasses the approvals workflow and causes the duplicate/contradictory chip the user sees.
- Replace it with a **read-only `StatusPill`** component (`src/components/StatusPill.tsx`) used in:
  - editor header (next to doc name),
  - approvals page,
  - home cards.
  Variants: `draft` (amber, `Clock`), `in_review` (sky, `GitCompare`), `published` (emerald, `CheckCircle2`). Single visual language everywhere.
- Status transitions, centralized in the store:
  - `draft → in_review` only via `EditModeBar → Solicitar publicación`.
  - `in_review → published` only via approval reaching `required_approvals` (already in approvals flow).
  - `in_review → draft` on rejection or "Discard request".
  - `published → in_review` automatically the first time the user edits a published doc (i.e. when dirty becomes true and current status is `published`, flip to `draft` with baseline kept; the EditModeBar already drives the flow from there).
- Audit log entry recorded whenever status changes (see #6).

## 6. Modificación vs Auditoría — distinct modes in the editor

Today, edits and audit notes are conflated inside `EditModeBar` + the right panel. Split them by adding an explicit `mode` to the editor.

- `src/routes/editor.tsx` reads `mode` from the URL (`?mode=edit|audit`, default `edit`). Show a **mode toggle pill** in the toolbar with two segments and matching icons:
  - **Modificación** (`PencilRuler`, amber)
  - **Auditoría** (`ShieldCheck`, sky) — only enabled if `status === "in_review"` OR user has admin/approver role.
- **Modification mode** (current behavior, tightened):
  - User can edit shapes/connectors.
  - `EditModeBar` shows the diff vs `baseline` as today, with **Descartar / Guardar borrador / Solicitar publicación**.
  - Right panel highlights "Cambios propuestos" using the existing `ChangesEntry` list per shape.
- **Audit mode** (new):
  - Canvas is **read-only** (shapes not draggable, no FormatBar). A blue ribbon across the top: *"Modo auditoría · estás revisando cambios propuestos por <user>"*.
  - Diff overlay from `ChangesDiffModal` is shown inline (added / removed / moved highlights on the canvas).
  - Right panel switches to a new **Audit panel** (`src/components/AuditPanel.tsx`) with per-shape:
    - **Diagnóstico** dropdown (funciona / inconsistente / roto / sin_definir) — stored in `shape.diagnostico`, already exists.
    - **Oportunidades de mejora** input (categorías chips) — uses existing `addImprovement`.
    - **Inconsistencias** note (new field `shape.inconsistencias?: string[]` — added to `shape-types.ts` and store helper `addInconsistencia/deleteInconsistencia`).
  - Footer of the audit panel: **Aprobar** / **Pedir cambios** / **Rechazar** buttons (wired to existing `decidePublishRequest` server fn). Audit comments are saved as `approval.comment`.
- Sidebar of `home.tsx`: the "Ver auditoría" item in the card dropdown opens `/editor?doc=<id>&mode=audit` instead of the diff-only modal.

## Files touched

```text
src/components/flowit-logo.tsx           # logo polish
src/components/StatusPill.tsx            # NEW unified status chip
src/components/PickProcessModal.tsx      # NEW audit/edit picker
src/components/AuditPanel.tsx            # NEW audit-mode right panel
src/lib/shape-types.ts                   # +isTemplate, +inconsistencias
src/lib/diagram-store.ts                 # template + status + audit helpers
src/lib/preloaded-demo.ts                # +3 seed templates
src/routes/home.tsx                      # hero buttons, contextual header
src/routes/templates.tsx                 # NEW route
src/routes/editor.tsx                    # remove toggle, mode switch, status pill
```

## Out of scope

- No changes to AI/Granola flows, sub-process modal, format bar, or DB schema (audit notes live on shapes locally; only approval decision uses the existing Supabase tables).
- No new Supabase migration unless we later want to persist audit history server-side; for this round, audit notes stay on the shape JSON within the snapshot already sent to `publish_requests`.

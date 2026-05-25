
## Objetivo

Modernizar la pantalla principal de FlowIt: reemplazar categorías hardcodeadas por **áreas** administrables por superadmin, limpiar el sidebar, agregar página de **Integrations** (con Granola), rediseñar **Approvals** con cards visuales, y aplicar un nuevo sistema de branding (logo + tipografía Outfit/Figtree + paleta limpia y serena).

---

## 1. Áreas (reemplazo de chips "All / Processes / …")

### Backend
- Nueva tabla `areas` (Supabase):
  - `id uuid pk`, `name text`, `color text`, `icon text`, `sort_order int`, `created_at`
- RLS: SELECT abierto a authenticated; INSERT/UPDATE/DELETE solo `is_admin(auth.uid())`.
- Seed inicial: Operaciones, Ventas, Producto, Finanzas, RRHH.
- Campo nuevo en `documents` (store local): `areaId?: string`. Como los documentos viven en `diagram-store` (zustand + localStorage), agrego `areaId` opcional al tipo `Document` y al modal "Rename / New".

### UI
- Reemplazo de `CATEGORIES` fijas en `src/routes/home.tsx` por las áreas cargadas desde Supabase + chip "Todas".
- Chips con color sutil tomado de `area.color` (ring/dot, no fondo pleno).
- Filtro `documents.areaId === selectedArea`.
- En `/admin` (ya existe) sumo sección **"Áreas"**: lista + crear / renombrar / borrar / reordenar / picker de color.

---

## 2. Sidebar (limpiar + Documents real)

Estado final:
- **Home** (activa actual)
- **Documents** → nueva ruta `/documents` con vista lista/tabla: nombre, área, autor, última edición, estado de aprobación, acciones. Filtros por área y búsqueda. Reusa store actual.
- **Integrations** → nueva ruta `/integrations` (ver punto 3)
- Se **eliminan** Templates (no implementado) hasta que tengamos contenido real.

El botón **+ New** abre el modal nuevo (punto 4).

---

## 3. Integrations (con Granola)

Nueva ruta `/integrations`:
- Grid de cards de integraciones disponibles. Por ahora: **Granola** (activa) + placeholders deshabilitados (Slack, Notion) marcados "Próximamente".
- Card Granola muestra:
  - Estado de conexión (leyendo `granola_imports` recientes y/o un ping al gateway vía un nuevo `serverFn` `pingGranola`).
  - Botón **"Conectar / Reconectar"** que dispara el flujo de connector estándar.
  - Lista de últimas importaciones (de `granola_imports`) con link al doc generado.
- El botón "Granola" suelto que pudiera quedar en el navbar se quita; el acceso vive en Integrations y dentro de **Capturar proceso** (ya existe).

---

## 4. Modal "+ New" (3 opciones)

Reemplaza el modal actual de 3 botones genéricos por:
1. **Empezar de cero** → `createDocument()` + abre editor.
2. **Desde template** → abre selector de templates (por ahora 2-3 hardcodeados en `src/lib/preloaded-demo.ts`: Onboarding, Sales pipeline, Incident response).
3. **Capturar proceso** → abre el `CaptureProcessModal` existente (chatbot / Granola / notas).

Cada opción permite asignar **área** antes de crear.

---

## 5. Approvals — rediseño visual (cards con thumbnail)

Refactor de `/approvals`:
- Tabs: **Pendientes mías** · **Todas pendientes** · **Aprobadas** · **Rechazadas**.
- Grid de **cards grandes** (1-2 por fila en md, 3 en xl) con:
  - **Thumbnail SVG** del proceso (render mini del primer page del `snapshot`, reutilizando lógica del `LivePreview` de `CaptureProcessModal`).
  - Header: nombre doc, badge de versión `v{n}`, badge de estado con color.
  - Meta: autor (avatar + nombre), fecha, "X de Y aprobaciones".
  - Barra de progreso de aprobaciones (`approves / required`).
  - Lista compacta de approvers con tick verde / cruz roja / pendiente.
  - Acciones inline: **Aprobar** (verde) / **Rechazar** (rojo, abre textarea de comentario) / **Ver diagrama** (abre editor read-only).
- Empty state ilustrado por tab.
- Notificación de "Tenés N aprobaciones pendientes" en el navbar del home (badge en el link "Approvals").

---

## 6. Branding — Limpio sereno (Outfit + Figtree, pastel fresco)

### Tipografía
- Cargar **Outfit** (headings) y **Figtree** (body) desde Google Fonts en `__root.tsx` head.
- `src/styles.css`: actualizar `body` a `Figtree`, agregar utility `.font-display` con `Outfit`.

### Paleta (tokens en `src/styles.css`, oklch)
- `--primary`: oklch del `#0EA5E9` (sky)
- `--accent`: oklch del `#A78BFA` (violet suave)
- Secundarios: cyan `#22D3EE`, pink `#F472B6` (usados como acentos de chips/áreas).
- Mantener fondo blanco / gris muy claro; tipografía gris oscuro (no negro puro).
- Actualizar `bg-[#5B6CF8]` hardcodeados (home, login) a `bg-primary` con el nuevo token.

### Logo
- Reemplazo del cuadrado `F` por un mark SVG inline más jugado pero limpio:
  - Glifo: dos líneas curvas formando una "F" estilizada / nodo conectado (sugiere flowchart), gradient sky→violet, esquinas redondeadas.
  - Componente `<FlowItLogo />` en `src/components/flowit-logo.tsx` con prop `size` y `withWordmark`.
  - Wordmark "FlowIt" en Outfit semibold con tracking ajustado; la "o" estilizada como un nodo (círculo con punto interior) para el touch playful.
- Uso en: navbar del home, login, reset-password, navbar del editor.

### Toques playful (sutiles, no infantiles)
- Esquinas `rounded-xl` por default en cards.
- Microinteracción: hover de cards documents = leve lift + sombra colorida (sky 10%).
- Chips de áreas con dot animado (pulse sutil) en la seleccionada.

---

## 7. Out of scope (no se toca en este plan)
- Editor de diagramas (canvas, shapes, sub-procesos).
- CaptureProcessModal interno (solo se referencia desde el nuevo + New).
- Roles / aprobaciones backend logic (ya funciona, solo cambia UI).

---

## Detalles técnicos clave

- **Áreas**: una `migration` agrega tabla + RLS + seed; un `createServerFn` `listAreas` + `upsertArea` + `deleteArea` con `requireSupabaseAuth` (admin checks en handler usando `has_role`).
- **Documents store**: `Document` gana `areaId?: string`; `partialize` ya excluye binarios, sin cambios.
- **Approvals thumbnails**: helper puro `renderDocThumbnail(snapshot, { width, height })` que toma el primer page y devuelve `<svg>`; reusable en home cards también (mejora visual).
- **Sidebar nav state**: nuevo helper `useActiveSection()` que matchea pathname.
- **Fonts**: agregar `<link>` preconnect + `display=swap` en `__root.tsx`.

## Files a tocar / crear
- `src/styles.css` (tokens + fonts)
- `src/routes/__root.tsx` (fonts link)
- `src/routes/home.tsx` (sidebar limpio, chips de áreas, modal new, badge approvals)
- `src/routes/documents.tsx` (nuevo)
- `src/routes/integrations.tsx` (nuevo)
- `src/routes/approvals.tsx` (rediseño cards)
- `src/routes/admin.tsx` (sección Áreas)
- `src/components/flowit-logo.tsx` (nuevo)
- `src/components/doc-thumbnail.tsx` (nuevo)
- `src/components/area-picker.tsx` (nuevo)
- `src/lib/areas.functions.ts` (nuevo, serverFn)
- `src/lib/diagram-store.ts` (campo `areaId`)
- `src/lib/preloaded-demo.ts` (2-3 templates)
- Migration Supabase: tabla `areas` + RLS + seed.

## Objetivo

Arreglar el crash de `QuotaExceededError` y hacer un barrido completo de UI sobre las 3 áreas marcadas. Sin tocar lógica de negocio salvo donde sea necesario para que la UI no rompa.

---

## 1. Persistencia (bug crítico)

**Problema:** `localStorage["flowit-store"]` se desborda. Hoy se persiste el estado completo, incluyendo:
- `past[]` y `future[]` (hasta 50 snapshots completos del documento — multiplica todo por 50)
- `imageDataUrl` de shapes (base64)
- `documents[].fileDataUrl` en `DocEntry` (PDFs/imágenes en base64)
- `uploads` enteros

**Fix:**
- Agregar `partialize` al `persist(...)` en `src/lib/diagram-store.ts` que:
  - Excluya `past`, `future`, `uploads`.
  - Recorra `documents → pages → shapes` y reemplace `imageDataUrl` y cada `documents[].fileDataUrl` por `undefined` antes de serializar (mantiene metadata: `name`, `docType`, `url`, `fileMime`, `fileSize`, `fileName`).
- Wrap del `setItem` con try/catch: si falla, mostrar un toast "Espacio local lleno — se quitan imágenes" y reintentar sin blobs.
- Después de cada `commit`, recortar `past` a 20 (en vez de 50) snapshots para reducir memoria.

---

## 2. Resumen de cambios (sidebar + modal)

Barrido sobre las 6 vistas implementadas. Bugs/mejoras a aplicar:

**Sidebar (todas las vistas):**
- Tabs en pills hacen wrap a 3 líneas en 280px — reducir a `text-[10px]` y `gap-1` para que entren en 2 líneas máximo.
- StatBar: "Docs faltantes" rompe en 2 líneas, ajustar tamaño y truncar a "Docs" en sidebar.
- `Ver más →` aparece sólo cuando el corte de 5 oculta items reales (hoy aparece también con 5 exactos en algunos casos).
- Los pills de shape (`ShapePill`) deben truncar con `max-w-[140px]` para no romper layout.

**General:**
- En sidebar el orden actual es correcto. Asegurar `gap` consistente entre secciones y separadores (problema reportado en mensajes anteriores).

**Por persona:**
- LoadBar muestra %loadPct que puede dar 0% pero igual aparece la persona — ocultar barra si pct = 0.
- Avatar usa hash de id; algunos colores quedan muy claros sobre texto blanco — forzar `lightness` a ~45%.
- Tag "Sin asignar" debe ir siempre al final, hoy va al final pero después del "Ver más" — reordenar.

**Por prioridad:**
- Cuando un shape tiene alert y entry, hoy muestra sólo el icono de alert (muy poca info) — mostrar título de alerta junto al icono.
- El collapse del grupo no recuerda estado al cambiar de vista y volver — ya está OK con `openGroups`, verificar.

**Por categoría:**
- Entries con múltiples categorías aparecen duplicados en el contador del header pero no en el "Ver más" del modal — corregir conteo en modal para considerar único por entry+categoría.

**Documentación:**
- Grid de Doc Types se ve apretado en sidebar (1 col). Cards deben tener `min-height` igual para alinear.
- "Responsables con más gaps": badge rojo `gaps > 2` está OK, pero falta hover state en la fila.

**Por proceso:**
- ProgressMeter no se ve bien en 280px (barra de 24 + label = se corta). Usar barra de 80px y mover label debajo en sidebar.
- Sub-procesos indentados se ven cortados — usar `marginLeft: 16` y borde izquierdo guía.

**Fullscreen modal:**
- Header se rompe en viewports < 1100px porque pills + tabs + close no entran. Wrap a 2 filas con `flex-wrap`.
- Columna derecha: cuando se elige `person`, el botón "Ir a la shape →" del footer apunta a la primera shape — esconder footer si selección es de persona.
- Al cambiar de tab se resetea `sel` correctamente, pero el scroll del lado izquierdo no — resetear `scrollTop` a 0.
- Tabs en modal con `size="sm"` aún hacen wrap — reducir padding a `px-2 py-0.5`.

---

## 3. Popups de hover sobre shapes

- Popup queda **debajo** del botón ⊞ de sub-proceso cuando aparece en top-left. Ajustar `computePos` para evitar también esa zona (24px desde top-left).
- Línea punteada parte de la pin button (top-right de la shape) en algunas posiciones — debe partir siempre del borde más cercano de la shape, no de la pin button.
- Cuando el popup está pinneado y se hace zoom out, la línea queda desconectada porque `shapeInOverlayRef` no actualiza si la shape sale del viewport — recalcular en cada frame con `requestAnimationFrame`.
- Drag del popup pinneado: si soltás fuera del viewport, el popup queda inaccesible. Clamp a `[0, vw-w] × [0, vh-h]`.
- Botón de pin (📌) hover state es invisible sobre fondos blancos — agregar `border` + `shadow`.

---

## 4. Sub-procesos (modal con zoom)

- Animación de zoom-in: el `originRect` se mide con `getBoundingClientRect()` pero si el canvas tiene scroll, el rect queda desfasado. Usar `rect.left + window.scrollX`.
- Overlay oscuro aparece **antes** de que termine la animación — debe aparecer en sync (fade-in 200ms paralelo).
- Cerrar con Escape funciona pero no anima de vuelta — disparar la animación reversa antes de `unmount`.
- Click en el overlay no cierra el modal (sólo Escape y la X). Agregar `onClick` al overlay.
- Editar un shape dentro del sub-proceso: el RightPanel del editor principal también se actualiza con la selección del sub-modal — hoy hay independent state, pero verificar que no haya bleed.
- Toolbar lateral de shapes en el modal: los iconos no tienen tooltip, agregar `title`.
- Resize del modal: la handle de bottom-right no se ve sobre fondo claro — agregar borde.
- Cuando el modal está abierto y haces pan en el canvas principal (atrás), el pan se ejecuta (no debería). El overlay debe capturar todos los pointer events.

---

## 5. UI general del editor

- Toolbar superior: dropdown de fuente abre por encima de otros controles — verificar `z-index`.
- Slider de opacidad no muestra el valor numérico — agregar etiqueta "67%".
- Botón de shadow toggle no tiene estado visual activo — variant filled cuando `shadow: true`.
- Cursor de resize handles en shapes muy chicos se solapa con el cursor de move — z-order de handles encima del shape body.
- Scroll del RightPanel salta cuando se agrega un improvement entry — preservar scroll position.
- Breadcrumb / tabs de páginas: si el nombre es largo, rompe el layout. Truncar a 24 chars con ellipsis.

---

## Archivos a tocar

- `src/lib/diagram-store.ts` — partialize, try/catch, MAX_HIST = 20.
- `src/routes/editor.tsx` — todo el resto (ya es donde vive `SummaryPanel`, `FullSummaryModal`, `ShapeNode`, popups, `SubProcessModal`, toolbar).
- Sin nuevas dependencias, sin migrations.

## Validación

1. Typecheck limpio (`bunx tsc --noEmit`).
2. Recargar la página y verificar que `localStorage["flowit-store"]` < 1MB con un documento con 1 imagen.
3. Editar shape repetidas veces sin crash.
4. Recorrer las 6 vistas del Resumen en sidebar (280px) y modal (full).
5. Abrir/cerrar sub-proceso, verificar animación in y out, Escape, click en overlay.
6. Hover sobre shapes y pin → popup en posiciones extremas del canvas.

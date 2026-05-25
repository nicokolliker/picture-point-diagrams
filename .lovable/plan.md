
## 1. Toolbar flotante estilo Miro para edición de shapes

Hoy `FormatBar` vive en la barra superior fija del editor. Mover a una barra flotante contextual sobre la shape seleccionada, igual a Miro.

- Nuevo componente `FloatingFormatBar` renderizado vía `createPortal` dentro del `overlayRef` de `CanvasArea` (mismo patrón que los popups → no se mueve con sidebars).
- Se ancla arriba de la(s) shape(s) seleccionada(s) con `computeRect()` similar a `computePos`, recalculando en `pan`/`zoom`/`renderedH` y al redimensionar.
- Se oculta automáticamente cuando no hay selección, durante drag, o cuando hay multi-selección con shapes muy separadas (fallback: top-center del viewport).
- Se quita la FormatBar de la barra superior. La barra superior queda sólo con acciones globales (undo/redo, zoom, vista, etc.).

Contenido de la barra (paridad con Miro), agrupado con separadores verticales:
1. Color de relleno (swatch + popover con paleta + custom hex + slider de opacidad con valor numérico "67%").
2. Color y grosor de borde + estilo (sólido/dashed/dotted).
3. Tipografía: family, size (con stepper ▲▼), bold/italic/underline, alineación (izq/centro/der), color de texto.
4. Estilo de esquina (sharp / rounded / pill) como toggle de 3 estados.
5. Sombra (toggle con variant filled cuando está activo).
6. Capa (traer al frente / enviar atrás).
7. Link, lock, comentarios (placeholders consistentes con el resto).
8. Menú `⋮` con "Duplicar", "Copiar estilo", "Eliminar".

Detalles UX:
- Pills redondeadas, fondo blanco, sombra `0 8px 24px rgba(0,0,0,0.12)`, borde `1px solid #E5E7EB`.
- Cada popover (color, fuente) abre debajo con z-index por encima de la propia barra y se cierra al click afuera.
- Tooltips con `IconTip` en cada botón.
- La barra nunca se solapa con la shape: si no entra arriba, se ancla abajo.

## 2. Popup pineado no debe seguir al pan/scroll

Síntoma: aunque `computePos` hace early-return cuando `pinned`, el popup igual se mueve. Causa: el popup vive en el `overlayRef` del `CanvasArea`, pero ese overlay está dentro del contenedor que pannea (o hereda el `transform` del layer pannable). El "freeze" actual sólo congela las coordenadas, no el sistema de referencia.

Fix:
- Asegurar que `overlayRef` es un `<div absolute inset-0>` hermano del layer pannable (no hijo). Si ya lo es, el bug está en que las coordenadas guardadas son del shape (pannean) en vez de del viewport.
- Cuando se pinea, convertir `popupPos` a coordenadas **viewport-fijas** (sumar `pan` y multiplicar por `zoom` una sola vez al pinear) y dejar el popup como `position: fixed` mientras está pineado, fuera del overlay pannable.
- El extremo "shape" del connector sí debe recalcularse con `pan`/`zoom` cada frame (ya lo hace `shapeInOverlayRef`), el extremo "popup" queda fijo en viewport.
- Clamp del drag del popup pineado a `[0, vw-w] × [0, vh-h]` para que no quede inaccesible.

## 3. Edición de objetos dentro de sub-procesos

`SubProcessModal` ya monta `CanvasArea` + `RightPanel` con state propio, pero las shapes no se pueden editar. Causas a verificar/corregir:

- El contenedor exterior del modal hace `onPointerDown={(e) => e.stopPropagation()}` y `onClick={(e) => e.stopPropagation()}`. Eso no debería bloquear handlers internos, pero sí rompe el ciclo `pointerdown → focus` de inputs anidados (textareas de shapes) en algunos casos. Quitar el `stopPropagation` del contenedor y manejarlo sólo en el overlay oscuro de fondo.
- Verificar que el `docId`/`pageId` que recibe `CanvasArea` apunta a la página del sub-proceso y que las mutaciones (`updateShape`, `addShape`, etc.) están escribiendo en esa misma página y no en la página principal.
- Verificar que `RightPanel` dentro del modal opera sobre `selectedIds` locales y aplica `onChange` a la página del sub-proceso (no a la principal).
- Asegurar que el modal acepta foco de teclado (tab-index, `onKeyDown` para Delete/Backspace de la shape seleccionada dentro del modal y no a nivel global del editor).

Resultado esperado: dentro del modal funciona drag, resize, edición de texto, FloatingFormatBar (punto 1), y atajos de teclado, exactamente igual que en el canvas principal.

## 4. Ícono de sub-proceso: ⊞ → shuffle

Reemplazar el glifo `⊞` por el ícono `Shuffle` de lucide-react en los tres lugares donde aparece:
- Badge en la esquina top-left de `ShapeNode` (trigger del modal).
- Header del `SubProcessModal` (cuadrito azul a la izquierda del nombre).
- Tab de página en la barra de páginas (`⊞ ${pd.page.name}` → ícono + nombre).

Mantener el mismo tamaño visual (14px), color heredado del contenedor, con `IconTip` "Abrir sub-proceso" en el trigger.

---

## Archivos a tocar

- `src/routes/editor.tsx` — `FormatBar` → `FloatingFormatBar` con portal, lógica de anclaje, freeze de popup pineado, fix de edición en `SubProcessModal`, reemplazo de ⊞ por `Shuffle`.
- Sin cambios en store, types, ni nuevas dependencias.

## Validación

1. Seleccionar una shape en el canvas principal → la barra flotante aparece encima, con todos los controles. Mover/zoom el canvas → la barra sigue a la shape.
2. Pinear un popup, hacer pan/zoom y scroll de página → el popup queda fijo en viewport, la línea sigue conectada al borde de la shape.
3. Abrir un sub-proceso → crear shape desde el toolbar lateral, arrastrarla, redimensionarla, editar su texto, cambiar color con la barra flotante, borrar con Delete.
4. Verificar que el ícono shuffle aparece en los 3 lugares.

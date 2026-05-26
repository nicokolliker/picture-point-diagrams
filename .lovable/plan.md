# Plan — Estados, diff y logo

## 1. Estado se queda en "En auditoría" después de aprobar

**Diagnóstico.** Cuando el aprobador decide en `/approvals`, esa pantalla sí corre `syncApprovedSnapshots()` y actualiza el store local de ese usuario. Pero el **solicitante**, que ya está en `/home`, sólo sincroniza al montar la ruta (línea 95 de `home.tsx`). Mientras tanto su store sigue con `status: "in_review"` (lo seteamos en `EditModeBar.onSubmit`). Resultado: aunque el backend ya marcó la request como `approved`, el doc local sigue figurando en "En auditoría".

Además, en el flujo de **fork** (Modificar proceso publicado), el snapshot lleva el id del fork pero `doc_id` apunta al padre. `applyApprovedSnapshot` archiva el fork y publica el padre, pero si el sync no se dispara, el fork queda visible como "in_review".

**Cambios.**

- `src/routes/home.tsx`
  - Re-sincronizar en `window` `focus` y `visibilitychange` (cuando el tab vuelve a estar activo).
  - Poll liviano cada 20s mientras la pestaña está visible.
  - Filtrar de la lista los docs con `archived === true` (el fork archivado no debe aparecer como tarjeta separada).
- `src/lib/sync-approved.ts`
  - Devolver un boolean si aplicó algo nuevo, para que la home pueda toastear "Publicado" cuando un doc pasa de `in_review` a `published`.
- `src/routes/editor.tsx`
  - Reemplazar el pill "Draft / Published" hecho a mano (líneas ~366–375) por `<StatusPill>` para que coincida con la home y refleje `in_review`. Eliminar el botón que toggle-aba `status` directo desde el editor (rompe el flujo de aprobación).
- `src/components/EditModeBar.tsx`
  - Al enviar la solicitud, mostrar el toast "Solicitud enviada" pero **no** navegar automáticamente a `/approvals`; ofrecer un botón en el toast. Esto evita que el solicitante "pierda" el doc y vea sólo el estado intermedio.

## 2. El diff se rompe / no se entiende

**Diagnóstico.** `ChangesDiffModal` mete en un mismo SVG las shapes de **todas** las páginas (incluidas sub-procesos). Cuando un sub-proceso tiene coordenadas muy alejadas, el `viewBox` se estira y las shapes del flujo principal aparecen como puntitos. Además, el modo "lado a lado" cuando `prev` y `next` tienen tamaños distintos no respeta el aspect ratio.

**Cambios en `src/components/ChangesDiffModal.tsx`.**

- Calcular el diff y los bounds **por página** (`pageId`), no global. Mostrar pestañas si hay más de una página con cambios (default: la primera con diffs).
- Forzar un `viewBox` común entre `prev` y `next` en modo "Lado a lado" (unión de bounds) para que las dos mitades se vean al mismo zoom y se entienda qué se movió.
- Dibujar conectores (no sólo shapes) con el mismo esquema de color: verde nuevos, rojo eliminados, gris base. Hoy sólo se cuentan.
- Agregar un mini-render del texto (`<text>`) centrado en cada shape, truncado a ~14 chars, para que se identifique qué nodo es cuál.
- Cuando `prev === null` y modo "Overlay", reemplazar el `<DiffCanvas>` por la vista propuesta sola con un banner "Primera versión" arriba (en lugar de pintar todo como "agregado" gigante que se ve raro).
- En el listado de detalle, agrupar por categoría (Agregadas / Eliminadas / Movidas / Editadas) con headers.

## 3. Logo más chico + gradient violeta/azul oscuro

**Cambios en `src/components/flowit-logo.tsx`.**

- Bajar `size` default de 28 → 22. Reducir el ring (`ringSize` 86% → 80%) y el ícono.
- Cambiar el wordmark: en vez de inyectar el SVG negro tal cual (`<img>`), embeber el SVG inline y aplicarle `fill: url(#flowit-wordmark-grad)` con un gradient violeta→azul oscuro (`#3730A3` → `#1E3A8A`, parecido al ramp del usuario pero más oscuro). El ícono shuffle usa el mismo gradient para que todo sea una sola familia.
- Ajustar los call-sites donde se pase `size` explícito en headers para mantener proporciones (revisar `home.tsx`, `editor.tsx`, `approvals.tsx`, `templates.tsx`, etc. — sólo bajar valores, no romper layout).

## Notas técnicas

- El SVG de Chill It vive en `src/assets/chillit-logo.svg`. Para aplicar gradient hace falta importarlo como componente (Vite soporta `?react`) o leer el contenido y pegarlo inline. Voy con la opción inline (un mini componente `<ChillitWordmark>` dentro de `flowit-logo.tsx`) para no agregar plugins.
- No tocamos el esquema de Supabase ni `approvals.functions.ts`; el backend ya hace lo correcto, el problema es de propagación cliente.
- No se modifica el comportamiento de fork/aprobación, sólo cómo se refleja localmente y cómo se visualiza el diff.

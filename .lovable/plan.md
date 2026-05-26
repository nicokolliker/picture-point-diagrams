
## 1. Logo un toque más chico

`src/components/flowit-logo.tsx`: bajar el default de `size = 34` → `size = 28` y reducir `wordmarkHeight` a `size * 0.85`. Verificar alineación en sidebar (232px) y en headers de editor/approvals donde se pasa `size={26}`.

## 2. Auto-publicación al aprobar (bug actual)

Hoy el trigger SQL marca el `publish_request` como `approved`, pero no pasa nada con el doc en el cliente: el snapshot nunca reemplaza al documento ni cambia su status. Por eso "no salio a publicados".

**Store** (`src/lib/diagram-store.ts`) — nueva acción:
- `applyApprovedSnapshot(docId, snapshot, meta)`:
  - Reemplaza `pages` del doc por las del snapshot.
  - `status = "published"`, `baseline = { pages: snapshot.pages, capturedAt: now }`.
  - Empuja al array `versions` (ver §3) un registro `{ version_number, approvedAt, requestId, requester, approvers[], note, snapshot }`.
  - Si el doc no existe localmente (otro usuario lo creó), lo inserta desde el snapshot.

**Aplicar al sincronizar**:
- En `src/routes/approvals.tsx`, después de `decide(... "approve")`, refrescar el request; si `status === "approved"`, llamar `applyApprovedSnapshot` con la lista de approvals.
- En `src/routes/home.tsx` (y editor al cargar), un `useEffect` consulta `publish_requests` con `status='approved'` y, para cada doc local con `lastSyncedRequestId` distinto, aplica el snapshot. Esto cubre el caso de que apruebe otro y mi cliente lo refleje.

**Tipo** (`src/lib/shape-types.ts`): agregar `lastSyncedRequestId?: string` y el array `versions` (§3) a `DiagramDocument`.

## 3. Vista de publicados con metadata y versiones

**Modelo** (`src/lib/shape-types.ts`):
```ts
interface DocVersion {
  versionNumber: number;
  approvedAt: number;
  requestId: string;
  requesterId: string;
  approverIds: string[];
  note?: string;
  snapshot: { pages: Page[] };
}
interface DiagramDocument {
  // ...
  versions?: DocVersion[];     // append-only
  currentVersion?: number;     // = versions.at(-1)?.versionNumber
  publishedAt?: number;
}
```

**Cards en home (status = published)** — `src/routes/home.tsx`:
- Mostrar `Actualizado · {fecha}`, `v{currentVersion}`, avatars de últimos aprobadores y requester.
- Acciones del card dropdown: `Ver versiones`, `Modificar`, `Auditar`.

**Nuevo componente** `src/components/VersionsModal.tsx`:
- Lista (tabla) con: versión, fecha, requester, aprobadores (avatars), nota, thumbnail mini.
- Click en una fila → split-view read-only mostrando esa versión + botón **"Ver diff vs actual"** (reutiliza `ChangesDiffModal`) y **"Restaurar como borrador"** (clona snapshot a un draft nuevo vía `createFromTemplate`-like helper `restoreVersionAsDraft(docId, versionNumber)`).
- Acceso: botón en home card de publicados y en editor header.

## 4. Modificar ≠ Auditar (flujo)

**Modificar** (`PickProcessModal` mode="edit") — al seleccionar un proceso **publicado**:
1. Mini diálogo con dos opciones:
   - **Editar borrador existente** (visible si ya hay draft propio en curso para ese doc, derivado de `documents` con `originDocId === pub.id && status==='draft'`).
   - **Proponer cambio a publicado** → llama nueva acción `forkPublishedToDraft(docId)`:
     - Clona el doc publicado a un draft nuevo con `originDocId = docId`, `baseline = snapshot actual`, `status='draft'`, `name = "<name> (cambios)"`.
     - Abre `/editor?doc=<nuevoDraft>&mode=edit`.
2. Al **Solicitar publicación** desde `EditModeBar`: crear `publish_request` con `doc_id = originDocId` (no el del draft) + snapshot del draft, y **redirigir a `/approvals`** (toast con CTA "Ver aprobaciones").

**Borrador propio sin publicado padre** (caso doc creado de cero): mantiene el flujo actual, redirige a `/approvals` igual.

**Auditar** (proactivo, sólo lectura) — `PickProcessModal` mode="audit" ahora lista **publicados** (no `in_review`). Abre `/editor?doc=<id>&mode=audit`:
- Canvas read-only, banner sky "Modo auditoría".
- Panel derecho `AuditPanel` permite registrar diagnósticos, inconsistencias, oportunidades por shape (campos ya soportados o agregados — esto queda como follow-up del plan anterior si no está hecho).
- Botón **"Crear modificación desde esta auditoría"** → `forkPublishedToDraft` con las observaciones copiadas al draft.

**`/editor` `?mode`**: si falta, default `audit` para publicados y `edit` para drafts/in_review.

**Sidebar home**: el item "En auditoría" pasa a contar **publicados con auditoría en curso** (cualquier shape con `diagnostico` o `inconsistencias` registradas recientemente). "Pendientes de aprobación" se mueve a un item nuevo enlazando a `/approvals` con badge de conteo (`status='in_review'` o requests `pending` del usuario).

## 5. Limpieza de estado

- Quitar `status = 'in_review'` al **modificar** un publicado (ese cambio queda como draft propio, no toca el publicado original).
- `in_review` queda sólo durante la vida de un `publish_request` pendiente; al aprobarse, el draft hijo se archiva (`archived: true`, oculto del listado) y el publicado salta a la nueva versión.

## Archivos tocados

```text
src/components/flowit-logo.tsx          # tamaño
src/components/VersionsModal.tsx        # NEW
src/components/PickProcessModal.tsx     # mode=audit lista publicados, mode=edit con sub-selector
src/components/EditModeBar.tsx          # redirección a /approvals tras solicitar
src/lib/shape-types.ts                  # versions, currentVersion, publishedAt, originDocId, archived, lastSyncedRequestId
src/lib/diagram-store.ts                # applyApprovedSnapshot, forkPublishedToDraft, restoreVersionAsDraft
src/routes/approvals.tsx                # tras aprobar → applyApprovedSnapshot
src/routes/home.tsx                     # metadata en cards publicados, dropdown Ver versiones, sync inicial
src/routes/editor.tsx                   # mode default por status, banner audit, botón Versiones
```

## Fuera de alcance

- Persistencia server-side del historial de versiones (vive en `publish_requests.snapshot` que ya guardamos; el array local se hidrata desde ahí).
- Nuevas migraciones SQL: no hacen falta, `publish_requests` ya guarda snapshot, requester, aprobadores via `approvals`, fecha y nota.
- Cambios al AuditPanel/diagnósticos (asume lo del plan previo).

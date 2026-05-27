## Phase 3 — Auditorías, permisos por área y aprobaciones configurables

Implemento los tres bloques en orden, cada uno verificable por separado.

### 1) Auditorías end-to-end

**Store + UI**
- Nuevo helper `audits.functions.ts` (serverFn con `requireSupabaseAuth`) con:
  - `openAudit(docId, docName)` — crea un audit `open` (unique parcial ya garantiza uno solo abierto).
  - `addFinding(auditId, { pageId?, shapeId?, severity, title, description })`.
  - `closeAudit(auditId, summary)`.
  - `promoteFindingToDraft(findingId)` — clona el doc publicado a draft (fork) y guarda `promoted_to_doc_id`.
- Nuevo `AuditPanel` (drawer derecho en `/editor`):
  - Lista de findings con severidad (info / opportunity / risk / blocker) y color.
  - Botón "Marcar shape" para asociar el finding al `selectedIds[0]` y `currentPage`.
  - Botón "Promover a propuesta" → crea fork draft con `originDocId` y navega.
- En `/home`: el modo "Auditar proceso" abre `PickProcessModal` filtrando `status=published`; al seleccionar abre el editor en modo solo-lectura + `AuditPanel`.
- Badge ⚠️ en cards cuando el doc tiene una auditoría abierta.

### 2) Permisos por área en UI (visibilidad real)

- Nuevo hook `useAreaMembership()` que cachea `area_members` del usuario por área (rol).
- Filtrado en `/home`, `/documents`, pickers y aprobaciones según reglas:
  - `draft`: visible solo a `created_by`.
  - `in_review`: `created_by` + approvers + auditores del área + owners.
  - `published`: cualquier miembro del área + `doc_notified`.
- Acciones gated:
  - "Modificar proceso" solo si rol ≥ editor en alguna de las áreas del doc.
  - "Auditar" solo si rol = auditor / owner / super_admin.
  - "Aprobar" solo si está en `doc_approvers`.
- Pequeño `RoleBadge` en la barra del editor mostrando el rol efectivo en el doc actual.

### 3) Aprobaciones configurables

- En `/admin` agrego sección **Aprobadores por proceso**:
  - Selector de doc → multi-select de usuarios (de los miembros del área) → input `required_count` (1–N).
  - Persiste en `doc_approvers` (ya existe).
- `EditModeBar` "Request publish" toma `required_count` del doc y lo guarda en `publish_requests.required_approvals`.
- En `/approvals`:
  - Mostrar progreso `X / N aprobaciones`.
  - Botón **Aprobar** y **Rechazar** con textarea de comentario obligatorio en rechazo.
  - Al rechazar: el trigger `check_approval_threshold` ya marca la request como `rejected`; añado lógica cliente que, si la request es `rejected`, regresa el doc a `draft` y muestra los comentarios al autor en `EditModeBar` (sección "Cambios solicitados").
- Notificación visual: chip rojo "Cambios solicitados" en cards de docs cuya última request fue rechazada.

### Detalles técnicos

- Nuevos serverFns en `src/lib/audits.functions.ts` y `src/lib/approvals.functions.ts`. Promoción de finding usa `supabaseAdmin` solo del lado servidor para clonar snapshot.
- Tipos compartidos en `src/lib/audit-types.ts` (`Finding`, `AuditSeverity`, `AuditStatus`).
- No se tocan `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`.
- Migración mínima adicional: ninguna (las tablas ya están). Si surge necesidad de un índice de búsqueda lo añadiré en una migración separada.

### Orden de entrega

1. Auditorías (serverFns + AuditPanel + integración con `/home` "Auditar").
2. Permisos por área (hook + filtrados + gating de acciones).
3. Aprobaciones configurables (admin UI + flujo de rechazo + indicadores).

Verifico cada paso en preview antes de pasar al siguiente.
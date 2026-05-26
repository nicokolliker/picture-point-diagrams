
# Modelo de flujos de FlowIt (consolidado)

Esto resume — basado en tus respuestas — cómo debería comportarse cada estado y transición. Si algo acá no coincide con lo que pensabas, lo ajustamos antes de implementar.

## 1. Roles

Roles **por área** (un mismo usuario puede tener distintos roles en distintas áreas):

- **Viewer**: ve procesos publicados del área.
- **Editor**: crea borradores, modifica, propone cambios.
- **Auditor**: audita procesos publicados, abre hallazgos, puede promoverlos a propuesta de cambio.
- **Approver**: aprueba/rechaza solicitudes de publicación del área.
- **Notified**: no decide, recibe notificación de cambios publicados.
- **Super admin** (global): configura áreas, asigna roles, configura cuántos aprobadores requiere cada proceso y quiénes son los notificados.

Cambio de schema: tabla nueva `area_members(area_id, user_id, role)` con role enum `viewer|editor|auditor|approver|notified`. `user_roles` global queda solo para `super_admin`/`admin`.

## 2. Estados de un proceso

```text
                  ┌──────────┐
   crear ───────► │  draft   │ ◄────── rechazo ──────┐
                  └────┬─────┘                       │
              request publish                        │
                       ▼                             │
                  ┌──────────┐                       │
                  │in_review │ ──────────────────────┘
                  └────┬─────┘
              N approvals OK
                       ▼
                  ┌──────────┐    nueva versión aprobada
                  │published │ ◄──────────────────────┐
                  └────┬─────┘                        │
              "Modificar" (fork)                      │
                       ▼                              │
                  ┌──────────┐  request publish       │
                  │  draft   │ ─────► in_review ──────┘
                  │ (fork)   │
                  └──────────┘
```

- `draft`: privado del autor. Nadie más lo ve en home.
- `in_review`: visible para approvers/notified del área + autor. Read-only para el resto.
- `published`: visible para todos los miembros del área.
- `archived` (flag, no estado): fork que se mergeó al padre se archiva.

## 3. Crear proceso

- Cualquier **Editor del área** puede crear (blank / template / capture).
- Nace como `draft` privado: solo el autor lo ve hasta que pida aprobación.
- El doc se asocia al/los `areaIds` elegidos al crear.

## 4. Modificar proceso publicado

- Editor abre "Modificar" desde el modal de PickProcess.
- Si el doc está `published` → **fork a draft propio** (`originDocId = parentId`, `archived=false`). El publicado sigue vivo, otros pueden seguir usándolo y proponiendo en paralelo (varios forks coexisten).
- Editor trabaja en su fork y cuando termina, pide aprobación.

## 5. Auditar proceso publicado

- Auditor abre "Auditar" → entra en modo `audit` sobre el publicado (read-only sobre shapes).
- Puede:
  - Marcar **status del proceso** (Verde / Amarillo / Rojo).
  - Crear **hallazgos** (inconsistencias, oportunidades, riesgos) anclados a shapes o al proceso entero.
  - Cerrar la auditoría → queda guardada como objeto propio en historial del doc, con autor, fecha y status.
- Desde una auditoría puede **"Promover a propuesta"**: genera un fork-draft con los hallazgos pre-cargados como notas/sugerencias y entra al flujo normal de modificación → aprobación.
- La auditoría NO modifica el publicado. Solo el flujo de modificación + aprobación puede.

Cambio de schema: tabla `audits(id, doc_id, auditor_id, status, summary, created_at, closed_at)` + `audit_findings(audit_id, shape_id?, severity, title, description, promoted_to_doc_id?)`.

## 6. Aprobaciones

- Super admin define, por proceso (no por área): `required_approvals` (N) y la lista de `approvers` + `notified`. Ya existe `doc_approvers` — sumamos `doc_notified(doc_id, user_id)`.
- Editor en su draft → "Solicitar publicación" → crea `publish_request` (pending). El doc pasa a `in_review`.
- Approvers ven la solicitud en `/approvals`. Pueden aprobar o rechazar con comentario.
- **Aprobación**: cuando llega a N approves, el snapshot se aplica al doc padre (o al doc original si es fork), versión sube +1, doc vuelve a `published`. Si era fork, el fork queda `archived`.
- **Rechazo**: cualquier rechazo cancela el request. El doc vuelve a `draft` con el comentario adjunto. El autor edita y vuelve a pedir aprobación (request nuevo, no se reabre el viejo). No hay iteración en vivo dentro del mismo request.
- Notified recibe notificación in-app + email cuando se publica (no aprueba).

## 7. Versiones y publicación

Cada aprobación crea un registro `versions` en el doc (ya existe `currentVersion` y `versions[]`). Desde el menú del doc publicado se puede ver historial, diff entre versiones y restaurar como nuevo borrador.

## 8. Visibilidad en home

- Filtros existentes (Estado, Área, búsqueda) se aplican según rol por área:
  - Viewer: solo ve `published` de sus áreas.
  - Editor: ve `published` + sus propios `draft`/`in_review` + forks propios.
  - Auditor: ve `published` + auditorías propias (sección nueva).
  - Approver: ve `published` + `in_review` de sus áreas (cualquier autor).
  - Super admin: ve todo.
- Forks `archived=true` no aparecen como card separada.

## 9. Cambios técnicos resumidos

- Schema: nuevas tablas `area_members`, `audits`, `audit_findings`, `doc_notified`. Migrar lógica de roles globales para que `editor/approver/auditor` salgan de `area_members`.
- Server fns: `setAreaMembers`, `createAudit`, `addFinding`, `closeAudit`, `promoteAuditToDraft`, `setDocApprovers` (super admin), `setDocNotified`.
- Store: agregar `audits` por doc, `originDocId` ya existe. Al rechazar request, transicionar `in_review` → `draft` y guardar comentario.
- UI:
  - Pantalla `/admin` extendida: gestionar miembros por área + aprobadores/notified por proceso.
  - Pantalla `/audits` (similar a `/approvals`): lista de auditorías abiertas/cerradas con su status.
  - Modo `audit` del editor: panel lateral de hallazgos + botón "Cerrar auditoría" + "Promover a propuesta".
  - Editor en modo modificación: si es fork, banner "Estás proponiendo cambios sobre v{N} de {Nombre}".
  - Home: filtros respetan rol por área. Card de `published` ya muestra v{N} y aprobadores; agregar última auditoría y status (🟢🟡🔴).

## Preguntas abiertas

1. Notificaciones: ¿alcanza con notificaciones in-app + email transaccional, o querés también algo como Slack?
2. Auditorías: ¿cualquier auditor puede abrir auditoría en paralelo, o solo una auditoría abierta por proceso a la vez?
3. ¿El super admin es el único que asigna roles por área, o también el owner del área (a definir como nuevo rol)?

Si confirmás esto y aclarás las 3 preguntas abiertas, paso a implementarlo por fases (schema → roles/visibilidad → auditorías → flujos de aprobación).

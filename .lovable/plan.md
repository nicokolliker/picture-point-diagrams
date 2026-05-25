# Plan: Aprobaciones de versiones + Input de Granola

## Decisiones tomadas
- **Trigger**: aprobación se pide al "Publicar" (draft → published).
- **Modelo**: N aprobaciones requeridas (sin orden), configurable por documento.
- **Granola**: conexión vía connector oficial; eleg ís la reunión de una lista.
- **AI**: genera un documento nuevo en **draft** que vos revisás antes de publicar.
- **Superadmin**: `nkolliker@chillit.com` — aprueba todo, gestiona usuarios y permisos.

---

## 1. Backend (Lovable Cloud)

Activar Lovable Cloud (no estaba). Toda la persistencia de docs (que hoy vive en `localStorage` vía `diagram-store.ts`) sigue en localStorage para no romper UX; **lo nuevo** (usuarios, roles, versiones, aprobaciones, reuniones Granola) va a DB.

### Tablas

```text
profiles                    user_roles                publish_requests
─────────                   ──────────                ────────────────
id (uuid, FK auth.users)    id                        id
email                       user_id → auth.users      doc_id           (texto: id local del doc)
display_name                role: app_role enum       doc_name
created_at                  created_at                version_number
                            unique(user_id, role)     snapshot (jsonb) ← copia inmutable del documento
                                                      requested_by → auth.users
                                                      required_approvals (int)
                                                      status: pending|approved|rejected|cancelled
                                                      created_at, resolved_at

doc_approvers               approvals
─────────────               ─────────
id                          id
doc_id (texto)              request_id → publish_requests
user_id → auth.users        approver_id → auth.users
required_count (int)        decision: approve|reject
unique(doc_id, user_id)     comment (text)
                            created_at
                            unique(request_id, approver_id)

granola_imports
───────────────
id
user_id → auth.users
note_id (granola)
note_title
generated_doc_id (texto, el id del nuevo documento)
status: pending|generating|ready|failed
created_at
```

`app_role` enum: `super_admin`, `admin`, `editor`, `viewer`.

### Seguridad
- RLS en todas las tablas.
- Función `has_role(user, role)` como `SECURITY DEFINER` (patrón estándar — los roles NUNCA viven en `profiles`).
- `super_admin` puede leer/escribir todo; `admin` gestiona usuarios menos super_admins; `editor` solicita aprobaciones; `viewer` solo lee.
- Trigger en signup: crea fila en `profiles`. Si email = `nkolliker@chillit.com`, inserta rol `super_admin` automáticamente.

---

## 2. Frontend: Auth

- Página `/login` con email/password + Google (default Lovable Cloud).
- Wrapper `_authenticated` para proteger rutas del editor.
- Header con avatar + menu (logout, "Admin" si corresponde).
- Cliente Supabase + `onAuthStateChange` en `__root.tsx`.

---

## 3. Frontend: Panel de administración (solo super_admin/admin)

Nueva ruta `/admin`:
- **Usuarios**: lista, invitar (email), cambiar rol, desactivar.
- **Aprobadores por proceso**: por cada documento, elegir aprobadores y `required_count` (N firmas).
- **Auditoría**: historial de `publish_requests` con quién aprobó/rechazó y cuándo.

---

## 4. Flujo de aprobación de versiones

### En el editor
- El botón **"Publish"** (que hoy cambia `status` a `published` localmente) cambia comportamiento:
  - Si el doc NO tiene aprobadores configurados → super_admin/admin publica directo; editor recibe error "configurar aprobadores".
  - Si tiene aprobadores → abre modal "Solicitar aprobación": snapshot del doc se guarda en `publish_requests.snapshot`, status `pending`.
- Mientras hay request `pending`, el doc muestra badge **"Pendiente de aprobación"** y el botón Publish queda deshabilitado.

### Nueva vista `/approvals`
- **Pendientes para mí**: requests donde figuro como aprobador.
- **Mis solicitudes**: requests que yo creé.
- Cada request muestra: nombre del doc, versión, quién pidió, diff resumido (cantidad de shapes/conectores nuevos/modificados/eliminados vs versión anterior), botones **Aprobar / Rechazar + comentario**.
- Cuando `approvals.count(approve) >= required_approvals` → status pasa a `approved`, el snapshot se aplica al documento local (`status: published`, se incrementa `version_number`).
- Cualquier rechazo → status `rejected`, queda registrado.

### Historial
- Tab "Versiones" en el editor: lista de `publish_requests` aprobadas con timestamp, autor, aprobadores. Permite ver snapshot de cualquier versión (read-only).

---

## 5. Input de Granola

### Conexión
- Usar `standard_connectors--connect` con `connector_id: granola`. El usuario conecta su cuenta una vez.

### UI
- Nuevo botón en el home (`/`) "Importar desde Granola" + tab dentro del editor.
- Modal con lista de reuniones (`GET /v1/notes` vía gateway), buscador, paginación.
- Al elegir una → server function que:
  1. Trae transcript + summary de la nota (`/v1/notes/{id}?include=transcript`).
  2. Llama a Lovable AI Gateway (`google/gemini-3-flash-preview`) con structured output (Zod schema) para generar:
     - Lista de shapes (tipo: rectangle/diamond/oval, título, descripción, responsable detectado).
     - Lista de conectores entre shapes.
     - Layout en grilla automática (posiciones x/y).
  3. Crea un `DiagramDocument` nuevo en localStorage vía un endpoint client-side post-respuesta, con `status: draft` y nombre = título de la nota.
  4. Registra el import en `granola_imports`.
- Toast: "Documento generado, abrir en editor".

### Server functions
- `src/lib/granola.functions.ts`:
  - `listGranolaNotes({ cursor, limit })`
  - `generateFlowchartFromNote({ noteId })` → retorna el JSON del documento.

### Schema AI (Zod)
```ts
z.object({
  name: z.string(),
  shapes: z.array(z.object({
    id: z.string(),
    type: z.enum(["rectangle","diamond","oval","sticky"]),
    title: z.string(),
    text: z.string(),
    responsable: z.string().optional(),
  })),
  connectors: z.array(z.object({
    fromId: z.string(), toId: z.string(), label: z.string().optional(),
  })),
})
```

---

## 6. Cambios en `diagram-store.ts`
- Agregar campo `pendingRequestId?: string` y `version: number` a `DiagramDocument`.
- Acción `applyApprovedSnapshot(docId, snapshot)` para reemplazar el doc cuando se aprueba.
- Acción `createDocumentFromAI(payload)` para Granola.

---

## 7. Detalles técnicos

- **Stack**: Lovable Cloud (Supabase) + TanStack Start.
- **Server functions** protegidas con `requireSupabaseAuth`.
- **Granola** vía connector gateway (`https://connector-gateway.lovable.dev/granola/v1/...`), headers `Authorization: Bearer $LOVABLE_API_KEY` + `X-Connection-Api-Key: $GRANOLA_API_KEY`.
- **AI** vía Lovable AI Gateway con `generateText` + `Output.object` (structured output).
- **Snapshot del doc**: JSON completo de la página/s con shapes y conectores; permite reaplicar exactamente la versión aprobada.
- **Diff resumido** computado en el cliente comparando snapshot vs versión publicada anterior.

---

## 8. Orden de implementación

1. Activar Lovable Cloud + crear schema (profiles, user_roles, has_role, RLS).
2. Auth UI (login + Google) + protección de rutas + trigger superadmin.
3. Panel `/admin` (usuarios + aprobadores por doc).
4. Schema `publish_requests` + `approvals` + flujo "Solicitar aprobación" en editor.
5. Vista `/approvals` + aplicación del snapshot al aprobarse.
6. Tab "Versiones" en el editor (historial read-only).
7. Conectar Granola + UI listado de reuniones.
8. Server function `generateFlowchartFromNote` + creación de doc draft.
9. QA end-to-end con tu cuenta superadmin.

¿Te cierra? Si querés ajusto algo (por ejemplo: agregar comentarios por shape en las requests, o notificaciones por email a aprobadores) antes de implementar.
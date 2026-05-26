import type { DiagramDocument, Shape, Connector, Diagnostico, Prioridad, Status } from "./shape-types";

const statusToDiag: Record<Status, Diagnostico> = {
  funciona: "funciona",
  riesgo: "inconsistente",
  roto: "roto",
  ninguno: "sin_definir",
};

const baseShape = (
  id: string,
  y: number,
  title: string,
  description: string,
  status: Status,
  prioridad?: Prioridad,
): Shape => ({
  id,
  type: "rectangle",
  x: 400,
  y,
  width: 240,
  height: 90,
  text: title,
  title,
  description,
  responsable: "",
  responsableIds: [],
  status,
  diagnostico: statusToDiag[status],
  prioridad,
  improvementEntries: [],
  documents: [],
  noStandardDoc: false,
  fontFamily: "Figtree",
  fontSize: 14,
  bold: true,
  italic: false,
  underline: false,
  textColor: "#111827",
  align: "center",
  borderStyle: "solid",
  borderWeight: 1,
  cornerStyle: "rounded",
  fill: "#ffffff",
  z: 1,
});

function chain(shapes: Shape[]): Connector[] {
  const out: Connector[] = [];
  for (let i = 0; i < shapes.length - 1; i++) {
    out.push({
      id: `c${i}`,
      fromId: shapes[i].id,
      toId: shapes[i + 1].id,
      label: "",
      lineStyle: "solid",
      weight: 2,
      arrowEnd: "arrow",
    });
  }
  return out;
}

export function createDemoDocument(): DiagramDocument {
  const shapes: Shape[] = [
    baseShape("s1", 60, "Entrada de leads", "WhatsApp + Forms", "funciona", "ok"),
    baseShape("s2", 200, "Calificación SQL", "7% conversión actual", "roto", "urgente"),
    baseShape("s3", 340, "Follow-up SDR", "Cadencia 2 semanas", "roto", "urgente"),
    baseShape("s4", 480, "Segmentación", "3 flujos mezclados", "riesgo", "proximo_sprint"),
    baseShape("s5", 620, "Propuesta y cierre", "ERP duplica datos", "riesgo", "backlog"),
    baseShape("s6", 760, "Medición", "Atribución rota", "roto", "urgente"),
  ];
  return {
    id: "demo-1",
    name: "Pipeline Comercial · España",
    category: "Processes",
    updatedAt: Date.now(),
    status: "draft",
    pages: [{ id: "p1", name: "Page 1", shapes, connectors: chain(shapes) }],
  };
}

function tmpl(
  id: string,
  name: string,
  steps: Array<[string, string, Status, Prioridad?]>,
): DiagramDocument {
  const shapes = steps.map(([t, d, s, p], i) =>
    baseShape(`${id}-s${i + 1}`, 60 + i * 140, t, d, s, p),
  );
  return {
    id,
    name,
    category: "Templates",
    isTemplate: true,
    status: "published",
    updatedAt: Date.now(),
    pages: [{ id: `${id}-p1`, name: "Page 1", shapes, connectors: chain(shapes) }],
  };
}

export function createSeedTemplates(): DiagramDocument[] {
  return [
    tmpl("tpl-onboarding", "Template · Onboarding de cliente", [
      ["Contrato firmado", "Disparador del proceso", "funciona", "ok"],
      ["Kick-off interno", "Asignación de equipo", "funciona", "ok"],
      ["Kick-off con cliente", "Expectativas y roadmap", "riesgo", "proximo_sprint"],
      ["Setup técnico", "Accesos + integraciones", "ninguno"],
      ["Capacitación", "Onboarding del equipo cliente", "ninguno"],
      ["Hand-off a CS", "Pasaje a Customer Success", "funciona", "ok"],
    ]),
    tmpl("tpl-pipeline", "Template · Pipeline comercial", [
      ["Lead capturado", "Inbound + outbound", "funciona", "ok"],
      ["Calificación", "Criterios SQL", "ninguno"],
      ["Demo / discovery", "Reunión con cliente", "ninguno"],
      ["Propuesta", "Cotización y términos", "ninguno"],
      ["Negociación", "Ajustes finales", "ninguno"],
      ["Cierre", "Contrato firmado", "ninguno"],
    ]),
    tmpl("tpl-soporte", "Template · Soporte / Ticket", [
      ["Ticket entrante", "Email, chat o portal", "funciona", "ok"],
      ["Triage", "Prioridad y categoría", "ninguno"],
      ["Asignación", "Owner del ticket", "ninguno"],
      ["Resolución", "Trabajo del agente", "ninguno"],
      ["Validación con cliente", "Confirmación de cierre", "ninguno"],
    ]),
  ];
}

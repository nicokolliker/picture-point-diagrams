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
  responsable: "Equipo Comercial",
  status,
  diagnostico: statusToDiag[status],
  prioridad,
  improvementEntries: [],
  documents: [],
  noStandardDoc: false,
  fontFamily: "Inter",
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

export function createDemoDocument(): DiagramDocument {
  const shapes: Shape[] = [
    baseShape("s1", 60, "Entrada de leads", "WhatsApp + Forms", "funciona"),
    baseShape("s2", 200, "Calificación SQL", "7% conversión actual", "roto"),
    baseShape("s3", 340, "Follow-up SDR", "Cadencia 2 semanas", "roto"),
    baseShape("s4", 480, "Segmentación", "3 flujos mezclados", "riesgo"),
    baseShape("s5", 620, "Propuesta y cierre", "ERP duplica datos", "riesgo"),
    baseShape("s6", 760, "Medición", "Atribución rota", "roto"),
  ];
  const connectors: Connector[] = [];
  for (let i = 0; i < shapes.length - 1; i++) {
    connectors.push({
      id: `c${i}`,
      fromId: shapes[i].id,
      toId: shapes[i + 1].id,
      label: "",
      lineStyle: "solid",
      weight: 2,
      arrowEnd: "arrow",
    });
  }
  return {
    id: "demo-1",
    name: "Pipeline Comercial · España",
    category: "Processes",
    updatedAt: Date.now(),
    status: "draft",
    pages: [{ id: "p1", name: "Page 1", shapes, connectors }],
  };
}

import type { DiagramDocument, Shape, Connector, ShapeType } from "./shape-types";

interface AIShape {
  id: string;
  type: string;
  label?: string;
}
interface AIConnector {
  from: string;
  to: string;
  label?: string;
}
export interface AIFlowchart {
  name: string;
  shapes: AIShape[];
  connectors: AIConnector[];
}

const ALLOWED: ShapeType[] = ["rectangle", "diamond", "oval"];

function normType(t: string): ShapeType {
  const v = t.toLowerCase();
  if (v.includes("diamond") || v.includes("decision")) return "diamond";
  if (v.includes("oval") || v.includes("start") || v.includes("end")) return "oval";
  return "rectangle";
}

const W = 180;
const H = 90;
const GAP_Y = 60;
const COL_GAP = 80;

export function buildDocFromAI(flow: AIFlowchart): DiagramDocument {
  // Naive vertical layout
  const shapes: Shape[] = flow.shapes.map((s, i) => ({
    id: s.id || `s${i}`,
    type: ALLOWED.includes(s.type as ShapeType) ? (s.type as ShapeType) : normType(s.type),
    x: 200 + (i % 3) * (W + COL_GAP),
    y: 120 + Math.floor(i / 3) * (H + GAP_Y),
    width: W,
    height: H,
    text: s.label ?? "",
    title: s.label ?? "",
    description: "",
    responsable: "",
    status: "ninguno",
    fontFamily: "Inter",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    textColor: "#111827",
    align: "center",
    borderStyle: "solid",
    borderWeight: 1,
    cornerStyle: "rounded",
    fill: "#FFFFFF",
    z: i,
  }));

  const idMap = new Map(shapes.map((s) => [s.id, s.id]));
  const connectors: Connector[] = flow.connectors
    .filter((c) => idMap.has(c.from) && idMap.has(c.to))
    .map((c, i) => ({
      id: `c${i}`,
      fromId: c.from,
      toId: c.to,
      label: c.label ?? "",
      lineStyle: "solid",
      weight: 1,
      arrowEnd: "arrow",
    }));

  const docId = `d${Date.now()}`;
  return {
    id: docId,
    name: flow.name || "Imported from Granola",
    category: "Processes",
    updatedAt: Date.now(),
    status: "draft",
    pages: [
      {
        id: `p${Date.now()}`,
        name: "Page 1",
        shapes,
        connectors,
      },
    ],
  };
}

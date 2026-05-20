export type Status = "funciona" | "riesgo" | "roto" | "ninguno";

export type ShapeType =
  | "rectangle"
  | "diamond"
  | "oval"
  | "parallelogram"
  | "cylinder"
  | "document"
  | "manual"
  | "text"
  | "sticky"
  | "container";

export interface Shape {
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  title: string;
  description: string;
  responsable: string;
  status: Status;
  imageDataUrl?: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  textColor: string;
  align: "left" | "center" | "right";
  borderStyle: "solid" | "dashed" | "dotted";
  borderWeight: 1 | 2 | 3;
  cornerStyle: "sharp" | "rounded";
  fill: string;
  z: number;
}

export interface Connector {
  id: string;
  fromId: string;
  toId: string;
  label: string;
  lineStyle: "solid" | "dashed" | "dotted";
  weight: 1 | 2 | 3;
  arrowEnd: "none" | "arrow" | "filled";
}

export interface Page {
  id: string;
  name: string;
  shapes: Shape[];
  connectors: Connector[];
}

export interface DiagramDocument {
  id: string;
  name: string;
  category: string;
  updatedAt: number;
  status: "draft" | "published";
  pages: Page[];
}

export const STATUS_COLORS: Record<Status, { bg: string; label: string }> = {
  funciona: { bg: "#16A34A", label: "Funciona" },
  riesgo: { bg: "#F59E0B", label: "En riesgo" },
  roto: { bg: "#DC2626", label: "Roto" },
  ninguno: { bg: "#9CA3AF", label: "Sin estado" },
};

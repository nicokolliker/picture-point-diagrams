export type Status = "funciona" | "riesgo" | "roto" | "ninguno";

export type Diagnostico = "funciona" | "inconsistente" | "roto" | "sin_definir";
export type Prioridad = "urgente" | "proximo_sprint" | "backlog" | "ok";

export type ImprovementCategory =
  | "proceso"
  | "personas"
  | "herramienta"
  | "documentacion"
  | "probar";

export type DocType = "Playbook" | "Template" | "SOP" | "Guía" | "Otro";

export const MISSING_DOC_TYPES = [
  "Playbook",
  "Template",
  "SOP",
  "Guía",
  "Capacitación",
  "Otro",
] as const;
export type MissingDocType = (typeof MISSING_DOC_TYPES)[number];

export interface Person {
  id: string;
  name: string;
  role?: string;
}

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

export interface ChangeEntry {
  id: string;
  text: string;
  date: number;
}

export interface ImprovementEntry {
  id: string;
  text: string;
  categories: ImprovementCategory[];
  date: number;
}

export interface DocEntry {
  id: string;
  name: string;
  docType: DocType;
  url: string;
  fileDataUrl?: string;
  fileMime?: string;
  fileSize?: number;
  fileName?: string;
}

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
  currentReality?: string;
  improvements?: string;
  improvementEntries?: ImprovementEntry[];
  documents?: DocEntry[];
  noStandardDoc?: boolean;
  missingDocTypes?: MissingDocType[];
  changes?: ChangeEntry[];
  responsable: string;
  responsableIds?: string[];
  status: Status;
  diagnostico?: Diagnostico;
  prioridad?: Prioridad;
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
  borderColor?: string;
  cornerStyle: "sharp" | "rounded";
  fill: string;
  z: number;
  subProcessPageId?: string;
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

export const DIAGNOSTICO_META: Record<
  Diagnostico,
  { bg: string; label: string; dot: string }
> = {
  funciona: { bg: "#16A34A", label: "Funciona", dot: "🟢" },
  inconsistente: { bg: "#F59E0B", label: "Inconsistente", dot: "🟡" },
  roto: { bg: "#DC2626", label: "Roto", dot: "🔴" },
  sin_definir: { bg: "#9CA3AF", label: "Sin definir", dot: "⚫" },
};

export const PRIORIDAD_META: Record<
  Prioridad,
  { bg: string; label: string; dot: string }
> = {
  urgente: { bg: "#DC2626", label: "Urgente", dot: "🔴" },
  proximo_sprint: { bg: "#EA580C", label: "Próximo sprint", dot: "🟠" },
  backlog: { bg: "#F59E0B", label: "Backlog", dot: "🟡" },
  ok: { bg: "#16A34A", label: "OK por ahora", dot: "🟢" },
};

export const CATEGORY_META: Record<
  ImprovementCategory,
  { bg: string; fg: string; label: string; icon: string }
> = {
  proceso: { bg: "#DBEAFE", fg: "#1E40AF", label: "Proceso", icon: "🔧" },
  personas: { bg: "#FCE7F3", fg: "#9D174D", label: "Personas", icon: "👤" },
  herramienta: { bg: "#E0E7FF", fg: "#3730A3", label: "Herramienta", icon: "🛠" },
  documentacion: { bg: "#FEF3C7", fg: "#92400E", label: "Documentación", icon: "📋" },
  probar: { bg: "#DCFCE7", fg: "#166534", label: "Probar", icon: "🧪" },
};

export const DOC_TYPES: DocType[] = ["Playbook", "Template", "SOP", "Guía", "Otro"];

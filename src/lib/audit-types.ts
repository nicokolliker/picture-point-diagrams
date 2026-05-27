export type AuditSeverity = "info" | "opportunity" | "inconsistency" | "risk";
export type AuditStatus = "open" | "closed_green" | "closed_yellow" | "closed_red";
export type CloseOutcome = "green" | "yellow" | "red";

export interface AuditFinding {
  id: string;
  audit_id: string;
  page_id: string | null;
  shape_id: string | null;
  severity: AuditSeverity;
  title: string;
  description: string | null;
  promoted_to_doc_id: string | null;
  created_at: string;
}

export interface Audit {
  id: string;
  doc_id: string;
  doc_name: string;
  auditor_id: string;
  status: AuditStatus;
  summary: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export const SEVERITY_META: Record<
  AuditSeverity,
  { label: string; bg: string; fg: string; dot: string; ring: string }
> = {
  info: { label: "Info", bg: "bg-slate-100", fg: "text-slate-700", dot: "bg-slate-400", ring: "ring-slate-200" },
  opportunity: { label: "Oportunidad", bg: "bg-sky-100", fg: "text-sky-700", dot: "bg-sky-500", ring: "ring-sky-200" },
  inconsistency: { label: "Inconsistencia", bg: "bg-amber-100", fg: "text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
  risk: { label: "Riesgo", bg: "bg-red-100", fg: "text-red-700", dot: "bg-red-500", ring: "ring-red-200" },
};

export const AUDIT_OUTCOME_META: Record<
  CloseOutcome,
  { label: string; bg: string; fg: string; dot: string }
> = {
  green: { label: "Aprobada — sin acciones", bg: "bg-emerald-100", fg: "text-emerald-800", dot: "bg-emerald-500" },
  yellow: { label: "Con observaciones", bg: "bg-amber-100", fg: "text-amber-800", dot: "bg-amber-500" },
  red: { label: "Requiere cambios", bg: "bg-red-100", fg: "text-red-700", dot: "bg-red-500" },
};

export function isClosed(s: AuditStatus): boolean {
  return s !== "open";
}

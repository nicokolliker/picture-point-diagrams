export type AuditSeverity = "info" | "opportunity" | "risk" | "blocker";
export type AuditStatus = "open" | "closed";

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
  risk: { label: "Riesgo", bg: "bg-amber-100", fg: "text-amber-800", dot: "bg-amber-500", ring: "ring-amber-200" },
  blocker: { label: "Crítico", bg: "bg-red-100", fg: "text-red-700", dot: "bg-red-500", ring: "ring-red-200" },
};

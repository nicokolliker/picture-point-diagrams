import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useDiagramStore } from "@/lib/diagram-store";
import {
  openAudit,
  addFinding,
  deleteFinding,
  closeAudit,
  markFindingPromoted,
} from "@/lib/audits.functions";
import type {
  Audit,
  AuditFinding,
  AuditSeverity,
  CloseOutcome,
} from "@/lib/audit-types";
import { SEVERITY_META, AUDIT_OUTCOME_META, isClosed } from "@/lib/audit-types";
import type { DiagramDocument } from "@/lib/shape-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  Plus,
  Target,
  Trash2,
  GitBranch,
  X,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";

export function AuditPanel({
  doc,
  currentPageId,
  selectedShapeId,
  onClose,
  onJumpToShape,
}: {
  doc: DiagramDocument;
  currentPageId: string;
  selectedShapeId: string | null;
  onClose: () => void;
  onJumpToShape: (pageId: string, shapeId: string) => void;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const forkPublishedToDraft = useDiagramStore((s) => s.forkPublishedToDraft);

  const open = useServerFn(openAudit);
  const add = useServerFn(addFinding);
  const del = useServerFn(deleteFinding);
  const close = useServerFn(closeAudit);
  const markPromoted = useServerFn(markFindingPromoted);

  const [audit, setAudit] = useState<Audit | null>(null);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState(true);
  const [closeOpen, setCloseOpen] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState<CloseOutcome>("yellow");
  const [closeSummary, setCloseSummary] = useState("");

  // Quick-add form
  const [severity, setSeverity] = useState<AuditSeverity>("opportunity");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [attachShape, setAttachShape] = useState(true);

  const refresh = async () => {
    const { data: a } = await supabase
      .from("audits")
      .select("*")
      .eq("doc_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setAudit((a as Audit) ?? null);
    if (a) {
      const { data: f } = await supabase
        .from("audit_findings")
        .select("*")
        .eq("audit_id", (a as Audit).id)
        .order("created_at", { ascending: true });
      setFindings((f as AuditFinding[]) ?? []);
    } else {
      setFindings([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id]);

  const ensureAudit = async (): Promise<Audit | null> => {
    if (audit && !isClosed(audit.status)) return audit;
    try {
      const a = (await open({ data: { doc_id: doc.id, doc_name: doc.name } })) as Audit;
      setAudit(a);
      return a;
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo abrir la auditoría");
      return null;
    }
  };

  const onAdd = async () => {
    if (!title.trim()) {
      toast.error("Poné un título al hallazgo");
      return;
    }
    const a = await ensureAudit();
    if (!a) return;
    try {
      await add({
        data: {
          audit_id: a.id,
          page_id: attachShape && selectedShapeId ? currentPageId : null,
          shape_id: attachShape && selectedShapeId ? selectedShapeId : null,
          severity,
          title: title.trim(),
          description: desc.trim() || null,
        },
      });
      setTitle("");
      setDesc("");
      refresh();
      toast.success("Hallazgo guardado");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al guardar");
    }
  };

  const onDelete = async (id: string) => {
    try {
      await del({ data: { id } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al eliminar");
    }
  };

  const onPromote = async (f: AuditFinding) => {
    if (f.promoted_to_doc_id) {
      navigate({ to: "/editor", search: { doc: f.promoted_to_doc_id } });
      return;
    }
    if (doc.status !== "published") {
      toast.info("Solo se puede promover desde un proceso publicado.");
      return;
    }
    const draftId = forkPublishedToDraft(doc.id);
    if (!draftId) {
      toast.error("No se pudo crear el borrador");
      return;
    }
    try {
      await markPromoted({
        data: { finding_id: f.id, promoted_to_doc_id: draftId },
      });
      toast.success("Propuesta creada como borrador");
      navigate({ to: "/editor", search: { doc: draftId } });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al promover");
    }
  };

  const onClose_ = async () => {
    if (!audit) return;
    try {
      await close({
        data: {
          audit_id: audit.id,
          outcome: closeOutcome,
          summary: closeSummary || undefined,
        },
      });
      toast.success("Auditoría cerrada");
      setCloseOpen(false);
      setCloseSummary("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al cerrar");
    }
  };

  const grouped = useMemo(() => {
    const order: AuditSeverity[] = ["risk", "inconsistency", "opportunity", "info"];
    return order
      .map((sev) => ({
        sev,
        items: findings.filter((f) => f.severity === sev),
      }))
      .filter((g) => g.items.length > 0);
  }, [findings]);

  const isAuditor = !!audit && audit.auditor_id === user?.id;
  const closed = audit ? isClosed(audit.status) : false;

  return (
    <div className="flex h-full w-[340px] shrink-0 flex-col border-l border-[#EBEBEB] bg-white">
      <header className="flex items-center gap-2 border-b border-[#EBEBEB] px-3 py-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-semibold text-[#0F172A]">Auditoría</div>
          <div className="truncate text-[11px] text-[#94A3B8]">
            {loading
              ? "Cargando…"
              : audit
                ? closed
                  ? `Cerrada · ${findings.length} hallazgo${findings.length === 1 ? "" : "s"}`
                  : `Abierta · ${findings.length} hallazgo${findings.length === 1 ? "" : "s"}`
                : "Sin auditoría activa"}
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 text-[#64748B] hover:bg-[#F1F5F9]">
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Quick-add */}
      {!closed && (
        <div className="border-b border-[#EBEBEB] bg-[#FAFBFF] p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Nuevo hallazgo
          </div>
          <div className="space-y-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título corto…"
              className="h-8 text-sm"
            />
            <Textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descripción (opcional)…"
              className="min-h-[56px] text-xs"
            />
            <div className="flex items-center gap-2">
              <Select value={severity} onValueChange={(v) => setSeverity(v as AuditSeverity)}>
                <SelectTrigger className="h-8 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["risk", "inconsistency", "opportunity", "info"] as AuditSeverity[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("h-2 w-2 rounded-full", SEVERITY_META[s].dot)} />
                        {SEVERITY_META[s].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700" onClick={onAdd}>
                <Plus className="h-3.5 w-3.5" /> Agregar
              </Button>
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-[#475569]">
              <input
                type="checkbox"
                checked={attachShape}
                onChange={(e) => setAttachShape(e.target.checked)}
                disabled={!selectedShapeId}
              />
              <Target className="h-3 w-3" />
              {selectedShapeId
                ? "Asociar al shape seleccionado"
                : "Seleccioná un shape para asociar"}
            </label>
          </div>
        </div>
      )}

      {/* Findings list */}
      <div className="flex-1 overflow-y-auto p-2">
        {findings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#FAFBFF] p-6 text-center text-xs text-[#94A3B8]">
            Todavía no agregaste hallazgos.
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((g) => (
              <div key={g.sev}>
                <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                  <span className={cn("h-1.5 w-1.5 rounded-full", SEVERITY_META[g.sev].dot)} />
                  {SEVERITY_META[g.sev].label}
                  <span className="text-[#CBD5E1]">· {g.items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {g.items.map((f) => (
                    <div
                      key={f.id}
                      className={cn(
                        "group rounded-lg border bg-white p-2.5 ring-1 ring-transparent transition-shadow hover:shadow-sm",
                        "border-[#EBEBEB]",
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={cn(
                            "mt-1 h-2 w-2 shrink-0 rounded-full",
                            SEVERITY_META[f.severity].dot,
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-[#0F172A]">{f.title}</div>
                          {f.description && (
                            <div className="mt-0.5 line-clamp-3 text-[11px] text-[#64748B]">
                              {f.description}
                            </div>
                          )}
                          {f.shape_id && (
                            <button
                              onClick={() => onJumpToShape(f.page_id ?? currentPageId, f.shape_id!)}
                              className="mt-1 inline-flex items-center gap-1 text-[10px] text-sky-600 hover:underline"
                            >
                              <Target className="h-3 w-3" /> Ir al shape
                            </button>
                          )}
                          {f.promoted_to_doc_id && (
                            <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-700">
                              <CheckCircle2 className="h-3 w-3" /> Promovido a borrador
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {isAuditor && !closed && (
                            <button
                              title="Promover a propuesta de cambio"
                              onClick={() => onPromote(f)}
                              className="rounded p-1 text-violet-600 hover:bg-violet-50"
                            >
                              <GitBranch className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {isAuditor && !closed && (
                            <button
                              title="Eliminar"
                              onClick={() => onDelete(f.id)}
                              className="rounded p-1 text-red-500 hover:bg-red-50"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      {audit && !closed && isAuditor && (
        <div className="border-t border-[#EBEBEB] p-2.5">
          <Button
            size="sm"
            className="h-8 w-full bg-[#0F172A] hover:bg-[#1E293B]"
            onClick={() => setCloseOpen(true)}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Cerrar auditoría
            <ChevronRight className="ml-auto h-3.5 w-3.5" />
          </Button>
        </div>
      )}
      {audit && closed && (
        <div className="border-t border-[#EBEBEB] bg-[#FAFBFF] p-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                AUDIT_OUTCOME_META[
                  audit.status === "closed_green"
                    ? "green"
                    : audit.status === "closed_yellow"
                      ? "yellow"
                      : "red"
                ].dot,
              )}
            />
            <span className="font-medium text-[#0F172A]">
              {
                AUDIT_OUTCOME_META[
                  audit.status === "closed_green"
                    ? "green"
                    : audit.status === "closed_yellow"
                      ? "yellow"
                      : "red"
                ].label
              }
            </span>
          </div>
          {audit.summary && (
            <p className="mt-1 text-[11px] text-[#64748B]">{audit.summary}</p>
          )}
        </div>
      )}

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cerrar auditoría</DialogTitle>
            <DialogDescription>
              Elegí un resultado y agregá una conclusión opcional.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {(["green", "yellow", "red"] as CloseOutcome[]).map((o) => (
              <button
                key={o}
                onClick={() => setCloseOutcome(o)}
                className={cn(
                  "rounded-lg border p-2.5 text-left text-xs transition-all",
                  closeOutcome === o
                    ? "border-[#0F172A] bg-[#0F172A] text-white"
                    : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", AUDIT_OUTCOME_META[o].dot)} />
                  <span className="font-medium">{AUDIT_OUTCOME_META[o].label}</span>
                </div>
              </button>
            ))}
          </div>
          <Textarea
            value={closeSummary}
            onChange={(e) => setCloseSummary(e.target.value)}
            placeholder="Conclusión de la auditoría (opcional)…"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={onClose_} className="bg-violet-600 hover:bg-violet-700">
              Cerrar auditoría
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

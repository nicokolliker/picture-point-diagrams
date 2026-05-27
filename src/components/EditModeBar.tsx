import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Undo2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useDiagramStore } from "@/lib/diagram-store";
import type { DiagramDocument, Page } from "@/lib/shape-types";
import { createPublishRequest } from "@/lib/approvals.functions";
import { useLatestRequests } from "@/lib/use-latest-requests";
import { AlertTriangle } from "lucide-react";

function normalizePages(pages: Page[]) {
  return JSON.stringify(
    pages.map((p) => ({
      id: p.id,
      name: p.name,
      shapes: p.shapes,
      connectors: p.connectors,
    })),
  );
}

export function EditModeBar({ doc }: { doc: DiagramDocument }) {
  const captureBaseline = useDiagramStore((s) => s.captureBaseline);
  const discardChanges = useDiagramStore((s) => s.discardChanges);
  const setDocStatus = useDiagramStore((s) => s.setDocStatus);
  const documents = useDiagramStore((s) => s.documents);
  const create = useServerFn(createPublishRequest);
  const navigate = useNavigate();

  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isDirty = useMemo(() => {
    if (!doc.baseline) {
      const hasContent = doc.pages.some(
        (p) => p.shapes.length > 0 || p.connectors.length > 0,
      );
      return hasContent && doc.status === "draft";
    }
    return normalizePages(doc.pages) !== normalizePages(doc.baseline.pages);
  }, [doc]);

  const targetIdForLookup = doc.originDocId ?? doc.id;
  const { byDoc } = useLatestRequests([targetIdForLookup]);
  const latest = byDoc[targetIdForLookup];
  const showRejected = latest?.status === "rejected" && (doc.status === "draft" || isDirty);

  if (!isDirty && !showRejected) return null;

  const isFork = !!doc.originDocId;
  const parent = isFork ? documents.find((d) => d.id === doc.originDocId) : null;

  const onDiscard = () => {
    if (!doc.baseline) {
      toast.info("No hay versión anterior para restaurar.");
      return;
    }
    if (!confirm("¿Descartar todos los cambios desde la última versión guardada?")) return;
    discardChanges(doc.id);
    toast.success("Cambios descartados");
  };

  const onSaveDraft = () => {
    setDocStatus(doc.id, "draft");
    toast.success("Borrador guardado");
  };

  const onSubmit = async () => {
    setBusy(true);
    try {
      const targetId = parent?.id ?? doc.id;
      const targetName = parent?.name ?? doc.name;
      const nextVersion = (parent?.currentVersion ?? doc.currentVersion ?? 0) + 1;
      await create({
        data: {
          doc_id: targetId,
          doc_name: targetName,
          version_number: nextVersion,
          snapshot: doc, // includes originDocId so server can find the fork
          note: note || undefined,
        },
      });
      captureBaseline(doc.id);
      setDocStatus(doc.id, "in_review");
      toast.success("Solicitud enviada a aprobación", {
        action: {
          label: "Ver aprobaciones",
          onClick: () => navigate({ to: "/approvals" }),
        },
      });
      setPublishOpen(false);
      setNote("");
    } catch (e: any) {
      toast.error(e?.message ?? "Error al enviar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {showRejected && (
        <div className="border-b border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-2 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div className="flex-1">
              <div className="font-medium text-rose-900">Cambios solicitados por los aprobadores</div>
              {latest?.reject_comments?.length ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-rose-800/90">
                  {latest.reject_comments.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              ) : (
                <div className="text-xs text-rose-800/80">Aplicá los ajustes y volvé a solicitar la publicación.</div>
              )}
            </div>
          </div>
        </div>
      )}
      {isDirty && (
      <div className="flex items-center gap-2 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-1.5 text-sm">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        <span className="font-medium text-amber-900">
          {isFork ? "Modificando proceso publicado" : "Modo edición"}
        </span>
        <span className="text-amber-700/80">
          {isFork
            ? `Cambios sobre "${parent?.name ?? "original"}". Pasarán por aprobación.`
            : "Tenés cambios sin publicar."}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" className="h-7 text-amber-900 hover:bg-amber-100" onClick={onDiscard}>
            <Undo2 className="h-3.5 w-3.5" /> Descartar cambios
          </Button>
          <Button size="sm" variant="outline" className="h-7 border-amber-300 bg-white text-amber-900 hover:bg-amber-50" onClick={onSaveDraft}>
            <Save className="h-3.5 w-3.5" /> Guardar borrador
          </Button>
          <Button size="sm" className="h-7 bg-[#5B6CF8] text-white hover:bg-[#4856E0]" onClick={() => setPublishOpen(true)}>
            <Send className="h-3.5 w-3.5" /> Solicitar publicación
          </Button>
        </div>
      </div>
      )}



      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar publicación</DialogTitle>
            <DialogDescription>
              Se enviará una snapshot del documento a los aprobadores asignados. Una vez aprobado, se publicará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Mensaje opcional para los aprobadores…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>Cancelar</Button>
            <Button disabled={busy} onClick={onSubmit} className="bg-[#5B6CF8] hover:bg-[#4856E0]">
              {busy ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

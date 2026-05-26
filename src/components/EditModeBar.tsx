import { useMemo, useState } from "react";
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

function normalizePages(pages: Page[]) {
  // Strip volatile fields then stringify for comparison.
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
  const create = useServerFn(createPublishRequest);

  const [publishOpen, setPublishOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const isDirty = useMemo(() => {
    if (!doc.baseline) {
      // No baseline yet: treat as dirty only if there's any content,
      // so the bar appears after the very first edit on a fresh doc.
      const hasContent = doc.pages.some(
        (p) => p.shapes.length > 0 || p.connectors.length > 0,
      );
      return hasContent && doc.status === "draft";
    }
    return normalizePages(doc.pages) !== normalizePages(doc.baseline.pages);
  }, [doc]);

  if (!isDirty) return null;

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
      await create({
        data: {
          doc_id: doc.id,
          doc_name: doc.name,
          version_number: 1,
          snapshot: doc,
          note: note || undefined,
        },
      });
      // Mark this version as the new baseline so the bar disappears.
      captureBaseline(doc.id);
      toast.success("Solicitud de publicación enviada");
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
      <div className="flex items-center gap-2 border-b border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 px-4 py-1.5 text-sm">
        <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
        <span className="font-medium text-amber-900">Modo edición</span>
        <span className="text-amber-700/80">Tenés cambios sin publicar.</span>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-amber-900 hover:bg-amber-100"
            onClick={onDiscard}
          >
            <Undo2 className="h-3.5 w-3.5" /> Descartar cambios
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-amber-300 bg-white text-amber-900 hover:bg-amber-50"
            onClick={onSaveDraft}
          >
            <Save className="h-3.5 w-3.5" /> Guardar borrador
          </Button>
          <Button
            size="sm"
            className="h-7 bg-[#5B6CF8] text-white hover:bg-[#4856E0]"
            onClick={() => setPublishOpen(true)}
          >
            <Send className="h-3.5 w-3.5" /> Solicitar publicación
          </Button>
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar publicación</DialogTitle>
            <DialogDescription>
              Se enviará una snapshot del documento a los aprobadores asignados. No se publicará
              hasta que reciba las aprobaciones requeridas.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Mensaje opcional para los aprobadores…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPublishOpen(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={onSubmit} className="bg-[#5B6CF8] hover:bg-[#4856E0]">
              {busy ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, GitBranch, History, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useDiagramStore } from "@/lib/diagram-store";
import { ChangesDiffModal } from "@/components/ChangesDiffModal";
import type { DiagramDocument } from "@/lib/shape-types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function VersionsModal({
  doc,
  open,
  onClose,
}: {
  doc: DiagramDocument;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const restoreVersionAsDraft = useDiagramStore((s) => s.restoreVersionAsDraft);
  const [diffVersion, setDiffVersion] = useState<number | null>(null);

  const versions = useMemo(
    () =>
      [...(doc.versions ?? [])].sort(
        (a, b) => b.versionNumber - a.versionNumber,
      ),
    [doc.versions],
  );

  const compareSnapshot = useMemo(() => {
    if (diffVersion == null) return null;
    const v = doc.versions?.find((x) => x.versionNumber === diffVersion);
    if (!v) return null;
    return {
      ...doc,
      pages: v.snapshot.pages,
    } as DiagramDocument;
  }, [diffVersion, doc]);

  const restore = (n: number) => {
    const id = restoreVersionAsDraft(doc.id, n);
    if (!id) {
      toast.error("No se pudo restaurar");
      return;
    }
    toast.success(`v${n} restaurada como borrador`);
    onClose();
    navigate({ to: "/editor", search: { doc: id } });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <History className="h-4 w-4 text-[#5B6CF8]" />
              Versiones · {doc.name}
            </DialogTitle>
            <DialogDescription>
              Cada aprobación queda registrada. Podés revisar diferencias o restaurar como borrador.
            </DialogDescription>
          </DialogHeader>

          {versions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E2E8F0] p-8 text-center text-sm text-[#94A3B8]">
              Aún no hay versiones aprobadas.
            </div>
          ) : (
            <ul className="max-h-[55vh] divide-y divide-[#F1F5F9] overflow-y-auto">
              {versions.map((v) => {
                const isCurrent = v.versionNumber === doc.currentVersion;
                return (
                  <li
                    key={v.versionNumber}
                    className={cn(
                      "flex items-center gap-3 py-3",
                      isCurrent && "bg-emerald-50/40 -mx-2 px-2 rounded-lg",
                    )}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-xs font-semibold text-white">
                      v{v.versionNumber}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-medium text-[#0F172A]">
                          Versión {v.versionNumber}
                        </span>
                        {isCurrent && (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            Actual
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#64748B]">
                        <Clock className="h-3 w-3" />
                        {new Date(v.approvedAt).toLocaleString()}
                        <span>·</span>
                        <span>{v.approverIds.length} aprobador{v.approverIds.length !== 1 ? "es" : ""}</span>
                      </div>
                      {v.note && (
                        <p className="mt-1 line-clamp-2 text-xs text-[#475569]">"{v.note}"</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setDiffVersion(v.versionNumber)}
                      >
                        Ver cambios
                      </Button>
                      {!isCurrent && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => restore(v.versionNumber)}
                        >
                          <GitBranch className="h-3 w-3" /> Restaurar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" /> Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {compareSnapshot && (
        <ChangesDiffModal
          open={!!compareSnapshot}
          onClose={() => setDiffVersion(null)}
          prev={compareSnapshot}
          next={doc}
          title={`v${diffVersion} → actual (v${doc.currentVersion ?? "?"})`}
        />
      )}
    </>
  );
}

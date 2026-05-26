import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, ShieldCheck, PencilRuler, Inbox } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDiagramStore } from "@/lib/diagram-store";
import { useAreas } from "@/lib/use-areas";
import { DocThumbnail } from "@/components/doc-thumbnail";
import { StatusPill } from "@/components/StatusPill";
import { cn } from "@/lib/utils";

type Mode = "audit" | "edit";

export function PickProcessModal({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: Mode;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const documents = useDiagramStore((s) => s.documents);
  const { areas } = useAreas();
  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState<string>("all");

  const list = useMemo(() => {
    return documents
      .filter((d) => !d.isTemplate)
      .filter((d) =>
        mode === "audit"
          ? d.status === "in_review"
          : d.status !== "in_review",
      )
      .filter((d) => {
        if (areaId === "all") return true;
        const ids = d.areaIds && d.areaIds.length > 0 ? d.areaIds : d.areaId ? [d.areaId] : [];
        return ids.includes(areaId);
      })
      .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, mode, areaId, query]);

  const openDoc = (id: string) => {
    onClose();
    navigate({ to: "/editor", search: { doc: id, mode } as any });
  };

  const isAudit = mode === "audit";
  const Icon = isAudit ? ShieldCheck : PencilRuler;
  const accent = isAudit
    ? "from-violet-500 to-fuchsia-500"
    : "from-amber-500 to-pink-500";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl">
            <span
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white",
                accent,
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            {isAudit ? "Auditar proceso" : "Modificar proceso"}
          </DialogTitle>
          <DialogDescription>
            {isAudit
              ? "Procesos con cambios propuestos esperando tu revisión."
              : "Elegí un proceso para editar. Los cambios pasarán por aprobación."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar…"
              className="h-9 rounded-full border-[#E2E8F0] pl-9"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Chip
            sel={areaId === "all"}
            onClick={() => setAreaId("all")}
            color="#94A3B8"
            label="Todas las áreas"
          />
          {areas.map((a) => (
            <Chip
              key={a.id}
              sel={areaId === a.id}
              onClick={() => setAreaId(a.id)}
              color={a.color}
              label={a.name}
            />
          ))}
        </div>

        <div className="max-h-[55vh] overflow-y-auto pr-1">
          {list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#FAFBFF] p-10 text-center">
              <Inbox className="mx-auto h-7 w-7 text-[#CBD5E1]" />
              <p className="mt-2 text-sm text-[#475569]">
                {isAudit
                  ? "No hay procesos en auditoría."
                  : "No hay procesos para editar con esos filtros."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {list.map((d) => {
                const area = areas.find((a) => a.id === (d.areaIds?.[0] ?? d.areaId));
                return (
                  <button
                    key={d.id}
                    onClick={() => openDoc(d.id)}
                    className="group overflow-hidden rounded-xl border border-[#EBEBEB] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[5/3] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-violet-50">
                      <DocThumbnail doc={d} />
                      <span className="absolute right-2 top-2">
                        <StatusPill status={d.status} size="sm" />
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="truncate font-display text-sm font-semibold text-[#0F172A]">
                        {d.name}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                        {area && (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} />
                            <span className="truncate">{area.name}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{d.pages[0]?.shapes.length ?? 0} shapes</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Chip({
  sel,
  onClick,
  color,
  label,
}: {
  sel: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
        sel
          ? "border-transparent bg-[#0F172A] text-white shadow-sm"
          : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]",
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

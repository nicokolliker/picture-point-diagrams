import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, LayoutGrid, Search, Sparkles, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDiagramStore } from "@/lib/diagram-store";
import { useAreas } from "@/lib/use-areas";
import { DocThumbnail } from "@/components/doc-thumbnail";
import { FlowItLogo } from "@/components/flowit-logo";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { DiagramDocument } from "@/lib/shape-types";

export const Route = createFileRoute("/templates")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Templates · FlowIt" },
      { name: "description", content: "Plantillas de procesos listas para usar." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();
  const documents = useDiagramStore((s) => s.documents);
  const ensureSeed = useDiagramStore((s) => s.ensureSeed);
  const createFromTemplate = useDiagramStore((s) => s.createFromTemplate);
  const { areas } = useAreas();
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState<DiagramDocument | null>(null);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);

  useEffect(() => { ensureSeed(); }, [ensureSeed]);

  const templates = useMemo(
    () =>
      documents
        .filter((d) => d.isTemplate)
        .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [documents, query],
  );

  const onCreate = () => {
    if (!picking) return;
    const id = createFromTemplate(picking.id, { areaIds: selectedAreaIds });
    if (!id) {
      toast.error("No se pudo crear el proceso desde el template.");
      return;
    }
    toast.success("Proceso creado desde template");
    setPicking(null);
    setSelectedAreaIds([]);
    navigate({ to: "/editor", search: { doc: id } as any });
  };

  return (
    <div className="flex h-screen flex-col bg-[#FAFBFF] text-[#0F172A]">
      <header className="flex h-16 items-center border-b border-[#EBEBEB] bg-white pr-4">
        <div className="flex w-[232px] shrink-0 items-center pl-5 border-r border-[#EBEBEB] h-full">
          <Link to="/home"><FlowItLogo size={34} /></Link>
        </div>
        <div className="flex flex-1 items-center justify-between pl-4">
          <Link to="/home" className="inline-flex items-center gap-1.5 text-sm text-[#475569] hover:text-[#0F172A]">
            <ArrowLeft className="h-4 w-4" /> Volver
          </Link>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar templates…"
              className="h-9 rounded-full border-[#E2E8F0] pl-9"
            />
          </div>
          <div />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Templates</h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Plantillas listas para arrancar un proceso en segundos.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs text-violet-700 ring-1 ring-violet-200">
            <LayoutGrid className="h-3.5 w-3.5" /> {templates.length} disponibles
          </span>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#CBD5E1]" />
            <p className="mt-3 text-sm text-[#475569]">No hay templates todavía.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => setPicking(t)}
                className="group overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(139,92,246,0.12)]"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-violet-50 via-white to-sky-50">
                  <DocThumbnail doc={t} />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-violet-700 shadow-sm">
                    <LayoutGrid className="h-2.5 w-2.5" /> Template
                  </span>
                </div>
                <div className="p-3">
                  <div className="truncate font-display text-sm font-semibold">{t.name}</div>
                  <div className="mt-0.5 text-xs text-[#94A3B8]">
                    {t.pages[0]?.shapes.length ?? 0} shapes
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      <Dialog open={!!picking} onOpenChange={(o) => { if (!o) { setPicking(null); setSelectedAreaIds([]); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Crear proceso desde este template</DialogTitle>
            <DialogDescription>
              Se creará una copia editable. Podés ajustar todo después.
            </DialogDescription>
          </DialogHeader>
          {picking && (
            <div className="rounded-xl border border-[#EBEBEB] bg-white p-3">
              <div className="text-sm font-medium">{picking.name}</div>
              <div className="text-xs text-[#94A3B8]">{picking.pages[0]?.shapes.length ?? 0} shapes</div>
            </div>
          )}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Áreas
            </div>
            {areas.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">Podés asignar áreas más tarde.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {areas.map((a) => {
                  const sel = selectedAreaIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() =>
                        setSelectedAreaIds((cur) =>
                          cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id],
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                        sel
                          ? "border-transparent bg-[#0F172A] text-white"
                          : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]",
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                      {a.name}
                      {sel && <Check className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPicking(null)}>Cancelar</Button>
            <Button onClick={onCreate} className="bg-gradient-to-r from-sky-500 to-violet-500 hover:opacity-95">
              Crear proceso
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

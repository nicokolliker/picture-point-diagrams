import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDiagramStore } from "@/lib/diagram-store";
import { useAreas } from "@/lib/use-areas";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { FlowItLogo } from "@/components/flowit-logo";
import { DocThumbnail } from "@/components/doc-thumbnail";

export const Route = createFileRoute("/documents")({
  head: () => ({ meta: [{ title: "Documents — FlowIt" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const documents = useDiagramStore((s) => s.documents);
  const ensureSeed = useDiagramStore((s) => s.ensureSeed);
  const { areas } = useAreas();
  const [q, setQ] = useState("");
  const [areaId, setAreaId] = useState<string>("all");

  useEffect(() => { ensureSeed(); }, [ensureSeed]);
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const list = useMemo(() => {
    return documents
      .filter((d) => areaId === "all" ? true : d.areaId === areaId)
      .filter((d) => d.name.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, areaId, q]);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]"><ArrowLeft className="h-4 w-4" /></Link>
          <FlowItLogo size={26} withWordmark />
          <span className="ml-2 font-display text-sm text-[#94A3B8]">/ Documents</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold text-[#0F172A]">Todos los documentos</h1>
          <Badge variant="outline" className="ml-2 rounded-full">{list.length}</Badge>
        </div>
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className="h-9 pl-9" />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <Filter className="h-4 w-4 text-[#94A3B8]" />
            <AreaChip selected={areaId === "all"} onClick={() => setAreaId("all")} color="#94A3B8" label="Todas" />
            {areas.map((a) => (
              <AreaChip key={a.id} selected={areaId === a.id} onClick={() => setAreaId(a.id)} color={a.color} label={a.name} />
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white">
          <table className="w-full text-sm">
            <thead className="bg-[#F8FAFC] text-left text-xs uppercase tracking-wider text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Área</th>
                <th className="px-4 py-3 font-medium">Shapes</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Modificado</th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => {
                const a = areas.find((x) => x.id === d.areaId);
                return (
                  <tr
                    key={d.id}
                    onClick={() => navigate({ to: "/editor", search: { doc: d.id } })}
                    className="cursor-pointer border-t border-[#F1F5F9] hover:bg-[#F8FAFC]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-12 overflow-hidden rounded-md bg-gradient-to-br from-sky-50 to-violet-50">
                          <DocThumbnail doc={d} />
                        </div>
                        <span className="font-medium text-[#0F172A]">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a ? (
                        <span className="inline-flex items-center gap-1.5 text-[#475569]">
                          <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />
                          {a.name}
                        </span>
                      ) : (
                        <span className="text-[#94A3B8]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{d.pages[0]?.shapes.length ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        d.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      )}>{d.status === "published" ? "Publicado" : "Borrador"}</span>
                    </td>
                    <td className="px-4 py-3 text-[#64748B]">{timeAgo(d.updatedAt)}</td>
                  </tr>
                );
              })}
              {list.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-[#94A3B8]">No hay documentos que coincidan.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function AreaChip({ selected, onClick, color, label }: { selected: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors",
        selected ? "border-transparent bg-[#0F172A] text-white" : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]"
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </button>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

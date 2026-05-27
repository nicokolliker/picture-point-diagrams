import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  Search,
  Home as HomeIcon,
  FileText,
  LayoutGrid,
  Plug,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  FilePlus2,
  Sparkles,
  Mic,
  Shield,
  CheckCircle2,
  Clock,
  GitCompare,
  ScrollText,
  Rocket,
  ShieldCheck,
  PencilRuler,
  Check,
  History as HistoryIcon,
  Users as UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useDiagramStore } from "@/lib/diagram-store";
import { cn } from "@/lib/utils";
import { useAuth, signOut } from "@/lib/auth";
import { useAreas } from "@/lib/use-areas";
import { useAreaMembership } from "@/lib/use-area-membership";
import { CaptureProcessModal } from "@/components/CaptureProcessModal";
import { FlowItLogo } from "@/components/flowit-logo";
import { DocThumbnail } from "@/components/doc-thumbnail";
import { ChangesDiffModal } from "@/components/ChangesDiffModal";
import { PickProcessModal } from "@/components/PickProcessModal";
import { VersionsModal } from "@/components/VersionsModal";
import { StatusPill } from "@/components/StatusPill";
import type { DiagramDocument } from "@/lib/shape-types";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "FlowIt — Tu hub de procesos" },
      { name: "description", content: "Capturá, diseñá y aprobá procesos con IA." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const documents = useDiagramStore((s) => s.documents);
  const ensureSeed = useDiagramStore((s) => s.ensureSeed);
  const createDocument = useDiagramStore((s) => s.createDocument);
  const deleteDocument = useDiagramStore((s) => s.deleteDocument);
  const duplicateDocument = useDiagramStore((s) => s.duplicateDocument);
  const renameDocument = useDiagramStore((s) => s.renameDocument);
  const { areas } = useAreas();

  const [query, setQuery] = useState("");
  const [areaId, setAreaId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "in_review" | "published">("all");
  const [showNew, setShowNew] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [auditDoc, setAuditDoc] = useState<DiagramDocument | null>(null);
  const [pickerMode, setPickerMode] = useState<"audit" | "edit" | null>(null);
  const [versionsDoc, setVersionsDoc] = useState<DiagramDocument | null>(null);

  useEffect(() => { ensureSeed(); }, [ensureSeed]);
  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const run = async () => {
      try {
        const m = await import("@/lib/sync-approved");
        const n = await m.syncApprovedSnapshots();
        if (alive && n > 0) {
          const { toast } = await import("sonner");
          toast.success(
            n === 1 ? "Un proceso fue publicado" : `${n} procesos fueron publicados`,
          );
        }
      } catch { /* noop */ }
    };
    run();
    const onFocus = () => run();
    const onVis = () => { if (document.visibilityState === "visible") run(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, 20000);
    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const recientesRef = useRef<HTMLElement | null>(null);

  // Exclude templates and archived (merged fork drafts).
  const realDocs = useMemo(
    () => documents.filter((d) => !d.isTemplate && !d.archived),
    [documents],
  );

  const filtered = useMemo(() => {
    return realDocs
      .filter((d) => {
        if (areaId === "all") return true;
        const ids = d.areaIds && d.areaIds.length > 0 ? d.areaIds : d.areaId ? [d.areaId] : [];
        return ids.includes(areaId);
      })
      .filter((d) => (statusFilter === "all" ? true : (d.status ?? "draft") === statusFilter))
      .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [realDocs, areaId, statusFilter, query]);

  const openDoc = (id: string) => navigate({ to: "/editor", search: { doc: id } });

  const scrollToRecientes = () => {
    setTimeout(() => recientesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleCreateBlank = () => {
    const ids = selectedAreaIds.length > 0 ? selectedAreaIds : areaId === "all" ? [] : [areaId];
    const id = createDocument({ areaIds: ids });
    setShowNew(false);
    setSelectedAreaIds([]);
    openDoc(id);
  };

  const handleCapture = () => {
    setShowNew(false);
    setCaptureOpen(true);
  };

  const handleTemplates = () => {
    setShowNew(false);
    setSelectedAreaIds([]);
    navigate({ to: "/templates" });
  };

  const handleAuditar = () => setPickerMode("audit");
  const handleModificar = () => setPickerMode("edit");

  // Build a contextual header for the Recientes section.
  const filterContext = useMemo(() => {
    const area = areaId !== "all" ? areas.find((a) => a.id === areaId) : null;
    const statusLabel =
      statusFilter === "draft"
        ? "Borradores"
        : statusFilter === "in_review"
          ? "En auditoría"
          : statusFilter === "published"
            ? "Publicados"
            : null;
    const parts: string[] = [];
    if (statusLabel) parts.push(statusLabel);
    if (query.trim()) parts.push(`"${query.trim()}"`);
    return { area, statusLabel, parts };
  }, [areaId, areas, statusFilter, query]);

  const hasActiveFilter =
    areaId !== "all" || statusFilter !== "all" || query.trim().length > 0;
  const clearFilters = () => {
    setAreaId("all");
    setStatusFilter("all");
    setQuery("");
  };


  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Buen día";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  }, []);
  const userName = (user?.email ?? "").split("@")[0];

  return (
    <div className="flex h-screen flex-col bg-[#FAFBFF] text-[#0F172A]">
      {/* Top navbar */}
      <header className="flex h-16 items-center border-b border-[#EBEBEB] bg-white pr-4">
        <div className="flex w-[232px] shrink-0 items-center pl-5 border-r border-[#EBEBEB] h-full">
          <FlowItLogo size={34} />
        </div>
        <div className="flex flex-1 items-center justify-between gap-4 pl-4">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar procesos…"
              className="h-9 rounded-full border-[#E2E8F0] pl-9"
            />
          </div>
        <div className="flex items-center gap-2">
          <Link
            to="/approvals"
            className="inline-flex items-center gap-1.5 rounded-full border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#475569] hover:bg-[#F8FAFC]"
          >
            <Shield className="h-3.5 w-3.5" /> Aprobaciones
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-500 text-xs font-semibold text-white">
                {(user?.email ?? "?").slice(0, 1).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem onSelect={() => navigate({ to: "/admin" })}>
                  Panel de admin
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => navigate({ to: "/approvals" })}>
                Mis aprobaciones
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await signOut();
                  navigate({ to: "/login" });
                }}
              >
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-[232px] flex-col border-r border-[#EBEBEB] bg-white p-3">
          <Button
            onClick={() => setShowNew(true)}
            className="mb-4 h-10 w-full rounded-xl bg-gradient-to-r from-sky-500 to-violet-500 font-semibold text-white shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Nuevo
          </Button>
          <nav className="flex flex-col gap-0.5">
            <SidebarLink active icon={HomeIcon} label="Inicio" />
            <SidebarLink icon={FileText} label="Documents" to="/documents" />
            <SidebarLink icon={LayoutGrid} label="Templates" to="/templates" />
            <SidebarLink icon={Plug} label="Integrations" to="/integrations" />
          </nav>

          <div className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Estado
          </div>
          <div className="flex flex-col gap-0.5">
            <StatusItem selected={statusFilter === "all"} onClick={() => setStatusFilter("all")} dotClass="bg-slate-300" label="Todos" count={realDocs.length} />
            <StatusItem selected={statusFilter === "draft"} onClick={() => setStatusFilter("draft")} dotClass="bg-amber-400" label="Borradores" count={realDocs.filter((d) => (d.status ?? "draft") === "draft").length} />
            <StatusItem selected={statusFilter === "in_review"} onClick={() => setStatusFilter("in_review")} dotClass="bg-sky-500" label="En auditoría" count={realDocs.filter((d) => d.status === "in_review").length} />
            <StatusItem selected={statusFilter === "published"} onClick={() => setStatusFilter("published")} dotClass="bg-emerald-500" label="Publicados" count={realDocs.filter((d) => d.status === "published").length} />
          </div>


          <div className="mt-6 mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Áreas
          </div>
          <div className="flex flex-col gap-0.5">
            <AreaItem
              selected={areaId === "all"}
              onClick={() => setAreaId("all")}
              color="#94A3B8"
              label="Todas"
              count={realDocs.length}
            />
            {areas.map((a) => {
              const count = realDocs.filter((d) => {
                const ids = d.areaIds && d.areaIds.length > 0 ? d.areaIds : d.areaId ? [d.areaId] : [];
                return ids.includes(a.id);
              }).length;
              return (
                <AreaItem
                  key={a.id}
                  selected={areaId === a.id}
                  onClick={() => setAreaId(a.id)}
                  color={a.color}
                  label={a.name}
                  count={count}
                />
              );
            })}
          </div>
          {isAdmin && (
            <Link
              to="/admin"
              className="mt-2 inline-flex items-center gap-1 px-3 py-1 text-xs text-sky-600 hover:underline"
            >
              <Plus className="h-3 w-3" /> Gestionar áreas
            </Link>
          )}
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto">
          {/* Hero */}
          <section className="border-b border-[#EBEBEB] bg-gradient-to-br from-sky-50 via-white to-violet-50 px-8 py-8">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-[#0F172A]">
              {greeting}, <span className="bg-gradient-to-r from-sky-500 to-violet-500 bg-clip-text text-transparent">{userName}</span> 👋
            </h1>
            <p className="mt-1 text-sm text-[#64748B]">
              Elegí qué querés hacer con tus procesos hoy.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <HeroCard
                onClick={() => setShowNew(true)}
                icon={<Rocket className="h-5 w-5" />}
                title="Iniciar nuevo proceso"
                desc="Empezá de cero, con template o capturando una reunión."
                gradient="from-sky-100 to-cyan-50"
                iconBg="bg-gradient-to-br from-sky-500 to-cyan-500"
              />
              <HeroCard
                onClick={handleAuditar}
                icon={<ShieldCheck className="h-5 w-5" />}
                title="Auditar proceso"
                desc="Revisá los procesos en auditoría y aprobá cambios."
                gradient="from-violet-100 to-fuchsia-50"
                iconBg="bg-gradient-to-br from-violet-500 to-fuchsia-500"
                badge={documents.filter((d) => d.status === "in_review").length}
              />
              <HeroCard
                onClick={handleModificar}
                icon={<PencilRuler className="h-5 w-5" />}
                title="Modificar proceso"
                desc="Editá borradores o publicados (pasa por aprobación)."
                gradient="from-amber-100 to-pink-50"
                iconBg="bg-gradient-to-br from-amber-500 to-pink-500"
              />
            </div>
          </section>

          <section ref={recientesRef} className="px-8 py-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-semibold">Recientes</h2>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B]">
                  {filterContext.area ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 ring-1 ring-[#E2E8F0]">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: filterContext.area.color }} />
                      {filterContext.area.name}
                    </span>
                  ) : (
                    <span className="text-[#94A3B8]">Todas las áreas</span>
                  )}
                  {filterContext.parts.map((p) => (
                    <span key={p} className="text-[#94A3B8]">· {p}</span>
                  ))}
                  <span className="text-[#94A3B8]">· {filtered.length} resultado{filtered.length === 1 ? "" : "s"}</span>
                  {hasActiveFilter && (
                    <button onClick={clearFilters} className="ml-1 text-sky-600 hover:underline">
                      limpiar filtros
                    </button>
                  )}
                </div>
              </div>
              <Link to="/documents" className="shrink-0 text-xs text-sky-600 hover:underline">
                Ver todos →
              </Link>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-white p-12 text-center">
                <Sparkles className="mx-auto h-8 w-8 text-[#CBD5E1]" />
                <p className="mt-3 font-display text-base text-[#475569]">No hay procesos todavía</p>
                <p className="mt-1 text-xs text-[#94A3B8]">Clickeá <span className="font-medium">Nuevo</span> para crear uno.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.slice(0, 12).map((doc) => {
                  const area = areas.find((a) => a.id === doc.areaId);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => openDoc(doc.id)}
                      className="group cursor-pointer overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(14,165,233,0.10)]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-sky-50 via-white to-violet-50">
                        <DocThumbnail doc={doc} />
                        {area && (
                          <span
                            className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-medium text-[#475569] shadow-sm backdrop-blur"
                          >
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: area.color }} />
                            {area.name}
                          </span>
                        )}
                        <span className="absolute right-2 top-2">
                          <StatusPill status={doc.status} size="sm" />
                        </span>
                        <div
                          className="absolute bottom-2 right-2 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="rounded-md bg-white p-1 shadow-sm hover:bg-[#F3F4F6]">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onSelect={() => {
                                  setRenamingId(doc.id);
                                  setRenameValue(doc.name);
                                }}
                              >
                                <Pencil className="h-4 w-4" /> Renombrar
                              </DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => duplicateDocument(doc.id)}>
                                <Copy className="h-4 w-4" /> Duplicar
                              </DropdownMenuItem>
                              {doc.baseline && (
                                <DropdownMenuItem onSelect={() => setAuditDoc(doc)}>
                                  <ScrollText className="h-4 w-4" /> Ver auditoría
                                </DropdownMenuItem>
                              )}
                              {doc.status === "published" && (
                                <DropdownMenuItem onSelect={() => setVersionsDoc(doc)}>
                                  <HistoryIcon className="h-4 w-4" /> Ver versiones
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onSelect={() => deleteDocument(doc.id)}
                                className="text-[#DC2626] focus:text-[#DC2626]"
                              >
                                <Trash2 className="h-4 w-4" /> Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="truncate font-display text-sm font-semibold text-[#0F172A]">{doc.name}</div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#94A3B8]">
                          <span>{doc.pages[0]?.shapes.length ?? 0} shapes</span>
                          <span>·</span>
                          <span>{timeAgo(doc.updatedAt)}</span>
                          {doc.status === "published" && doc.currentVersion != null && (
                            <>
                              <span>·</span>
                              <span className="font-medium text-emerald-600">v{doc.currentVersion}</span>
                            </>
                          )}
                        </div>
                        {doc.status === "published" && (doc.versions?.length ?? 0) > 0 && (
                          <div className="mt-1 flex items-center gap-1 text-[10px] text-[#94A3B8]">
                            <UsersIcon className="h-2.5 w-2.5" />
                            <span>
                              {doc.versions?.[doc.versions.length - 1]?.approverIds.length ?? 0} aprobador
                              {(doc.versions?.[doc.versions.length - 1]?.approverIds.length ?? 0) === 1 ? "" : "es"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* New document modal */}
      <Dialog open={showNew} onOpenChange={(o) => { setShowNew(o); if (!o) setSelectedAreaIds([]); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Iniciar nuevo proceso</DialogTitle>
            <DialogDescription>Categorizá el proceso por área y elegí cómo empezar.</DialogDescription>
          </DialogHeader>

          {/* Area multi-select */}
          <div className="pt-2">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
              Áreas {selectedAreaIds.length > 0 && <span className="ml-1 normal-case text-[#475569]">· {selectedAreaIds.length} seleccionada{selectedAreaIds.length > 1 ? "s" : ""}</span>}
            </div>
            {areas.length === 0 ? (
              <p className="text-xs text-[#94A3B8]">No hay áreas creadas todavía. Podés asignar una luego desde el proceso.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {areas.map((a) => {
                  const sel = selectedAreaIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() =>
                        setSelectedAreaIds((cur) =>
                          cur.includes(a.id) ? cur.filter((x) => x !== a.id) : [...cur, a.id]
                        )
                      }
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-all",
                        sel
                          ? "border-transparent bg-[#0F172A] text-white shadow-sm"
                          : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#CBD5E1]"
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

          <div className="mt-1 grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <NewOption
              onClick={handleCreateBlank}
              icon={<FilePlus2 className="h-6 w-6" />}
              title="Empezar de cero"
              desc="Lienzo en blanco."
              accent="from-sky-500 to-cyan-500"
            />
            <NewOption
              onClick={handleTemplates}
              icon={<LayoutGrid className="h-6 w-6" />}
              title="Template"
              desc="Procesos pre-armados."
              accent="from-violet-500 to-fuchsia-500"
            />
            <NewOption
              onClick={handleCapture}
              icon={<Mic className="h-6 w-6" />}
              title="Capturar proceso"
              desc="IA, Granola o notas."
              accent="from-amber-500 to-pink-500"
            />
          </div>
        </DialogContent>
      </Dialog>


      {/* Rename modal */}
      <Dialog open={!!renamingId} onOpenChange={(o) => { if (!o) setRenamingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renombrar proceso</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renamingId) {
                renameDocument(renamingId, renameValue.trim() || "Sin título");
                setRenamingId(null);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenamingId(null)}>Cancelar</Button>
            <Button
              onClick={() => {
                if (renamingId) {
                  renameDocument(renamingId, renameValue.trim() || "Sin título");
                  setRenamingId(null);
                }
              }}
            >
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CaptureProcessModal
        open={captureOpen}
        onClose={() => { setCaptureOpen(false); setSelectedAreaIds([]); }}
        defaultAreaIds={selectedAreaIds.length > 0 ? selectedAreaIds : (areaId !== "all" ? [areaId] : undefined)}
      />

      {auditDoc && (
        <ChangesDiffModal
          open={!!auditDoc}
          onClose={() => setAuditDoc(null)}
          prev={auditDoc.baseline ? ({ ...auditDoc, pages: auditDoc.baseline.pages } as DiagramDocument) : null}
          next={auditDoc}
          title={`Auditoría · ${auditDoc.name}`}
        />
      )}

      <PickProcessModal
        open={pickerMode !== null}
        mode={pickerMode ?? "edit"}
        onClose={() => setPickerMode(null)}
      />

      {versionsDoc && (
        <VersionsModal
          doc={versionsDoc}
          open={!!versionsDoc}
          onClose={() => setVersionsDoc(null)}
        />
      )}
    </div>
  );
}

function StatusItem({ selected, onClick, dotClass, label, count }: { selected: boolean; onClick: () => void; dotClass: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
        selected ? "bg-[#F1F5F9] font-medium text-[#0F172A]" : "text-[#475569] hover:bg-[#F8FAFC]"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-[#94A3B8]">{count}</span>
    </button>
  );
}

function SidebarLink({ active, icon: Icon, label, to }: { active?: boolean; icon: React.ElementType; label: string; to?: string }) {
  const cls = cn(
    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#475569] hover:bg-[#F1F5F9] text-left",
    active && "bg-gradient-to-r from-sky-50 to-violet-50 text-[#0F172A] font-medium",
  );
  if (to) return <Link to={to} className={cls}><Icon className="h-4 w-4" /> {label}</Link>;
  return <button className={cls}><Icon className="h-4 w-4" /> {label}</button>;
}

function AreaItem({ selected, onClick, color, label, count }: { selected: boolean; onClick: () => void; color: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
        selected ? "bg-[#F1F5F9] font-medium text-[#0F172A]" : "text-[#475569] hover:bg-[#F8FAFC]"
      )}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className="text-xs text-[#94A3B8]">{count}</span>
    </button>
  );
}

function HeroCard({ onClick, icon, title, desc, gradient, iconBg, badge }: { onClick: () => void; icon: React.ReactNode; title: string; desc: string; gradient: string; iconBg: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(14,165,233,0.12)]",
        gradient
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm", iconBg)}>
          {icon}
        </div>
        {badge !== undefined && badge > 0 && (
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-2 text-[11px] font-semibold text-[#0F172A] shadow-sm">
            {badge}
          </span>
        )}
      </div>
      <div className="font-display text-base font-semibold text-[#0F172A]">{title}</div>
      <div className="mt-0.5 text-xs text-[#475569]">{desc}</div>
    </button>
  );
}

function NewOption({ onClick, icon, title, desc, accent }: { onClick: () => void; icon: React.ReactNode; title: string; desc: string; accent: string }) {
  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-start gap-2 rounded-xl border border-[#E2E8F0] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-md"
    >
      <div className={cn("inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm", accent)}>
        {icon}
      </div>
      <div className="font-display text-sm font-semibold text-[#0F172A]">{title}</div>
      <div className="text-xs text-[#64748B]">{desc}</div>
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

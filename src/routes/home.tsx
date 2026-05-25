import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  Upload,
  FilePlus2,
  Sparkles,
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
} from "@/components/ui/dropdown-menu";
import { useDiagramStore } from "@/lib/diagram-store";
import { cn } from "@/lib/utils";
import { useAuth, signOut } from "@/lib/auth";
import {
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/home")({
  head: () => ({
    meta: [
      { title: "Dashboard — FlowIt" },
      { name: "description", content: "Manage your FlowIt diagrams." },
    ],
  }),
  component: HomePage,
});

const CATEGORIES = ["All", "Processes", "Systems", "Planning", "Brainstorming", "Agile"];
const SIDEBAR_ITEMS = [
  { label: "Home", icon: HomeIcon, active: true },
  { label: "Documents", icon: FileText },
  { label: "Templates", icon: LayoutGrid },
  { label: "Integrations", icon: Plug },
];

function HomePage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading } = useAuth();
  const documents = useDiagramStore((s) => s.documents);
  const ensureSeed = useDiagramStore((s) => s.ensureSeed);
  const createDocument = useDiagramStore((s) => s.createDocument);
  const deleteDocument = useDiagramStore((s) => s.deleteDocument);
  const duplicateDocument = useDiagramStore((s) => s.duplicateDocument);
  const renameDocument = useDiagramStore((s) => s.renameDocument);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showNew, setShowNew] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    ensureSeed();
  }, [ensureSeed]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const filtered = useMemo(() => {
    return documents
      .filter((d) => (category === "All" ? true : d.category === category))
      .filter((d) => d.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [documents, category, query]);

  const openDoc = (id: string) => navigate({ to: "/editor", search: { doc: id } });

  const handleCreateBlank = () => {
    const id = createDocument();
    setShowNew(false);
    openDoc(id);
  };

  return (
    <div className="flex h-screen flex-col bg-white text-[#111827]">
      {/* Top navbar */}
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#5B6CF8] text-white font-bold">
            F
          </div>
          <span className="text-base font-semibold">FlowIt</span>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search diagrams"
            className="h-9 pl-9"
          />
        </div>
        <div className="flex items-center gap-3" />
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-[240px] flex-col border-r border-[#EBEBEB] bg-white p-3">
          <Button
            onClick={() => setShowNew(true)}
            className="mb-4 w-full bg-[#5B6CF8] hover:bg-[#4856E0] text-white"
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          <nav className="flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => (
              <button
                key={item.label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-[#4B5563] hover:bg-[#F3F4F6] text-left",
                  item.active && "bg-[#F3F4F6] text-[#111827] font-medium",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-sm transition-colors",
                  category === c
                    ? "border-[#5B6CF8] bg-[#5B6CF8] text-white"
                    : "border-[#EBEBEB] bg-white text-[#4B5563] hover:border-[#D0D0D0]",
                )}
              >
                {c}
              </button>
            ))}
          </div>

          <h1 className="mb-4 text-xl font-semibold">Recent documents</h1>

          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#D0D0D0] p-12 text-center text-[#6B7280]">
              No documents yet. Click <span className="font-medium text-[#111827]">+ New</span> to create one.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((doc) => (
                <div
                  key={doc.id}
                  onClick={() => openDoc(doc.id)}
                  className="group cursor-pointer rounded-lg border border-[#EBEBEB] bg-white p-3 transition-all hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5"
                >
                  <div className="relative mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-gradient-to-br from-[#F3F4F6] to-[#E5E7EB]">
                    <div className="flex flex-col items-center gap-2 text-[#9CA3AF]">
                      <LayoutGrid className="h-8 w-8" />
                      <span className="text-xs">{doc.pages[0]?.shapes.length ?? 0} shapes</span>
                    </div>
                    <div
                      className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
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
                            <Pencil className="h-4 w-4" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => duplicateDocument(doc.id)}>
                            <Copy className="h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => deleteDocument(doc.id)}
                            className="text-[#DC2626] focus:text-[#DC2626]"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="truncate text-sm font-medium">{doc.name}</div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Edited {timeAgo(doc.updatedAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* New document modal */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new document</DialogTitle>
            <DialogDescription>Choose how to start.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            <button
              onClick={handleCreateBlank}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#EBEBEB] p-4 text-sm hover:border-[#5B6CF8] hover:bg-[#F5F6FF]"
            >
              <FilePlus2 className="h-6 w-6 text-[#5B6CF8]" />
              Blank diagram
            </button>
            <button
              onClick={handleCreateBlank}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#EBEBEB] p-4 text-sm hover:border-[#5B6CF8] hover:bg-[#F5F6FF]"
            >
              <Upload className="h-6 w-6 text-[#5B6CF8]" />
              Import
            </button>
            <button
              onClick={handleCreateBlank}
              className="flex flex-col items-center gap-2 rounded-lg border border-[#EBEBEB] p-4 text-sm hover:border-[#5B6CF8] hover:bg-[#F5F6FF]"
            >
              <Sparkles className="h-6 w-6 text-[#5B6CF8]" />
              Template
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename modal */}
      <Dialog
        open={!!renamingId}
        onOpenChange={(o) => {
          if (!o) setRenamingId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && renamingId) {
                renameDocument(renamingId, renameValue.trim() || "Untitled");
                setRenamingId(null);
              }
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenamingId(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (renamingId) {
                  renameDocument(renamingId, renameValue.trim() || "Untitled");
                  setRenamingId(null);
                }
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Link to="/home" className="hidden" aria-hidden />
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

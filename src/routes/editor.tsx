import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  ArrowLeft,
  Bold,
  Camera,
  ChevronRight,
  Download,
  Eye,
  FileText,
  FileWarning,
  Image as ImageIcon,
  Italic,
  Layers,
  ListChecks,
  Maximize2,
  GripVertical,
  Pin,
  Plus,
  Search,
  Share2,
  Shapes as ShapesIcon,
  Trash2,
  Underline,
  Upload,
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDiagramStore, makeDefaultShape } from "@/lib/diagram-store";
import { edgePoint, GRID, shapeCenter, snap } from "@/lib/geometry";
import type {
  Connector,
  Diagnostico,
  DocEntry,
  DocType,
  ImprovementCategory,
  Prioridad,
  Shape,
  ShapeType,
} from "@/lib/shape-types";
import {
  CATEGORY_META,
  DIAGNOSTICO_META,
  DOC_TYPES,
  PRIORIDAD_META,
} from "@/lib/shape-types";
import { cn } from "@/lib/utils";

interface EditorSearch {
  doc?: string;
}

export const Route = createFileRoute("/editor")({
  validateSearch: (s: Record<string, unknown>): EditorSearch => ({
    doc: typeof s.doc === "string" ? s.doc : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Editor — FlowIt" },
      { name: "description", content: "Edit your FlowIt diagram." },
    ],
  }),
  component: EditorPage,
});

const FLOWCHART_SHAPES: { type: ShapeType; label: string }[] = [
  { type: "rectangle", label: "Process" },
  { type: "diamond", label: "Decision" },
  { type: "oval", label: "Start/End" },
  { type: "parallelogram", label: "Input" },
  { type: "cylinder", label: "Database" },
  { type: "document", label: "Document" },
  { type: "manual", label: "Manual" },
];

const STANDARD_SHAPES: { type: ShapeType; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "sticky", label: "Sticky" },
];

const CONTAINER_SHAPES: { type: ShapeType; label: string }[] = [
  { type: "container", label: "Container" },
];

function EditorPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const documents = useDiagramStore((s) => s.documents);
  const ensureSeed = useDiagramStore((s) => s.ensureSeed);
  const renameDocument = useDiagramStore((s) => s.renameDocument);
  const setDocStatus = useDiagramStore((s) => s.setDocStatus);

  useEffect(() => {
    ensureSeed();
  }, [ensureSeed]);

  const doc = useMemo(
    () => documents.find((d) => d.id === search.doc) ?? documents[0],
    [documents, search.doc],
  );

  const [currentPageId, setCurrentPageId] = useState<string | undefined>();
  useEffect(() => {
    if (doc && !doc.pages.find((p) => p.id === currentPageId)) {
      setCurrentPageId(doc.pages[0]?.id);
    }
  }, [doc, currentPageId]);

  const page = doc?.pages.find((p) => p.id === currentPageId) ?? doc?.pages[0];

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"shapes" | "images" | "pages" | "summary">("shapes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const pinShape = useCallback(
    (id: string) => setPinnedIds((p) => (p.includes(id) ? p : [...p, id])),
    [],
  );
  const unpinShape = useCallback(
    (id: string) => setPinnedIds((p) => p.filter((x) => x !== id)),
    [],
  );

  const selectedShape =
    selectedIds.length === 1 ? page?.shapes.find((s) => s.id === selectedIds[0]) : undefined;

  if (!doc || !page) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-[#6B7280]">Document not found.</p>
          <Button className="mt-3" onClick={() => navigate({ to: "/home" })}>
            Back to dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-white text-[#111827]">
      {/* Toolbar */}
      <div className="flex h-12 items-center gap-3 border-b border-[#EBEBEB] bg-white px-3">
        <button
          onClick={() => navigate({ to: "/home" })}
          className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
          title="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#5B6CF8] text-white text-sm font-bold">
          F
        </div>
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onBlur={() => {
              renameDocument(doc.id, renameVal.trim() || "Untitled");
              setRenaming(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                renameDocument(doc.id, renameVal.trim() || "Untitled");
                setRenaming(false);
              }
              if (e.key === "Escape") setRenaming(false);
            }}
            className="rounded border border-[#5B6CF8] px-2 py-0.5 text-sm font-medium outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setRenameVal(doc.name);
              setRenaming(true);
            }}
            className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap rounded px-2 py-0.5 text-left text-sm font-medium hover:bg-[#F3F4F6]"
            style={{ minWidth: 160, maxWidth: 280 }}
          >
            {doc.name}
          </button>
        )}
        <button
          onClick={() =>
            setDocStatus(doc.id, doc.status === "draft" ? "published" : "draft")
          }
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            doc.status === "draft"
              ? "bg-[#FEF3C7] text-[#92400E]"
              : "bg-[#DCFCE7] text-[#166534]",
          )}
        >
          {doc.status === "draft" ? "Draft" : "Published"}
        </button>

        {/* Format controls when shape selected */}
        <div className="ml-2 flex flex-1 items-center justify-center gap-1">
          {selectedShape && (
            <FormatBar
              shape={selectedShape}
              onChange={(patch) =>
                useDiagramStore
                  .getState()
                  .updateShape(doc.id, page.id, selectedShape.id, patch)
              }
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {["LV", "JM", "AR"].map((i, idx) => (
              <div
                key={i}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-xs font-medium text-white",
                  idx === 0 && "bg-[#5B6CF8]",
                  idx === 1 && "bg-[#16A34A]",
                  idx === 2 && "bg-[#F59E0B]",
                )}
              >
                {i}
              </div>
            ))}
          </div>
          <span className="text-xs text-[#6B7280] tabular-nums">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})}
            className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <Button className="h-8 bg-[#5B6CF8] hover:bg-[#4856E0] text-white">
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Icon rail */}
        <div className="flex w-12 flex-col items-center gap-1 border-r border-[#EBEBEB] bg-white py-2">
          {[
            { id: "shapes" as const, icon: ShapesIcon, label: "Shapes" },
            { id: "images" as const, icon: ImageIcon, label: "Images" },
            { id: "pages" as const, icon: Layers, label: "Pages" },
            { id: "summary" as const, icon: ListChecks, label: "Resumen de cambios" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => {
                if (activeTab === t.id) setSidebarOpen((o) => !o);
                else {
                  setActiveTab(t.id);
                  setSidebarOpen(true);
                }
              }}
              title={t.label}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md hover:bg-[#F3F4F6]",
                activeTab === t.id && sidebarOpen && "bg-[#EEF0FF] text-[#5B6CF8]",
              )}
            >
              <t.icon className="h-4 w-4" />
            </button>
          ))}
        </div>

        {/* Left panel */}
        {sidebarOpen && (
          <div className="w-[260px] shrink-0 border-r border-[#EBEBEB] bg-white">
            {activeTab === "shapes" && (
              <ShapesPanel
                onAddShape={(type) => {
                  const s = makeDefaultShape(
                    type,
                    snap(200 - pan.x / zoom),
                    snap(200 - pan.y / zoom),
                  );
                  useDiagramStore.getState().addShape(doc.id, page.id, s);
                  setSelectedIds([s.id]);
                }}
                shapesInUse={page.shapes}
              />
            )}
            {activeTab === "images" && (
              <ImagesPanel
                onAssign={(dataUrl) => {
                  if (selectedShape) {
                    useDiagramStore
                      .getState()
                      .updateShape(doc.id, page.id, selectedShape.id, {
                        imageDataUrl: dataUrl,
                      });
                  }
                }}
              />
            )}
            {activeTab === "pages" && (
              <PagesPanel
                docId={doc.id}
                pages={doc.pages}
                currentPageId={page.id}
                onSelect={setCurrentPageId}
              />
            )}
            {activeTab === "summary" && (
              <SummaryPanel
                docId={doc.id}
                page={page}
                onJumpToShape={(id) => setSelectedIds([id])}
              />
            )}
          </div>
        )}

        {/* Canvas */}
        <CanvasArea
          docId={doc.id}
          page={page}
          pan={pan}
          setPan={setPan}
          zoom={zoom}
          setZoom={setZoom}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          pinnedIds={pinnedIds}
          pinShape={pinShape}
          unpinShape={unpinShape}
        />

        {/* Right panel */}
        {selectedShape && (
          <RightPanel
            docId={doc.id}
            pageId={page.id}
            shape={selectedShape}
            onChange={(patch) =>
              useDiagramStore
                .getState()
                .updateShape(doc.id, page.id, selectedShape.id, patch)
            }
            onClose={() => setSelectedIds([])}
          />
        )}
      </div>

      <PinnedConnectorsOverlay pinnedIds={pinnedIds} />

      <Link to="/editor" className="hidden" aria-hidden />
    </div>
  );
}

/* -------------------- Pinned popup → shape connector overlay -------------------- */
function PinnedConnectorsOverlay({ pinnedIds }: { pinnedIds: string[] }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (pinnedIds.length === 0) return;
    let raf = 0;
    const loop = () => {
      force((n) => (n + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pinnedIds.length]);
  if (pinnedIds.length === 0) return null;
  return (
    <svg className="pointer-events-none fixed inset-0 z-40 h-full w-full">
      {pinnedIds.map((id) => {
        const shape = document.querySelector(`[data-shape-id="${id}"]`) as HTMLElement | null;
        const popup = document.querySelector(`[data-pinned-popup-for="${id}"]`) as HTMLElement | null;
        if (!shape || !popup) return null;
        const s = shape.getBoundingClientRect();
        const p = popup.getBoundingClientRect();
        const sc = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
        const pc = { x: p.left + p.width / 2, y: p.top + p.height / 2 };

        // Determine nearest edge midpoints based on relative position.
        const dx = pc.x - sc.x;
        const dy = pc.y - sc.y;
        let sx: number, sy: number, ex: number, ey: number;
        let horizontal = Math.abs(dx) >= Math.abs(dy);
        if (horizontal) {
          if (dx >= 0) {
            sx = s.right; sy = sc.y; ex = p.left; ey = pc.y;
          } else {
            sx = s.left; sy = sc.y; ex = p.right; ey = pc.y;
          }
        } else {
          if (dy >= 0) {
            sx = sc.x; sy = s.bottom; ex = pc.x; ey = p.top;
          } else {
            sx = sc.x; sy = s.top; ex = pc.x; ey = p.bottom;
          }
        }

        const offset = 80;
        const c1x = horizontal ? sx + (dx >= 0 ? offset : -offset) : sx;
        const c1y = horizontal ? sy : sy + (dy >= 0 ? offset : -offset);
        const c2x = horizontal ? ex + (dx >= 0 ? -offset : offset) : ex;
        const c2y = horizontal ? ey : ey + (dy >= 0 ? -offset : offset);
        const d = `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${ex},${ey}`;

        return (
          <path
            key={id}
            d={d}
            fill="none"
            stroke="#CCCCCC"
            strokeOpacity={0.6}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        );
      })}
    </svg>
  );
}

/* -------------------- Format bar -------------------- */
function FormatBar({
  shape,
  onChange,
}: {
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-[#EBEBEB] bg-white p-1">
      <Select value={shape.fontFamily} onValueChange={(v) => onChange({ fontFamily: v })}>
        <SelectTrigger className="h-7 w-[90px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {["Inter", "Arial", "Georgia", "Monospace"].map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={String(shape.fontSize)}
        onValueChange={(v) => onChange({ fontSize: Number(v) })}
      >
        <SelectTrigger className="h-7 w-[60px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[10, 12, 14, 16, 18, 20, 24].map((f) => (
            <SelectItem key={f} value={String(f)}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleBtn active={shape.bold} onClick={() => onChange({ bold: !shape.bold })}>
        <Bold className="h-3.5 w-3.5" />
      </ToggleBtn>
      <ToggleBtn active={shape.italic} onClick={() => onChange({ italic: !shape.italic })}>
        <Italic className="h-3.5 w-3.5" />
      </ToggleBtn>
      <ToggleBtn active={shape.underline} onClick={() => onChange({ underline: !shape.underline })}>
        <Underline className="h-3.5 w-3.5" />
      </ToggleBtn>
      <input
        type="color"
        value={shape.textColor}
        onChange={(e) => onChange({ textColor: e.target.value })}
        className="h-6 w-6 cursor-pointer rounded border border-[#EBEBEB]"
        title="Text color"
      />
      <div className="mx-1 h-5 w-px bg-[#EBEBEB]" />
      <ToggleBtn
        active={shape.align === "left"}
        onClick={() => onChange({ align: "left" })}
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </ToggleBtn>
      <ToggleBtn
        active={shape.align === "center"}
        onClick={() => onChange({ align: "center" })}
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </ToggleBtn>
      <ToggleBtn
        active={shape.align === "right"}
        onClick={() => onChange({ align: "right" })}
      >
        <AlignRight className="h-3.5 w-3.5" />
      </ToggleBtn>
      <div className="mx-1 h-5 w-px bg-[#EBEBEB]" />
      <Select
        value={shape.borderStyle}
        onValueChange={(v) =>
          onChange({ borderStyle: v as Shape["borderStyle"] })
        }
      >
        <SelectTrigger className="h-7 w-[80px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="solid">Solid</SelectItem>
          <SelectItem value="dashed">Dashed</SelectItem>
          <SelectItem value="dotted">Dotted</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={String(shape.borderWeight)}
        onValueChange={(v) => onChange({ borderWeight: Number(v) as 1 | 2 | 3 })}
      >
        <SelectTrigger className="h-7 w-[55px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1px</SelectItem>
          <SelectItem value="2">2px</SelectItem>
          <SelectItem value="3">3px</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={shape.cornerStyle}
        onValueChange={(v) => onChange({ cornerStyle: v as Shape["cornerStyle"] })}
      >
        <SelectTrigger className="h-7 w-[80px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sharp">Sharp</SelectItem>
          <SelectItem value="rounded">Rounded</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded hover:bg-[#F3F4F6]",
        active && "bg-[#EEF0FF] text-[#5B6CF8]",
      )}
    >
      {children}
    </button>
  );
}

/* -------------------- Shapes panel -------------------- */
function ShapesPanel({
  onAddShape,
  shapesInUse,
}: {
  onAddShape: (t: ShapeType) => void;
  shapesInUse: Shape[];
}) {
  const [q, setQ] = useState("");
  const inUseTypes = Array.from(new Set(shapesInUse.map((s) => s.type)));

  const filt = (items: { type: ShapeType; label: string }[]) =>
    items.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#EBEBEB] p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search shapes"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {inUseTypes.length > 0 && (
          <Section title="Shapes in use">
            <div className="grid grid-cols-3 gap-2">
              {inUseTypes.map((t) => (
                <ShapeTile key={t} type={t} onClick={() => onAddShape(t)} />
              ))}
            </div>
          </Section>
        )}
        <Section title="Flowchart">
          <div className="grid grid-cols-3 gap-2">
            {filt(FLOWCHART_SHAPES).map((s) => (
              <ShapeTile
                key={s.type}
                type={s.type}
                label={s.label}
                onClick={() => onAddShape(s.type)}
              />
            ))}
          </div>
        </Section>
        <Section title="Standard">
          <div className="grid grid-cols-3 gap-2">
            {filt(STANDARD_SHAPES).map((s) => (
              <ShapeTile
                key={s.type}
                type={s.type}
                label={s.label}
                onClick={() => onAddShape(s.type)}
              />
            ))}
          </div>
        </Section>
        <Section title="Containers">
          <div className="grid grid-cols-3 gap-2">
            {filt(CONTAINER_SHAPES).map((s) => (
              <ShapeTile
                key={s.type}
                type={s.type}
                label={s.label}
                onClick={() => onAddShape(s.type)}
              />
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
        {title}
      </div>
      {children}
    </div>
  );
}

function ShapeTile({
  type,
  label,
  onClick,
}: {
  type: ShapeType;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("application/x-flowit-shape", type)}
      title={label ?? type}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-[#EBEBEB] p-1 hover:border-[#5B6CF8] hover:bg-[#F5F6FF]"
    >
      <ShapePreview type={type} />
      {label && <span className="truncate text-[10px] text-[#6B7280]">{label}</span>}
    </button>
  );
}

function ShapePreview({ type }: { type: ShapeType }) {
  const common = "stroke-[#4B5563] fill-white";
  if (type === "diamond")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <polygon points="20,2 38,15 20,28 2,15" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "oval")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <ellipse cx="20" cy="15" rx="18" ry="12" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "parallelogram")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <polygon points="8,4 38,4 32,26 2,26" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "cylinder")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <path d="M4 6 Q4 1 20 1 Q36 1 36 6 L36 24 Q36 29 20 29 Q4 29 4 24 Z" className={common} strokeWidth="1.5" />
        <ellipse cx="20" cy="6" rx="16" ry="4" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "document")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <path d="M3 3 H37 V23 Q28 28 20 23 Q12 18 3 23 Z" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "manual")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <polygon points="2,8 38,2 36,28 2,28" className={common} strokeWidth="1.5" />
      </svg>
    );
  if (type === "sticky")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <rect x="3" y="3" width="34" height="24" fill="#FEF3C7" stroke="#F59E0B" strokeWidth="1.5" />
      </svg>
    );
  if (type === "text")
    return <span className="text-sm font-semibold text-[#4B5563]">T</span>;
  if (type === "container")
    return (
      <svg viewBox="0 0 40 30" className="h-8 w-10">
        <rect x="2" y="2" width="36" height="26" fill="none" stroke="#5B6CF8" strokeWidth="1.5" strokeDasharray="3,2" rx="3" />
      </svg>
    );
  return (
    <svg viewBox="0 0 40 30" className="h-8 w-10">
      <rect x="3" y="5" width="34" height="20" rx="3" className={common} strokeWidth="1.5" />
    </svg>
  );
}

/* -------------------- Images panel -------------------- */
function ImagesPanel({ onAssign }: { onAssign: (dataUrl: string) => void }) {
  const uploads = useDiagramStore((s) => s.uploads);
  const addUpload = useDiagramStore((s) => s.addUpload);
  const removeUpload = useDiagramStore((s) => s.removeUpload);
  const [tab, setTab] = useState<"uploads" | "stock" | "icons">("uploads");
  const [urlVal, setUrlVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") addUpload(reader.result);
      };
      reader.readAsDataURL(file);
    });
  };

  const STOCK = [
    "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400",
    "https://images.unsplash.com/photo-1518770660439-4636190af475?w=400",
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400",
    "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=400",
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#EBEBEB] p-3">
        <div className="mb-2 flex gap-1 rounded-md bg-[#F3F4F6] p-1 text-xs">
          {(["uploads", "stock", "icons"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 rounded px-2 py-1 capitalize",
                tab === t ? "bg-white shadow-sm font-medium" : "text-[#6B7280]",
              )}
            >
              {t === "uploads" ? "My uploads" : t}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "uploads" && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button
              variant="outline"
              className="mb-2 w-full"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Upload image
            </Button>
            <div className="mb-3 flex gap-1">
              <Input
                placeholder="Paste image URL"
                value={urlVal}
                onChange={(e) => setUrlVal(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (urlVal.trim()) {
                    addUpload(urlVal.trim());
                    setUrlVal("");
                  }
                }}
              >
                Add
              </Button>
            </div>
            {uploads.length === 0 ? (
              <div className="rounded border border-dashed border-[#D0D0D0] p-4 text-center text-xs text-[#6B7280]">
                No uploads yet. Add an image, then click it to assign to a selected shape.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {uploads.map((u) => (
                  <div
                    key={u}
                    className="group relative cursor-pointer overflow-hidden rounded border border-[#EBEBEB] hover:border-[#5B6CF8]"
                    onClick={() => onAssign(u)}
                  >
                    <img src={u} alt="upload" className="aspect-square w-full object-cover" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeUpload(u);
                      }}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "stock" && (
          <div className="grid grid-cols-2 gap-2">
            {STOCK.map((u) => (
              <button
                key={u}
                onClick={() => onAssign(u)}
                className="overflow-hidden rounded border border-[#EBEBEB] hover:border-[#5B6CF8]"
              >
                <img src={u} alt="stock" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {tab === "icons" && (
          <div className="text-center text-xs text-[#6B7280]">
            Icon library coming soon.
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Pages panel -------------------- */
function PagesPanel({
  docId,
  pages,
  currentPageId,
  onSelect,
}: {
  docId: string;
  pages: { id: string; name: string }[];
  currentPageId: string;
  onSelect: (id: string) => void;
}) {
  const addPage = useDiagramStore((s) => s.addPage);
  return (
    <div className="flex h-full flex-col p-3">
      <Button variant="outline" className="mb-3 w-full" onClick={() => addPage(docId)}>
        <Plus className="h-4 w-4" /> Add page
      </Button>
      <div className="flex flex-col gap-1">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={cn(
              "rounded-md px-3 py-2 text-left text-sm hover:bg-[#F3F4F6]",
              p.id === currentPageId && "bg-[#EEF0FF] text-[#5B6CF8] font-medium",
            )}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------- Right panel -------------------- */
function RightPanel({
  docId,
  pageId,
  shape,
  onChange,
  onClose,
}: {
  docId: string;
  pageId: string;
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [panelWidth, setPanelWidth] = useState(320);

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = panelWidth;
      const onMove = (ev: PointerEvent) => {
        const next = Math.max(240, Math.min(520, startW - (ev.clientX - startX)));
        setPanelWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [panelWidth],
  );

  return (
    <div
      className="flowit-slide-in-right relative flex h-full shrink-0 flex-col overflow-hidden border-l border-[#EBEBEB] bg-white"
      style={{ width: panelWidth }}
    >
      <div
        onPointerDown={startResize}
        className="absolute left-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent hover:bg-[#5B6CF8]/30 transition-colors"
        title="Arrastrá para ajustar el ancho"
      />

      <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-3">
        <h3 className="text-sm font-semibold">Properties</h3>
        <button
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded hover:bg-[#F3F4F6]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-[#6B7280]">Title</Label>
          <Input
            value={shape.title}
            onChange={(e) => onChange({ title: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#6B7280]">Como está hoy</Label>
          <Textarea
            value={shape.currentReality ?? ""}
            onChange={(e) => onChange({ currentReality: e.target.value })}
            placeholder="Describe la realidad actual de esta etapa"
            rows={3}
            className="resize-none text-sm"
          />
        </div>
        <CompactDiagPrio
          diagnostico={shape.diagnostico ?? "sin_definir"}
          prioridad={shape.prioridad}
          onChangeDiag={(v) => onChange({ diagnostico: v })}
          onChangePrio={(v) => onChange({ prioridad: v })}
        />

        <div className="space-y-2">
          <Label className="text-xs text-[#6B7280]">Oportunidades de mejora</Label>
          <ImprovementList docId={docId} pageId={pageId} shape={shape} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-[#6B7280]">Responsable</Label>
          <Input
            value={shape.responsable}
            onChange={(e) => onChange({ responsable: e.target.value })}
            className="h-8 text-sm"
          />
        </div>



        <div className="space-y-2">
          <Label className="text-xs text-[#6B7280]">Documentos</Label>
          <DocumentsSection docId={docId} pageId={pageId} shape={shape} onChange={onChange} />
        </div>


        <div className="space-y-2">
          <Label className="text-xs text-[#6B7280]">Image</Label>
          {shape.imageDataUrl ? (
            <div className="space-y-2">
              <img
                src={shape.imageDataUrl}
                alt="assigned"
                className="w-full rounded-md border border-[#EBEBEB] object-cover"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[#DC2626]"
                onClick={() => onChange({ imageDataUrl: undefined })}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove image
              </Button>
            </div>
          ) : (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const r = new FileReader();
                  r.onload = () => {
                    if (typeof r.result === "string") {
                      onChange({ imageDataUrl: r.result });
                      useDiagramStore.getState().addUpload(r.result);
                    }
                  };
                  r.readAsDataURL(f);
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" /> Upload image
              </Button>
              <div className="flex gap-1">
                <Input
                  placeholder="Paste image URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    if (url.trim()) {
                      onChange({ imageDataUrl: url.trim() });
                      setUrl("");
                    }
                  }}
                >
                  Set
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


/* -------------------- Compact Diagnóstico + Prioridad rows -------------------- */
function CompactDiagPrio({
  diagnostico,
  prioridad,
  onChangeDiag,
  onChangePrio,
}: {
  diagnostico: Diagnostico;
  prioridad: Prioridad | undefined;
  onChangeDiag: (v: Diagnostico) => void;
  onChangePrio: (v: Prioridad) => void;
}) {
  const diagOrder: Diagnostico[] = ["funciona", "inconsistente", "roto", "sin_definir"];
  const prioOrder: Prioridad[] = ["urgente", "proximo_sprint", "backlog", "ok"];
  const diagMeta = DIAGNOSTICO_META[diagnostico];
  const prioMeta = prioridad ? PRIORIDAD_META[prioridad] : null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Diagnóstico
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white transition-colors"
              style={{ background: diagMeta.bg }}
            >
              <span>{diagMeta.dot}</span>
              {diagMeta.label}
              <ChevronRight className="h-3 w-3 rotate-90 opacity-80" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            {diagOrder.map((d) => {
              const m = DIAGNOSTICO_META[d];
              return (
                <button
                  key={d}
                  onClick={() => onChangeDiag(d)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[#F3F4F6]",
                    diagnostico === d && "bg-[#F3F4F6] font-medium",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: m.bg }}
                  />
                  {m.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
          Prioridad
        </span>
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors"
              style={
                prioMeta
                  ? { background: prioMeta.bg, color: "#fff" }
                  : { background: "#F3F4F6", color: "#6B7280" }
              }
            >
              <span>{prioMeta?.dot ?? "—"}</span>
              {prioMeta?.label ?? "Sin definir"}
              <ChevronRight className="h-3 w-3 rotate-90 opacity-80" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            {prioOrder.map((p) => {
              const m = PRIORIDAD_META[p];
              return (
                <button
                  key={p}
                  onClick={() => onChangePrio(p)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[#F3F4F6]",
                    prioridad === p && "bg-[#F3F4F6] font-medium",
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: m.bg }}
                  />
                  {m.label}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}


/* -------------------- Improvement list (multi-category) -------------------- */
function CategoryToggle({
  cat,
  active,
  onClick,
}: {
  cat: ImprovementCategory;
  active: boolean;
  onClick: () => void;
}) {
  const meta = CATEGORY_META[cat];
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium transition-all",
        active ? "border-transparent" : "border-[#E5E7EB] bg-white text-[#9CA3AF] hover:border-[#D1D5DB]",
      )}
      style={active ? { background: meta.bg, color: meta.fg } : undefined}
      title={meta.label}
    >
      <span>{meta.icon}</span>
      {meta.label}
    </button>
  );
}

const ALL_CATEGORIES: ImprovementCategory[] = [
  "proceso",
  "personas",
  "herramienta",
  "documentacion",
  "probar",
];

function ImprovementList({
  docId,
  pageId,
  shape,
}: {
  docId: string;
  pageId: string;
  shape: Shape;
}) {
  const [text, setText] = useState("");
  const [draftCats, setDraftCats] = useState<ImprovementCategory[]>([]);
  const addImprovement = useDiagramStore((s) => s.addImprovement);
  // updateImprovement removed — saved entries are no longer editable inline
  const deleteImprovement = useDiagramStore((s) => s.deleteImprovement);
  const entries = shape.improvementEntries ?? [];

  const toggleDraft = (c: ImprovementCategory) =>
    setDraftCats((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    addImprovement(docId, pageId, shape.id, v, draftCats);
    setText("");
    setDraftCats([]);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1.5 rounded-md border border-[#EBEBEB] bg-[#FAFAFA] p-2">
        <div className="flex gap-1">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Nueva oportunidad…"
            className="h-8 text-xs"
          />
          <Button size="sm" onClick={submit} disabled={!text.trim()}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((c) => (
            <CategoryToggle
              key={c}
              cat={c}
              active={draftCats.includes(c)}
              onClick={() => toggleDraft(c)}
            />
          ))}
        </div>
      </div>
      {entries.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#E5E7EB] p-2 text-center text-[11px] text-[#9CA3AF]">
          Sin oportunidades
        </div>
      ) : (
        <ul className="space-y-1.5">
          {entries
            .slice()
            .sort((a, b) => b.date - a.date)
            .map((e) => {
              const dominant = e.categories[0];
              const dotMeta = dominant ? CATEGORY_META[dominant] : null;
              const tooltip =
                e.categories.length > 0
                  ? e.categories.map((c) => CATEGORY_META[c].label).join(", ")
                  : "Sin categoría";
              return (
                <li
                  key={e.id}
                  className="flowit-entry group flex items-start gap-2 rounded-md border border-[#EBEBEB] bg-white px-2 py-1.5"
                  title={tooltip}
                >
                  <span
                    className="mt-1 h-2 w-2 shrink-0 rounded-full"
                    style={{ background: dotMeta?.fg ?? "#D1D5DB" }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-[12px] leading-snug text-[#111827]">
                      {e.text}
                    </div>
                    <div className="text-[10px] text-[#9CA3AF]">{formatDate(e.date)}</div>
                  </div>
                  <button
                    onClick={() => deleteImprovement(docId, pageId, shape.id, e.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-[#DC2626]" />
                  </button>
                </li>
              );
            })}

        </ul>
      )}
    </div>
  );
}

/* -------------------- Documents section -------------------- */
function getDocIcon(d: DocEntry): string {
  const mime = d.fileMime ?? "";
  const name = (d.fileName ?? "").toLowerCase();
  if (mime.includes("pdf") || name.endsWith(".pdf")) return "📄";
  if (mime.includes("word") || name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
  if (mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return "🖼";
  if (d.url) return "🔗";
  return "📄";
}

function DocCard({
  doc,
  onPreview,
  onDelete,
  large = false,
}: {
  doc: DocEntry;
  onPreview: () => void;
  onDelete: () => void;
  large?: boolean;
}) {
  const icon = getDocIcon(doc);
  const title = doc.name || doc.fileName || "Sin nombre";
  const canPreview = !!doc.fileDataUrl || !!doc.url;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-[#EBEBEB] bg-white transition-shadow hover:shadow-sm",
        large ? "p-3" : "p-2",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-[#F3F4F6]",
          large ? "h-12 w-12 text-2xl" : "h-9 w-9 text-lg",
        )}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate font-semibold text-[#111827]",
            large ? "text-sm" : "text-[13px]",
          )}
        >
          {title}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-medium text-[#3730A3]">
            {doc.docType}
          </span>
          {doc.fileName && (
            <span className="truncate text-[10px] text-[#9CA3AF]">{doc.fileName}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={onPreview}
          disabled={!canPreview}
          title="Vista previa"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827] disabled:opacity-30"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Eliminar"
          className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-[#FEE2E2] hover:text-[#DC2626]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function DocumentsSection({
  docId,
  pageId,
  shape,
  onChange,
}: {
  docId: string;
  pageId: string;
  shape: Shape;
  onChange: (patch: Partial<Shape>) => void;
}) {
  const addShapeDoc = useDiagramStore((s) => s.addShapeDoc);
  const updateShapeDoc = useDiagramStore((s) => s.updateShapeDoc);
  const deleteShapeDoc = useDiagramStore((s) => s.deleteShapeDoc);
  const docs = shape.documents ?? [];
  const disabled = !!shape.noStandardDoc;
  const [previewDoc, setPreviewDoc] = useState<DocEntry | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);

  // Inline add form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<DocType>("Playbook");
  const [formTab, setFormTab] = useState<"file" | "url">("file");
  const [formUrl, setFormUrl] = useState("");
  const [formFile, setFormFile] = useState<{
    dataUrl: string;
    mime: string;
    size: number;
    name: string;
  } | null>(null);

  const resetForm = () => {
    setFormName("");
    setFormType("Playbook");
    setFormTab("file");
    setFormUrl("");
    setFormFile(null);
    setAdding(false);
  };

  const handleFilePick = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setFormFile({
        dataUrl: reader.result as string,
        mime: file.type,
        size: file.size,
        name: file.name,
      });
      if (!formName) setFormName(file.name.replace(/\.[^.]+$/, ""));
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    addShapeDoc(docId, pageId, shape.id);
    // Find the just-added entry — it's appended at the end. We patch the latest store state.
    const state = useDiagramStore.getState();
    const d = state.documents.find((x) => x.id === docId);
    const p = d?.pages.find((x) => x.id === pageId);
    const s = p?.shapes.find((x) => x.id === shape.id);
    const newest = s?.documents?.[s.documents.length - 1];
    if (newest) {
      updateShapeDoc(docId, pageId, shape.id, newest.id, {
        name: formName || formFile?.name || "",
        docType: formType,
        url: formTab === "url" ? formUrl : "",
        fileDataUrl: formTab === "file" ? formFile?.dataUrl : undefined,
        fileMime: formTab === "file" ? formFile?.mime : undefined,
        fileSize: formTab === "file" ? formFile?.size : undefined,
        fileName: formTab === "file" ? formFile?.name : undefined,
      });
    }
    resetForm();
  };

  const canSave =
    (formName.trim().length > 0) &&
    (formTab === "file" ? !!formFile : formUrl.trim().length > 0);

  const visible = docs.slice(0, 3);
  const hasMore = docs.length > visible.length;

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#EBEBEB] bg-[#FAFAFA] px-2 py-1.5 text-[12px] text-[#374151]">
        <input
          type="checkbox"
          checked={disabled}
          onChange={(e) => onChange({ noStandardDoc: e.target.checked })}
          className="h-3.5 w-3.5"
        />
        <FileWarning className="h-3.5 w-3.5 text-[#F59E0B]" />
        <span>Sin documentación estandarizada</span>
      </label>
      <div className={cn("space-y-1.5", disabled && "pointer-events-none opacity-50")}>
        {docs.length === 0 && !adding ? (
          <div className="rounded-md border border-dashed border-[#E5E7EB] p-2 text-center text-[11px] text-[#9CA3AF]">
            Sin documentos
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                onPreview={() => setPreviewDoc(d)}
                onDelete={() => deleteShapeDoc(docId, pageId, shape.id, d.id)}
              />
            ))}
          </div>
        )}

        {!adding && (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setAdding(true)}
            disabled={disabled}
          >
            <Plus className="h-3.5 w-3.5" /> Agregar documento
          </Button>
        )}

        {adding && (
          <div className="space-y-2 rounded-md border border-[#EBEBEB] bg-[#FAFAFA] p-2">
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Nombre del documento"
              className="h-8 text-xs"
            />
            <Select value={formType} onValueChange={(v) => setFormType(v as DocType)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1 rounded-md bg-white p-0.5">
              <button
                onClick={() => setFormTab("file")}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                  formTab === "file"
                    ? "bg-[#5B6CF8] text-white"
                    : "text-[#6B7280] hover:bg-[#F3F4F6]",
                )}
              >
                📎 Subir archivo
              </button>
              <button
                onClick={() => setFormTab("url")}
                className={cn(
                  "flex-1 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                  formTab === "url"
                    ? "bg-[#5B6CF8] text-white"
                    : "text-[#6B7280] hover:bg-[#F3F4F6]",
                )}
              >
                🔗 Pegar URL
              </button>
            </div>
            {formTab === "file" ? (
              <label className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-[#D0D0D0] text-[11px] text-[#6B7280] hover:border-[#5B6CF8] hover:text-[#5B6CF8]">
                <Upload className="h-3.5 w-3.5" />
                {formFile ? formFile.name : "Seleccionar archivo…"}
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.docx,application/pdf,image/png,image/jpeg,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFilePick(f);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : (
              <Input
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://…"
                className="h-8 text-xs"
              />
            )}
            {formFile && formFile.size > 2 * 1024 * 1024 && (
              <div className="text-[10px] text-[#F59E0B]">
                Archivo grande — puede afectar el rendimiento
              </div>
            )}
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={resetForm}
                className="text-[11px] text-[#6B7280] hover:text-[#111827] hover:underline"
              >
                Cancelar
              </button>
              <Button size="sm" className="h-7 text-[11px]" onClick={handleSave} disabled={!canSave}>
                Guardar
              </Button>
            </div>
          </div>
        )}

        {hasMore && !adding && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-right text-[11px] font-medium text-[#5B6CF8] hover:underline"
          >
            Ver todos ({docs.length}) →
          </button>
        )}
        {docs.length >= 2 && !hasMore && !adding && (
          <button
            onClick={() => setShowAll(true)}
            className="w-full text-right text-[11px] font-medium text-[#5B6CF8] hover:underline"
          >
            Ver todos →
          </button>
        )}
      </div>

      {previewDoc && (
        <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {showAll && (
        <AllDocsModal
          docs={docs}
          onClose={() => setShowAll(false)}
          onPreview={(d) => setPreviewDoc(d)}
          onDelete={(d) => deleteShapeDoc(docId, pageId, shape.id, d.id)}
          shapeTitle={shape.title || shape.text || "Documentos"}
        />
      )}
    </div>
  );
}

function AllDocsModal({
  docs,
  onClose,
  onPreview,
  onDelete,
  shapeTitle,
}: {
  docs: DocEntry[];
  onClose: () => void;
  onPreview: (d: DocEntry) => void;
  onDelete: (d: DocEntry) => void;
  shapeTitle: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[720px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#111827]">
              Documentos · {shapeTitle}
            </div>
            <div className="text-[11px] text-[#6B7280]">{docs.length} elemento(s)</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-[#F9FAFB] p-4">
          <div className="space-y-2">
            {docs.map((d) => (
              <DocCard
                key={d.id}
                doc={d}
                large
                onPreview={() => onPreview(d)}
                onDelete={() => onDelete(d)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DocPreviewModal({ doc, onClose }: { doc: DocEntry; onClose: () => void }) {
  const mime = doc.fileMime ?? "";
  const isPdf = mime.includes("pdf") || (doc.fileName ?? "").toLowerCase().endsWith(".pdf");
  const isImage = mime.startsWith("image/");
  const isDocx = mime.includes("word") || (doc.fileName ?? "").toLowerCase().endsWith(".docx");
  const isLink = !doc.fileDataUrl && !!doc.url;

  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfFailed, setPdfFailed] = useState(false);

  // Convert base64 PDF → Blob URL (iframes don't reliably accept huge data: URIs).
  useEffect(() => {
    setPdfBlobUrl(null);
    setPdfFailed(false);
    if (!isPdf || !doc.fileDataUrl) return;
    try {
      const comma = doc.fileDataUrl.indexOf(",");
      const b64 = comma >= 0 ? doc.fileDataUrl.slice(comma + 1) : doc.fileDataUrl;
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch {
      setPdfFailed(true);
    }
  }, [isPdf, doc.fileDataUrl]);

  const downloadHref = doc.fileDataUrl ?? doc.url;
  const downloadName = doc.fileName || doc.name || "documento";
  // Source the iframe can render: prefer the uploaded file blob, fall back to the external URL.
  const pdfSrc = pdfBlobUrl ?? (doc.url || null);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] h-[90vh] w-full max-w-[900px] flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-[#111827]">
              {doc.name || doc.fileName || "Documento"}
            </div>
            {doc.fileName && (
              <div className="truncate text-[11px] text-[#6B7280]">{doc.fileName}</div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-[#F9FAFB]">
          {isPdf && (
            <div className="flex h-full flex-col">
              {pdfSrc && !pdfFailed && (
                <iframe
                  src={pdfSrc}
                  title={doc.name}
                  className="w-full flex-1 border-0"
                />
              )}
              {(pdfFailed || !pdfSrc) && (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
                  <FileText className="h-10 w-10 text-[#6B7280]" />
                  <div className="text-sm text-[#374151]">No se puede previsualizar</div>
                  {downloadHref && (
                    <a
                      href={downloadHref}
                      download={downloadName}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-[#5B6CF8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4854d1]"
                    >
                      <Download className="h-3.5 w-3.5" /> Descargar PDF
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
          {isImage && doc.fileDataUrl && (
            <img
              src={doc.fileDataUrl}
              alt={doc.name}
              className="mx-auto block max-h-[75vh] w-full object-contain"
            />
          )}
          {isDocx && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <FileText className="h-12 w-12 text-[#6B7280]" />
              <div className="text-sm text-[#374151]">
                Descargá el archivo para visualizarlo
              </div>
              {doc.fileDataUrl && (
                <a
                  href={doc.fileDataUrl}
                  download={doc.fileName || doc.name || "documento"}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#5B6CF8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4854d1]"
                >
                  <Download className="h-3.5 w-3.5" /> Descargar
                </a>
              )}
            </div>
          )}
          {isLink && (
            <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
              <div className="text-3xl">🔗</div>
              <div className="break-all text-sm text-[#374151]">{doc.url}</div>
              <a
                href={doc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#5B6CF8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4854d1]"
              >
                Abrir enlace ↗
              </a>
            </div>
          )}
          {!isPdf && !isImage && !isDocx && !isLink && (
            <div className="p-12 text-center text-sm text-[#6B7280]">
              Vista previa no disponible
            </div>
          )}
        </div>
      </div>
    </div>
  );
}




function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

/* -------------------- Summary panel -------------------- */
function SummaryPanel({
  docId: _docId,
  page,
  onJumpToShape,
}: {
  docId: string;
  page: { id: string; shapes: Shape[] };
  onJumpToShape: (id: string) => void;
}) {
  const entries = page.shapes
    .flatMap((s) =>
      (s.improvementEntries ?? []).map((e) => ({ shape: s, entry: e })),
    )
    .sort((a, b) => b.entry.date - a.entry.date);
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#EBEBEB] p-3">
        <h3 className="text-sm font-semibold text-[#111827]">Resumen de cambios</h3>
        <p className="mt-0.5 text-[11px] text-[#6B7280]">
          Todas las mejoras propuestas en el proceso
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Oportunidades de mejora
          </div>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E5E7EB] p-4 text-center text-xs text-[#9CA3AF]">
              Aún no hay oportunidades de mejora.
            </div>
          ) : (
            <ul className="space-y-2">
              {entries.map(({ shape, entry }) => (
                <li
                  key={entry.id}
                  className="rounded-md border border-[#EBEBEB] bg-white p-2.5 hover:border-[#5B6CF8]"
                >
                  <button
                    onClick={() => onJumpToShape(shape.id)}
                    className="mb-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10px] font-medium text-[#5B6CF8] hover:bg-[#DDE2FF]"
                  >
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{
                        background:
                          DIAGNOSTICO_META[shape.diagnostico ?? "sin_definir"].bg,
                      }}
                    />
                    <span className="truncate">{shape.title || shape.text}</span>
                  </button>
                  <div className="break-words text-[12px] leading-snug text-[#111827]">
                    {entry.text}
                  </div>
                  {entry.categories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {entry.categories.map((c) => {
                        const m = CATEGORY_META[c];
                        return (
                          <span
                            key={c}
                            className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium"
                            style={{ background: m.bg, color: m.fg }}
                          >
                            <span>{m.icon}</span>
                            {m.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-[#9CA3AF]">{formatDate(entry.date)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">
            <FileWarning className="h-3.5 w-3.5 text-[#F59E0B]" />
            Documentación faltante
          </div>
          {(() => {
            const missing = page.shapes.filter((s) => s.noStandardDoc);
            if (missing.length === 0) {
              return (
                <div className="rounded-md border border-dashed border-[#E5E7EB] p-3 text-center text-xs text-[#9CA3AF]">
                  Todas las etapas tienen documentación.
                </div>
              );
            }
            return (
              <ul className="space-y-1">
                {missing.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => onJumpToShape(s.id)}
                      className="flex w-full items-center gap-2 rounded-md border border-[#EBEBEB] bg-white px-2 py-1.5 text-left text-[12px] hover:border-[#F59E0B] hover:bg-[#FFFBEB]"
                    >
                      <FileWarning className="h-3.5 w-3.5 shrink-0 text-[#F59E0B]" />
                      <span className="truncate">{s.title || s.text || "Sin título"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            );
          })()}
        </div>
      </div>

    </div>
  );
}



/* -------------------- Canvas -------------------- */
interface CanvasProps {
  docId: string;
  page: { id: string; shapes: Shape[]; connectors: Connector[] };
  pan: { x: number; y: number };
  setPan: (p: { x: number; y: number }) => void;
  zoom: number;
  setZoom: (z: number) => void;
  selectedIds: string[];
  setSelectedIds: (ids: string[] | ((p: string[]) => string[])) => void;
  pinnedIds: string[];
  pinShape: (id: string) => void;
  unpinShape: (id: string) => void;
}

function CanvasArea({
  docId,
  page,
  pan,
  setPan,
  zoom,
  setZoom,
  selectedIds,
  setSelectedIds,
  pinnedIds,
  pinShape,
  unpinShape,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const panRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const [dragging, setDragging] = useState<{
    ids: string[];
    startX: number;
    startY: number;
    orig: Record<string, { x: number; y: number }>;
  } | null>(null);
  const [selBox, setSelBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const selBoxStart = useRef<{ x: number; y: number } | null>(null);
  const [connectDraft, setConnectDraft] = useState<{
    fromId: string;
    to: { x: number; y: number };
  } | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingConnectorId, setEditingConnectorId] = useState<string | null>(null);

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (sx - rect.left - pan.x) / zoom,
        y: (sy - rect.top - pan.y) / zoom,
      };
    },
    [pan, zoom],
  );

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(true);
        if (containerRef.current) containerRef.current.style.cursor = "grab";
      }
      if (
        (e.key === "Backspace" || e.key === "Delete") &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        if (selectedIds.length > 0) {
          useDiagramStore.getState().deleteShapes(docId, page.id, selectedIds);
          setSelectedIds([]);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpaceDown(false);
        if (containerRef.current) containerRef.current.style.cursor = "";
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [docId, page.id, selectedIds, setSelectedIds]);

  // Wheel: ctrl/cmd+wheel → zoom (toward cursor); otherwise trackpad two-finger pan
  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.ctrlKey || e.metaKey) {
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = Math.max(0.25, Math.min(4, zoom * factor));
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - pan.x) / zoom;
      const wy = (my - pan.y) / zoom;
      setPan({ x: mx - wx * newZoom, y: my - wy * newZoom });
      setZoom(newZoom);
    } else {
      setPan({ x: pan.x - e.deltaX, y: pan.y - e.deltaY });
    }
  };

  // Pan / selection box
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || (e.button === 0 && spaceDown)) {
      panRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      if (containerRef.current) containerRef.current.style.cursor = "grabbing";
      return;
    }
    if (e.button === 0 && e.target === e.currentTarget) {
      // start selection box
      const w = screenToWorld(e.clientX, e.clientY);
      selBoxStart.current = w;
      setSelBox({ x: w.x, y: w.y, w: 0, h: 0 });
      setSelectedIds([]);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.panX + dx, y: panRef.current.panY + dy });
      return;
    }
    if (dragging) {
      const w = screenToWorld(e.clientX, e.clientY);
      const dx = w.x - dragging.startX;
      const dy = w.y - dragging.startY;
      dragging.ids.forEach((id) => {
        const o = dragging.orig[id];
        useDiagramStore.getState().updateShape(docId, page.id, id, {
          x: snap(o.x + dx),
          y: snap(o.y + dy),
        });
      });
      return;
    }
    if (selBoxStart.current) {
      const w = screenToWorld(e.clientX, e.clientY);
      const x = Math.min(selBoxStart.current.x, w.x);
      const y = Math.min(selBoxStart.current.y, w.y);
      const ww = Math.abs(w.x - selBoxStart.current.x);
      const hh = Math.abs(w.y - selBoxStart.current.y);
      setSelBox({ x, y, w: ww, h: hh });
      const hits = page.shapes
        .filter(
          (s) =>
            s.x < x + ww && s.x + s.width > x && s.y < y + hh && s.y + s.height > y,
        )
        .map((s) => s.id);
      setSelectedIds(hits);
      return;
    }
    if (connectDraft) {
      const w = screenToWorld(e.clientX, e.clientY);
      setConnectDraft({ ...connectDraft, to: w });
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current) {
      panRef.current = null;
      if (containerRef.current) containerRef.current.style.cursor = spaceDown ? "grab" : "";
    }
    if (dragging) setDragging(null);
    if (selBoxStart.current) {
      selBoxStart.current = null;
      setSelBox(null);
    }
    if (connectDraft) {
      // find target shape under cursor
      const w = screenToWorld(e.clientX, e.clientY);
      const target = page.shapes.find(
        (s) =>
          s.id !== connectDraft.fromId &&
          w.x >= s.x &&
          w.x <= s.x + s.width &&
          w.y >= s.y &&
          w.y <= s.y + s.height,
      );
      if (target) {
        useDiagramStore.getState().addConnector(docId, page.id, {
          id: `c${Date.now()}`,
          fromId: connectDraft.fromId,
          toId: target.id,
          label: "",
          lineStyle: "solid",
          weight: 2,
          arrowEnd: "arrow",
        });
      }
      setConnectDraft(null);
    }
  };

  // Drop from sidebar
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/x-flowit-shape") as ShapeType;
    if (!type) return;
    const w = screenToWorld(e.clientX, e.clientY);
    const s = makeDefaultShape(type, snap(w.x - 90), snap(w.y - 40));
    useDiagramStore.getState().addShape(docId, page.id, s);
    setSelectedIds([s.id]);
  };

  const sortedShapes = [...page.shapes].sort((a, b) => a.z - b.z);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
      className="relative flex-1 overflow-hidden flowit-canvas-bg select-none"
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${GRID * zoom}px ${GRID * zoom}px`,
      }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Connectors layer */}
        <svg
          className="absolute left-0 top-0 overflow-visible pointer-events-none"
          width="1"
          height="1"
        >
          <defs>
            <marker
              id="flowit-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#4B5563" />
            </marker>
          </defs>
          {page.connectors.map((c) => {
            const from = page.shapes.find((s) => s.id === c.fromId);
            const to = page.shapes.find((s) => s.id === c.toId);
            if (!from || !to) return null;
            const p1 = edgePoint(from, shapeCenter(to));
            const p2 = edgePoint(to, shapeCenter(from));
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            return (
              <g key={c.id} className="pointer-events-auto">
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke="#4B5563"
                  strokeWidth={c.weight}
                  strokeDasharray={
                    c.lineStyle === "dashed" ? "8,4" : c.lineStyle === "dotted" ? "2,3" : undefined
                  }
                  markerEnd={c.arrowEnd !== "none" ? "url(#flowit-arrow)" : undefined}
                  onDoubleClick={() => setEditingConnectorId(c.id)}
                  className="cursor-pointer"
                />
                {(c.label || editingConnectorId === c.id) && (
                  <foreignObject x={mid.x - 60} y={mid.y - 12} width={120} height={24}>
                    {editingConnectorId === c.id ? (
                      <input
                        autoFocus
                        defaultValue={c.label}
                        onBlur={(e) => {
                          useDiagramStore
                            .getState()
                            .updateConnector(docId, page.id, c.id, { label: e.target.value });
                          setEditingConnectorId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingConnectorId(null);
                        }}
                        className="w-full rounded border border-[#5B6CF8] bg-white px-1 text-center text-xs outline-none"
                      />
                    ) : (
                      <div
                        onDoubleClick={() => setEditingConnectorId(c.id)}
                        className="rounded bg-white/90 px-1 text-center text-xs text-[#4B5563]"
                      >
                        {c.label}
                      </div>
                    )}
                  </foreignObject>
                )}
              </g>
            );
          })}
          {/* Connector draft */}
          {connectDraft &&
            (() => {
              const from = page.shapes.find((s) => s.id === connectDraft.fromId);
              if (!from) return null;
              const p1 = edgePoint(from, connectDraft.to);
              return (
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={connectDraft.to.x}
                  y2={connectDraft.to.y}
                  stroke="#5B6CF8"
                  strokeWidth={2}
                  strokeDasharray="6,4"
                />
              );
            })()}
        </svg>

        {/* Shapes layer */}
        {sortedShapes.map((s) => (
          <ShapeNode
            key={s.id}
            shape={s}
            docId={docId}
            pageId={page.id}
            pinned={pinnedIds.includes(s.id)}
            onPin={() => pinShape(s.id)}
            onUnpin={() => unpinShape(s.id)}
            selected={selectedIds.includes(s.id)}
            editingText={editingTextId === s.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (spaceDown) return;
              const additive = e.shiftKey;
              const newSel = additive
                ? selectedIds.includes(s.id)
                  ? selectedIds.filter((i) => i !== s.id)
                  : [...selectedIds, s.id]
                : selectedIds.includes(s.id)
                  ? selectedIds
                  : [s.id];
              setSelectedIds(newSel);
              const w = screenToWorld(e.clientX, e.clientY);
              const orig: Record<string, { x: number; y: number }> = {};
              newSel.forEach((id) => {
                const sh = page.shapes.find((p) => p.id === id);
                if (sh) orig[id] = { x: sh.x, y: sh.y };
              });
              setDragging({ ids: newSel, startX: w.x, startY: w.y, orig });
            }}
            onDoubleClickText={() => setEditingTextId(s.id)}
            onTextCommit={(text) => {
              useDiagramStore.getState().updateShape(docId, page.id, s.id, { text });
              setEditingTextId(null);
            }}
            onSelectShape={() => setSelectedIds([s.id])}
            onStartConnector={(e) => {
              e.stopPropagation();
              const w = screenToWorld(e.clientX, e.clientY);
              setConnectDraft({ fromId: s.id, to: w });
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onContextAction={(action) => {
              if (action === "editText") setEditingTextId(s.id);
              if (action === "delete") {
                useDiagramStore.getState().deleteShapes(docId, page.id, [s.id]);
                setSelectedIds([]);
              }
              if (action === "front") useDiagramStore.getState().bringToFront(docId, page.id, s.id);
              if (action === "back") useDiagramStore.getState().sendToBack(docId, page.id, s.id);
              if (action === "duplicate") {
                const copy = { ...s, id: `s${Date.now()}`, x: s.x + 40, y: s.y + 40 };
                useDiagramStore.getState().addShape(docId, page.id, copy);
              }
            }}
          />
        ))}

        {/* Selection box */}
        {selBox && (
          <div
            className="pointer-events-none absolute border border-[#5B6CF8] bg-[#5B6CF8]/10"
            style={{
              left: selBox.x,
              top: selBox.y,
              width: selBox.w,
              height: selBox.h,
            }}
          />
        )}
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-white/90 px-2 py-1 text-[11px] text-[#6B7280] shadow-sm">
        Hold <kbd className="rounded bg-[#F3F4F6] px-1">Space</kbd> + drag to pan · Two-finger scroll to pan · <kbd className="rounded bg-[#F3F4F6] px-1">⌘</kbd> + scroll to zoom · Hover shapes for preview
      </div>
    </div>
  );
}

/* -------------------- Shape node + hover popup -------------------- */
interface ShapeNodeProps {
  shape: Shape;
  docId: string;
  pageId: string;
  pinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  selected: boolean;
  editingText: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDoubleClickText: () => void;
  onTextCommit: (text: string) => void;
  onStartConnector: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onSelectShape: () => void;
  onContextAction: (
    a: "editText" | "delete" | "front" | "back" | "duplicate" | "assignImage",
  ) => void;
}

function ShapeNode({
  shape,
  docId,
  pageId,
  pinned,
  onPin,
  onUnpin,
  selected,
  editingText,
  onPointerDown,
  onDoubleClickText,
  onTextCommit,
  onStartConnector,
  onSelectShape,
  onContextAction,
}: ShapeNodeProps) {
  const [hovered, setHovered] = useState(false);
  const [popupHovered, setPopupHovered] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  // Reset drag position when unpinned
  useEffect(() => {
    if (!pinned) setDragPos(null);
  }, [pinned]);

  const onDragHandleDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = dragPos ?? popupPos;
      if (!origin) return;
      const startLeft = origin.left;
      const startTop = origin.top;
      setDragging(true);
      const onMove = (ev: PointerEvent) => {
        setDragPos({
          left: startLeft + (ev.clientX - startX),
          top: startTop + (ev.clientY - startY),
        });
      };
      const onUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [dragPos, popupPos],
  );

  const [popupSize, setPopupSize] = useState<{ w: number; h: number } | null>(null);

  const computePos = useCallback(() => {
    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;
    const POP_W = popupSize?.w ?? 320;
    const POP_H = popupSize?.h ?? 380;
    const MARGIN = 24;
    const MAX_GAP = 120;
    const pad = 8;
    const candidates: { left: number; top: number; ok: boolean }[] = [];
    // Right
    {
      const left = rect.right + MARGIN;
      const top = Math.max(pad, Math.min(rect.top, window.innerHeight - POP_H - pad));
      candidates.push({ left, top, ok: left + POP_W + pad <= window.innerWidth });
    }
    // Left
    {
      const left = rect.left - POP_W - MARGIN;
      const top = Math.max(pad, Math.min(rect.top, window.innerHeight - POP_H - pad));
      candidates.push({ left, top, ok: left >= pad });
    }
    // Bottom
    {
      const top = rect.bottom + MARGIN;
      const left = Math.max(pad, Math.min(rect.left, window.innerWidth - POP_W - pad));
      candidates.push({ left, top, ok: top + POP_H + pad <= window.innerHeight });
    }
    // Top
    {
      const top = rect.top - POP_H - MARGIN;
      const left = Math.max(pad, Math.min(rect.left, window.innerWidth - POP_W - pad));
      candidates.push({ left, top, ok: top >= pad });
    }
    const pick = candidates.find((c) => c.ok) ?? candidates[0];
    let { left, top } = pick;
    // Enforce max 120px gap from nearest shape edge.
    if (left > rect.right + MAX_GAP) left = rect.right + MAX_GAP;
    if (left + POP_W < rect.left - MAX_GAP) left = rect.left - MAX_GAP - POP_W;
    if (top > rect.bottom + MAX_GAP) top = rect.bottom + MAX_GAP;
    if (top + POP_H < rect.top - MAX_GAP) top = rect.top - MAX_GAP - POP_H;
    top = Math.max(pad, Math.min(top, window.innerHeight - 80));
    setPopupPos({ left, top });
  }, [popupSize]);

  const onResizePopupDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = popupSize?.w ?? 320;
      const startH = popupSize?.h ?? 380;
      const onMove = (ev: PointerEvent) => {
        const w = Math.max(260, Math.min(600, startW + (ev.clientX - startX)));
        const h = Math.max(180, Math.min(800, startH + (ev.clientY - startY)));
        setPopupSize({ w, h });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [popupSize],
  );


  // Pinned popup is always shown. Don't auto-reposition if user has dragged.
  useEffect(() => {
    if (pinned) {
      if (!dragPos) computePos();
      setShowPopup(true);
    }
  }, [pinned, computePos, dragPos]);

  // Hover-show with 500ms delay, hover-hide with grace timer.
  useEffect(() => {
    const active = hovered || popupHovered;
    if (active) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (!showPopup && !pinned) {
        hoverTimer.current = window.setTimeout(() => {
          computePos();
          setShowPopup(true);
        }, 500);
      }
    } else {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      if (!pinned) {
        hideTimer.current = window.setTimeout(() => setShowPopup(false), 120);
      }
    }
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [hovered, popupHovered, pinned, showPopup, computePos]);



  const diagPre =
    shape.diagnostico && shape.diagnostico !== "sin_definir"
      ? DIAGNOSTICO_META[shape.diagnostico]
      : null;
  const prioPre = shape.prioridad ? PRIORIDAD_META[shape.prioridad] : null;
  const pillsCount = (diagPre ? 1 : 0) + (prioPre ? 1 : 0);
  // Each pill ≈ 18px tall + 4px gap, plus 8px breathing room above
  const pillsArea = pillsCount > 0 ? pillsCount * 18 + (pillsCount - 1) * 4 + 8 : 0;
  const basePad = 16;
  const padBottom = shape.type === "text" ? basePad : basePad + pillsArea;
  const minH = shape.type === "text" ? undefined : 56 + pillsArea;

  const style: CSSProperties = {
    position: "absolute",
    left: shape.x,
    top: shape.y,
    width: shape.width,
    height: shape.height,
    minHeight: minH,
    background: shape.fill,
    border: `${selected ? 2 : shape.borderWeight}px ${shape.borderStyle} ${selected ? "#5B6CF8" : "#D0D0D0"}`,
    borderRadius: shape.cornerStyle === "rounded" ? 8 : 0,
    padding: `${basePad}px ${basePad}px ${padBottom}px ${basePad}px`,
    display: "flex",
    alignItems: "center",
    justifyContent:
      shape.align === "left" ? "flex-start" : shape.align === "right" ? "flex-end" : "center",
    fontFamily: shape.fontFamily,
    fontSize: shape.fontSize,
    fontWeight: shape.bold ? 700 : 500,
    fontStyle: shape.italic ? "italic" : "normal",
    textDecoration: shape.underline ? "underline" : "none",
    color: shape.textColor,
    textAlign: shape.align,
    boxSizing: "border-box",
    cursor: "move",
    transition: "border-color 100ms ease-out, box-shadow 150ms ease-out",
  };

  // Diamond / oval / parallelogram / cylinder / document use clip-path
  if (shape.type === "diamond") {
    style.clipPath = "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)";
    style.borderRadius = 0;
  } else if (shape.type === "oval") {
    style.borderRadius = 9999;
  } else if (shape.type === "parallelogram") {
    style.clipPath = "polygon(15% 0, 100% 0, 85% 100%, 0 100%)";
    style.borderRadius = 0;
  } else if (shape.type === "document") {
    style.clipPath =
      "path('M0 0 H100% V80% Q75% 100% 50% 80% Q25% 60% 0 80% Z')";
  } else if (shape.type === "container") {
    style.background = shape.fill;
    style.border = `${selected ? 2 : 1}px dashed ${selected ? "#5B6CF8" : "#5B6CF8"}`;
    style.alignItems = "flex-start";
    style.justifyContent = "flex-start";
  } else if (shape.type === "sticky") {
    style.border = "1px solid #F59E0B";
    style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
  } else if (shape.type === "text") {
    style.border = selected ? "2px dashed #5B6CF8" : "1px dashed transparent";
    style.background = "transparent";
  }

  const diag = diagPre;
  const prio = prioPre;
  const hasDocs = (shape.documents ?? []).length > 0;
  const missingDocs = !!shape.noStandardDoc;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={nodeRef}
            data-shape-id={shape.id}
            style={style}
            onPointerDown={onPointerDown}
            onDoubleClick={onDoubleClickText}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            {editingText ? (
              <input
                autoFocus
                defaultValue={shape.text}
                onBlur={(e) => onTextCommit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="w-full bg-transparent text-center outline-none"
                style={{
                  fontFamily: shape.fontFamily,
                  fontSize: shape.fontSize,
                  color: shape.textColor,
                }}
              />
            ) : (
              <span className="pointer-events-none select-none break-words">
                {shape.text}
              </span>
            )}

            {/* Status pills bottom (diagnostico + prioridad) — left-aligned, inside border */}
            {shape.type !== "text" && (diag || prio) && (
              <div className="pointer-events-none absolute bottom-1.5 left-2 flex flex-col items-start gap-[3px]">
                {diag && (
                  <div
                    className="rounded-full font-medium leading-none text-white"
                    style={{
                      background: diag.bg,
                      fontSize: 10,
                      padding: "2px 7px",
                      transition: "background-color 150ms ease-out",
                    }}
                  >
                    {diag.label}
                  </div>
                )}
                {prio && (
                  <div
                    className="rounded-full font-medium leading-none text-white"
                    style={{
                      background: prio.bg,
                      fontSize: 10,
                      padding: "2px 7px",
                      transition: "background-color 150ms ease-out",
                    }}
                  >
                    {prio.label}
                  </div>
                )}
              </div>
            )}

            {/* Bottom-right badges: docs, image */}
            {shape.type !== "text" && (hasDocs || missingDocs || shape.imageDataUrl) && (
              <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1">
                {missingDocs && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9CA3AF] text-white"
                    title="Sin documentación estandarizada"
                  >
                    <FileWarning className="h-3 w-3" />
                  </div>
                )}
                {hasDocs && !missingDocs && (
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5B6CF8] text-white"
                    title="Documentos vinculados"
                  >
                    <FileText className="h-3 w-3" />
                  </div>
                )}
                {shape.imageDataUrl && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5B6CF8] text-white">
                    <Camera className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}


            {/* Selection handles + connector handles */}
            {selected && (
              <>
                {(["nw", "ne", "sw", "se"] as const).map((p) => (
                  <div
                    key={p}
                    className="pointer-events-none absolute h-2 w-2 rounded-sm border border-[#5B6CF8] bg-white"
                    style={{
                      left: p.includes("w") ? -4 : undefined,
                      right: p.includes("e") ? -4 : undefined,
                      top: p.includes("n") ? -4 : undefined,
                      bottom: p.includes("s") ? -4 : undefined,
                    }}
                  />
                ))}
                {/* Edge connector handle (right side) */}
                <div
                  onPointerDown={onStartConnector}
                  className="absolute h-3 w-3 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-[#5B6CF8] bg-white hover:scale-125 transition-transform"
                  style={{ right: -6, top: "50%" }}
                  title="Drag to connect"
                />
                <div
                  onPointerDown={onStartConnector}
                  className="absolute h-3 w-3 -translate-x-1/2 cursor-crosshair rounded-full border-2 border-[#5B6CF8] bg-white hover:scale-125 transition-transform"
                  style={{ bottom: -6, left: "50%" }}
                  title="Drag to connect"
                />
              </>
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onSelect={() => onContextAction("editText")}>Edit text</ContextMenuItem>
          <ContextMenuItem onSelect={() => onContextAction("duplicate")}>Copy</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => onContextAction("front")}>Bring to front</ContextMenuItem>
          <ContextMenuItem onSelect={() => onContextAction("back")}>Send to back</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onSelect={() => onContextAction("delete")}
            className="text-[#DC2626] focus:text-[#DC2626]"
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* HOVER POPUP */}
      {showPopup && popupPos && (
        <div
          data-pinned-popup-for={pinned ? shape.id : undefined}
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-[10px] border border-[#EBEBEB] bg-white",
            pinned ? "flowit-pin-in" : "flowit-popup",
            dragging
              ? "shadow-[0_12px_40px_rgba(0,0,0,0.25)]"
              : "shadow-[0_4px_20px_rgba(0,0,0,0.12)]",
          )}
          style={{
            left: (dragPos ?? popupPos).left,
            top: (dragPos ?? popupPos).top,
            width: pinned ? popupSize?.w ?? 320 : 280,
            height: pinned ? popupSize?.h ?? 380 : undefined,
            transition: dragging ? "none" : "box-shadow 150ms ease-out",
          }}
          onMouseEnter={() => setPopupHovered(true)}
          onMouseLeave={() => setPopupHovered(false)}
          onPointerDown={(e) => {
            e.stopPropagation();
            if (pinned) onSelectShape();
          }}
        >
          {pinned && (
            <div
              onPointerDown={onDragHandleDown}
              className="flex h-7 shrink-0 cursor-grab items-center justify-between border-b border-[#EBEBEB] bg-[#FAFAFA] px-2 active:cursor-grabbing"
              title="Drag to move"
            >
              <GripVertical className="h-3.5 w-3.5 text-[#9CA3AF]" />
              <div className="truncate px-2 text-[11px] font-medium text-[#6B7280]">
                {shape.title || shape.text || "Sin título"}
              </div>
              <button
                onClick={onUnpin}
                title="Cerrar"
                onPointerDown={(e) => e.stopPropagation()}
                className="flex h-5 w-5 items-center justify-center rounded text-[#6B7280] transition-colors hover:bg-white hover:text-[#111827]"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <div className="relative shrink-0">
            {shape.imageDataUrl ? (
              <img
                src={shape.imageDataUrl}
                alt={shape.title}
                className="block w-full object-cover"
                style={{ height: pinned ? Math.min(240, ((popupSize?.w ?? 320) * 9) / 16) : 160 }}
                draggable={false}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="flex h-[110px] w-full flex-col items-center justify-center gap-2 border-b border-dashed border-[#D0D0D0] bg-[#FAFAFA] text-[#9CA3AF]">
                <Camera className="h-6 w-6" />
                <span className="text-xs">Right-click → Assign image</span>
              </div>
            )}
            {!pinned && (
              <button
                onClick={onPin}
                title="Anclar"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#EBEBEB] bg-white/95 shadow-sm transition-all hover:bg-white hover:scale-105"
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {!pinned && (
              <div className="text-[14px] font-bold text-[#111827]">
                {shape.title || shape.text || "Sin título"}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {diag && (
                <div
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: diag.bg, transition: "background-color 150ms ease-out" }}
                  title={`Diagnóstico: ${diag.label}`}
                >
                  <span>{diag.dot}</span>
                  {diag.label}
                </div>
              )}
              {prio && (
                <div
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                  style={{ background: prio.bg, transition: "background-color 150ms ease-out" }}
                  title={`Prioridad: ${prio.label}`}
                >
                  <span>{prio.dot}</span>
                  {prio.label}
                </div>
              )}
              {!diag && !prio && (
                <div className="text-[11px] text-[#9CA3AF]">Sin diagnóstico</div>
              )}
            </div>
            {pinned && (shape.improvementEntries ?? []).length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                  Oportunidades de mejora
                </div>
                <ul className="space-y-1">
                  {(shape.improvementEntries ?? [])
                    .slice()
                    .sort((a, b) => b.date - a.date)
                    .map((e) => {
                      const dominant = e.categories[0];
                      const dotMeta = dominant ? CATEGORY_META[dominant] : null;
                      const tooltip =
                        e.categories.length > 0
                          ? e.categories.map((c) => CATEGORY_META[c].label).join(", ")
                          : "Sin categoría";
                      return (
                        <li
                          key={e.id}
                          className="flowit-entry flex items-start gap-2 rounded-md border border-[#EBEBEB] bg-white px-2 py-1.5"
                          title={tooltip}
                        >
                          <span
                            className="mt-1 h-2 w-2 shrink-0 rounded-full"
                            style={{ background: dotMeta?.fg ?? "#D1D5DB" }}
                          />
                          <div className="min-w-0 flex-1 break-words text-[12px] leading-snug text-[#111827]">
                            {e.text}
                          </div>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
          {pinned && (
            <div
              onPointerDown={onResizePopupDown}
              className="absolute bottom-0 right-0 z-10 h-4 w-4 cursor-se-resize"
              title="Redimensionar"
              style={{
                background:
                  "linear-gradient(135deg, transparent 0 50%, #9CA3AF 50% 60%, transparent 60% 70%, #9CA3AF 70% 80%, transparent 80%)",
              }}
            />
          )}
        </div>
      )}

    </>
  );
}

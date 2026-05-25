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
import { createPortal } from "react-dom";
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
  Undo2,
  Redo2,
  Upload,
  X,
  ZoomIn,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Expand,
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
  MissingDocType,
  Person,
  Prioridad,
  Shape,
  ShapeType,
} from "@/lib/shape-types";
import {
  CATEGORY_META,
  DIAGNOSTICO_META,
  DOC_TYPES,
  MISSING_DOC_TYPES,
  PRIORIDAD_META,
} from "@/lib/shape-types";
import { cn } from "@/lib/utils";
import { PdfCanvasViewer } from "@/components/pdf-canvas-viewer";
import { PeoplePicker } from "@/components/people-picker";
import { IconTip } from "@/components/icon-tooltip";

interface EditorSearch {
  doc?: string;
  page?: string;
}

export const Route = createFileRoute("/editor")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): EditorSearch => ({
    doc: typeof s.doc === "string" ? s.doc : undefined,
    page: typeof s.page === "string" ? s.page : undefined,
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
  // Sync currentPageId with URL ?page= param when valid; otherwise default to first page.
  useEffect(() => {
    if (!doc) return;
    const fromUrl = search.page && doc.pages.find((p) => p.id === search.page) ? search.page : undefined;
    const next = fromUrl ?? doc.pages[0]?.id;
    if (next !== currentPageId) setCurrentPageId(next);
  }, [doc, search.page, currentPageId]);

  const page = doc?.pages.find((p) => p.id === currentPageId) ?? doc?.pages[0];

  // Floating sub-process panels (one per shape with an open panel).
  const [subPanels, setSubPanels] = useState<
    Array<{ shapeId: string; pageId: string; sourcePageId: string; minimized: boolean }>
  >([]);
  const openSubProcessPanel = useCallback(
    (shape: Shape, sourcePageId: string) => {
      let pid = shape.subProcessPageId;
      if (!pid) {
        pid = useDiagramStore
          .getState()
          .createSubProcess(doc!.id, sourcePageId, shape.id);
      }
      setSubPanels((prev) => {
        const existing = prev.find((p) => p.shapeId === shape.id);
        if (existing) {
          return prev.map((p) =>
            p.shapeId === shape.id ? { ...p, minimized: false } : p,
          );
        }
        return [...prev, { shapeId: shape.id, pageId: pid!, sourcePageId, minimized: false }];
      });
    },
    [doc],
  );
  const closeSubProcessPanel = useCallback((shapeId: string) => {
    setSubPanels((prev) => prev.filter((p) => p.shapeId !== shapeId));
  }, []);
  const toggleMinimizeSubPanel = useCallback((shapeId: string) => {
    setSubPanels((prev) =>
      prev.map((p) => (p.shapeId === shapeId ? { ...p, minimized: !p.minimized } : p)),
    );
  }, []);
  const subPanelStates = useMemo(() => {
    const m: Record<string, "open" | "minimized"> = {};
    for (const p of subPanels) m[p.shapeId] = p.minimized ? "minimized" : "open";
    return m;
  }, [subPanels]);

  // Apply a pending shape selection after a page-change navigation.
  const pendingSelectRef = useRef<string | null>(null);
  const goToPage = useCallback(
    (pageId: string, selectShapeId?: string) => {
      if (!doc) return;
      if (selectShapeId) pendingSelectRef.current = selectShapeId;
      navigate({ to: "/editor", search: { doc: doc.id, page: pageId } });
    },
    [doc, navigate],
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  useEffect(() => {
    if (pendingSelectRef.current && page) {
      const id = pendingSelectRef.current;
      pendingSelectRef.current = null;
      if (page.shapes.some((s) => s.id === id)) setSelectedIds([id]);
    }
  }, [page]);
  const [activeTab, setActiveTab] = useState<"shapes" | "images" | "pages" | "summary">("shapes");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 80, y: 40 });
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState("");
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [summaryWidth, setSummaryWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 340;
    const v = Number(window.localStorage.getItem("flowitSummaryWidth"));
    return Number.isFinite(v) && v >= 300 && v <= 600 ? v : 340;
  });
  const startSummaryResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = summaryWidth;
      let lastW = startW;
      const onMove = (ev: PointerEvent) => {
        const next = Math.max(300, Math.min(600, startW + (ev.clientX - startX)));
        lastW = next;
        setSummaryWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          window.localStorage.setItem("flowitSummaryWidth", String(lastW));
        } catch { /* ignore */ }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [summaryWidth],
  );
  const pinShape = useCallback(
    (id: string) => setPinnedIds((p) => (p.includes(id) ? p : [...p, id])),
    [],
  );
  const unpinShape = useCallback(
    (id: string) => setPinnedIds((p) => p.filter((x) => x !== id)),
    [],
  );

  // Global undo/redo keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        useDiagramStore.getState().undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        useDiagramStore.getState().redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
          <UndoRedoButtons />
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
          <div
            className="relative shrink-0 border-r border-[#EBEBEB] bg-white"
            style={{ width: activeTab === "summary" ? summaryWidth : 260 }}
          >
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
                onSelect={(pid) => goToPage(pid)}
              />
            )}
            {activeTab === "summary" && (
              <SummaryPanel
                docId={doc.id}
                page={page}
                onJumpToShape={(id) => setSelectedIds([id])}
              />
            )}
            {activeTab === "summary" && (
              <div
                onPointerDown={startSummaryResize}
                className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize bg-transparent transition-colors hover:bg-[#5B6CF8]/30"
                title="Arrastrá para ajustar el ancho"
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
          onSubProcessIconClick={(shape) => openSubProcessPanel(shape, page.id)}
          subPanelStates={subPanelStates}
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

      {/* Floating sub-process panels */}
      {subPanels.map((panel, idx) => {
        const srcPage = doc.pages.find((p) => p.id === panel.sourcePageId);
        const srcShape = srcPage?.shapes.find((s) => s.id === panel.shapeId);
        const subPage = doc.pages.find((p) => p.id === panel.pageId);
        if (!subPage) return null;
        const minimizedIndex = subPanels
          .filter((p) => p.minimized)
          .findIndex((p) => p.shapeId === panel.shapeId);
        return (
          <SubProcessPanel
            key={panel.shapeId}
            docId={doc.id}
            page={subPage}
            shapeTitle={srcShape?.title || srcShape?.text || "Sub-proceso"}
            minimized={panel.minimized}
            minimizedStackIndex={minimizedIndex}
            onClose={() => closeSubProcessPanel(panel.shapeId)}
            onToggleMinimize={() => toggleMinimizeSubPanel(panel.shapeId)}
            onSubProcessIconClick={(shape) =>
              openSubProcessPanel(shape, panel.pageId)
            }
            subPanelStates={subPanelStates}
            zIndexBase={8000 + idx}
          />
        );
      })}

      <Link to="/editor" className="hidden" aria-hidden />
    </div>
  );
}

/* -------------------- Popup → shape connector overlay -------------------- */
function PinnedConnectorsOverlay({ pinnedIds }: { pinnedIds: string[] }) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      force((n) => (n + 1) % 1000000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  if (typeof document === "undefined") return null;
  const popups = Array.from(document.querySelectorAll<HTMLElement>("[data-popup-for]"));
  if (popups.length === 0) return null;
  void pinnedIds;
  return (
    <svg className="pointer-events-none fixed inset-0 z-40 h-full w-full">
      {popups.map((popup) => {
        const id = popup.getAttribute("data-popup-for");
        if (!id) return null;
        const shape = document.querySelector(`[data-shape-id="${id}"]`) as HTMLElement | null;
        if (!shape) return null;
        const s = shape.getBoundingClientRect();
        const p = popup.getBoundingClientRect();
        const sc = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
        const pc = { x: p.left + p.width / 2, y: p.top + p.height / 2 };

        const dx = pc.x - sc.x;
        const dy = pc.y - sc.y;
        let sx: number, sy: number, ex: number, ey: number;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        if (horizontal) {
          if (dx >= 0) { sx = s.right; sy = sc.y; ex = p.left; ey = pc.y; }
          else { sx = s.left; sy = sc.y; ex = p.right; ey = pc.y; }
        } else {
          if (dy >= 0) { sx = sc.x; sy = s.bottom; ex = pc.x; ey = p.top; }
          else { sx = sc.x; sy = s.top; ex = pc.x; ey = p.bottom; }
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

/* -------------------- Undo / Redo -------------------- */
function UndoRedoButtons() {
  const past = useDiagramStore((s) => s.past);
  const future = useDiagramStore((s) => s.future);
  const undo = useDiagramStore((s) => s.undo);
  const redo = useDiagramStore((s) => s.redo);
  const canU = past.length > 0;
  const canR = future.length > 0;
  return (
    <div className="mr-1 flex items-center gap-0.5 rounded-md border border-[#EBEBEB] bg-white p-1">
      <button
        onClick={undo}
        disabled={!canU}
        title="Deshacer (⌘Z)"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded",
          canU ? "text-[#111827] hover:bg-[#F3F4F6]" : "text-[#D1D5DB] cursor-not-allowed",
        )}
      >
        <Undo2 className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={redo}
        disabled={!canR}
        title="Rehacer (⌘⇧Z)"
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded",
          canR ? "text-[#111827] hover:bg-[#F3F4F6]" : "text-[#D1D5DB] cursor-not-allowed",
        )}
      >
        <Redo2 className="h-3.5 w-3.5" />
      </button>
    </div>
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
      <div className="mx-1 h-5 w-px bg-[#EBEBEB]" />
      <ColorSwatchPicker
        label="Fill"
        value={shape.fill}
        onChange={(c) => onChange({ fill: c })}
      />
      <ColorSwatchPicker
        label="Border"
        value={shape.borderColor ?? "#D0D0D0"}
        onChange={(c) => onChange({ borderColor: c })}
      />
    </div>
  );
}

const SWATCHES = [
  "#FFFFFF", "#000000", "#6B7280", "#D0D0D0",
  "#FCA5A5", "#F59E0B", "#FCD34D", "#86EFAC",
  "#5EEAD4", "#93C5FD", "#A78BFA", "#F0ABFC",
];

function ColorSwatchPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="flex h-7 items-center gap-1 rounded border border-[#EBEBEB] px-1.5 text-[11px] text-[#374151] hover:bg-[#F3F4F6]"
          title={`${label} color`}
        >
          <span
            className="h-4 w-4 rounded border border-[#D0D0D0]"
            style={{ background: value }}
          />
          <span>{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={cn(
                "h-6 w-6 rounded border",
                value.toLowerCase() === c.toLowerCase()
                  ? "border-[#5B6CF8] ring-1 ring-[#5B6CF8]"
                  : "border-[#D0D0D0]",
              )}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border border-[#EBEBEB]"
          />
          <span className="text-[11px] text-[#6B7280]">Custom</span>
        </div>
      </PopoverContent>
    </Popover>
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
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    if (typeof window === "undefined") return 320;
    const v = Number(window.localStorage.getItem("flowitPanelWidth"));
    return Number.isFinite(v) && v >= 240 && v <= 520 ? v : 320;
  });

  const startResize = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = panelWidth;
      let lastW = startW;
      const onMove = (ev: PointerEvent) => {
        const next = Math.max(240, Math.min(520, startW - (ev.clientX - startX)));
        lastW = next;
        setPanelWidth(next);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        try {
          window.localStorage.setItem("flowitPanelWidth", String(lastW));
        } catch {
          /* ignore */
        }
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
          <PeoplePicker
            selectedIds={shape.responsableIds ?? []}
            onChange={(ids) => onChange({ responsableIds: ids })}
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
    <IconTip label={meta.label}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={cn(
          "inline-flex h-6 w-6 items-center justify-center rounded-full border text-[12px] transition-all",
          active
            ? "border-transparent shadow-sm"
            : "border-[#E5E7EB] bg-white opacity-50 hover:opacity-100",
        )}
        style={active ? { background: meta.bg, color: meta.fg } : undefined}
        aria-label={meta.label}
      >
        <span>{meta.icon}</span>
      </button>
    </IconTip>
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
      {disabled && (
        <div className="space-y-1 rounded-md border border-[#F59E0B]/30 bg-[#FFFBEB] p-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[#92400E]">
            ¿Qué falta?
          </div>
          <div className="flex flex-wrap gap-1">
            {MISSING_DOC_TYPES.map((t) => {
              const sel = (shape.missingDocTypes ?? []).includes(t);
              return (
                <button
                  key={t}
                  onClick={() => {
                    const cur = shape.missingDocTypes ?? [];
                    onChange({
                      missingDocTypes: sel
                        ? cur.filter((x) => x !== t)
                        : [...cur, t],
                    });
                  }}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-all",
                    sel
                      ? "border-transparent bg-[#F59E0B] text-white"
                      : "border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#F59E0B]",
                  )}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}
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
            <PdfCanvasViewer
              src={pdfBlobUrl ?? doc.url ?? null}
              failed={pdfFailed}
              downloadHref={downloadHref}
              downloadName={downloadName}
            />
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
        {downloadHref && (
          <div className="flex justify-end border-t border-[#EBEBEB] bg-white px-4 py-2.5">
            <a
              href={downloadHref}
              download={downloadName}
              target={doc.fileDataUrl ? undefined : "_blank"}
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-[#EBEBEB] px-3 py-1.5 text-xs font-medium text-[#374151] hover:bg-[#F3F4F6]"
            >
              <Download className="h-3.5 w-3.5" /> {doc.fileDataUrl ? "Descargar" : "Abrir"}
            </a>
          </div>
        )}
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
  const people = useDiagramStore((s) => s.people);
  const updateShape = useDiagramStore((s) => s.updateShape);
  const addShapeDoc = useDiagramStore((s) => s.addShapeDoc);
  const updateShapeDoc = useDiagramStore((s) => s.updateShapeDoc);
  const entries = page.shapes
    .flatMap((s) =>
      (s.improvementEntries ?? []).map((e) => ({ shape: s, entry: e })),
    )
    .sort((a, b) => b.entry.date - a.entry.date);

  // ----- Smart alerts -----
  type Alert = {
    id: string;
    icon: string;
    title: string;
    explanation: string;
    shapes: Shape[];
    tone: "red" | "amber" | "blue";
  };
  const alerts: Alert[] = [];
  const shapes = page.shapes.filter((s) => s.type !== "text" && s.type !== "sticky" && s.type !== "container");
  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "Sin nombre";

  // 🔴 Proceso huérfano
  const orphan = shapes.filter((s) => (s.responsableIds ?? []).length === 0 && !s.responsable);
  if (orphan.length > 0)
    alerts.push({
      id: "orphan",
      icon: "🔴",
      title: "Proceso huérfano",
      explanation: "Etapas sin responsable asignado.",
      shapes: orphan,
      tone: "red",
    });

  // ⚠️ Cuello de botella — persona en 3+ etapas
  const ownerCount = new Map<string, Shape[]>();
  for (const s of shapes) {
    for (const id of s.responsableIds ?? []) {
      if (!ownerCount.has(id)) ownerCount.set(id, []);
      ownerCount.get(id)!.push(s);
    }
  }
  const bottleneck = Array.from(ownerCount.entries()).filter(([, ss]) => ss.length >= 3);
  if (bottleneck.length > 0) {
    const set = new Set<Shape>();
    bottleneck.forEach(([, ss]) => ss.forEach((s) => set.add(s)));
    alerts.push({
      id: "bottleneck",
      icon: "⚠️",
      title: "Cuello de botella",
      explanation:
        bottleneck.map(([id, ss]) => `${personName(id)} (${ss.length})`).join(", "),
      shapes: Array.from(set),
      tone: "amber",
    });
  }

  // 📋 Urgente sin documentar
  const urgentNoDoc = shapes.filter(
    (s) =>
      s.prioridad === "urgente" &&
      s.noStandardDoc &&
      (s.documents ?? []).length === 0,
  );
  if (urgentNoDoc.length > 0)
    alerts.push({
      id: "urgent-nodoc",
      icon: "📋",
      title: "Urgente sin documentar",
      explanation: "Prioridad urgente sin documentos cargados.",
      shapes: urgentNoDoc,
      tone: "red",
    });

  // 🔗 Cadena rota — etapas consecutivas (por X) con diagnostico roto
  const ordered = [...shapes].sort((a, b) => a.x - b.x);
  const chain: Shape[] = [];
  for (let i = 0; i < ordered.length - 1; i++) {
    if (ordered[i].diagnostico === "roto" && ordered[i + 1].diagnostico === "roto") {
      if (!chain.includes(ordered[i])) chain.push(ordered[i]);
      if (!chain.includes(ordered[i + 1])) chain.push(ordered[i + 1]);
    }
  }
  if (chain.length > 0)
    alerts.push({
      id: "chain",
      icon: "🔗",
      title: "Cadena rota",
      explanation: "Etapas consecutivas con diagnóstico Roto.",
      shapes: chain,
      tone: "red",
    });

  // 👤 Single point of failure
  const spof = shapes.filter(
    (s) =>
      (s.responsableIds ?? []).length === 1 &&
      (s.documents ?? []).length === 0 &&
      (s.diagnostico === "roto" || s.diagnostico === "sin_definir" || !s.diagnostico),
  );
  if (spof.length > 0)
    alerts.push({
      id: "spof",
      icon: "👤",
      title: "Single point of failure",
      explanation: "Una sola persona, sin documentación y diagnóstico inestable.",
      shapes: spof,
      tone: "red",
    });

  // 👤 Sobrecarga con gaps — persona dueña de 2+ etapas con doc faltante
  const overloadMap = new Map<string, Shape[]>();
  for (const s of shapes) {
    if (!s.noStandardDoc) continue;
    for (const id of s.responsableIds ?? []) {
      if (!overloadMap.has(id)) overloadMap.set(id, []);
      overloadMap.get(id)!.push(s);
    }
  }
  const overload = Array.from(overloadMap.entries()).filter(([, ss]) => ss.length >= 2);
  if (overload.length > 0) {
    const set = new Set<Shape>();
    overload.forEach(([, ss]) => ss.forEach((s) => set.add(s)));
    alerts.push({
      id: "overload",
      icon: "👤",
      title: "Sobrecarga con gaps",
      explanation: overload
        .map(([id, ss]) => `${personName(id)} (${ss.length})`)
        .join(", "),
      shapes: Array.from(set),
      tone: "amber",
    });
  }

  const toneAccent = (tone: Alert["tone"]) =>
    tone === "red" ? "#DC2626" : tone === "amber" ? "#F59E0B" : "#3B82F6";

  const sectionHeader =
    "mb-3 mt-4 text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF] first:mt-0";

  const [fullscreen, setFullscreen] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[#EBEBEB] px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#111827]">Resumen de cambios</h3>
          <button
            onClick={() => setFullscreen(true)}
            title="Ver resumen completo"
            className="flex h-6 w-6 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <Expand className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[11px] text-[#6B7280]">
          Todas las mejoras propuestas en el proceso
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Alertas */}
        <div>
          <div className={sectionHeader}>⚠️ Alertas</div>
          {alerts.length === 0 ? (
            <div className="rounded-md border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-center text-xs text-[#166534]">
              ✅ Sin alertas detectadas
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="rounded-md border border-[#EBEBEB] bg-white p-4 shadow-sm"
                  style={{ borderLeft: `3px solid ${toneAccent(a.tone)}` }}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-[#111827]">
                    <span>{a.icon}</span>
                    <span>{a.title}</span>
                  </div>
                  <div className="mb-2 text-[12px] leading-relaxed text-[#4B5563]">
                    {a.explanation}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {a.shapes.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => onJumpToShape(s.id)}
                        className="inline-flex max-w-full items-center rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#374151] hover:bg-[#E5E7EB]"
                      >
                        <span className="truncate">{s.title || s.text || "Sin título"}</span>
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="my-6 h-px bg-[#EBEBEB]" />

        <div>
          <div className={sectionHeader}>Oportunidades de mejora</div>
          {entries.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E5E7EB] p-4 text-center text-xs text-[#9CA3AF]">
              Aún no hay oportunidades de mejora.
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {entries.map(({ shape, entry }) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-[#EBEBEB] bg-white p-4 transition-colors hover:border-[#5B6CF8]"
                >
                  <button
                    onClick={() => onJumpToShape(shape.id)}
                    className="mb-2 inline-flex max-w-full items-center gap-1 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[10px] font-medium text-[#5B6CF8] hover:bg-[#DDE2FF]"
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
                  <div className="break-words text-[12px] leading-relaxed text-[#111827]">
                    {entry.text}
                  </div>
                  {entry.categories.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
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
                  <div className="mt-2 text-[10px] text-[#9CA3AF]">{formatDate(entry.date)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="my-6 h-px bg-[#EBEBEB]" />

        {/* Documentación faltante */}
        <div>
          <div className={cn(sectionHeader, "flex items-center gap-1.5")}>
            <FileText className="h-3.5 w-3.5" />
            <span>Documentación faltante</span>
          </div>
          {(() => {
            const missing = page.shapes.filter((s) => s.noStandardDoc);
            if (missing.length === 0) {
              return (
                <div className="rounded-md border border-dashed border-[#E5E7EB] p-4 text-center text-xs text-[#9CA3AF]">
                  Todas las etapas tienen documentación.
                </div>
              );
            }
            const groups = new Map<string, Shape[]>();
            const UNSPEC = "Sin tipo definido";
            for (const s of missing) {
              const types = s.missingDocTypes ?? [];
              const keys = types.length > 0 ? types : [UNSPEC];
              for (const k of keys) {
                if (!groups.has(k)) groups.set(k, []);
                groups.get(k)!.push(s);
              }
            }
            return (
              <div className="flex flex-col gap-4">
                {Array.from(groups.entries()).map(([type, shapes]) => (
                  <div key={type}>
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                      <span>
                        {type === "Sin tipo definido" ? type : `${type} faltante`}
                      </span>
                      <span className="inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#F3F4F6] px-1 text-[10px] font-semibold text-[#6B7280]">
                        {shapes.length}
                      </span>
                    </div>
                    <ul className="flex flex-col gap-2">
                      {shapes.map((s) => (
                        <li key={s.id}>
                          <button
                            onClick={() => onJumpToShape(s.id)}
                            className="flex w-full items-center gap-2 rounded-md border border-[#EBEBEB] bg-white px-3 py-2 text-left text-[12px] text-[#111827] hover:border-[#9CA3AF]"
                          >
                            <FileText className="h-3.5 w-3.5 shrink-0 text-[#9CA3AF]" />
                            <span className="truncate">
                              {s.title || s.text || "Sin título"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>


      {fullscreen && typeof document !== "undefined" &&
        createPortal(
          <FullSummaryModal
            page={page}
            people={people}
            alerts={alerts}
            entries={entries}
            onClose={() => setFullscreen(false)}
            onJumpToShape={(id) => {
              setFullscreen(false);
              onJumpToShape(id);
            }}
            onSetDiag={(sid, d) => updateShape(_docId, page.id, sid, { diagnostico: d })}
            onSetPrio={(sid, p) => updateShape(_docId, page.id, sid, { prioridad: p })}
            onCreateDoc={(sid, type) => {
              addShapeDoc(_docId, page.id, sid);
              // The new doc has Playbook by default; patch the latest one's type.
              const s = page.shapes.find((x) => x.id === sid);
              const after = s?.documents ?? [];
              // Schedule a microtask to update doc type once store updates settle.
              setTimeout(() => {
                const fresh = useDiagramStore.getState()
                  .documents.find((d) => d.id === _docId)
                  ?.pages.find((p) => p.id === page.id)
                  ?.shapes.find((x) => x.id === sid);
                const last = fresh?.documents?.[fresh.documents.length - 1];
                if (last) updateShapeDoc(_docId, page.id, sid, last.id, { docType: type as DocType });
              }, 0);
              void after;
            }}
          />,
          document.body,
        )}
    </div>
  );
}




interface FullSummaryAlert {
  id: string;
  icon: string;
  title: string;
  explanation: string;
  shapes: Shape[];
  tone: "red" | "amber" | "blue";
}

type SelItem =
  | { kind: "alert"; id: string }
  | { kind: "improvement"; id: string }
  | { kind: "missing"; type: string }
  | { kind: "nostate"; shapeId: string };

function FullSummaryModal({
  page,
  people,
  alerts,
  entries,
  onClose,
  onJumpToShape,
  onSetDiag,
  onSetPrio,
  onCreateDoc,
}: {
  page: { id: string; shapes: Shape[] };
  people: Person[];
  alerts: FullSummaryAlert[];
  entries: { shape: Shape; entry: { id: string; text: string; categories: ImprovementCategory[]; date: number } }[];
  onClose: () => void;
  onJumpToShape: (id: string) => void;
  onSetDiag: (shapeId: string, d: Diagnostico) => void;
  onSetPrio: (shapeId: string, p: Prioridad) => void;
  onCreateDoc: (shapeId: string, type: DocType) => void;
}) {
  // Build missing-doc groups
  const missingGroups = new Map<string, Shape[]>();
  const UNSPEC = "Sin tipo definido";
  for (const s of page.shapes.filter((x) => x.noStandardDoc)) {
    const types = s.missingDocTypes ?? [];
    const keys = types.length > 0 ? types : [UNSPEC];
    for (const k of keys) {
      if (!missingGroups.has(k)) missingGroups.set(k, []);
      missingGroups.get(k)!.push(s);
    }
  }

  const noStateShapes = page.shapes.filter(
    (s) =>
      s.type !== "text" &&
      s.type !== "sticky" &&
      s.type !== "container" &&
      (!s.diagnostico || s.diagnostico === "sin_definir") &&
      !s.prioridad,
  );

  const [sel, setSel] = useState<SelItem | null>(
    alerts[0]
      ? { kind: "alert", id: alerts[0].id }
      : entries[0]
        ? { kind: "improvement", id: entries[0].entry.id }
        : null,
  );
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const personName = (id: string) => people.find((p) => p.id === id)?.name ?? "?";
  const personInit = (id: string) =>
    (people.find((p) => p.id === id)?.name ?? "?").slice(0, 2).toUpperCase();

  const Avatars = ({ ids }: { ids: string[] }) => (
    <div className="flex -space-x-1.5">
      {ids.map((id) => (
        <div
          key={id}
          title={personName(id)}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#5B6CF8] text-[10px] font-semibold text-white"
        >
          {personInit(id)}
        </div>
      ))}
    </div>
  );

  const Row = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[12px] text-[#111827] transition-colors hover:bg-[#F9FAFB]"
      style={
        active
          ? { background: "#EEF0FF", borderLeft: "3px solid #5B6CF8", paddingLeft: 9 }
          : { borderLeft: "3px solid transparent" }
      }
    >
      {children}
    </button>
  );

  const groupHdr =
    "mb-1 mt-4 px-1 text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] first:mt-0";

  const selectedAlert =
    sel?.kind === "alert" ? alerts.find((a) => a.id === sel.id) : null;
  const selectedEntry =
    sel?.kind === "improvement"
      ? entries.find((e) => e.entry.id === sel.id)
      : null;
  const selectedMissing =
    sel?.kind === "missing"
      ? { type: sel.type, shapes: missingGroups.get(sel.type) ?? [] }
      : null;
  const selectedNoState =
    sel?.kind === "nostate"
      ? page.shapes.find((s) => s.id === sel.shapeId)
      : null;

  const selShapeId =
    selectedEntry?.shape.id ??
    selectedMissing?.shapes[0]?.id ??
    selectedNoState?.id ??
    selectedAlert?.shapes[0]?.id;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9500,
        background: "white",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#EBEBEB] px-5">
        <div className="text-[14px] font-semibold text-[#111827]">
          Resumen de cambios
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded text-[#6B7280] hover:bg-[#F3F4F6]"
          title="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left list */}
        <div
          className="overflow-y-auto border-r border-[#EBEBEB] p-3"
          style={{ width: "35%" }}
        >
          {alerts.length > 0 && (
            <>
              <div className={groupHdr}>Alertas</div>
              {alerts.map((a) => (
                <Row
                  key={a.id}
                  active={sel?.kind === "alert" && sel.id === a.id}
                  onClick={() => setSel({ kind: "alert", id: a.id })}
                >
                  <span>{a.icon}</span>
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className="text-[10px] text-[#9CA3AF]">
                    {a.shapes.length}
                  </span>
                </Row>
              ))}
            </>
          )}

          {entries.length > 0 && (
            <>
              <div className={groupHdr}>Oportunidades de mejora</div>
              {entries.map(({ shape, entry }) => {
                const dot = DIAGNOSTICO_META[shape.diagnostico ?? "sin_definir"];
                return (
                  <Row
                    key={entry.id}
                    active={sel?.kind === "improvement" && sel.id === entry.id}
                    onClick={() => setSel({ kind: "improvement", id: entry.id })}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: dot.bg }}
                    />
                    <span className="rounded-full bg-[#EEF0FF] px-1.5 py-0.5 text-[10px] font-medium text-[#5B6CF8]">
                      {shape.title || shape.text}
                    </span>
                    <span className="flex-1 truncate text-[11px] text-[#6B7280]">
                      {entry.text}
                    </span>
                  </Row>
                );
              })}
            </>
          )}

          {missingGroups.size > 0 && (
            <>
              <div className={groupHdr}>Documentación faltante</div>
              {Array.from(missingGroups.entries()).map(([type, ss]) => (
                <Row
                  key={type}
                  active={sel?.kind === "missing" && sel.type === type}
                  onClick={() => setSel({ kind: "missing", type })}
                >
                  <FileText className="h-3.5 w-3.5 text-[#9CA3AF]" />
                  <span className="flex-1 truncate">
                    {type === UNSPEC ? type : `${type} faltante`}
                  </span>
                  <span className="text-[10px] text-[#9CA3AF]">{ss.length}</span>
                </Row>
              ))}
            </>
          )}

          {noStateShapes.length > 0 && (
            <>
              <div className={groupHdr}>Sin estado</div>
              {noStateShapes.map((s) => (
                <Row
                  key={s.id}
                  active={sel?.kind === "nostate" && sel.shapeId === s.id}
                  onClick={() => setSel({ kind: "nostate", shapeId: s.id })}
                >
                  <span>⚫</span>
                  <span className="flex-1 truncate">
                    {s.title || s.text || "Sin título"}
                  </span>
                </Row>
              ))}
            </>
          )}

          {alerts.length === 0 &&
            entries.length === 0 &&
            missingGroups.size === 0 &&
            noStateShapes.length === 0 && (
              <div className="p-6 text-center text-[12px] text-[#9CA3AF]">
                Nada por resumir todavía.
              </div>
            )}
        </div>

        {/* Right detail */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-8">
            {!sel && (
              <div className="text-[12px] text-[#9CA3AF]">
                Seleccioná un ítem a la izquierda.
              </div>
            )}

            {selectedAlert && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-[18px] font-bold text-[#111827]">
                  <span className="text-[22px]">{selectedAlert.icon}</span>
                  {selectedAlert.title}
                </div>
                <div className="text-[13px] leading-relaxed text-[#4B5563]">
                  {selectedAlert.explanation}
                </div>
                <div className="space-y-2">
                  {selectedAlert.shapes.map((s) => {
                    const d = DIAGNOSTICO_META[s.diagnostico ?? "sin_definir"];
                    const p = s.prioridad ? PRIORIDAD_META[s.prioridad] : null;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-md border border-[#EBEBEB] bg-white p-3"
                      >
                        <button
                          onClick={() => onJumpToShape(s.id)}
                          className="flex-1 truncate text-left text-[13px] font-medium text-[#111827] hover:underline"
                        >
                          {s.title || s.text || "Sin título"}
                        </button>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ background: d.bg }}
                        >
                          {d.label}
                        </span>
                        {p && (
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                            style={{ background: p.bg }}
                          >
                            {p.label}
                          </span>
                        )}
                        <Avatars ids={s.responsableIds ?? []} />
                      </div>
                    );
                  })}
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Notas / Plan de acción
                  </div>
                  <textarea
                    value={notes[selectedAlert.id] ?? ""}
                    onChange={(e) =>
                      setNotes((n) => ({ ...n, [selectedAlert.id]: e.target.value }))
                    }
                    placeholder="Escribí qué se va a hacer…"
                    className="min-h-[100px] w-full rounded-md border border-[#EBEBEB] bg-white p-3 text-[13px] outline-none focus:border-[#5B6CF8]"
                  />
                </div>
              </div>
            )}

            {selectedEntry && (
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full bg-[#EEF0FF] px-3 py-1 text-[12px] font-medium text-[#5B6CF8]">
                  {selectedEntry.shape.title || selectedEntry.shape.text}
                </div>
                <div className="text-[16px] leading-relaxed text-[#111827]">
                  {selectedEntry.entry.text}
                </div>
                {selectedEntry.entry.categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEntry.entry.categories.map((c) => {
                      const m = CATEGORY_META[c];
                      return (
                        <span
                          key={c}
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{ background: m.bg, color: m.fg }}
                        >
                          <span>{m.icon}</span>
                          {m.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="text-[11px] text-[#9CA3AF]">
                  {formatDate(selectedEntry.entry.date)}
                </div>
                {selectedEntry.shape.currentReality && (
                  <div className="rounded-md bg-[#F9FAFB] p-3 text-[12px] leading-relaxed text-[#6B7280]">
                    <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider">
                      Como está hoy
                    </div>
                    {selectedEntry.shape.currentReality}
                  </div>
                )}
                {selectedEntry.shape.imageDataUrl && (
                  <img
                    src={selectedEntry.shape.imageDataUrl}
                    alt=""
                    className="max-h-[200px] rounded-md border border-[#EBEBEB] object-cover"
                  />
                )}
              </div>
            )}

            {selectedMissing && (
              <div className="space-y-4">
                <div className="text-[18px] font-bold text-[#111827]">
                  {selectedMissing.type === UNSPEC
                    ? selectedMissing.type
                    : `${selectedMissing.type} faltante`}
                </div>
                <div className="space-y-2">
                  {selectedMissing.shapes.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 rounded-md border border-[#EBEBEB] bg-white p-3"
                    >
                      <button
                        onClick={() => onJumpToShape(s.id)}
                        className="flex-1 truncate text-left text-[13px] font-medium text-[#111827] hover:underline"
                      >
                        {s.title || s.text || "Sin título"}
                      </button>
                      <Avatars ids={s.responsableIds ?? []} />
                      {selectedMissing.type !== UNSPEC && (
                        <button
                          onClick={() => {
                            onCreateDoc(s.id, selectedMissing.type as DocType);
                            onJumpToShape(s.id);
                          }}
                          className="flex items-center gap-1 rounded-md bg-[#5B6CF8] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#4F5DE0]"
                        >
                          <Plus className="h-3 w-3" /> Crear {selectedMissing.type}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedNoState && (
              <div className="space-y-4">
                <div className="text-[18px] font-bold text-[#111827]">
                  {selectedNoState.title || selectedNoState.text || "Sin título"}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Diagnóstico
                    <select
                      value={selectedNoState.diagnostico ?? "sin_definir"}
                      onChange={(e) =>
                        onSetDiag(selectedNoState.id, e.target.value as Diagnostico)
                      }
                      className="rounded-md border border-[#EBEBEB] bg-white px-2 py-1 text-[13px] font-normal normal-case tracking-normal text-[#111827]"
                    >
                      {(Object.keys(DIAGNOSTICO_META) as Diagnostico[]).map((k) => (
                        <option key={k} value={k}>
                          {DIAGNOSTICO_META[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#6B7280]">
                    Prioridad
                    <select
                      value={selectedNoState.prioridad ?? ""}
                      onChange={(e) =>
                        onSetPrio(selectedNoState.id, e.target.value as Prioridad)
                      }
                      className="rounded-md border border-[#EBEBEB] bg-white px-2 py-1 text-[13px] font-normal normal-case tracking-normal text-[#111827]"
                    >
                      <option value="">—</option>
                      {(Object.keys(PRIORIDAD_META) as Prioridad[]).map((k) => (
                        <option key={k} value={k}>
                          {PRIORIDAD_META[k].label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>

          {selShapeId && (
            <div className="flex shrink-0 items-center justify-end border-t border-[#EBEBEB] bg-[#FAFAFA] px-6 py-3">
              <button
                onClick={() => onJumpToShape(selShapeId)}
                className="rounded-md bg-[#5B6CF8] px-3 py-1.5 text-[13px] font-medium text-white hover:bg-[#4F5DE0]"
              >
                Ir a la shape →
              </button>
            </div>
          )}
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
  onSubProcessIconClick: (shape: Shape, originRect: DOMRect) => void;
  subPanelStates: Record<string, "open" | "minimized">;
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
  onSubProcessIconClick,
  subPanelStates,
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
  const [quickGhost, setQuickGhost] = useState<{ shapeId: string; edge: "top" | "bottom" | "left" | "right" } | null>(null);

  const [alignGuides, setAlignGuides] = useState<
    { orient: "h" | "v"; pos: number }[]
  >([]);

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
      // Smart alignment: compute against the FIRST dragged shape's bounds, snap whole group.
      const SNAP = 6;
      const firstId = dragging.ids[0];
      const firstOrig = dragging.orig[firstId];
      const first = page.shapes.find((s) => s.id === firstId);
      let snapDX = 0;
      let snapDY = 0;
      const guides: { orient: "h" | "v"; pos: number }[] = [];
      if (first) {
        const movedLeft = firstOrig.x + dx;
        const movedTop = firstOrig.y + dy;
        const movedRight = movedLeft + first.width;
        const movedBottom = movedTop + first.height;
        const movedCX = movedLeft + first.width / 2;
        const movedCY = movedTop + first.height / 2;
        const others = page.shapes.filter((s) => !dragging.ids.includes(s.id));
        let bestVx: { delta: number; pos: number } | null = null;
        let bestHy: { delta: number; pos: number } | null = null;
        for (const o of others) {
          const oXs = [o.x, o.x + o.width / 2, o.x + o.width];
          const oYs = [o.y, o.y + o.height / 2, o.y + o.height];
          for (const tx of oXs) {
            for (const m of [movedLeft, movedCX, movedRight]) {
              const d = tx - m;
              if (Math.abs(d) <= SNAP && (!bestVx || Math.abs(d) < Math.abs(bestVx.delta))) {
                bestVx = { delta: d, pos: tx };
              }
            }
          }
          for (const ty of oYs) {
            for (const m of [movedTop, movedCY, movedBottom]) {
              const d = ty - m;
              if (Math.abs(d) <= SNAP && (!bestHy || Math.abs(d) < Math.abs(bestHy.delta))) {
                bestHy = { delta: d, pos: ty };
              }
            }
          }
        }
        if (bestVx) {
          snapDX = bestVx.delta;
          // collect all guides matching after snap
          const finalLeft = movedLeft + snapDX;
          const finalRight = finalLeft + first.width;
          const finalCX = finalLeft + first.width / 2;
          for (const o of others) {
            for (const tx of [o.x, o.x + o.width / 2, o.x + o.width]) {
              if (
                Math.abs(tx - finalLeft) < 0.5 ||
                Math.abs(tx - finalRight) < 0.5 ||
                Math.abs(tx - finalCX) < 0.5
              ) {
                if (!guides.find((g) => g.orient === "v" && g.pos === tx))
                  guides.push({ orient: "v", pos: tx });
              }
            }
          }
        }
        if (bestHy) {
          snapDY = bestHy.delta;
          const finalTop = movedTop + snapDY;
          const finalBottom = finalTop + first.height;
          const finalCY = finalTop + first.height / 2;
          for (const o of others) {
            for (const ty of [o.y, o.y + o.height / 2, o.y + o.height]) {
              if (
                Math.abs(ty - finalTop) < 0.5 ||
                Math.abs(ty - finalBottom) < 0.5 ||
                Math.abs(ty - finalCY) < 0.5
              ) {
                if (!guides.find((g) => g.orient === "h" && g.pos === ty))
                  guides.push({ orient: "h", pos: ty });
              }
            }
          }
        }
      }
      setAlignGuides(guides);
      const adx = dx + snapDX;
      const ady = dy + snapDY;
      dragging.ids.forEach((id) => {
        const o = dragging.orig[id];
        useDiagramStore.getState().updateShape(docId, page.id, id, {
          x: snapDX !== 0 ? Math.round(o.x + adx) : snap(o.x + dx),
          y: snapDY !== 0 ? Math.round(o.y + ady) : snap(o.y + dy),
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
    if (dragging) {
      setDragging(null);
      setAlignGuides([]);
    }
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
            zoom={zoom}
            pan={pan}
            allShapes={page.shapes}
            pinned={pinnedIds.includes(s.id)}
            onPin={() => pinShape(s.id)}
            onUnpin={() => unpinShape(s.id)}

            selected={selectedIds.includes(s.id)}
            editingText={editingTextId === s.id}
            onPointerDown={(e) => {
              e.stopPropagation();
              if (spaceDown) return;
              const additive = e.shiftKey || e.metaKey || e.ctrlKey;
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
            onQuickAdd={(edge) => {
              let nx = s.x;
              let ny = s.y;
              if (edge === "bottom") { nx = s.x; ny = s.y + s.height + 40; }
              else if (edge === "top") { nx = s.x; ny = s.y - s.height - 40; }
              else if (edge === "right") { nx = s.x + s.width + 60; ny = s.y; }
              else if (edge === "left") { nx = s.x - s.width - 60; ny = s.y; }
              const ns: Shape = {
                ...s,
                id: `s${Date.now()}${Math.floor(Math.random() * 10000)}`,
                x: nx,
                y: ny,
                text: "Label",
                title: "Untitled",
                description: "",
                status: "ninguno",
                diagnostico: "sin_definir",
                prioridad: undefined,
                changes: [],
                improvementEntries: [],
                documents: [],
                noStandardDoc: false,
                missingDocTypes: [],
                imageDataUrl: undefined,
                responsable: "",
                responsableIds: [],

              };
              useDiagramStore.getState().addShape(docId, page.id, ns);
              // For "top", arrow goes from new -> original; otherwise original -> new
              const fromId = edge === "top" ? ns.id : s.id;
              const toId = edge === "top" ? s.id : ns.id;
              useDiagramStore.getState().addConnector(docId, page.id, {
                id: `c${Date.now()}${Math.floor(Math.random() * 10000)}`,
                fromId,
                toId,
                label: "",
                lineStyle: "solid",
                weight: 2,
                arrowEnd: "arrow",
              });
              setSelectedIds([ns.id]);
              setQuickGhost(null);
            }}
            onQuickAddHover={(edge) => {
              setQuickGhost(edge ? { shapeId: s.id, edge } : null);
            }}

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
            onSubProcessIconClick={(rect) => onSubProcessIconClick(s, rect)}
            subPanelState={subPanelStates[s.id]}
          />
        ))}

        {/* Quick-add ghost preview */}
        {quickGhost && (() => {
          const src = page.shapes.find((sh) => sh.id === quickGhost.shapeId);
          if (!src) return null;
          let nx = src.x, ny = src.y;
          if (quickGhost.edge === "bottom") ny = src.y + src.height + 40;
          else if (quickGhost.edge === "top") ny = src.y - src.height - 40;
          else if (quickGhost.edge === "right") nx = src.x + src.width + 60;
          else if (quickGhost.edge === "left") nx = src.x - src.width - 60;
          const w = src.width, h = src.height;
          const stroke = "#5B6CF8";
          const fillRgba = src.fill;
          const isSvg = ["diamond", "parallelogram", "cylinder", "document", "manual"].includes(src.type);
          // Line starts from + button position, ends at near edge of ghost
          const OFFSET = 8;
          let sc = { x: src.x + src.width / 2, y: src.y + src.height / 2 };
          let gc = { x: nx + w / 2, y: ny + h / 2 };
          if (quickGhost.edge === "bottom") {
            sc = { x: src.x + src.width / 2, y: src.y + src.height + OFFSET };
            gc = { x: nx + w / 2, y: ny };
          } else if (quickGhost.edge === "top") {
            sc = { x: src.x + src.width / 2, y: src.y - OFFSET };
            gc = { x: nx + w / 2, y: ny + h };
          } else if (quickGhost.edge === "right") {
            sc = { x: src.x + src.width + OFFSET, y: src.y + src.height / 2 };
            gc = { x: nx, y: ny + h / 2 };
          } else if (quickGhost.edge === "left") {
            sc = { x: src.x - OFFSET, y: src.y + src.height / 2 };
            gc = { x: nx + w, y: ny + h / 2 };
          }

          return (
            <>
              <svg
                className="pointer-events-none absolute left-0 top-0 overflow-visible"
                style={{
                  opacity: 0.45,
                  transition: "opacity 120ms ease-out",
                  zIndex: 9997,
                }}
              >
                <line
                  x1={sc.x} y1={sc.y} x2={gc.x} y2={gc.y}
                  stroke={stroke} strokeWidth={2} strokeDasharray="6,4"
                />
              </svg>
              {isSvg ? (
                <svg
                  className="pointer-events-none absolute"
                  style={{
                    left: nx, top: ny, width: w, height: h,
                    overflow: "visible", opacity: 0.45,
                    transition: "opacity 120ms ease-out", zIndex: 9997,
                  }}
                >
                  {src.type === "diamond" && (
                    <polygon points={`${w/2},2 ${w-2},${h/2} ${w/2},${h-2} 2,${h/2}`}
                      fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                  )}
                  {src.type === "parallelogram" && (
                    <polygon points={`${w*0.15},2 ${w-2},2 ${w*0.85},${h-2} 2,${h-2}`}
                      fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                  )}
                  {src.type === "manual" && (
                    <polygon points={`2,${h*0.15} ${w-2},2 ${w-2},${h-2} 2,${h-2}`}
                      fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                  )}
                  {src.type === "cylinder" && (
                    <>
                      <rect x={2} y={h*0.15} width={w-4} height={h*0.75}
                        fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                      <ellipse cx={w/2} cy={h*0.9} rx={(w-4)/2} ry={h*0.12}
                        fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                      <ellipse cx={w/2} cy={h*0.15} rx={(w-4)/2} ry={h*0.12}
                        fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4" />
                    </>
                  )}
                  {src.type === "document" && (
                    <path
                      d={`M 2,2 L ${w-2},2 L ${w-2},${h*0.78} C ${w*0.85},${h*0.78} ${w*0.85},${h*0.95} ${w*0.75},${h*0.95} C ${w*0.65},${h*0.95} ${w*0.65},${h*0.78} ${w*0.5},${h*0.78} C ${w*0.35},${h*0.78} ${w*0.35},${h*0.95} ${w*0.25},${h*0.95} C ${w*0.15},${h*0.95} ${w*0.15},${h*0.78} 2,${h*0.78} Z`}
                      fill={fillRgba} fillOpacity={0.6} stroke={stroke} strokeWidth={2} strokeDasharray="6,4"
                    />
                  )}
                </svg>
              ) : (
                <div
                  className="pointer-events-none absolute"
                  style={{
                    left: nx, top: ny, width: w, height: h,
                    background: fillRgba, opacity: 0.45,
                    border: `2px dashed ${stroke}`,
                    borderRadius: src.type === "oval" ? 9999 : src.cornerStyle === "rounded" ? 8 : 0,
                    transition: "opacity 120ms ease-out",
                    zIndex: 9997,
                  }}
                />
              )}
            </>
          );
        })()}


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

        {/* Alignment guides */}
        {alignGuides.map((g, i) =>
          g.orient === "v" ? (
            <div
              key={`gv${i}`}
              className="pointer-events-none absolute"
              style={{
                left: g.pos,
                top: -10000,
                width: 1,
                height: 20000,
                background: "#FF4D6D",
              }}
            />
          ) : (
            <div
              key={`gh${i}`}
              className="pointer-events-none absolute"
              style={{
                top: g.pos,
                left: -10000,
                height: 1,
                width: 20000,
                background: "#FF4D6D",
              }}
            />
          ),
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
  zoom: number;
  pan: { x: number; y: number };
  allShapes: Shape[];
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
  onQuickAdd: (edge: "top" | "bottom" | "left" | "right") => void;
  onQuickAddHover: (edge: "top" | "bottom" | "left" | "right" | null) => void;
  onContextAction: (
    a: "editText" | "delete" | "front" | "back" | "duplicate" | "assignImage",
  ) => void;
  onSubProcessIconClick: (originRect: DOMRect) => void;
  subPanelState?: "open" | "minimized";
}


function ShapeNode({
  shape,
  docId,
  pageId,
  zoom,
  pan,
  allShapes,
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
  onQuickAdd,
  onQuickAddHover,
  onContextAction,
  onSubProcessIconClick,
  subPanelState,
}: ShapeNodeProps) {

  const [hovered, setHovered] = useState(false);
  
  const [showPopup, setShowPopup] = useState(false);
  const hoverTimer = useRef<number | null>(null);
  const hideTimer = useRef<number | null>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ left: number; top: number } | null>(null);
  const [popupSide, setPopupSide] = useState<"top" | "bottom" | "left" | "right" | null>(null);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [qaEdge, setQaEdge] = useState<"top" | "bottom" | "left" | "right">("bottom");
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Quick-add (+) button: appears 400ms after hover, 200ms grace on leave.
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [qaHover, setQaHover] = useState(false);
  const [pointerActive, setPointerActive] = useState(false);
  const qaShowTimer = useRef<number | null>(null);
  const qaHideTimer = useRef<number | null>(null);
  useEffect(() => {
    const active = (hovered || qaHover) && !pointerActive;
    if (active) {
      if (qaHideTimer.current) { clearTimeout(qaHideTimer.current); qaHideTimer.current = null; }
      if (!showQuickAdd && !qaShowTimer.current) {
        qaShowTimer.current = window.setTimeout(() => {
          // Compute closest edge to mouse
          const rect = nodeRef.current?.getBoundingClientRect();
          let edge: "top" | "bottom" | "left" | "right" = "bottom";
          if (rect) {
            const relX = mouseRef.current.x - (rect.left + rect.width / 2);
            const relY = mouseRef.current.y - (rect.top + rect.height / 2);
            if (Math.abs(relX) > Math.abs(relY)) edge = relX > 0 ? "right" : "left";
            else edge = relY > 0 ? "bottom" : "top";
          }
          // Avoid collision with popup
          if (showPopup && popupSide === edge) {
            const opp: Record<typeof edge, typeof edge> = { top: "bottom", bottom: "top", left: "right", right: "left" };
            edge = opp[edge];
          }
          setQaEdge(edge);
          setShowQuickAdd(true);
          qaShowTimer.current = null;
        }, 400);
      }
    } else {
      if (qaShowTimer.current) { clearTimeout(qaShowTimer.current); qaShowTimer.current = null; }
      if (showQuickAdd && !qaHideTimer.current) {
        qaHideTimer.current = window.setTimeout(() => {
          setShowQuickAdd(false);
          qaHideTimer.current = null;
        }, 200);
      }
    }
  }, [hovered, qaHover, pointerActive, showQuickAdd, showPopup, popupSide]);

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
    const POP_W = pinned ? popupSize?.w ?? 320 : 280;
    const POP_H = pinned ? popupSize?.h ?? 380 : 200;
    const GAP = 12;
    const pad = 8;
    void pan;

    const canvasOffsetX = rect.left - shape.x * zoom;
    const canvasOffsetY = rect.top - shape.y * zoom;

    const otherRects = allShapes
      .filter((s) => s.id !== shape.id)
      .map((s) => ({
        left: s.x * zoom + canvasOffsetX,
        top: s.y * zoom + canvasOffsetY,
        right: (s.x + s.width) * zoom + canvasOffsetX,
        bottom: (s.y + s.height) * zoom + canvasOffsetY,
      }));

    const overlapScore = (pl: number, pt: number) => {
      const pr = pl + POP_W;
      const pb = pt + POP_H;
      return otherRects.reduce((sum, r) => {
        const ox = Math.max(0, Math.min(pr, r.right) - Math.max(pl, r.left));
        const oy = Math.max(0, Math.min(pb, r.bottom) - Math.max(pt, r.top));
        return sum + ox * oy;
      }, 0);
    };

    const clampL = (l: number) =>
      Math.max(pad, Math.min(l, window.innerWidth - POP_W - pad));
    const clampT = (t: number) =>
      Math.max(pad, Math.min(t, window.innerHeight - POP_H - pad));

    const raw = [
      { name: "right", l: rect.right + GAP, t: clampT(rect.top) },
      { name: "left", l: rect.left - POP_W - GAP, t: clampT(rect.top) },
      { name: "bottom", l: clampL(rect.left), t: rect.bottom + GAP },
      { name: "top", l: clampL(rect.left), t: rect.top - POP_H - GAP },
    ];
    const priority: Record<string, number> = { right: 0, left: 1, bottom: 2, top: 3 };
    const candidates = raw
      .map((c) => ({ ...c, l: clampL(c.l), t: clampT(c.t) }))
      .map((c) => ({ ...c, score: overlapScore(c.l, c.t) }))
      .sort((a, b) => a.score - b.score || priority[a.name] - priority[b.name]);

    const best = candidates[0];
    setPopupPos({ left: best.l, top: best.t });
    setPopupSide(best.name as "top" | "bottom" | "left" | "right");
  }, [shape, allShapes, pan, zoom, popupSize, pinned]);

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

  // Hover-show with 400ms delay; popup itself does not extend its lifetime.
  // When the mouse leaves the shape, hide after a 150ms grace period.
  useEffect(() => {
    const active = hovered;
    if (active) {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (!showPopup && !pinned) {
        hoverTimer.current = window.setTimeout(() => {
          computePos();
          setShowPopup(true);
        }, 400);
      }
    } else {
      if (hoverTimer.current) {
        clearTimeout(hoverTimer.current);
        hoverTimer.current = null;
      }
      if (!pinned) {
        hideTimer.current = window.setTimeout(() => setShowPopup(false), 150);
      }
    }
    return () => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
    };
  }, [hovered, pinned, showPopup, computePos]);



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
    border: `${shape.borderWeight}px ${shape.borderStyle} ${shape.borderColor ?? "#D0D0D0"}`,
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

  // Shapes rendered with an SVG outline sibling (so absolute children — pills,
  // badges — are never clipped). Their content div is transparent w/ no border.
  const CLIP_TYPES: ShapeType[] = ["diamond", "parallelogram", "cylinder", "document", "manual"];
  const useSvgOutline = CLIP_TYPES.includes(shape.type);
  if (useSvgOutline) {
    style.background = "transparent";
    style.border = "none";
    style.borderRadius = 0;
  } else if (shape.type === "oval") {
    style.borderRadius = 9999;
  } else if (shape.type === "container") {
    style.background = shape.fill;
    style.border = `1px dashed #5B6CF8`;
    style.alignItems = "flex-start";
    style.justifyContent = "flex-start";
  } else if (shape.type === "sticky") {
    style.border = "1px solid #F59E0B";
    style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
  } else if (shape.type === "text") {
    style.border = "1px dashed transparent";
    style.background = "transparent";
  }

  const diag = diagPre;
  const prio = prioPre;
  const hasDocs = (shape.documents ?? []).length > 0;
  const missingDocs = !!shape.noStandardDoc;

  return (
    <>
      {useSvgOutline && (() => {
        const w = shape.width;
        const h = shape.height;
        const stroke = shape.borderColor ?? "#D0D0D0";
        const sw = shape.borderWeight;
        const fill = shape.fill;
        const dash =
          shape.borderStyle === "dashed" ? "8,4" : shape.borderStyle === "dotted" ? "2,3" : undefined;
        const common = { fill, stroke, strokeWidth: sw, strokeDasharray: dash } as const;
        let inner: React.ReactNode = null;
        if (shape.type === "diamond")
          inner = (
            <polygon
              points={`${w / 2},2 ${w - 2},${h / 2} ${w / 2},${h - 2} 2,${h / 2}`}
              {...common}
            />
          );
        else if (shape.type === "parallelogram")
          inner = (
            <polygon
              points={`${w * 0.15},2 ${w - 2},2 ${w * 0.85},${h - 2} 2,${h - 2}`}
              {...common}
            />
          );
        else if (shape.type === "manual")
          inner = (
            <polygon
              points={`2,${h * 0.15} ${w - 2},2 ${w - 2},${h - 2} 2,${h - 2}`}
              {...common}
            />
          );
        else if (shape.type === "cylinder") {
          const rx = (w - 4) / 2;
          const ry = h * 0.12;
          inner = (
            <>
              <rect x={2} y={h * 0.15} width={w - 4} height={h * 0.75} {...common} />
              <ellipse cx={w / 2} cy={h * 0.9} rx={rx} ry={ry} {...common} />
              <ellipse cx={w / 2} cy={h * 0.15} rx={rx} ry={ry} {...common} />
            </>
          );
        } else if (shape.type === "document") {
          const d = `M 2,2 L ${w - 2},2 L ${w - 2},${h * 0.78} C ${w * 0.85},${h * 0.78} ${w * 0.85},${h * 0.95} ${w * 0.75},${h * 0.95} C ${w * 0.65},${h * 0.95} ${w * 0.65},${h * 0.78} ${w * 0.5},${h * 0.78} C ${w * 0.35},${h * 0.78} ${w * 0.35},${h * 0.95} ${w * 0.25},${h * 0.95} C ${w * 0.15},${h * 0.95} ${w * 0.15},${h * 0.78} 2,${h * 0.78} Z`;
          inner = <path d={d} {...common} />;
        }
        return (
          <svg
            className="pointer-events-none absolute"
            style={{ left: shape.x, top: shape.y, width: w, height: h, overflow: "visible", zIndex: shape.z }}
          >
            {inner}
          </svg>
        );
      })()}
      {selected && (
        <div
          className="absolute"
          style={{
            left: shape.x - 2,
            top: shape.y - 2,
            width: shape.width + 4,
            height: shape.height + 4,
            zIndex: 9999,
            pointerEvents: "none",
          }}
        >
          {/* Border (non-interactive) */}
          <div
            className="absolute inset-0"
            style={{
              border: "2px solid #5B6CF8",
              borderRadius: shape.cornerStyle === "rounded" ? 10 : 0,
              pointerEvents: "none",
            }}
          />
          {(
            [
              ["nw", 0, 0],
              ["n", 0.5, 0],
              ["ne", 1, 0],
              ["e", 1, 0.5],
              ["se", 1, 1],
              ["s", 0.5, 1],
              ["sw", 0, 1],
              ["w", 0, 0.5],
            ] as const
          ).map(([k, fx, fy]) => {
            const CURSORS: Record<string, string> = {
              nw: "nw-resize", n: "n-resize", ne: "ne-resize", e: "e-resize",
              se: "se-resize", s: "s-resize", sw: "sw-resize", w: "w-resize",
            };
            return (
              <div
                key={k}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const orig = { x: shape.x, y: shape.y, w: shape.width, h: shape.height };
                  const MIN = 60;
                  const onMove = (ev: PointerEvent) => {
                    const dx = (ev.clientX - startX) / zoom;
                    const dy = (ev.clientY - startY) / zoom;
                    let { x, y, w, h } = orig;
                    if (k === "e" || k === "ne" || k === "se") w = Math.max(MIN, orig.w + dx);
                    if (k === "w" || k === "nw" || k === "sw") { x = orig.x + dx; w = Math.max(MIN, orig.w - dx); }
                    if (k === "s" || k === "se" || k === "sw") h = Math.max(MIN, orig.h + dy);
                    if (k === "n" || k === "ne" || k === "nw") { y = orig.y + dy; h = Math.max(MIN, orig.h - dy); }
                    useDiagramStore.getState().updateShape(docId, pageId, shape.id, {
                      x: Math.round(x), y: Math.round(y),
                      width: Math.round(w), height: Math.round(h),
                    });
                  };
                  const onUp = () => {
                    window.removeEventListener("pointermove", onMove);
                    window.removeEventListener("pointerup", onUp);
                  };
                  window.addEventListener("pointermove", onMove);
                  window.addEventListener("pointerup", onUp);
                  try { (e.currentTarget as Element).setPointerCapture?.(e.pointerId); } catch {}
                }}
                style={{
                  position: "absolute",
                  left: `${fx * 100}%`,
                  top: `${fy * 100}%`,
                  width: 10,
                  height: 10,
                  background: "white",
                  border: "1px solid #5B6CF8",
                  transform: "translate(-50%, -50%)",
                  pointerEvents: "auto",
                  cursor: CURSORS[k],
                  borderRadius: 2,
                  zIndex: 10001,
                }}
              />
            );
          })}
        </div>
      )}

      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            ref={nodeRef}
            data-shape-id={shape.id}
            style={style}
            onPointerDown={(e) => {
              setPointerActive(true);
              const onUp = () => {
                setPointerActive(false);
                window.removeEventListener("pointerup", onUp);
              };
              window.addEventListener("pointerup", onUp);
              onPointerDown(e);
            }}
            onDoubleClick={onDoubleClickText}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onMouseMove={(e) => {
              mouseRef.current = { x: e.clientX, y: e.clientY };
            }}
          >
            {editingText && !useSvgOutline ? (
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

      {/* Pin button on shape (top-right corner) */}
      {(showPopup || pinned) && shape.type !== "text" && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (pinned) onUnpin();
            else onPin();
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            "flowit-fade-in absolute flex items-center justify-center rounded-full border shadow-sm transition-all hover:scale-110",
            pinned
              ? "border-[#5B6CF8] bg-[#5B6CF8] text-white"
              : "border-[#EBEBEB] bg-white text-[#6B7280] hover:text-[#111827]",
          )}
          style={{
            left: shape.x + shape.width - 12,
            top: shape.y - 10,
            width: 22,
            height: 22,
            zIndex: 9999,
          }}
          title={pinned ? "Desanclar" : "Anclar"}
        >
          <Pin className="h-3 w-3" style={pinned ? { fill: "currentColor" } : undefined} />
        </button>
      )}

      {/* Sub-process trigger (top-left corner) */}
      {shape.type !== "text" && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            const rect = nodeRef.current?.getBoundingClientRect();
            if (rect) onSubProcessIconClick(rect);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={cn(
            "absolute flex items-center justify-center rounded-full border-2 text-[13px] font-semibold leading-none shadow-sm transition-all hover:scale-110",
            subPanelState === "open" && "border-[#5B6CF8] bg-[#5B6CF8] text-white",
            subPanelState === "minimized" && "border-[#F59E0B] bg-[#F59E0B] text-white",
            !subPanelState && shape.subProcessPageId && "border-[#5B6CF8] bg-white text-[#5B6CF8]",
            !subPanelState && !shape.subProcessPageId && "border-[#D1D5DB] bg-white text-[#D1D5DB] hover:border-[#5B6CF8] hover:text-[#5B6CF8]",
          )}
          style={{
            left: shape.x - 11,
            top: shape.y - 11,
            width: 24,
            height: 24,
            zIndex: 9999,
          }}
          title={shape.subProcessPageId ? "Abrir sub-proceso" : "Crear sub-proceso"}
        >
          ⊞
        </button>
      )}


      {/* Quick-add (+) button on edge nearest mouse */}
      {showQuickAdd && shape.type !== "text" && (() => {
        const SIZE = 24;
        const OFFSET = 8;
        let left = shape.x + shape.width / 2 - SIZE / 2;
        let top = shape.y + shape.height / 2 - SIZE / 2;
        if (qaEdge === "bottom") top = shape.y + shape.height + OFFSET;
        else if (qaEdge === "top") top = shape.y - OFFSET - SIZE;
        else if (qaEdge === "right") left = shape.x + shape.width + OFFSET;
        else if (qaEdge === "left") left = shape.x - OFFSET - SIZE;
        return (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onQuickAdd(qaEdge);
            }}
            onMouseEnter={() => { setQaHover(true); onQuickAddHover(qaEdge); }}
            onMouseLeave={() => { setQaHover(false); onQuickAddHover(null); }}

            className="flowit-fade-in absolute flex items-center justify-center rounded-full border-2 border-[#5B6CF8] bg-white text-[#5B6CF8] hover:bg-[#EEF0FF]"
            style={{ left, top, width: SIZE, height: SIZE, zIndex: 9998 }}
            title="Add connected shape"
          >
            <Plus className="h-4 w-4" />
          </button>
        );
      })()}

      {/* HOVER POPUP */}
      {showPopup && popupPos && (
        <div
          data-popup-for={shape.id}
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
            pointerEvents: pinned ? "auto" : "none",
          }}
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
              <div
                className="group/img relative cursor-zoom-in"
                onClick={(e) => {
                  if (!pinned) return;
                  e.stopPropagation();
                  setLightbox(true);
                }}
              >
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
                {pinned && (
                  <div className="pointer-events-none absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover/img:opacity-100">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex h-[110px] w-full flex-col items-center justify-center gap-2 border-b border-dashed border-[#D0D0D0] bg-[#FAFAFA] text-[#9CA3AF]">
                <Camera className="h-6 w-6" />
                <span className="text-xs">Right-click → Assign image</span>
              </div>
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

      {editingText && useSvgOutline && typeof document !== "undefined" && (() => {
        const r = nodeRef.current?.getBoundingClientRect();
        if (!r) return null;
        return createPortal(
          <input
            autoFocus
            defaultValue={shape.text}
            onBlur={(e) => onTextCommit((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            style={{
              position: "fixed",
              left: r.left,
              top: r.top,
              width: r.width,
              height: r.height,
              zIndex: 10000,
              background: "rgba(255,255,255,0.92)",
              border: "2px solid #5B6CF8",
              borderRadius: 6,
              textAlign: "center",
              fontSize: shape.fontSize,
              fontFamily: shape.fontFamily,
              color: shape.textColor,
              outline: "none",
              padding: "8px",
            }}
          />,
          document.body,
        );
      })()}


      {lightbox && shape.imageDataUrl && typeof document !== "undefined" &&
        createPortal(
          <div
            onClick={() => setLightbox(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: 1,
              animation: "flowitLightboxIn 200ms ease-out",
            }}
          >
            <span
              onClick={(e) => {
                e.stopPropagation();
                setLightbox(false);
              }}
              style={{
                position: "absolute",
                top: 20,
                right: 24,
                fontSize: 28,
                color: "white",
                cursor: "pointer",
                lineHeight: 1,
                userSelect: "none",
              }}
            >
              ×
            </span>
            <img
              src={shape.imageDataUrl}
              alt={shape.title}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: 8,
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}

/* -------------------- Floating sub-process panel -------------------- */
interface SubProcessPanelProps {
  docId: string;
  page: { id: string; name: string; shapes: Shape[]; connectors: Connector[] };
  shapeTitle: string;
  minimized: boolean;
  minimizedStackIndex: number;
  onClose: () => void;
  onToggleMinimize: () => void;
  onSubProcessIconClick: (shape: Shape) => void;
  subPanelStates: Record<string, "open" | "minimized">;
  zIndexBase: number;
}

function SubProcessPanel({
  docId,
  page,
  shapeTitle,
  minimized,
  minimizedStackIndex,
  onClose,
  onToggleMinimize,
  onSubProcessIconClick,
  subPanelStates,
  zIndexBase,
}: SubProcessPanelProps) {
  const [pan, setPan] = useState({ x: 60, y: 40 });
  const [zoom, setZoom] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [nameVal, setNameVal] = useState(page.name);
  const [mounted, setMounted] = useState(false);

  const initialW = Math.min(900, Math.round(window.innerWidth * 0.72));
  const initialH = Math.min(600, Math.round(window.innerHeight * 0.68));
  const [size, setSize] = useState({ w: initialW, h: initialH });
  const [pos, setPos] = useState({
    left: Math.round((window.innerWidth - initialW) / 2),
    top: 80,
  });

  const dragRef = useRef<{ startX: number; startY: number; left: number; top: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; w: number; h: number } | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    setNameVal(page.name);
  }, [page.name]);

  const pinShape = useCallback(
    (id: string) => setPinnedIds((p) => (p.includes(id) ? p : [...p, id])),
    [],
  );
  const unpinShape = useCallback(
    (id: string) => setPinnedIds((p) => p.filter((x) => x !== id)),
    [],
  );

  const commitName = () => {
    const v = nameVal.trim() || "Sub-proceso";
    if (v !== page.name) {
      useDiagramStore.getState().renamePage(docId, page.id, v);
    }
  };

  const onHeaderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("input,button")) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, left: pos.left, top: pos.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHeaderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setPos({
      left: dragRef.current.left + (e.clientX - dragRef.current.startX),
      top: dragRef.current.top + (e.clientY - dragRef.current.startY),
    });
  };
  const onHeaderPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const onResizePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, w: size.w, h: size.h };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!resizeRef.current) return;
    setSize({
      w: Math.max(420, resizeRef.current.w + (e.clientX - resizeRef.current.startX)),
      h: Math.max(280, resizeRef.current.h + (e.clientY - resizeRef.current.startY)),
    });
  };
  const onResizePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    resizeRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const addShapeOfType = (type: ShapeType) => {
    const cx = (size.w - 48) / 2;
    const cy = (size.h - 44) / 2;
    const wx = (cx - pan.x) / zoom;
    const wy = (cy - pan.y) / zoom;
    const s = makeDefaultShape(type, Math.round(wx - 90), Math.round(wy - 40));
    useDiagramStore.getState().addShape(docId, page.id, s);
    setSelectedIds([s.id]);
  };

  if (typeof document === "undefined") return null;

  const headerBar = (
    <div
      onPointerDown={onHeaderPointerDown}
      onPointerMove={onHeaderPointerMove}
      onPointerUp={onHeaderPointerUp}
      onPointerCancel={onHeaderPointerUp}
      style={{ background: "#F8F9FF", cursor: dragRef.current ? "grabbing" : "grab" }}
      className="flex h-11 shrink-0 items-center gap-2 border-b border-[#EBEBEB] px-3 select-none"
    >
      <div className="flex h-[18px] w-[18px] items-center justify-center rounded-[4px] bg-[#5B6CF8] text-[12px] font-semibold leading-none text-white">
        ⊞
      </div>
      <input
        value={nameVal}
        onChange={(e) => setNameVal(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-7 flex-1 min-w-0 border-0 bg-transparent px-1 text-[14px] font-semibold text-[#111827] outline-none focus:bg-white focus:rounded"
        title={shapeTitle}
      />
      <button
        onClick={onToggleMinimize}
        className="flex h-7 w-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#EEF0FF] hover:text-[#111827]"
        title={minimized ? "Restaurar" : "Minimizar"}
      >
        {minimized ? "□" : "−"}
      </button>
      <button
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
        title="Cerrar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  const toolbarShapes: ShapeType[] = [
    "rectangle",
    "diamond",
    "oval",
    "parallelogram",
    "cylinder",
    "document",
    "manual",
    "sticky",
    "text",
    "container",
  ];

  const baseStyle: CSSProperties = minimized
    ? {
        position: "fixed",
        left: 320 + minimizedStackIndex * 280,
        bottom: 16,
        width: 260,
        height: 44,
        background: "white",
        borderRadius: 12,
        boxShadow:
          "0 12px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
        zIndex: zIndexBase,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.95)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      }
    : {
        position: "fixed",
        left: pos.left,
        top: pos.top,
        width: size.w,
        height: size.h,
        background: "white",
        borderRadius: 16,
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)",
        zIndex: zIndexBase,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "scale(1)" : "scale(0.95)",
        transition: "opacity 200ms ease-out, transform 200ms ease-out",
      };

  return createPortal(
    <div style={baseStyle}>
      {headerBar}
      {!minimized && (
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          {/* Left shape toolbar */}
          <div
            className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-[#EBEBEB] bg-white py-2"
            style={{ width: 48 }}
          >
            {toolbarShapes.map((t) => (
              <button
                key={t}
                onClick={() => addShapeOfType(t)}
                title={t}
                className="flex h-10 w-10 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
              >
                <ShapePreview type={t} />
              </button>
            ))}
          </div>
          {/* Canvas region */}
          <div className="relative flex flex-1 min-w-0 min-h-0 overflow-hidden">
            <CanvasArea
              docId={docId}
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
              onSubProcessIconClick={onSubProcessIconClick}
              subPanelStates={subPanelStates}
            />
          </div>
          {/* Resize handle */}
          <div
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            style={{
              background:
                "linear-gradient(135deg, transparent 50%, #C4C7D2 50%, #C4C7D2 60%, transparent 60%, transparent 70%, #C4C7D2 70%, #C4C7D2 80%, transparent 80%)",
            }}
          />
        </div>
      )}
    </div>,
    document.body,
  );
}


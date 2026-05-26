import { useMemo, useState } from "react";
import { GitCompare, Plus, Minus, Move, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DiagramDocument, Shape, Connector, Page } from "@/lib/shape-types";
import { cn } from "@/lib/utils";

// ---------- diff types ----------
type PageDiff = {
  pageId: string;
  pageName: string;
  added: Shape[];
  removed: Shape[];
  moved: { before: Shape; after: Shape }[];
  modified: { before: Shape; after: Shape }[];
  connectorsAdded: Connector[];
  connectorsRemoved: Connector[];
  baseShapes: Shape[]; // shapes that exist on both sides unchanged
  baseConnectors: Connector[];
  // shapes from either side keyed by id for arrow lookups
  shapeById: Map<string, Shape>;
};

function emptyPageDiff(pageId: string, pageName: string): PageDiff {
  return {
    pageId,
    pageName,
    added: [],
    removed: [],
    moved: [],
    modified: [],
    connectorsAdded: [],
    connectorsRemoved: [],
    baseShapes: [],
    baseConnectors: [],
    shapeById: new Map(),
  };
}

function diffPages(prev: Page | null, next: Page | null, pageId: string, pageName: string): PageDiff {
  const d = emptyPageDiff(pageId, pageName);
  const a = new Map<string, Shape>();
  const b = new Map<string, Shape>();
  prev?.shapes.forEach((s) => a.set(s.id, s));
  next?.shapes.forEach((s) => b.set(s.id, s));
  a.forEach((s) => d.shapeById.set(s.id, s));
  b.forEach((s) => d.shapeById.set(s.id, s));

  b.forEach((shape, id) => {
    const prevShape = a.get(id);
    if (!prevShape) {
      d.added.push(shape);
      return;
    }
    const positionChanged =
      Math.abs(prevShape.x - shape.x) > 0.5 ||
      Math.abs(prevShape.y - shape.y) > 0.5 ||
      Math.abs(prevShape.width - shape.width) > 0.5 ||
      Math.abs(prevShape.height - shape.height) > 0.5;
    const contentChanged =
      prevShape.text !== shape.text ||
      prevShape.fill !== shape.fill ||
      JSON.stringify(prevShape.responsableIds ?? []) !==
        JSON.stringify(shape.responsableIds ?? []);
    if (positionChanged) d.moved.push({ before: prevShape, after: shape });
    else if (contentChanged) d.modified.push({ before: prevShape, after: shape });
    else d.baseShapes.push(shape);
  });
  a.forEach((shape, id) => {
    if (!b.has(id)) d.removed.push(shape);
  });

  const cA = new Map<string, Connector>();
  const cB = new Map<string, Connector>();
  prev?.connectors.forEach((c) => cA.set(c.id, c));
  next?.connectors.forEach((c) => cB.set(c.id, c));
  cB.forEach((c, id) => {
    if (!cA.has(id)) d.connectorsAdded.push(c);
    else d.baseConnectors.push(c);
  });
  cA.forEach((c, id) => {
    if (!cB.has(id)) d.connectorsRemoved.push(c);
  });
  return d;
}

function computePageDiffs(prev: DiagramDocument | null, next: DiagramDocument): PageDiff[] {
  const pageIds = new Set<string>();
  prev?.pages.forEach((p) => pageIds.add(p.id));
  next.pages.forEach((p) => pageIds.add(p.id));
  const out: PageDiff[] = [];
  pageIds.forEach((id) => {
    const np = next.pages.find((p) => p.id === id) ?? null;
    const pp = prev?.pages.find((p) => p.id === id) ?? null;
    out.push(diffPages(pp, np, id, np?.name ?? pp?.name ?? "Página"));
  });
  return out;
}

function diffHasChanges(d: PageDiff) {
  return (
    d.added.length +
      d.removed.length +
      d.moved.length +
      d.modified.length +
      d.connectorsAdded.length +
      d.connectorsRemoved.length >
    0
  );
}

// ---------- rendering ----------
const STYLES = {
  added: { fill: "rgba(16,185,129,0.20)", stroke: "#10b981", dash: undefined as string | undefined, text: "#065F46" },
  removed: { fill: "rgba(239,68,68,0.14)", stroke: "#ef4444", dash: "6,4", text: "#991B1B" },
  movedFrom: { fill: "rgba(245,158,11,0.10)", stroke: "#f59e0b", dash: "5,4", text: "#92400E" },
  movedTo: { fill: "rgba(245,158,11,0.22)", stroke: "#f59e0b", dash: undefined, text: "#92400E" },
  modified: { fill: "rgba(56,189,248,0.18)", stroke: "#0EA5E9", dash: undefined, text: "#0C4A6E" },
  base: { fill: "rgba(148,163,184,0.10)", stroke: "#cbd5e1", dash: undefined, text: "#475569" },
};

function truncate(t: string | undefined, n = 18) {
  if (!t) return "";
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
}

function ShapeNode({ s, variant }: { s: Shape; variant: keyof typeof STYLES }) {
  const st = STYLES[variant];
  const common = {
    fill: st.fill,
    stroke: st.stroke,
    strokeWidth: 2,
    strokeDasharray: st.dash,
  };
  const label = (
    <text
      x={s.x + s.width / 2}
      y={s.y + s.height / 2}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={Math.max(11, Math.min(s.height * 0.22, 16))}
      fill={st.text}
      style={{ pointerEvents: "none", fontFamily: "Figtree, system-ui" }}
    >
      {truncate(s.text)}
    </text>
  );
  let body: React.ReactNode;
  if (s.type === "oval") {
    body = (
      <ellipse
        cx={s.x + s.width / 2}
        cy={s.y + s.height / 2}
        rx={s.width / 2}
        ry={s.height / 2}
        {...common}
      />
    );
  } else if (s.type === "diamond") {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    body = (
      <polygon
        points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`}
        {...common}
      />
    );
  } else {
    body = <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={10} {...common} />;
  }
  return (
    <g>
      {body}
      {label}
    </g>
  );
}

function ConnectorLine({ c, shapes, variant }: { c: Connector; shapes: Map<string, Shape>; variant: keyof typeof STYLES }) {
  const from = shapes.get(c.fromId);
  const to = shapes.get(c.toId);
  if (!from || !to) return null;
  const st = STYLES[variant];
  return (
    <line
      x1={from.x + from.width / 2}
      y1={from.y + from.height / 2}
      x2={to.x + to.width / 2}
      y2={to.y + to.height / 2}
      stroke={st.stroke}
      strokeWidth={variant === "base" ? 1.2 : 2}
      strokeDasharray={st.dash}
      opacity={variant === "base" ? 0.6 : 1}
    />
  );
}

function computeViewBox(shapes: Shape[]): string | null {
  if (shapes.length === 0) return null;
  const minX = Math.min(...shapes.map((s) => s.x));
  const minY = Math.min(...shapes.map((s) => s.y));
  const maxX = Math.max(...shapes.map((s) => s.x + s.width));
  const maxY = Math.max(...shapes.map((s) => s.y + s.height));
  const pad = 50;
  const w = Math.max(maxX - minX + pad * 2, 200);
  const h = Math.max(maxY - minY + pad * 2, 200);
  return `${minX - pad} ${minY - pad} ${w} ${h}`;
}

function DiffOverlay({ diff, viewBox }: { diff: PageDiff; viewBox: string | null }) {
  if (!viewBox) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
        Sin shapes en esta página
      </div>
    );
  }
  return (
    <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="diff-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
        </marker>
      </defs>
      {/* connectors first so shapes overlap */}
      {diff.baseConnectors.map((c) => (
        <ConnectorLine key={`bc-${c.id}`} c={c} shapes={diff.shapeById} variant="base" />
      ))}
      {diff.connectorsRemoved.map((c) => (
        <ConnectorLine key={`rc-${c.id}`} c={c} shapes={diff.shapeById} variant="removed" />
      ))}
      {diff.connectorsAdded.map((c) => (
        <ConnectorLine key={`ac-${c.id}`} c={c} shapes={diff.shapeById} variant="added" />
      ))}
      {/* base shapes */}
      {diff.baseShapes.map((s) => (
        <ShapeNode key={`b-${s.id}`} s={s} variant="base" />
      ))}
      {/* modified */}
      {diff.modified.map((m) => (
        <ShapeNode key={`mod-${m.after.id}`} s={m.after} variant="modified" />
      ))}
      {/* removed ghost */}
      {diff.removed.map((s) => (
        <ShapeNode key={`r-${s.id}`} s={s} variant="removed" />
      ))}
      {/* moved before/after with arrow */}
      {diff.moved.map((m) => (
        <g key={`m-${m.after.id}`}>
          <ShapeNode s={m.before} variant="movedFrom" />
          <ShapeNode s={m.after} variant="movedTo" />
          <line
            x1={m.before.x + m.before.width / 2}
            y1={m.before.y + m.before.height / 2}
            x2={m.after.x + m.after.width / 2}
            y2={m.after.y + m.after.height / 2}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="3,3"
            markerEnd="url(#diff-arrow)"
          />
        </g>
      ))}
      {/* added */}
      {diff.added.map((s) => (
        <ShapeNode key={`a-${s.id}`} s={s} variant="added" />
      ))}
    </svg>
  );
}

function SideView({
  page,
  variant,
  viewBox,
}: {
  page: Page | null;
  variant: "before" | "after";
  viewBox: string | null;
}) {
  if (!page || page.shapes.length === 0 || !viewBox) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-[#94A3B8]">
        {variant === "before" ? "Sin versión previa" : "Sin contenido"}
      </div>
    );
  }
  const shapeMap = new Map<string, Shape>();
  page.shapes.forEach((s) => shapeMap.set(s.id, s));
  return (
    <svg viewBox={viewBox} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {page.connectors.map((c) => (
        <ConnectorLine key={`c-${c.id}`} c={c} shapes={shapeMap} variant="base" />
      ))}
      {page.shapes.map((s) => (
        <ShapeNode key={s.id} s={s} variant="base" />
      ))}
    </svg>
  );
}

// ---------- modal ----------
export function ChangesDiffModal({
  open,
  onClose,
  prev,
  next,
  title,
}: {
  open: boolean;
  onClose: () => void;
  prev: DiagramDocument | null;
  next: DiagramDocument;
  title: string;
}) {
  const pageDiffs = useMemo(() => computePageDiffs(prev, next), [prev, next]);
  const changedPages = useMemo(
    () => pageDiffs.filter(diffHasChanges),
    [pageDiffs],
  );
  const tabs = changedPages.length > 0 ? changedPages : pageDiffs.slice(0, 1);
  const [activeId, setActiveId] = useState<string>(tabs[0]?.pageId ?? "");
  const active = tabs.find((t) => t.pageId === activeId) ?? tabs[0];
  const [mode, setMode] = useState<"diff" | "side">("diff");

  const totals = useMemo(() => {
    return pageDiffs.reduce(
      (acc, d) => ({
        added: acc.added + d.added.length,
        removed: acc.removed + d.removed.length,
        moved: acc.moved + d.moved.length,
        modified: acc.modified + d.modified.length,
        cAdded: acc.cAdded + d.connectorsAdded.length,
        cRemoved: acc.cRemoved + d.connectorsRemoved.length,
      }),
      { added: 0, removed: 0, moved: 0, modified: 0, cAdded: 0, cRemoved: 0 },
    );
  }, [pageDiffs]);

  // Compute shared viewBox so prev/next render at same zoom
  const sharedViewBox = useMemo(() => {
    if (!active) return null;
    const prevPage = prev?.pages.find((p) => p.id === active.pageId) ?? null;
    const nextPage = next.pages.find((p) => p.id === active.pageId) ?? null;
    const allShapes = [
      ...(prevPage?.shapes ?? []),
      ...(nextPage?.shapes ?? []),
    ];
    return computeViewBox(allShapes);
  }, [active, prev, next]);

  if (!active) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sin cambios</DialogTitle>
            <DialogDescription>No hay diferencias para mostrar.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const prevPage = prev?.pages.find((p) => p.id === active.pageId) ?? null;
  const nextPage = next.pages.find((p) => p.id === active.pageId) ?? null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <GitCompare className="h-4 w-4 text-[#5B6CF8]" /> Cambios propuestos · {title}
          </DialogTitle>
          <DialogDescription>
            {prev
              ? "Comparación contra la última versión aprobada."
              : "Primera versión enviada — todo es nuevo."}
          </DialogDescription>
        </DialogHeader>

        {/* Summary chips (globales) */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            <Plus className="h-3 w-3" /> {totals.added} agregadas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
            <Minus className="h-3 w-3" /> {totals.removed} eliminadas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
            <Move className="h-3 w-3" /> {totals.moved} movidas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
            ✎ {totals.modified} editadas
          </span>
          {(totals.cAdded > 0 || totals.cRemoved > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-700">
              <ArrowRight className="h-3 w-3" /> {totals.cAdded} + / {totals.cRemoved} − conexiones
            </span>
          )}
          <div className="ml-auto inline-flex overflow-hidden rounded-md border border-[#E2E8F0] text-[11px]">
            <button
              onClick={() => setMode("diff")}
              className={`px-2.5 py-1 ${mode === "diff" ? "bg-[#5B6CF8] text-white" : "bg-white"}`}
            >
              Overlay
            </button>
            <button
              onClick={() => setMode("side")}
              className={`px-2.5 py-1 ${mode === "side" ? "bg-[#5B6CF8] text-white" : "bg-white"}`}
            >
              Lado a lado
            </button>
          </div>
        </div>

        {/* Tabs por página (si hay más de una con cambios) */}
        {tabs.length > 1 && (
          <div className="flex flex-wrap gap-1 border-b border-[#E2E8F0] pb-1">
            {tabs.map((t) => {
              const count =
                t.added.length + t.removed.length + t.moved.length + t.modified.length;
              return (
                <button
                  key={t.pageId}
                  onClick={() => setActiveId(t.pageId)}
                  className={cn(
                    "rounded-t-md px-3 py-1.5 text-xs font-medium transition-colors",
                    t.pageId === active.pageId
                      ? "border-b-2 border-[#5B6CF8] text-[#0F172A]"
                      : "text-[#64748B] hover:text-[#0F172A]",
                  )}
                >
                  {t.pageName}
                  <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {mode === "diff" ? (
          <div className="h-[440px] rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-slate-50 to-white p-2">
            <DiffOverlay diff={active} viewBox={sharedViewBox} />
          </div>
        ) : (
          <div className="grid h-[440px] grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                {prev ? "Versión anterior aprobada" : "Sin versión previa"}
              </div>
              <SideView page={prevPage} variant="before" viewBox={sharedViewBox} />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Versión propuesta
              </div>
              <SideView page={nextPage} variant="after" viewBox={sharedViewBox} />
            </div>
          </div>
        )}

        {/* Detail list agrupada */}
        {(active.added.length > 0 ||
          active.removed.length > 0 ||
          active.modified.length > 0 ||
          active.moved.length > 0) && (
          <div className="max-h-44 space-y-2 overflow-auto rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs">
            {active.added.length > 0 && (
              <DetailGroup title="Agregadas" tone="emerald">
                {active.added.map((s) => (
                  <li key={`la-${s.id}`} className="truncate text-emerald-700">+ {s.text || "(sin texto)"}</li>
                ))}
              </DetailGroup>
            )}
            {active.removed.length > 0 && (
              <DetailGroup title="Eliminadas" tone="red">
                {active.removed.map((s) => (
                  <li key={`lr-${s.id}`} className="truncate text-red-700">− {s.text || "(sin texto)"}</li>
                ))}
              </DetailGroup>
            )}
            {active.moved.length > 0 && (
              <DetailGroup title="Movidas" tone="amber">
                {active.moved.map((m) => (
                  <li key={`lmv-${m.after.id}`} className="truncate text-amber-700">↕ {m.after.text || "(sin texto)"}</li>
                ))}
              </DetailGroup>
            )}
            {active.modified.length > 0 && (
              <DetailGroup title="Editadas" tone="sky">
                {active.modified.map((m) => (
                  <li key={`lm-${m.after.id}`} className="truncate text-sky-700">
                    ✎ {m.before.text || "—"} → {m.after.text || "—"}
                  </li>
                ))}
              </DetailGroup>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailGroup({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "red" | "amber" | "sky";
  children: React.ReactNode;
}) {
  const toneCls = {
    emerald: "text-emerald-800",
    red: "text-red-800",
    amber: "text-amber-800",
    sky: "text-sky-800",
  }[tone];
  return (
    <div>
      <div className={cn("mb-0.5 text-[10px] font-semibold uppercase tracking-wide", toneCls)}>
        {title}
      </div>
      <ul className="space-y-0.5 pl-1">{children}</ul>
    </div>
  );
}

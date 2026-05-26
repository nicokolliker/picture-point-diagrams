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
import type { DiagramDocument, Shape, Connector } from "@/lib/shape-types";

type ShapeIndex = Map<string, Shape>;

function indexShapes(doc?: DiagramDocument | null): ShapeIndex {
  const map: ShapeIndex = new Map();
  if (!doc) return map;
  for (const p of doc.pages) for (const s of p.shapes) map.set(s.id, s);
  return map;
}

function indexConnectors(doc?: DiagramDocument | null): Map<string, Connector> {
  const map = new Map<string, Connector>();
  if (!doc) return map;
  for (const p of doc.pages) for (const c of p.connectors) map.set(c.id, c);
  return map;
}

type Diff = {
  added: Shape[];
  removed: Shape[];
  moved: { before: Shape; after: Shape }[];
  modified: { before: Shape; after: Shape }[];
  connectorsAdded: number;
  connectorsRemoved: number;
};

function computeDiff(prev: DiagramDocument | null, next: DiagramDocument): Diff {
  const a = indexShapes(prev);
  const b = indexShapes(next);
  const added: Shape[] = [];
  const removed: Shape[] = [];
  const moved: { before: Shape; after: Shape }[] = [];
  const modified: { before: Shape; after: Shape }[] = [];

  b.forEach((shape, id) => {
    const prevShape = a.get(id);
    if (!prevShape) {
      added.push(shape);
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
    if (positionChanged) moved.push({ before: prevShape, after: shape });
    else if (contentChanged) modified.push({ before: prevShape, after: shape });
  });

  a.forEach((shape, id) => {
    if (!b.has(id)) removed.push(shape);
  });

  const cA = indexConnectors(prev);
  const cB = indexConnectors(next);
  let connectorsAdded = 0;
  let connectorsRemoved = 0;
  cB.forEach((_, id) => {
    if (!cA.has(id)) connectorsAdded++;
  });
  cA.forEach((_, id) => {
    if (!cB.has(id)) connectorsRemoved++;
  });

  return { added, removed, moved, modified, connectorsAdded, connectorsRemoved };
}

function ShapeNode({
  s,
  variant,
}: {
  s: Shape;
  variant: "added" | "removed" | "moved-from" | "moved-to" | "base";
}) {
  const styles = {
    added: { fill: "rgba(16,185,129,0.18)", stroke: "#10b981", dash: undefined as string | undefined },
    removed: { fill: "rgba(239,68,68,0.12)", stroke: "#ef4444", dash: "6,4" },
    "moved-from": { fill: "rgba(245,158,11,0.10)", stroke: "#f59e0b", dash: "5,4" },
    "moved-to": { fill: "rgba(245,158,11,0.22)", stroke: "#f59e0b", dash: undefined },
    base: { fill: "rgba(148,163,184,0.10)", stroke: "#cbd5e1", dash: undefined },
  }[variant];
  const common = {
    fill: styles.fill,
    stroke: styles.stroke,
    strokeWidth: 2,
    strokeDasharray: styles.dash,
  };
  if (s.type === "oval")
    return (
      <ellipse
        cx={s.x + s.width / 2}
        cy={s.y + s.height / 2}
        rx={s.width / 2}
        ry={s.height / 2}
        {...common}
      />
    );
  if (s.type === "diamond") {
    const cx = s.x + s.width / 2;
    const cy = s.y + s.height / 2;
    return (
      <polygon
        points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`}
        {...common}
      />
    );
  }
  return <rect x={s.x} y={s.y} width={s.width} height={s.height} rx={10} {...common} />;
}

function DiffCanvas({
  prev,
  next,
  diff,
}: {
  prev: DiagramDocument | null;
  next: DiagramDocument;
  diff: Diff;
}) {
  const allShapes = useMemo(() => {
    const list: Shape[] = [];
    if (prev) for (const p of prev.pages) list.push(...p.shapes);
    for (const p of next.pages) list.push(...p.shapes);
    return list;
  }, [prev, next]);

  if (allShapes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#94A3B8]">
        Sin cambios visibles
      </div>
    );
  }

  const minX = Math.min(...allShapes.map((s) => s.x));
  const minY = Math.min(...allShapes.map((s) => s.y));
  const maxX = Math.max(...allShapes.map((s) => s.x + s.width));
  const maxY = Math.max(...allShapes.map((s) => s.y + s.height));
  const pad = 60;
  const w = Math.max(maxX - minX + pad * 2, 200);
  const h = Math.max(maxY - minY + pad * 2, 200);
  const vb = `${minX - pad} ${minY - pad} ${w} ${h}`;

  const nextIds = new Set<string>();
  for (const p of next.pages) for (const s of p.shapes) nextIds.add(s.id);

  const baseShapes: Shape[] = [];
  for (const p of next.pages)
    for (const s of p.shapes) {
      if (
        !diff.added.some((x) => x.id === s.id) &&
        !diff.moved.some((m) => m.after.id === s.id)
      ) {
        baseShapes.push(s);
      }
    }

  return (
    <svg viewBox={vb} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      {/* base (unchanged) */}
      {baseShapes.map((s) => (
        <ShapeNode key={`b-${s.id}`} s={s} variant="base" />
      ))}
      {/* removed ghost */}
      {diff.removed.map((s) => (
        <ShapeNode key={`r-${s.id}`} s={s} variant="removed" />
      ))}
      {/* moved before/after with arrow */}
      {diff.moved.map((m) => (
        <g key={`m-${m.after.id}`}>
          <ShapeNode s={m.before} variant="moved-from" />
          <ShapeNode s={m.after} variant="moved-to" />
          <line
            x1={m.before.x + m.before.width / 2}
            y1={m.before.y + m.before.height / 2}
            x2={m.after.x + m.after.width / 2}
            y2={m.after.y + m.after.height / 2}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="3,3"
            markerEnd="url(#arrow)"
          />
        </g>
      ))}
      {/* added */}
      {diff.added.map((s) => (
        <ShapeNode key={`a-${s.id}`} s={s} variant="added" />
      ))}
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#f59e0b" />
        </marker>
      </defs>
    </svg>
  );
}

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
  const diff = useMemo(() => computeDiff(prev, next), [prev, next]);
  const [mode, setMode] = useState<"diff" | "side">("diff");

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <GitCompare className="h-4 w-4" /> Cambios propuestos · {title}
          </DialogTitle>
          <DialogDescription>
            {prev
              ? "Comparación contra la última versión aprobada."
              : "Primera versión enviada — todo es nuevo."}
          </DialogDescription>
        </DialogHeader>

        {/* Summary chips */}
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
            <Plus className="h-3 w-3" /> {diff.added.length} agregadas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-700">
            <Minus className="h-3 w-3" /> {diff.removed.length} eliminadas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700">
            <Move className="h-3 w-3" /> {diff.moved.length} movidas
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
            ✎ {diff.modified.length} editadas
          </span>
          {(diff.connectorsAdded > 0 || diff.connectorsRemoved > 0) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 font-medium text-violet-700">
              <ArrowRight className="h-3 w-3" />
              {diff.connectorsAdded} +/ {diff.connectorsRemoved} − conexiones
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

        {mode === "diff" ? (
          <div className="h-[460px] rounded-xl border border-[#E2E8F0] bg-gradient-to-br from-slate-50 to-white p-2">
            <DiffCanvas prev={prev} next={next} diff={diff} />
          </div>
        ) : !prev ? (
          // First version: no "before" exists, so show a full-width "after" with a clear empty-state explainer.
          <div className="grid h-[460px] grid-cols-[260px_1fr] gap-3">
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <GitCompare className="h-5 w-5 text-slate-400" />
              </div>
              <div className="font-display text-sm font-semibold text-slate-700">Primera versión</div>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Aún no hay versión publicada para comparar. Todo lo de la derecha cuenta como contenido nuevo.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Versión propuesta
              </div>
              <DiffCanvas prev={null} next={next} diff={computeDiff(null, next)} />
            </div>
          </div>
        ) : (
          <div className="grid h-[460px] grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-slate-50 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Versión anterior aprobada
              </div>
              <DiffCanvas prev={null} next={prev} diff={computeDiff(null, prev)} />
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-2">
              <div className="mb-1 px-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                Versión propuesta
              </div>
              <DiffCanvas prev={null} next={next} diff={computeDiff(null, next)} />
            </div>
          </div>
        )}

        {/* Detail list */}
        {(diff.added.length > 0 || diff.removed.length > 0 || diff.modified.length > 0) && (
          <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[#E2E8F0] bg-white p-2 text-xs">
            {diff.added.map((s) => (
              <div key={`la-${s.id}`} className="flex items-center gap-2 text-emerald-700">
                <Plus className="h-3 w-3" /> <span className="truncate">{s.text || "(sin texto)"}</span>
              </div>
            ))}
            {diff.removed.map((s) => (
              <div key={`lr-${s.id}`} className="flex items-center gap-2 text-red-700">
                <Minus className="h-3 w-3" /> <span className="truncate">{s.text || "(sin texto)"}</span>
              </div>
            ))}
            {diff.modified.map((m) => (
              <div key={`lm-${m.after.id}`} className="flex items-center gap-2 text-sky-700">
                ✎ <span className="truncate">{m.before.text || "—"} → {m.after.text || "—"}</span>
              </div>
            ))}
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

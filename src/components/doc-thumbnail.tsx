import type { DiagramDocument, Shape } from "@/lib/shape-types";

type Props = {
  doc: DiagramDocument;
  className?: string;
};

export function DocThumbnail({ doc, className = "" }: Props) {
  const page = doc.pages[0];
  const shapes = page?.shapes ?? [];
  const connectors = page?.connectors ?? [];

  if (shapes.length === 0) {
    return (
      <div className={`flex h-full w-full items-center justify-center text-[#94A3B8] ${className}`}>
        <span className="text-xs">Diagrama vacío</span>
      </div>
    );
  }

  const minX = Math.min(...shapes.map((s) => s.x));
  const minY = Math.min(...shapes.map((s) => s.y));
  const maxX = Math.max(...shapes.map((s) => s.x + s.width));
  const maxY = Math.max(...shapes.map((s) => s.y + s.height));
  const pad = 40;
  const w = Math.max(maxX - minX + pad * 2, 100);
  const h = Math.max(maxY - minY + pad * 2, 100);
  const vb = `${minX - pad} ${minY - pad} ${w} ${h}`;

  const center = (s: Shape) => ({ x: s.x + s.width / 2, y: s.y + s.height / 2 });
  const byId = new Map(shapes.map((s) => [s.id, s]));

  return (
    <svg viewBox={vb} className={`h-full w-full ${className}`} preserveAspectRatio="xMidYMid meet">
      {connectors.map((c) => {
        const from = byId.get(c.fromId);
        const to = byId.get(c.toId);
        if (!from || !to) return null;
        const a = center(from);
        const b = center(to);
        return (
          <line
            key={c.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#CBD5E1"
            strokeWidth={3}
          />
        );
      })}
      {shapes.map((s) => {
        const fill = s.fill ?? "#fff";
        const stroke = "#94A3B8";
        if (s.type === "oval") {
          return (
            <ellipse
              key={s.id}
              cx={s.x + s.width / 2}
              cy={s.y + s.height / 2}
              rx={s.width / 2}
              ry={s.height / 2}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
          );
        }
        if (s.type === "diamond") {
          const cx = s.x + s.width / 2;
          const cy = s.y + s.height / 2;
          return (
            <polygon
              key={s.id}
              points={`${cx},${s.y} ${s.x + s.width},${cy} ${cx},${s.y + s.height} ${s.x},${cy}`}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
          );
        }
        return (
          <rect
            key={s.id}
            x={s.x}
            y={s.y}
            width={s.width}
            height={s.height}
            rx={10}
            fill={fill}
            stroke={stroke}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

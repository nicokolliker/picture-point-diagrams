import type { Person } from "@/lib/shape-types";
import { IconTip } from "@/components/icon-tooltip";

const PALETTE = [
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#F97316", // orange
  "#EC4899", // pink
  "#A855F7", // purple
  "#22C55E", // green
  "#EF4444", // red
  "#F59E0B", // amber
];

export function colorForName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function PersonAvatar({
  person,
  size = 32,
  ring = true,
  withTooltip = true,
}: {
  person: Person;
  size?: number;
  ring?: boolean;
  withTooltip?: boolean;
}) {
  const bg = colorForName(person.name);
  const node = (
    <span
      className={
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white " +
        (ring ? "ring-2 ring-white" : "")
      }
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize: Math.round(size * 0.42),
        lineHeight: 1,
      }}
      aria-label={person.name}
    >
      {initialsOf(person.name)}
    </span>
  );
  if (!withTooltip) return node;
  return (
    <IconTip
      label={
        <span>
          <strong>{person.name}</strong>
          {person.role ? <span className="text-[#9CA3AF]"> · {person.role}</span> : null}
        </span>
      }
    >
      {node}
    </IconTip>
  );
}

export function PersonStack({
  people,
  size = 28,
  max = 3,
}: {
  people: Person[];
  size?: number;
  max?: number;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const overflow = people.length - shown.length;
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <PersonAvatar person={p} size={size} />
        </span>
      ))}
      {overflow > 0 && (
        <IconTip
          label={
            <span>
              {people
                .slice(max)
                .map((p) => p.name)
                .join(", ")}
            </span>
          }
        >
          <span
            className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#6B7280] font-semibold text-white ring-2 ring-white"
            style={{
              width: size,
              height: size,
              marginLeft: -8,
              fontSize: Math.round(size * 0.38),
            }}
          >
            +{overflow}
          </span>
        </IconTip>
      )}
    </div>
  );
}

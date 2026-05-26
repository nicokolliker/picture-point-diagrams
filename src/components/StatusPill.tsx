import { CheckCircle2, Clock, GitCompare } from "lucide-react";
import { cn } from "@/lib/utils";

export type DocStatus = "draft" | "in_review" | "published";

const META: Record<
  DocStatus,
  { label: string; icon: React.ElementType; cls: string; dot: string }
> = {
  draft: {
    label: "Borrador",
    icon: Clock,
    cls: "bg-amber-50 text-amber-800 ring-amber-200",
    dot: "bg-amber-400",
  },
  in_review: {
    label: "En auditoría",
    icon: GitCompare,
    cls: "bg-sky-50 text-sky-800 ring-sky-200",
    dot: "bg-sky-500",
  },
  published: {
    label: "Publicado",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    dot: "bg-emerald-500",
  },
};

export function StatusPill({
  status,
  size = "md",
  className,
  withIcon = true,
}: {
  status: DocStatus;
  size?: "sm" | "md";
  className?: string;
  withIcon?: boolean;
}) {
  const m = META[status] ?? META.draft;
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        m.cls,
        className,
      )}
    >
      {withIcon ? (
        <Icon className={size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"} />
      ) : (
        <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} />
      )}
      {m.label}
    </span>
  );
}

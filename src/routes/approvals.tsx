import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { decidePublishRequest } from "@/lib/approvals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Check, X, Clock, CheckCircle2, XCircle, Inbox, GitCompare } from "lucide-react";
import { DocThumbnail } from "@/components/doc-thumbnail";
import { FlowItLogo } from "@/components/flowit-logo";
import { ChangesDiffModal } from "@/components/ChangesDiffModal";
import type { DiagramDocument } from "@/lib/shape-types";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/approvals")({
  head: () => ({ meta: [{ title: "Approvals — FlowIt" }] }),
  component: ApprovalsPage,
});

type Req = {
  id: string;
  doc_id: string;
  doc_name: string;
  version_number: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  requested_by: string;
  required_approvals: number;
  note: string | null;
  snapshot: DiagramDocument;
  created_at: string;
};

type Approval = {
  request_id: string;
  approver_id: string;
  decision: "approve" | "reject";
  comment: string | null;
};

type Profile = { id: string; email: string; display_name: string | null };
type Tab = "mine" | "pending" | "approved" | "rejected";

function ApprovalsPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [approverDocIds, setApproverDocIds] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("mine");
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState("");
  const [diffFor, setDiffFor] = useState<Req | null>(null);

  const decide = useServerFn(decidePublishRequest);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;
    const [r, a, da, p] = await Promise.all([
      supabase.from("publish_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("approvals").select("request_id,approver_id,decision,comment"),
      supabase.from("doc_approvers").select("doc_id").eq("user_id", user.id),
      supabase.from("profiles").select("id,email,display_name"),
    ]);
    setReqs(((r.data ?? []) as unknown) as Req[]);
    setApprovals((a.data as Approval[]) ?? []);
    setApproverDocIds(new Set((da.data ?? []).map((x: any) => x.doc_id)));
    setProfiles((p.data as Profile[]) ?? []);
  };

  useEffect(() => { refresh(); }, [user?.id]);

  const profileName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p ? p.display_name || p.email : id.slice(0, 8);
  };
  const initials = (id: string) => {
    const name = profileName(id);
    return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  };

  const canApprove = (r: Req) =>
    !!user?.id &&
    r.status === "pending" &&
    (isAdmin || approverDocIds.has(r.doc_id)) &&
    !approvals.some((a) => a.request_id === r.id && a.approver_id === user.id);

  const filtered = useMemo(() => {
    if (!user) return [];
    if (tab === "mine") return reqs.filter((r) => r.status === "pending" && (isAdmin || approverDocIds.has(r.doc_id)) && !approvals.some((a) => a.request_id === r.id && a.approver_id === user.id));
    if (tab === "pending") return reqs.filter((r) => r.status === "pending");
    return reqs.filter((r) => r.status === tab);
  }, [reqs, tab, approverDocIds, approvals, user, isAdmin]);

  const onDecide = async (request_id: string, decision: "approve" | "reject", comment?: string) => {
    try {
      await decide({ data: { request_id, decision, comment } });
      toast.success(decision === "approve" ? "Aprobado" : "Rechazado");
      setRejectFor(null);
      setRejectComment("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const counts = {
    mine: user ? reqs.filter((r) => r.status === "pending" && (isAdmin || approverDocIds.has(r.doc_id)) && !approvals.some((a) => a.request_id === r.id && a.approver_id === user.id)).length : 0,
    pending: reqs.filter((r) => r.status === "pending").length,
    approved: reqs.filter((r) => r.status === "approved").length,
    rejected: reqs.filter((r) => r.status === "rejected").length,
  };

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]"><ArrowLeft className="h-4 w-4" /></Link>
          <FlowItLogo size={26} withWordmark />
          <span className="ml-2 font-display text-sm text-[#94A3B8]">/ Aprobaciones</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-8">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#0F172A]">Aprobaciones</h1>
            <p className="mt-1 text-sm text-[#64748B]">Revisá los pedidos de publicación de procesos.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#E2E8F0]">
          <TabBtn active={tab === "mine"} onClick={() => setTab("mine")} icon={<Inbox className="h-3.5 w-3.5" />} label="Pendientes mías" count={counts.mine} accent />
          <TabBtn active={tab === "pending"} onClick={() => setTab("pending")} icon={<Clock className="h-3.5 w-3.5" />} label="Todas pendientes" count={counts.pending} />
          <TabBtn active={tab === "approved"} onClick={() => setTab("approved")} icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Aprobadas" count={counts.approved} />
          <TabBtn active={tab === "rejected"} onClick={() => setTab("rejected")} icon={<XCircle className="h-3.5 w-3.5" />} label="Rechazadas" count={counts.rejected} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white p-16 text-center">
            <Inbox className="mx-auto h-10 w-10 text-[#CBD5E1]" />
            <p className="mt-3 font-display text-base text-[#475569]">Nada por acá</p>
            <p className="mt-1 text-xs text-[#94A3B8]">No hay pedidos en esta vista.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((r) => {
              const reqApprovals = approvals.filter((a) => a.request_id === r.id);
              const approves = reqApprovals.filter((a) => a.decision === "approve").length;
              const rejects = reqApprovals.filter((a) => a.decision === "reject").length;
              const pct = Math.min(100, (approves / r.required_approvals) * 100);

              return (
                <div key={r.id} className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white transition-all hover:shadow-[0_8px_30px_rgba(14,165,233,0.08)]">
                  {/* Thumbnail */}
                  <div className="relative h-36 border-b border-[#F1F5F9] bg-gradient-to-br from-sky-50 via-cyan-50 to-violet-50">
                    {r.snapshot && <DocThumbnail doc={r.snapshot} />}
                    <div className="absolute right-2 top-2">
                      <StatusBadge status={r.status} />
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-display text-base font-semibold text-[#0F172A]">{r.doc_name}</h3>
                      <Badge variant="outline" className="ml-auto rounded-full border-[#E2E8F0] text-[10px]">v{r.version_number}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[#94A3B8]">
                      {profileName(r.requested_by)} · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                    {r.note && <p className="mt-2 line-clamp-2 text-sm text-[#475569]">{r.note}</p>}

                    {/* Progress */}
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-[#64748B]">
                        <span>{approves} de {r.required_approvals} aprobaciones</span>
                        {rejects > 0 && <span className="text-red-600">{rejects} rechazo{rejects > 1 ? "s" : ""}</span>}
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#F1F5F9]">
                        <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>

                    {/* Approver avatars */}
                    {reqApprovals.length > 0 && (
                      <div className="mt-3 flex -space-x-1.5">
                        {reqApprovals.map((a) => (
                          <div
                            key={a.approver_id + a.decision}
                            title={`${profileName(a.approver_id)} · ${a.decision}`}
                            className={cn(
                              "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white",
                              a.decision === "approve" ? "bg-emerald-500" : "bg-red-500"
                            )}
                          >
                            {initials(a.approver_id)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex gap-2">
                      <Link
                        to="/editor"
                        search={{ doc: r.doc_id }}
                        className="inline-flex flex-1 items-center justify-center rounded-md border border-[#E2E8F0] px-3 py-1.5 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC]"
                      >
                        Ver diagrama
                      </Link>
                      {canApprove(r) && (
                        <>
                          <Button size="sm" className="h-8 flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => onDecide(r.id, "approve")}>
                            <Check className="h-3.5 w-3.5" /> Aprobar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setRejectFor(r.id); setRejectComment(""); }}>
                            <X className="h-3.5 w-3.5" /> Rechazar
                          </Button>
                        </>
                      )}
                    </div>

                    {rejectFor === r.id && (
                      <div className="mt-3 rounded-md border border-red-200 bg-red-50/50 p-3">
                        <Textarea
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          placeholder="Comentario del rechazo (opcional)..."
                          className="min-h-[60px] text-xs"
                        />
                        <div className="mt-2 flex justify-end gap-2">
                          <Button size="sm" variant="outline" className="h-7" onClick={() => setRejectFor(null)}>Cancelar</Button>
                          <Button size="sm" className="h-7 bg-red-600 hover:bg-red-700" onClick={() => onDecide(r.id, "reject", rejectComment)}>Confirmar rechazo</Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, count, accent }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
        active
          ? "border-primary text-[#0F172A] font-medium"
          : "border-transparent text-[#64748B] hover:text-[#0F172A]"
      )}
    >
      {icon}
      {label}
      <span className={cn(
        "ml-1 rounded-full px-1.5 text-[10px] font-semibold",
        accent && count > 0 ? "bg-primary text-white" : "bg-[#F1F5F9] text-[#64748B]"
      )}>{count}</span>
    </button>
  );
}

function StatusBadge({ status }: { status: Req["status"] }) {
  const map = {
    pending: { bg: "bg-amber-100", fg: "text-amber-800", label: "Pendiente" },
    approved: { bg: "bg-emerald-100", fg: "text-emerald-800", label: "Aprobado" },
    rejected: { bg: "bg-red-100", fg: "text-red-800", label: "Rechazado" },
    cancelled: { bg: "bg-slate-100", fg: "text-slate-700", label: "Cancelado" },
  }[status];
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold", map.bg, map.fg)}>{map.label}</span>;
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { decidePublishRequest } from "@/lib/approvals.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Check, X } from "lucide-react";

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
  created_at: string;
};

type Approval = {
  request_id: string;
  approver_id: string;
  decision: "approve" | "reject";
  comment: string | null;
};

function ApprovalsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [reqs, setReqs] = useState<Req[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [approverDocIds, setApproverDocIds] = useState<Set<string>>(new Set());
  const decide = useServerFn(decidePublishRequest);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  const refresh = async () => {
    if (!user) return;
    const [r, a, da] = await Promise.all([
      supabase.from("publish_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("approvals").select("request_id,approver_id,decision,comment"),
      supabase.from("doc_approvers").select("doc_id").eq("user_id", user.id),
    ]);
    setReqs((r.data as Req[]) ?? []);
    setApprovals((a.data as Approval[]) ?? []);
    setApproverDocIds(new Set((da.data ?? []).map((x: any) => x.doc_id)));
  };

  useEffect(() => {
    refresh();
  }, [user?.id]);

  const onDecide = async (request_id: string, decision: "approve" | "reject") => {
    try {
      await decide({ data: { request_id, decision } });
      toast.success(`Marked as ${decision}d`);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const canDecide = (r: Req) =>
    user?.id &&
    r.status === "pending" &&
    (approverDocIds.has(r.doc_id) || /* super_admin fallback handled by RLS */ false) &&
    !approvals.some((a) => a.request_id === r.id && a.approver_id === user.id);

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-semibold">Approvals</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-3 p-8">
        {reqs.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-[#9CA3AF]">
            No publish requests yet.
          </div>
        )}
        {reqs.map((r) => {
          const reqApprovals = approvals.filter((a) => a.request_id === r.id);
          const approves = reqApprovals.filter((a) => a.decision === "approve").length;
          return (
            <div key={r.id} className="rounded-lg border border-[#EBEBEB] bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium">
                    {r.doc_name} <span className="text-[#9CA3AF]">v{r.version_number}</span>
                  </div>
                  <div className="mt-1 text-xs text-[#6B7280]">
                    Requested {new Date(r.created_at).toLocaleString()}
                  </div>
                  {r.note && <p className="mt-2 text-sm text-[#374151]">{r.note}</p>}
                  <div className="mt-2 text-xs text-[#6B7280]">
                    {approves}/{r.required_approvals} approvals
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      r.status === "approved"
                        ? "border-green-500 text-green-700"
                        : r.status === "rejected"
                          ? "border-red-500 text-red-700"
                          : "border-amber-500 text-amber-700"
                    }
                  >
                    {r.status}
                  </Badge>
                  {canDecide(r) && (
                    <>
                      <Button size="sm" onClick={() => onDecide(r.id, "approve")} className="bg-green-600 hover:bg-green-700">
                        <Check className="h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onDecide(r.id, "reject")}>
                        <X className="h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}

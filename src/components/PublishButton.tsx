import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createPublishRequest } from "@/lib/approvals.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Send, Check, X } from "lucide-react";
import type { DiagramDocument } from "@/lib/shape-types";

type Req = {
  id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  required_approvals: number;
};
type Approval = { request_id: string; decision: "approve" | "reject" };

export function PublishButton({ doc }: { doc: DiagramDocument }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState<Req | null>(null);
  const [approves, setApproves] = useState(0);
  const create = useServerFn(createPublishRequest);

  const refresh = async () => {
    const { data } = await supabase
      .from("publish_requests")
      .select("id,status,required_approvals")
      .eq("doc_id", doc.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const r = (data?.[0] as Req | undefined) ?? null;
    setLatest(r);
    if (r) {
      const { data: a } = await supabase
        .from("approvals")
        .select("request_id,decision")
        .eq("request_id", r.id);
      setApproves(((a as Approval[]) ?? []).filter((x) => x.decision === "approve").length);
    } else {
      setApproves(0);
    }
  };

  useEffect(() => {
    if (user) refresh();
  }, [user?.id, doc.id]);

  const onSubmit = async () => {
    setBusy(true);
    try {
      await create({
        data: {
          doc_id: doc.id,
          doc_name: doc.name,
          version_number: 1,
          snapshot: doc,
          note: note || undefined,
        },
      });
      toast.success("Publish request submitted");
      setOpen(false);
      setNote("");
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const statusColor =
    latest?.status === "approved"
      ? "border-green-500 text-green-700"
      : latest?.status === "rejected"
        ? "border-red-500 text-red-700"
        : "border-amber-500 text-amber-700";

  return (
    <div className="flex items-center gap-2">
      {latest && (
        <Badge variant="outline" className={statusColor}>
          {latest.status === "approved" ? (
            <Check className="mr-1 h-3 w-3" />
          ) : latest.status === "rejected" ? (
            <X className="mr-1 h-3 w-3" />
          ) : null}
          {latest.status === "pending"
            ? `Pending ${approves}/${latest.required_approvals}`
            : latest.status}
        </Badge>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8">
            <Send className="h-4 w-4" /> Request publish
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request publish</DialogTitle>
            <DialogDescription>
              A snapshot of the current document will be sent to the assigned approvers.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional message for approvers…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={onSubmit}
              className="bg-[#5B6CF8] hover:bg-[#4856E0]"
            >
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

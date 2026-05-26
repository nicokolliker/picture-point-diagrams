import { supabase } from "@/integrations/supabase/client";
import { useDiagramStore } from "@/lib/diagram-store";
import type { DiagramDocument } from "@/lib/shape-types";

/**
 * Pulls all approved publish_requests and applies any not yet merged
 * into the local document store. Should be invoked periodically (on
 * Home mount, after returning from /approvals, etc.).
 */
export async function syncApprovedSnapshots() {
  const { data: reqs, error } = await supabase
    .from("publish_requests")
    .select("id, doc_id, version_number, snapshot, requested_by, note, updated_at, created_at, status")
    .eq("status", "approved")
    .order("updated_at", { ascending: true });
  if (error || !reqs) return;

  const { data: approvals } = await supabase
    .from("approvals")
    .select("request_id, approver_id, decision");

  const docs = useDiagramStore.getState().documents;
  const apply = useDiagramStore.getState().applyApprovedSnapshot;

  for (const r of reqs as any[]) {
    const local = docs.find((d) => d.id === r.doc_id);
    if (!local) continue;
    if (local.lastSyncedRequestId === r.id) continue;
    const snapshot = r.snapshot as DiagramDocument | null;
    if (!snapshot) continue;
    const approverIds = (approvals ?? [])
      .filter((a: any) => a.request_id === r.id && a.decision === "approve")
      .map((a: any) => a.approver_id as string);
    const approvedAt = new Date(r.updated_at ?? r.created_at).getTime();
    apply(r.doc_id, snapshot, {
      requestId: r.id,
      versionNumber: r.version_number,
      approvedAt,
      requesterId: r.requested_by,
      approverIds,
      note: r.note ?? undefined,
      forkedFromDocId: snapshot.id !== r.doc_id ? snapshot.id : undefined,
    });
  }
}

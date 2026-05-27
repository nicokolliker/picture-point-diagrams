import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface LatestRequestInfo {
  doc_id: string;
  request_id: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
  reject_comments: string[];
}

/**
 * Fetches the most recent publish_request per docId and, for rejected ones,
 * the rejection comments. Lightweight client-side join.
 */
export function useLatestRequests(docIds: string[]) {
  const [byDoc, setByDoc] = useState<Record<string, LatestRequestInfo>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (docIds.length === 0) {
      setByDoc({});
      return;
    }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data: reqs } = await supabase
        .from("publish_requests")
        .select("id, doc_id, status, created_at")
        .in("doc_id", docIds)
        .order("created_at", { ascending: false });
      const latestByDoc = new Map<string, { id: string; status: any; created_at: string }>();
      for (const r of (reqs as any[]) ?? []) {
        if (!latestByDoc.has(r.doc_id)) {
          latestByDoc.set(r.doc_id, { id: r.id, status: r.status, created_at: r.created_at });
        }
      }
      const rejectedIds = [...latestByDoc.values()].filter((x) => x.status === "rejected").map((x) => x.id);
      let commentsByReq = new Map<string, string[]>();
      if (rejectedIds.length > 0) {
        const { data: aps } = await supabase
          .from("approvals")
          .select("request_id, decision, comment")
          .in("request_id", rejectedIds)
          .eq("decision", "reject");
        for (const a of (aps as any[]) ?? []) {
          if (!a.comment) continue;
          if (!commentsByReq.has(a.request_id)) commentsByReq.set(a.request_id, []);
          commentsByReq.get(a.request_id)!.push(a.comment);
        }
      }
      if (!alive) return;
      const out: Record<string, LatestRequestInfo> = {};
      latestByDoc.forEach((v, doc_id) => {
        out[doc_id] = {
          doc_id,
          request_id: v.id,
          status: v.status,
          created_at: v.created_at,
          reject_comments: commentsByReq.get(v.id) ?? [],
        };
      });
      setByDoc(out);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [docIds.join(",")]);

  return { byDoc, loading };
}

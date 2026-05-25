import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createPublishRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        doc_id: z.string().min(1),
        doc_name: z.string().min(1),
        version_number: z.number().int().min(1).default(1),
        snapshot: z.any(),
        note: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: approvers } = await supabase
      .from("doc_approvers")
      .select("user_id, required_count")
      .eq("doc_id", data.doc_id);
    const required =
      approvers && approvers.length > 0
        ? Math.max(...approvers.map((a) => a.required_count))
        : 1;

    const { data: req, error } = await supabase
      .from("publish_requests")
      .insert({
        doc_id: data.doc_id,
        doc_name: data.doc_name,
        version_number: data.version_number,
        snapshot: data.snapshot,
        requested_by: userId,
        required_approvals: required,
        note: data.note ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return req;
  });

export const decidePublishRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        request_id: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        comment: z.string().max(2000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("approvals").insert({
      request_id: data.request_id,
      approver_id: userId,
      decision: data.decision,
      comment: data.comment ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

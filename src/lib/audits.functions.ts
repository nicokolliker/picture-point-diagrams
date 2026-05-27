import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Severity = z.enum(["info", "opportunity", "risk", "blocker"]);

export const openAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        doc_id: z.string().min(1).max(120),
        doc_name: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Re-use any existing open audit by this auditor.
    const { data: existing } = await supabase
      .from("audits")
      .select("*")
      .eq("doc_id", data.doc_id)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return existing;
    const { data: row, error } = await supabase
      .from("audits")
      .insert({
        doc_id: data.doc_id,
        doc_name: data.doc_name,
        auditor_id: userId,
        status: "open",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const addFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        audit_id: z.string().uuid(),
        page_id: z.string().max(120).nullable().optional(),
        shape_id: z.string().max(120).nullable().optional(),
        severity: Severity,
        title: z.string().min(1).max(200),
        description: z.string().max(4000).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("audit_findings")
      .insert({
        audit_id: data.audit_id,
        page_id: data.page_id ?? null,
        shape_id: data.shape_id ?? null,
        severity: data.severity,
        title: data.title,
        description: data.description ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("audit_findings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        audit_id: z.string().uuid(),
        summary: z.string().max(4000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("audits")
      .update({
        status: "closed",
        summary: data.summary ?? null,
        closed_at: new Date().toISOString(),
      })
      .eq("id", data.audit_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markFindingPromoted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        finding_id: z.string().uuid(),
        promoted_to_doc_id: z.string().min(1).max(120),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("audit_findings")
      .update({ promoted_to_doc_id: data.promoted_to_doc_id })
      .eq("id", data.finding_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

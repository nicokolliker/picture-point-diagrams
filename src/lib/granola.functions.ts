import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/granola";

export const listGranolaNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const granolaKey = process.env.GRANOLA_API_KEY;
    if (!lovableKey || !granolaKey)
      throw new Error("Granola is not connected. Connect it in Lovable Cloud connectors.");

    const res = await fetch(`${GATEWAY}/v1/notes?limit=30`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": granolaKey,
      },
    });
    if (!res.ok) throw new Error(`Granola API ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { notes?: Array<{ id: string; title?: string; created_at?: string }> };
    return data.notes ?? [];
  });

export const generateFlowchartFromNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ note_id: z.string().min(1) }).parse(i))
  .handler(async ({ data, context }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const granolaKey = process.env.GRANOLA_API_KEY;
    if (!lovableKey || !granolaKey) throw new Error("Granola is not connected.");

    // 1. Fetch note with transcript
    const noteRes = await fetch(`${GATEWAY}/v1/notes/${data.note_id}?include=transcript`, {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": granolaKey,
      },
    });
    if (!noteRes.ok) throw new Error(`Granola note fetch failed: ${noteRes.status}`);
    const note = (await noteRes.json()) as {
      id: string;
      title?: string;
      summary?: string;
      transcript?: string;
    };

    // 2. Log import attempt
    const { supabase, userId } = context;
    await supabase.from("granola_imports").insert({
      user_id: userId,
      note_id: note.id,
      note_title: note.title ?? null,
      status: "generating",
    });

    // 3. Ask Lovable AI to extract a flowchart
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You convert meeting notes describing a process into a flowchart. Reply with strict JSON only matching: {\"name\":string,\"shapes\":[{\"id\":string,\"type\":\"oval\"|\"rectangle\"|\"diamond\",\"label\":string}],\"connectors\":[{\"from\":string,\"to\":string,\"label\"?:string}]}. Use 'oval' for start/end, 'diamond' for decisions, 'rectangle' for steps.",
          },
          {
            role: "user",
            content: `Title: ${note.title ?? ""}\n\nSummary:\n${note.summary ?? ""}\n\nTranscript:\n${(note.transcript ?? "").slice(0, 12000)}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (aiRes.status === 429) throw new Error("Rate limit hit. Try again shortly.");
    if (aiRes.status === 402) throw new Error("Credits exhausted. Add credits in workspace settings.");
    if (!aiRes.ok) throw new Error(`AI request failed: ${aiRes.status}`);

    const aiJson = (await aiRes.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const raw = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: { name?: string; shapes?: any[]; connectors?: any[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned malformed JSON");
    }

    await supabase
      .from("granola_imports")
      .update({ status: "ready" })
      .eq("note_id", note.id)
      .eq("user_id", userId);

    return {
      name: parsed.name ?? note.title ?? "Imported from Granola",
      shapes: parsed.shapes ?? [],
      connectors: parsed.connectors ?? [],
    };
  });

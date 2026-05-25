import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXTRACTION_SYSTEM = `You convert process descriptions into a flowchart. Reply with STRICT JSON only matching: {"name":string,"shapes":[{"id":string,"type":"oval"|"rectangle"|"diamond","label":string}],"connectors":[{"from":string,"to":string,"label"?:string}]}. Use 'oval' for start/end, 'diamond' for decisions, 'rectangle' for steps. Use short ids like "s1","s2". Labels in the user's language.`;

async function callLovable(body: unknown) {
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lovableKey}`,
    },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Rate limit. Probá en un momento.");
  if (res.status === 402) throw new Error("Sin créditos. Agregá créditos en la workspace.");
  if (!res.ok) throw new Error(`AI request failed: ${res.status}`);
  const json = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return json.choices?.[0]?.message?.content ?? "{}";
}

export const extractFlowchartFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ text: z.string().min(1).max(40000) }).parse(i),
  )
  .handler(async ({ data }) => {
    const raw = await callLovable({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM },
        { role: "user", content: data.text },
      ],
      response_format: { type: "json_object" },
    });
    let parsed: { name?: string; shapes?: any[]; connectors?: any[] } = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned malformed JSON");
    }
    return {
      name: parsed.name ?? "Proceso capturado",
      shapes: parsed.shapes ?? [],
      connectors: parsed.connectors ?? [],
    };
  });

const ChatTurnInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(0).max(8000),
      }),
    )
    .min(1)
    .max(60),
});

const CHATBOT_SYSTEM = `You help document a business process by chatting with the user in their language (default Spanish). Ask ONE concise question at a time covering, in order: 1) Context (name, purpose, frequency) 2) Trigger 3) Actors 4) Steps 5) Decision points 6) Tools 7) Exceptions 8) Metrics 9) Improvements.

After each user answer, extract any process info and update the diagram. Reply with STRICT JSON ONLY matching:
{
 "question": string,
 "progress": number (0-100),
 "updates": {
   "addShapes"?: [{"id":string,"type":"oval"|"rectangle"|"diamond","label":string}],
   "addConnectors"?: [{"from":string,"to":string,"label"?:string}],
   "updateShape"?: {"id":string,"fields":{"label"?:string,"type"?:"oval"|"rectangle"|"diamond"}}
 },
 "done": boolean
}

Use ids "s1","s2"… Reuse existing ids when refining. Start the conversation with: "¿Cómo se llama este proceso y para qué existe?" Set done=true once all blocks are reasonably covered.`;

export const chatbotProcessTurn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => ChatTurnInput.parse(i))
  .handler(async ({ data }) => {
    const raw = await callLovable({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "system", content: CHATBOT_SYSTEM }, ...data.messages],
      response_format: { type: "json_object" },
    });
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI returned malformed JSON");
    }
    return {
      question: String(parsed.question ?? ""),
      progress: Math.max(0, Math.min(100, Number(parsed.progress ?? 0))),
      updates: parsed.updates ?? {},
      done: Boolean(parsed.done ?? false),
    };
  });

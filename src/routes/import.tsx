import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listGranolaNotes, generateFlowchartFromNote } from "@/lib/granola.functions";
import { buildDocFromAI } from "@/lib/granola-to-doc";
import { useDiagramStore } from "@/lib/diagram-store";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ArrowLeft, Sparkles, FileText } from "lucide-react";

export const Route = createFileRoute("/import")({
  head: () => ({ meta: [{ title: "Import from Granola — FlowIt" }] }),
  component: ImportPage,
});

type Note = { id: string; title?: string; created_at?: string };

function ImportPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const listNotes = useServerFn(listGranolaNotes);
  const generate = useServerFn(generateFlowchartFromNote);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    listNotes()
      .then((n) => setNotes(n as Note[]))
      .catch((e) => setErr(e.message));
  }, [user?.id]);

  const onImport = async (noteId: string) => {
    setBusy(noteId);
    try {
      const flow = await generate({ data: { note_id: noteId } });
      const doc = buildDocFromAI(flow);
      // Inject directly into store
      useDiagramStore.setState((s) => ({ documents: [doc, ...s.documents] }));
      toast.success("Flowchart generated");
      navigate({ to: "/editor", search: { doc: doc.id } });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-4 w-4 text-[#5B6CF8]" /> Import from Granola
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 p-8">
        {err && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {err}
          </div>
        )}
        {!notes && !err && <div className="text-[#6B7280]">Loading meetings…</div>}
        {notes?.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-[#9CA3AF]">
            No Granola meetings found.
          </div>
        )}
        {notes?.map((n) => (
          <div
            key={n.id}
            className="flex items-center justify-between rounded-lg border border-[#EBEBEB] bg-white p-4"
          >
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#9CA3AF]" />
              <div>
                <div className="font-medium">{n.title ?? "Untitled meeting"}</div>
                {n.created_at && (
                  <div className="text-xs text-[#6B7280]">
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
            <Button
              size="sm"
              disabled={busy === n.id}
              onClick={() => onImport(n.id)}
              className="bg-[#5B6CF8] hover:bg-[#4856E0]"
            >
              {busy === n.id ? "Generating…" : "Generate flowchart"}
            </Button>
          </div>
        ))}
      </main>
    </div>
  );
}

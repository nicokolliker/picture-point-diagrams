import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle, ExternalLink, Mic, MessageCircle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FlowItLogo } from "@/components/flowit-logo";

export const Route = createFileRoute("/integrations")({
  head: () => ({ meta: [{ title: "Integrations — FlowIt" }] }),
  component: IntegrationsPage,
});

type Import = { id: string; note_id: string; note_title: string | null; status: string; generated_doc_id: string | null; created_at: string };

function IntegrationsPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [imports, setImports] = useState<Import[]>([]);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [loading, user, navigate]);
  useEffect(() => {
    if (!user) return;
    supabase
      .from("granola_imports")
      .select("id,note_id,note_title,status,generated_doc_id,created_at")
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => setImports((data as Import[]) ?? []));
  }, [user]);

  return (
    <div className="min-h-screen bg-[#FAFAFB]">
      <header className="flex h-14 items-center justify-between border-b border-[#EBEBEB] bg-white px-4">
        <div className="flex items-center gap-3">
          <Link to="/home" className="text-[#6B7280] hover:text-[#111827]"><ArrowLeft className="h-4 w-4" /></Link>
          <FlowItLogo size={26} withWordmark />
          <span className="ml-2 font-display text-sm text-[#94A3B8]">/ Integrations</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#0F172A]">Integraciones</h1>
          <p className="mt-1 text-sm text-[#64748B]">Conectá FlowIt con tus herramientas favoritas.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Granola */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-sky-100 to-violet-100 text-sky-600">
                  <Mic className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-lg font-semibold">Granola</h2>
                    <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
                    </Badge>
                  </div>
                  <p className="text-xs text-[#64748B]">Notas y transcripciones de reuniones.</p>
                </div>
              </div>
            </div>
            <p className="mt-3 text-sm text-[#475569]">
              Importá notas de Granola y convertilas en diagramas con IA desde "Capturar proceso".
            </p>

            <div className="mt-4 rounded-xl border border-[#F1F5F9] bg-[#F8FAFC] p-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#64748B]">Importaciones recientes</div>
              {imports.length === 0 ? (
                <div className="py-2 text-xs text-[#94A3B8]">Todavía no importaste ninguna nota.</div>
              ) : (
                <ul className="space-y-1.5">
                  {imports.map((i) => (
                    <li key={i.id} className="flex items-center justify-between text-xs">
                      <span className="truncate text-[#475569]">{i.note_title ?? i.note_id.slice(0, 8)}</span>
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={
                            i.status === "done"
                              ? "border-emerald-300 text-emerald-700"
                              : i.status === "error"
                                ? "border-red-300 text-red-700"
                                : "border-amber-300 text-amber-700"
                          }
                        >
                          {i.status}
                        </Badge>
                        {i.generated_doc_id && (
                          <Link to="/editor" search={{ doc: i.generated_doc_id }} className="text-sky-600 hover:underline">
                            Abrir
                          </Link>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <Button className="bg-primary hover:bg-primary/90" onClick={() => navigate({ to: "/home" })}>
                <MessageCircle className="h-4 w-4" /> Capturar proceso
              </Button>
              <a
                href="https://granola.ai"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] px-3 py-1.5 text-sm text-[#475569] hover:bg-[#F8FAFC]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Granola
              </a>
            </div>
          </div>

          {/* Placeholders */}
          {[
            { name: "Slack", desc: "Notificaciones y aprobaciones en canales.", icon: MessageCircle },
            { name: "Notion", desc: "Sincronizar procesos como páginas.", icon: FileText },
          ].map((it) => (
            <div key={it.name} className="rounded-2xl border border-dashed border-[#E2E8F0] bg-white/60 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F1F5F9] text-[#94A3B8]">
                    <it.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-lg font-semibold text-[#475569]">{it.name}</h2>
                      <Badge variant="outline" className="text-[#94A3B8]">
                        <AlertCircle className="mr-1 h-3 w-3" /> Próximamente
                      </Badge>
                    </div>
                    <p className="text-xs text-[#94A3B8]">{it.desc}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

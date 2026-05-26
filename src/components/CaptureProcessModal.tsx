import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Bot, FileText as FileTextIcon, Mic, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PeoplePicker } from "@/components/people-picker";
import { useDiagramStore } from "@/lib/diagram-store";
import { buildDocFromAI, type AIFlowchart } from "@/lib/granola-to-doc";
import { listGranolaNotes, generateFlowchartFromNote } from "@/lib/granola.functions";
import {
  extractFlowchartFromText,
  chatbotProcessTurn,
} from "@/lib/capture.functions";

type View = "picker" | "granola" | "chatbot" | "manual";
type Note = { id: string; title?: string; created_at?: string };

export function CaptureProcessModal({
  open,
  onClose,
  defaultAreaIds,
}: {
  open: boolean;
  onClose: () => void;
  defaultAreaIds?: string[];
}) {
  const navigate = useNavigate();
  const [view, setView] = useState<View>("picker");
  const [ejecutor, setEjecutor] = useState<string[]>([]);
  const [receptor, setReceptor] = useState<string[]>([]);
  const [incendios, setIncendios] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      setView("picker");
      setEjecutor([]);
      setReceptor([]);
      setIncendios([]);
    }
  }, [open]);

  if (!open) return null;

  const allPeople = [...ejecutor, ...receptor, ...incendios];

  const finish = (flow: AIFlowchart) => {
    const doc = buildDocFromAI(flow);
    if (defaultAreaIds && defaultAreaIds.length > 0) {
      doc.areaIds = [...defaultAreaIds];
      doc.areaId = defaultAreaIds[0];
    }
    if (allPeople.length > 0) {
      doc.pages.forEach((p) =>
        p.shapes.forEach((s) => {
          s.responsableIds = [...allPeople];
        }),
      );
    }
    useDiagramStore.setState((s) => ({ documents: [doc, ...s.documents] }));
    toast.success("Proceso generado");
    onClose();
    navigate({ to: "/editor", search: { doc: doc.id } });
  };

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col bg-white">
      <header className="flex h-12 items-center justify-between border-b border-[#EBEBEB] px-4">
        <div className="flex items-center gap-3">
          {view !== "picker" && (
            <button
              onClick={() => setView("picker")}
              className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <h2 className="text-sm font-semibold text-[#111827]">Capturar proceso nuevo</h2>
        </div>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-[#F3F4F6]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="flex-1 overflow-auto">
        {view === "picker" && (
          <PickerView
            onPick={setView}
            ejecutor={ejecutor}
            receptor={receptor}
            incendios={incendios}
            setEjecutor={setEjecutor}
            setReceptor={setReceptor}
            setIncendios={setIncendios}
          />
        )}
        {view === "granola" && <GranolaView onDone={finish} />}
        {view === "chatbot" && <ChatbotView onDone={finish} />}
        {view === "manual" && <ManualView onDone={finish} />}
      </div>
    </div>
  );
}

function PickerView({
  onPick,
  ejecutor,
  receptor,
  incendios,
  setEjecutor,
  setReceptor,
  setIncendios,
}: {
  onPick: (v: View) => void;
  ejecutor: string[];
  receptor: string[];
  incendios: string[];
  setEjecutor: (v: string[]) => void;
  setReceptor: (v: string[]) => void;
  setIncendios: (v: string[]) => void;
}) {
  const cards = [
    {
      id: "chatbot" as View,
      icon: Bot,
      color: "#5B6CF8",
      title: "AI Chatbot",
      desc: "Claude te pregunta y construye el diagrama mientras respondés.",
      cta: "Empezar →",
    },
    {
      id: "granola" as View,
      icon: Mic,
      color: "#EA580C",
      title: "Reunión Granola",
      desc: "Importá una reunión grabada con Granola.",
      cta: "Elegir reunión →",
    },
    {
      id: "manual" as View,
      icon: FileTextIcon,
      color: "#16A34A",
      title: "Notas manuales",
      desc: "Pegá tus notas y Claude extrae el proceso.",
      cta: "Pegar notas →",
    },
  ];
  return (
    <div className="mx-auto max-w-5xl space-y-10 p-10">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="group flex flex-col rounded-xl border border-[#EBEBEB] bg-white p-5 text-left transition-colors hover:border-[#5B6CF8]"
            >
              <div
                className="mb-4 flex h-8 w-8 items-center justify-center rounded-full"
                style={{ background: `${c.color}1A`, color: c.color }}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="text-[15px] font-semibold text-[#111827]">{c.title}</div>
              <p className="mt-1 flex-1 text-[13px] text-[#6B7280]">{c.desc}</p>
              <div className="mt-4 text-[13px] font-medium text-[#5B6CF8]">{c.cta}</div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#111827]">
          ¿A quién vas a entrevistar?
        </h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <RoleField label="Ejecutor" ids={ejecutor} onChange={setEjecutor} />
          <RoleField label="Receptor" ids={receptor} onChange={setReceptor} />
          <RoleField
            label="Apaga incendios"
            ids={incendios}
            onChange={setIncendios}
          />
        </div>
      </div>
    </div>
  );
}

function RoleField({
  label,
  ids,
  onChange,
}: {
  label: string;
  ids: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-[#374151]">{label}</div>
      <PeoplePicker selectedIds={ids} onChange={onChange} />
    </div>
  );
}

function GranolaView({ onDone }: { onDone: (flow: AIFlowchart) => void }) {
  const listNotes = useServerFn(listGranolaNotes);
  const generate = useServerFn(generateFlowchartFromNote);
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    listNotes()
      .then((n) => setNotes(n as Note[]))
      .catch((e) => setErr(e.message));
  }, []);

  const run = async (id: string) => {
    setBusy(id);
    try {
      const flow = await generate({ data: { note_id: id } });
      onDone(flow as AIFlowchart);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-8">
      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      )}
      {!notes && !err && <div className="text-[#6B7280]">Cargando reuniones…</div>}
      {notes?.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-[#9CA3AF]">
          No hay reuniones disponibles en Granola.
        </div>
      )}
      {notes?.map((n) => (
        <div
          key={n.id}
          className="flex items-center justify-between rounded-lg border border-[#EBEBEB] bg-white p-4"
        >
          <div>
            <div className="font-medium">{n.title ?? "Sin título"}</div>
            {n.created_at && (
              <div className="text-xs text-[#6B7280]">
                {new Date(n.created_at).toLocaleString()}
              </div>
            )}
          </div>
          <Button
            size="sm"
            disabled={busy === n.id}
            onClick={() => run(n.id)}
            className="bg-[#5B6CF8] hover:bg-[#4856E0]"
          >
            {busy === n.id ? "Generando…" : "Generar proceso"}
          </Button>
        </div>
      ))}
    </div>
  );
}

function ManualView({ onDone }: { onDone: (flow: AIFlowchart) => void }) {
  const extract = useServerFn(extractFlowchartFromText);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const flow = await extract({ data: { text } });
      onDone(flow as AIFlowchart);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-8">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Pegá aquí tus notas, la transcripción de una reunión, o cualquier texto que describa el proceso…"
        className="min-h-[320px] flex-1 resize-none"
      />
      <div className="flex justify-end">
        <Button
          disabled={busy || !text.trim()}
          onClick={run}
          className="bg-[#5B6CF8] hover:bg-[#4856E0]"
        >
          <Sparkles className="h-4 w-4" />
          {busy ? "Generando…" : "Generar proceso"}
        </Button>
      </div>
    </div>
  );
}

type PreviewShape = { id: string; type: "oval" | "rectangle" | "diamond"; label: string };
type PreviewConn = { from: string; to: string; label?: string };

function ChatbotView({ onDone }: { onDone: (flow: AIFlowchart) => void }) {
  const turn = useServerFn(chatbotProcessTurn);
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [input, setInput] = useState("");
  const [shapes, setShapes] = useState<PreviewShape[]>([]);
  const [connectors, setConnectors] = useState<PreviewConn[]>([]);
  const [progress, setProgress] = useState(0);
  const [name, setName] = useState("Proceso capturado");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const send = async (userMsg?: string) => {
    if (busy) return;
    const next = userMsg
      ? [...messages, { role: "user" as const, content: userMsg }]
      : [...messages];
    if (userMsg) setMessages(next);
    setBusy(true);
    try {
      const res = await turn({ data: { messages: next.length ? next : [{ role: "user", content: "Empezá" }] } });
      setMessages((m) => [...(userMsg ? m : m), { role: "assistant", content: res.question }]);
      setProgress(res.progress);
      const u = res.updates ?? {};
      if (Array.isArray(u.addShapes) && u.addShapes.length) {
        setShapes((prev) => {
          const ids = new Set(prev.map((s) => s.id));
          const add = (u.addShapes as PreviewShape[]).filter((s) => !ids.has(s.id));
          return [...prev, ...add];
        });
      }
      if (Array.isArray(u.addConnectors) && u.addConnectors.length) {
        setConnectors((prev) => [...prev, ...(u.addConnectors as PreviewConn[])]);
      }
      if (u.updateShape?.id) {
        setShapes((prev) =>
          prev.map((s) => (s.id === u.updateShape.id ? { ...s, ...u.updateShape.fields } : s)),
        );
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    send();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, busy]);

  const finalize = () => {
    if (shapes.length === 0) {
      toast.error("Aún no hay nada para generar");
      return;
    }
    onDone({ name, shapes, connectors });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const v = input.trim();
    setInput("");
    send(v);
  };

  return (
    <div className="grid h-full grid-cols-[40%_60%]">
      {/* Chat */}
      <div className="flex h-[calc(100vh-48px)] flex-col border-r border-[#EBEBEB]">
        <div className="border-b border-[#EBEBEB] p-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-sm font-medium outline-none"
          />
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
            <div
              className="h-full bg-[#5B6CF8] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-auto p-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-[#5B6CF8] px-3 py-2 text-sm text-white"
                    : "max-w-[85%] text-sm text-[#111827]"
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="text-xs text-[#9CA3AF]">Claude está pensando…</div>}
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-[#EBEBEB] p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tu respuesta…"
            className="flex-1 rounded-md border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#5B6CF8]"
          />
          <Button type="submit" disabled={busy || !input.trim()} className="bg-[#5B6CF8] hover:bg-[#4856E0]">
            <Send className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={progress < 60 || busy}
            onClick={finalize}
          >
            Finalizar
          </Button>
        </form>
      </div>

      {/* Live preview */}
      <div className="h-[calc(100vh-48px)] overflow-auto bg-[#FAFAFA] p-6">
        <LivePreview shapes={shapes} connectors={connectors} />
      </div>
    </div>
  );
}

function LivePreview({
  shapes,
  connectors,
}: {
  shapes: PreviewShape[];
  connectors: PreviewConn[];
}) {
  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    shapes.forEach((s, i) => {
      map.set(s.id, { x: 60 + (i % 3) * 220, y: 40 + Math.floor(i / 3) * 130 });
    });
    return map;
  }, [shapes]);

  const W = 160;
  const H = 80;
  const rows = Math.max(1, Math.ceil(shapes.length / 3));
  const height = 40 + rows * 130;

  if (shapes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[#9CA3AF]">
        El diagrama va a aparecer acá mientras chateás…
      </div>
    );
  }

  return (
    <svg width="100%" viewBox={`0 0 720 ${height}`} className="block">
      {connectors.map((c, i) => {
        const a = positions.get(c.from);
        const b = positions.get(c.to);
        if (!a || !b) return null;
        const x1 = a.x + W / 2;
        const y1 = a.y + H / 2;
        const x2 = b.x + W / 2;
        const y2 = b.y + H / 2;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#9CA3AF"
            strokeWidth={1.5}
            markerEnd="url(#arrow)"
          />
        );
      })}
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#9CA3AF" />
        </marker>
      </defs>
      {shapes.map((s) => {
        const p = positions.get(s.id)!;
        const common = {
          fill: "#FFFFFF",
          stroke: "#5B6CF8",
          strokeWidth: 1.5,
        } as const;
        return (
          <g key={s.id}>
            {s.type === "diamond" ? (
              <polygon
                points={`${p.x + W / 2},${p.y} ${p.x + W},${p.y + H / 2} ${p.x + W / 2},${p.y + H} ${p.x},${p.y + H / 2}`}
                {...common}
              />
            ) : s.type === "oval" ? (
              <ellipse cx={p.x + W / 2} cy={p.y + H / 2} rx={W / 2} ry={H / 2} {...common} />
            ) : (
              <rect x={p.x} y={p.y} width={W} height={H} rx={8} {...common} />
            )}
            <foreignObject x={p.x + 6} y={p.y + 6} width={W - 12} height={H - 12}>
              <div className="flex h-full w-full items-center justify-center text-center text-[11px] leading-tight text-[#111827]">
                {s.label}
              </div>
            </foreignObject>
          </g>
        );
      })}
    </svg>
  );
}

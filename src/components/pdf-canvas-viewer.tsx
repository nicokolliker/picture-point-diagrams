import { useEffect, useRef, useState } from "react";
import { Download, FileText } from "lucide-react";

const PDFJS_VERSION = "3.11.174";
const PDFJS_SRC = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.js`;
const PDFJS_WORKER = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

let pdfjsPromise: Promise<any> | null = null;
function loadPdfJs(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("ssr"));
  const w = window as any;
  if (w.pdfjsLib) {
    try {
      w.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
    } catch {}
    return Promise.resolve(w.pdfjsLib);
  }
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      `script[data-pdfjs="${PDFJS_VERSION}"]`,
    ) as HTMLScriptElement | null;
    const onReady = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) return reject(new Error("pdfjs failed to load"));
      try {
        lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      } catch {}
      resolve(lib);
    };
    if (existing) {
      existing.addEventListener("load", onReady);
      existing.addEventListener("error", () => reject(new Error("pdfjs script error")));
      return;
    }
    const s = document.createElement("script");
    s.src = PDFJS_SRC;
    s.async = true;
    s.dataset.pdfjs = PDFJS_VERSION;
    s.onload = onReady;
    s.onerror = () => reject(new Error("pdfjs script error"));
    document.head.appendChild(s);
  }).catch((err) => {
    pdfjsPromise = null;
    throw err;
  });
  return pdfjsPromise;
}

export function PdfCanvasViewer({
  src,
  failed,
  downloadHref,
  downloadName,
}: {
  src: string | null;
  failed: boolean;
  downloadHref?: string;
  downloadName: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPdf(null);
    setPage(1);
    setNumPages(0);
    setLoadFailed(false);
    if (!src || failed) return;
    setLoading(true);
    (async () => {
      try {
        const lib = await loadPdfJs();
        const res = await fetch(src);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        const doc = await lib.getDocument({ data: buf }).promise;
        if (cancelled) return;
        setPdf(doc);
        setNumPages(doc.numPages);
      } catch (e) {
        console.warn("pdfjs load failed", e);
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src, failed]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: any = null;
    (async () => {
      try {
        const p = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = p.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTask = p.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e) {
        if (!cancelled) console.warn("pdfjs render failed", e);
      }
    })();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel?.();
      } catch {}
    };
  }, [pdf, page]);

  if (!src || failed || loadFailed) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileText className="h-10 w-10 text-[#6B7280]" />
        <div className="text-sm text-[#374151]">No se puede previsualizar</div>
        {downloadHref && (
          <a
            href={downloadHref}
            download={downloadName}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md bg-[#5B6CF8] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#4854d1]"
          >
            <Download className="h-3.5 w-3.5" /> Descargar PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-auto bg-[#1f2937] p-4">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
        <canvas ref={canvasRef} className="mx-auto block shadow-lg" />
      </div>
      {numPages > 1 && (
        <div className="flex items-center justify-center gap-3 border-t border-[#EBEBEB] bg-white px-4 py-2 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-[#EBEBEB] px-2.5 py-1 hover:bg-[#F3F4F6] disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span className="tabular-nums text-[#374151]">
            Página {page} / {numPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="rounded-md border border-[#EBEBEB] px-2.5 py-1 hover:bg-[#F3F4F6] disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
    </div>
  );
}

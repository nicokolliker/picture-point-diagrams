import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChangeEntry, Connector, DiagramDocument, Page, Shape, ShapeType, Status } from "./shape-types";
import { createDemoDocument } from "./preloaded-demo";

interface State {
  documents: DiagramDocument[];
  uploads: string[];
  ensureSeed: () => void;
  createDocument: (name?: string) => string;
  deleteDocument: (id: string) => void;
  duplicateDocument: (id: string) => void;
  renameDocument: (id: string, name: string) => void;
  setDocStatus: (id: string, status: "draft" | "published") => void;
  addShape: (docId: string, pageId: string, shape: Shape) => void;
  updateShape: (docId: string, pageId: string, id: string, patch: Partial<Shape>) => void;
  updateShapes: (docId: string, pageId: string, ids: string[], patch: Partial<Shape>) => void;
  deleteShapes: (docId: string, pageId: string, ids: string[]) => void;
  bringToFront: (docId: string, pageId: string, id: string) => void;
  sendToBack: (docId: string, pageId: string, id: string) => void;
  addConnector: (docId: string, pageId: string, c: Connector) => void;
  updateConnector: (docId: string, pageId: string, id: string, patch: Partial<Connector>) => void;
  deleteConnectors: (docId: string, pageId: string, ids: string[]) => void;
  addPage: (docId: string) => void;
  addUpload: (dataUrl: string) => void;
  removeUpload: (dataUrl: string) => void;
  addChange: (docId: string, pageId: string, shapeId: string, text: string) => void;
  deleteChange: (docId: string, pageId: string, shapeId: string, changeId: string) => void;
}

function mutDoc(
  documents: DiagramDocument[],
  docId: string,
  fn: (d: DiagramDocument) => void,
): DiagramDocument[] {
  return documents.map((d) => {
    if (d.id !== docId) return d;
    const copy: DiagramDocument = {
      ...d,
      pages: d.pages.map((p) => ({
        ...p,
        shapes: [...p.shapes],
        connectors: [...p.connectors],
      })),
    };
    fn(copy);
    copy.updatedAt = Date.now();
    return copy;
  });
}

function mutPage(
  documents: DiagramDocument[],
  docId: string,
  pageId: string,
  fn: (p: Page) => void,
): DiagramDocument[] {
  return mutDoc(documents, docId, (d) => {
    const p = d.pages.find((p) => p.id === pageId);
    if (p) fn(p);
  });
}

export const useDiagramStore = create<State>()(
  persist(
    (set, get) => ({
      documents: [],
      uploads: [],
      ensureSeed: () => {
        if (get().documents.length === 0) {
          set({ documents: [createDemoDocument()] });
        }
      },
      createDocument: (name = "Untitled diagram") => {
        const id = `d${Date.now()}`;
        const doc: DiagramDocument = {
          id,
          name,
          category: "Processes",
          updatedAt: Date.now(),
          status: "draft",
          pages: [{ id: `p${Date.now()}`, name: "Page 1", shapes: [], connectors: [] }],
        };
        set({ documents: [doc, ...get().documents] });
        return id;
      },
      deleteDocument: (id) => set({ documents: get().documents.filter((d) => d.id !== id) }),
      duplicateDocument: (id) => {
        const src = get().documents.find((d) => d.id === id);
        if (!src) return;
        const copy: DiagramDocument = JSON.parse(JSON.stringify(src));
        copy.id = `d${Date.now()}`;
        copy.name = `${src.name} (copy)`;
        copy.updatedAt = Date.now();
        set({ documents: [copy, ...get().documents] });
      },
      renameDocument: (id, name) =>
        set({
          documents: get().documents.map((d) =>
            d.id === id ? { ...d, name, updatedAt: Date.now() } : d,
          ),
        }),
      setDocStatus: (id, status) =>
        set({
          documents: get().documents.map((d) =>
            d.id === id ? { ...d, status, updatedAt: Date.now() } : d,
          ),
        }),
      addShape: (docId, pageId, shape) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes.push(shape);
          }),
        }),
      updateShape: (docId, pageId, id, patch) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, ...patch } : s));
          }),
        }),
      updateShapes: (docId, pageId, ids, patch) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) => (ids.includes(s.id) ? { ...s, ...patch } : s));
          }),
        }),
      deleteShapes: (docId, pageId, ids) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.filter((s) => !ids.includes(s.id));
            p.connectors = p.connectors.filter(
              (c) => !ids.includes(c.fromId) && !ids.includes(c.toId),
            );
          }),
        }),
      bringToFront: (docId, pageId, id) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            const max = Math.max(0, ...p.shapes.map((s) => s.z));
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, z: max + 1 } : s));
          }),
        }),
      sendToBack: (docId, pageId, id) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            const min = Math.min(0, ...p.shapes.map((s) => s.z));
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, z: min - 1 } : s));
          }),
        }),
      addConnector: (docId, pageId, c) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.connectors.push(c);
          }),
        }),
      updateConnector: (docId, pageId, id, patch) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.connectors = p.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c));
          }),
        }),
      deleteConnectors: (docId, pageId, ids) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.connectors = p.connectors.filter((c) => !ids.includes(c.id));
          }),
        }),
      addPage: (docId) =>
        set({
          documents: mutDoc(get().documents, docId, (d) => {
            d.pages.push({
              id: `p${Date.now()}`,
              name: `Page ${d.pages.length + 1}`,
              shapes: [],
              connectors: [],
            });
          }),
        }),
      addUpload: (dataUrl) => set({ uploads: [dataUrl, ...get().uploads] }),
      removeUpload: (dataUrl) =>
        set({ uploads: get().uploads.filter((u) => u !== dataUrl) }),
      addChange: (docId, pageId, shapeId, text) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    changes: [
                      ...(s.changes ?? []),
                      { id: `ch${Date.now()}${Math.floor(Math.random() * 1000)}`, text, date: Date.now() } as ChangeEntry,
                    ],
                  }
                : s,
            );
          }),
        }),
      deleteChange: (docId, pageId, shapeId, changeId) =>
        set({
          documents: mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? { ...s, changes: (s.changes ?? []).filter((c) => c.id !== changeId) }
                : s,
            );
          }),
        }),
    }),
    { name: "flowit-store" },
  ),
);

export function makeDefaultShape(type: ShapeType, x: number, y: number): Shape {
  const isSticky = type === "sticky";
  const isText = type === "text";
  const isContainer = type === "container";
  return {
    id: `s${Date.now()}${Math.floor(Math.random() * 10000)}`,
    type,
    x,
    y,
    width: isContainer ? 320 : isSticky ? 160 : isText ? 140 : 180,
    height: isContainer ? 220 : isSticky ? 120 : isText ? 40 : 80,
    text:
      type === "diamond"
        ? "Decision"
        : type === "oval"
          ? "Start"
          : isText
            ? "Text"
            : isContainer
              ? "Container"
              : "Label",
    title: "Untitled",
    description: "",
    responsable: "",
    status: "ninguno" as Status,
    fontFamily: "Inter",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    textColor: "#111827",
    align: "center",
    borderStyle: "solid",
    borderWeight: 1,
    cornerStyle: "rounded",
    fill: isSticky ? "#FEF3C7" : isContainer ? "rgba(91,108,248,0.04)" : "#ffffff",
    z: 1,
  };
}

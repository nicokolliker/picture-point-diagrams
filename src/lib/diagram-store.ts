import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChangeEntry,
  Connector,
  DiagramDocument,
  DocEntry,
  DocType,
  ImprovementCategory,
  ImprovementEntry,
  Page,
  Person,
  Shape,
  ShapeType,
  Status,
} from "./shape-types";
import { createDemoDocument } from "./preloaded-demo";

interface State {
  documents: DiagramDocument[];
  uploads: string[];
  people: Person[];
  past: DiagramDocument[][];
  future: DiagramDocument[][];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  addPerson: (name: string, role?: string) => Person;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  deletePerson: (id: string) => void;
  ensureSeed: () => void;
  createDocument: (opts?: { name?: string; areaId?: string }) => string;
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
  renamePage: (docId: string, pageId: string, name: string) => void;
  addUpload: (dataUrl: string) => void;
  removeUpload: (dataUrl: string) => void;
  addChange: (docId: string, pageId: string, shapeId: string, text: string) => void;
  deleteChange: (docId: string, pageId: string, shapeId: string, changeId: string) => void;
  addImprovement: (docId: string, pageId: string, shapeId: string, text: string, categories?: ImprovementCategory[]) => void;
  updateImprovement: (docId: string, pageId: string, shapeId: string, entryId: string, patch: Partial<ImprovementEntry>) => void;
  deleteImprovement: (docId: string, pageId: string, shapeId: string, entryId: string) => void;
  addShapeDoc: (docId: string, pageId: string, shapeId: string) => void;
  updateShapeDoc: (docId: string, pageId: string, shapeId: string, entryId: string, patch: Partial<DocEntry>) => void;
  deleteShapeDoc: (docId: string, pageId: string, shapeId: string, entryId: string) => void;
  createSubProcess: (docId: string, pageId: string, shapeId: string) => string;
  deleteSubProcess: (docId: string, pageId: string, shapeId: string) => void;
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
    (set, get) => {
      const MAX_HIST = 20;
      const commit = (newDocs: DiagramDocument[]) => {
        const cur = get().documents;
        const past = [...get().past, cur];
        if (past.length > MAX_HIST) past.shift();
        set({ documents: newDocs, past, future: [] });
      };
      return ({
      documents: [],
      uploads: [],
      people: [],
      past: [],
      future: [],
      undo: () => {
        const past = get().past;
        if (past.length === 0) return;
        const prev = past[past.length - 1];
        set({
          documents: prev,
          past: past.slice(0, -1),
          future: [get().documents, ...get().future].slice(0, MAX_HIST),
        });
      },
      redo: () => {
        const future = get().future;
        if (future.length === 0) return;
        const next = future[0];
        set({
          documents: next,
          future: future.slice(1),
          past: [...get().past, get().documents].slice(-MAX_HIST),
        });
      },
      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,
      addPerson: (name, role) => {
        const trimmed = name.trim();
        const existing = get().people.find(
          (p) => p.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) return existing;
        const person: Person = {
          id: `pp${Date.now()}${Math.floor(Math.random() * 1000)}`,
          name: trimmed,
          role: role?.trim() || undefined,
        };
        set({ people: [...get().people, person] });
        return person;
      },
      updatePerson: (id, patch) =>
        set({
          people: get().people.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),
      deletePerson: (id) => {
        set({ people: get().people.filter((p) => p.id !== id) });
        // Remove from all shapes
        commit(
          get().documents.map((d) => ({
            ...d,
            pages: d.pages.map((p) => ({
              ...p,
              shapes: p.shapes.map((s) => ({
                ...s,
                responsableIds: (s.responsableIds ?? []).filter((x) => x !== id),
              })),
            })),
          })),
        );
      },
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
        commit([doc, ...get().documents]);
        return id;
      },
      deleteDocument: (id) => commit(get().documents.filter((d) => d.id !== id)),
      duplicateDocument: (id) => {
        const src = get().documents.find((d) => d.id === id);
        if (!src) return;
        const copy: DiagramDocument = JSON.parse(JSON.stringify(src));
        copy.id = `d${Date.now()}`;
        copy.name = `${src.name} (copy)`;
        copy.updatedAt = Date.now();
        commit([copy, ...get().documents]);
      },
      renameDocument: (id, name) =>
        commit(
          get().documents.map((d) =>
            d.id === id ? { ...d, name, updatedAt: Date.now() } : d,
          ),
        ),
      setDocStatus: (id, status) =>
        commit(
          get().documents.map((d) =>
            d.id === id ? { ...d, status, updatedAt: Date.now() } : d,
          )
        ),
      addShape: (docId, pageId, shape) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes.push(shape);
          })
        ),
      updateShape: (docId, pageId, id, patch) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, ...patch } : s));
          })
        ),
      updateShapes: (docId, pageId, ids, patch) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) => (ids.includes(s.id) ? { ...s, ...patch } : s));
          })
        ),
      deleteShapes: (docId, pageId, ids) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.filter((s) => !ids.includes(s.id));
            p.connectors = p.connectors.filter(
              (c) => !ids.includes(c.fromId) && !ids.includes(c.toId),
            );
          })
        ),
      bringToFront: (docId, pageId, id) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            const max = Math.max(0, ...p.shapes.map((s) => s.z));
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, z: max + 1 } : s));
          })
        ),
      sendToBack: (docId, pageId, id) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            const min = Math.min(0, ...p.shapes.map((s) => s.z));
            p.shapes = p.shapes.map((s) => (s.id === id ? { ...s, z: min - 1 } : s));
          })
        ),
      addConnector: (docId, pageId, c) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.connectors.push(c);
          })
        ),
      updateConnector: (docId, pageId, id, patch) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.connectors = p.connectors.map((c) => (c.id === id ? { ...c, ...patch } : c));
          })
        ),
      deleteConnectors: (docId, pageId, ids) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.connectors = p.connectors.filter((c) => !ids.includes(c.id));
          })
        ),
      addPage: (docId) =>
        commit(
          mutDoc(get().documents, docId, (d) => {
            d.pages.push({
              id: `p${Date.now()}`,
              name: `Page ${d.pages.length + 1}`,
              shapes: [],
              connectors: [],
            });
          })
        ),
      renamePage: (docId, pageId, name) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.name = name;
          })
        ),
      addUpload: (dataUrl) => set({ uploads: [dataUrl, ...get().uploads] }),
      removeUpload: (dataUrl) =>
        set({ uploads: get().uploads.filter((u) => u !== dataUrl) }),
      addChange: (docId, pageId, shapeId, text) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
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
          })
        ),
      deleteChange: (docId, pageId, shapeId, changeId) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? { ...s, changes: (s.changes ?? []).filter((c) => c.id !== changeId) }
                : s,
            );
          })
        ),
      addImprovement: (docId, pageId, shapeId, text, categories = []) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    improvementEntries: [
                      ...(s.improvementEntries ?? []),
                      {
                        id: `im${Date.now()}${Math.floor(Math.random() * 1000)}`,
                        text,
                        categories,
                        date: Date.now(),
                      } as ImprovementEntry,
                    ],
                  }
                : s,
            );
          })
        ),
      updateImprovement: (docId, pageId, shapeId, entryId, patch) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    improvementEntries: (s.improvementEntries ?? []).map((e) =>
                      e.id === entryId ? { ...e, ...patch } : e,
                    ),
                  }
                : s,
            );
          })
        ),
      deleteImprovement: (docId, pageId, shapeId, entryId) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    improvementEntries: (s.improvementEntries ?? []).filter(
                      (e) => e.id !== entryId,
                    ),
                  }
                : s,
            );
          })
        ),
      addShapeDoc: (docId, pageId, shapeId) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    documents: [
                      ...(s.documents ?? []),
                      {
                        id: `doc${Date.now()}${Math.floor(Math.random() * 1000)}`,
                        name: "",
                        docType: "Playbook" as DocType,
                        url: "",
                      } as DocEntry,
                    ],
                  }
                : s,
            );
          })
        ),
      updateShapeDoc: (docId, pageId, shapeId, entryId, patch) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? {
                    ...s,
                    documents: (s.documents ?? []).map((d) =>
                      d.id === entryId ? { ...d, ...patch } : d,
                    ),
                  }
                : s,
            );
          })
        ),
      deleteShapeDoc: (docId, pageId, shapeId, entryId) =>
        commit(
          mutPage(get().documents, docId, pageId, (p) => {
            p.shapes = p.shapes.map((s) =>
              s.id === shapeId
                ? { ...s, documents: (s.documents ?? []).filter((d) => d.id !== entryId) }
                : s,
            );
          })
        ),
      createSubProcess: (docId, pageId, shapeId) => {
        const newPageId = `p${Date.now()}${Math.floor(Math.random() * 1000)}`;
        commit(
          mutDoc(get().documents, docId, (d) => {
            const parentShape = d.pages
              .find((p) => p.id === pageId)
              ?.shapes.find((s) => s.id === shapeId);
            const subName = parentShape?.title || parentShape?.text || "Sub-proceso";
            d.pages.push({
              id: newPageId,
              name: `Sub: ${subName}`,
              shapes: [],
              connectors: [],
            });
            const p = d.pages.find((p) => p.id === pageId);
            if (p) {
              p.shapes = p.shapes.map((s) =>
                s.id === shapeId ? { ...s, subProcessPageId: newPageId } : s,
              );
            }
          }),
        );
        return newPageId;
      },
      deleteSubProcess: (docId, pageId, shapeId) =>
        commit(
          mutDoc(get().documents, docId, (d) => {
            const p = d.pages.find((pp) => pp.id === pageId);
            const target = p?.shapes.find((s) => s.id === shapeId);
            const subId = target?.subProcessPageId;
            if (p) {
              p.shapes = p.shapes.map((s) =>
                s.id === shapeId ? { ...s, subProcessPageId: undefined } : s,
              );
            }
            if (subId) d.pages = d.pages.filter((pg) => pg.id !== subId);
          }),
        ),
    });
    },
    {
      name: "flowit-store",
      partialize: (state) => {
        // Strip large base64 blobs and history from persisted state to avoid
        // QuotaExceededError. Keep all structural metadata.
        const stripDocs = (docs: DiagramDocument[]): DiagramDocument[] =>
          docs.map((d) => ({
            ...d,
            pages: d.pages.map((p) => ({
              ...p,
              shapes: p.shapes.map((s) => {
                const { imageDataUrl, documents, ...rest } = s as Shape & {
                  imageDataUrl?: string;
                  documents?: DocEntry[];
                };
                return {
                  ...rest,
                  ...(documents
                    ? {
                        documents: documents.map((doc) => {
                          const { fileDataUrl, ...docRest } = doc as DocEntry & {
                            fileDataUrl?: string;
                          };
                          return docRest as DocEntry;
                        }),
                      }
                    : {}),
                } as Shape;
              }),
            })),
          }));
        return {
          documents: stripDocs(state.documents),
          people: state.people,
          // intentionally drop: uploads, past, future
        } as Partial<State>;
      },
      storage: {
        getItem: (name) => {
          try {
            const raw = localStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (err) {
            // Quota exceeded — try without blobs already stripped by partialize,
            // last resort: drop documents entirely to keep people/settings.
            try {
              const v = value as { state: Record<string, unknown>; version?: number };
              const minimal = {
                ...v,
                state: { ...v.state, documents: [] },
              };
              localStorage.setItem(name, JSON.stringify(minimal));
              console.warn("[flowit] localStorage quota exceeded, dropped documents", err);
            } catch (err2) {
              console.error("[flowit] localStorage write failed", err2);
            }
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            /* noop */
          }
        },
      },
    },
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
    diagnostico: "sin_definir",
    improvementEntries: [],
    documents: [],
    noStandardDoc: false,
    fontFamily: "Inter",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    textColor: "#111827",
    align: "center",
    borderStyle: "solid",
    borderWeight: 1,
    borderColor: "#D0D0D0",
    cornerStyle: "rounded",
    fill: isSticky ? "#FEF3C7" : isContainer ? "rgba(91,108,248,0.04)" : "#ffffff",
    z: 1,
  };
}

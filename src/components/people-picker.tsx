import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { useDiagramStore } from "@/lib/diagram-store";
import type { Person } from "@/lib/shape-types";
import { cn } from "@/lib/utils";

export function PeoplePicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const people = useDiagramStore((s) => s.people);
  const addPerson = useDiagramStore((s) => s.addPerson);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selected = useMemo(
    () =>
      selectedIds
        .map((id) => people.find((p) => p.id === id))
        .filter(Boolean) as Person[],
    [selectedIds, people],
  );

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      people
        .filter((p) => !selectedIds.includes(p.id))
        .filter(
          (p) =>
            !q ||
            p.name.toLowerCase().includes(q) ||
            (p.role ?? "").toLowerCase().includes(q),
        )
        .slice(0, 8),
    [people, selectedIds, q],
  );

  const exact = people.find((p) => p.name.toLowerCase() === q);
  const showCreate = q.length > 0 && !exact;

  const select = (id: string) => {
    if (!selectedIds.includes(id)) onChange([...selectedIds, id]);
    setQuery("");
    inputRef.current?.focus();
  };

  const create = () => {
    if (!q) return;
    const p = addPerson(query);
    select(p.id);
  };

  const remove = (id: string) => onChange(selectedIds.filter((x) => x !== id));

  return (
    <div ref={wrapRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-1.5 py-1 focus-within:border-[#5B6CF8]"
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        {selected.map((p) => (
          <span
            key={p.id}
            className="inline-flex items-center gap-1 rounded-full bg-[#EEF0FF] px-2 py-0.5 text-[11px] font-medium text-[#3730A3]"
          >
            <span>{p.name}</span>
            {p.role && <span className="text-[#6B7280]">· {p.role}</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                remove(p.id);
              }}
              className="text-[#6B7280] hover:text-[#DC2626]"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (matches.length > 0) select(matches[0].id);
              else if (showCreate) create();
            } else if (e.key === "Backspace" && !query && selected.length > 0) {
              remove(selected[selected.length - 1].id);
            }
          }}
          placeholder={selected.length === 0 ? "Asignar persona…" : ""}
          className="min-w-[80px] flex-1 bg-transparent text-[12px] outline-none placeholder:text-[#9CA3AF]"
        />
      </div>

      {open && (matches.length > 0 || showCreate) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-auto rounded-md border border-[#E5E7EB] bg-white shadow-lg">
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[12px] hover:bg-[#F3F4F6]"
            >
              <span className="font-medium text-[#111827]">{p.name}</span>
              {p.role && (
                <span className="truncate text-[10px] text-[#6B7280]">{p.role}</span>
              )}
            </button>
          ))}
          {showCreate && (
            <button
              onClick={create}
              className={cn(
                "flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[12px] text-[#5B6CF8] hover:bg-[#EEF0FF]",
                matches.length > 0 && "border-t border-[#EBEBEB]",
              )}
            >
              <Plus className="h-3.5 w-3.5" /> Crear "{query}"
            </button>
          )}
        </div>
      )}

      <button
        onClick={() => setShowManage(true)}
        className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#6B7280] hover:text-[#5B6CF8]"
      >
        <Settings2 className="h-3 w-3" /> Gestionar personas →
      </button>

      {showManage && <ManagePeopleModal onClose={() => setShowManage(false)} />}
    </div>
  );
}

function ManagePeopleModal({ onClose }: { onClose: () => void }) {
  const people = useDiagramStore((s) => s.people);
  const addPerson = useDiagramStore((s) => s.addPerson);
  const updatePerson = useDiagramStore((s) => s.updatePerson);
  const deletePerson = useDiagramStore((s) => s.deletePerson);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");

  const add = () => {
    if (!name.trim()) return;
    addPerson(name, role);
    setName("");
    setRole("");
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#EBEBEB] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#111827]">Personas y roles</h3>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#F3F4F6]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 border-b border-[#EBEBEB] p-3">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="rounded-md border border-[#E5E7EB] px-2 py-1.5 text-[12px] outline-none focus:border-[#5B6CF8]"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Rol (opcional)"
              className="rounded-md border border-[#E5E7EB] px-2 py-1.5 text-[12px] outline-none focus:border-[#5B6CF8]"
            />
            <button
              onClick={add}
              disabled={!name.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-[#5B6CF8] px-2.5 text-[12px] font-medium text-white hover:bg-[#4854d1] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-3">
          {people.length === 0 ? (
            <div className="rounded-md border border-dashed border-[#E5E7EB] p-4 text-center text-xs text-[#9CA3AF]">
              No hay personas registradas.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {people.map((p) => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onUpdate={(patch) => updatePerson(p.id, patch)}
                  onDelete={() => deletePerson(p.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  person,
  onUpdate,
  onDelete,
}: {
  person: Person;
  onUpdate: (patch: Partial<Person>) => void;
  onDelete: () => void;
}) {
  return (
    <li className="grid grid-cols-[1fr_1fr_auto] items-center gap-1.5 rounded-md border border-[#EBEBEB] bg-white px-2 py-1.5">
      <input
        value={person.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
        className="bg-transparent text-[12px] font-medium text-[#111827] outline-none"
      />
      <input
        value={person.role ?? ""}
        onChange={(e) => onUpdate({ role: e.target.value })}
        placeholder="Rol"
        className="bg-transparent text-[11px] text-[#6B7280] outline-none"
      />
      <button
        onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center rounded-md text-[#6B7280] hover:bg-[#FEE2E2] hover:text-[#DC2626]"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

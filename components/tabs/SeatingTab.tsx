"use client";

import { useMemo, useState } from "react";
import {
  autoSeat,
  newId,
  type Guest,
  type SeatTable,
  type Wedding,
} from "@/lib/workspace";

export default function SeatingTab({
  wedding,
  update,
}: {
  wedding: Wedding;
  update: (fn: (w: Wedding) => Wedding) => void;
}) {
  const guests = wedding.guests ?? [];
  const tables = wedding.tables ?? [];
  const seatable = guests.filter((g) => g.rsvp !== "no");
  const unseated = seatable.filter((g) => !g.tableId);
  const [selected, setSelected] = useState<string | null>(null);

  const byTable = useMemo(() => {
    const m = new Map<string, Guest[]>();
    for (const t of tables) m.set(t.id, []);
    for (const g of seatable) if (g.tableId && m.has(g.tableId)) m.get(g.tableId)!.push(g);
    return m;
  }, [tables, seatable]);

  function setGuestTable(guestId: string, tableId: string | null) {
    update((w) => ({
      ...w,
      guests: (w.guests ?? []).map((g) =>
        g.id === guestId ? { ...g, tableId } : g
      ),
    }));
  }
  function seatSelectedTo(tableId: string) {
    if (!selected) return;
    setGuestTable(selected, tableId);
    setSelected(null);
  }
  function addTable() {
    const t: SeatTable = {
      id: newId("tbl"),
      name: `Table ${tables.length + 1}`,
      capacity: 10,
    };
    update((w) => ({ ...w, tables: [...(w.tables ?? []), t] }));
  }
  function createTablesForGuests() {
    const need = Math.max(1, Math.ceil(seatable.length / 10));
    const created: SeatTable[] = Array.from({ length: need }, (_, i) => ({
      id: newId("tbl"),
      name: `Table ${i + 1}`,
      capacity: 10,
    }));
    update((w) => ({ ...w, tables: created }));
  }
  function patchTable(id: string, p: Partial<SeatTable>) {
    update((w) => ({
      ...w,
      tables: (w.tables ?? []).map((t) => (t.id === id ? { ...t, ...p } : t)),
    }));
  }
  function removeTable(id: string) {
    update((w) => ({
      ...w,
      tables: (w.tables ?? []).filter((t) => t.id !== id),
      guests: (w.guests ?? []).map((g) =>
        g.tableId === id ? { ...g, tableId: null } : g
      ),
    }));
  }
  function runAutoSeat() {
    update((w) => ({
      ...w,
      guests: autoSeat(w.guests ?? [], w.tables ?? []),
    }));
  }
  function clearSeating() {
    update((w) => ({
      ...w,
      guests: (w.guests ?? []).map((g) => ({ ...g, tableId: null })),
    }));
  }

  if (guests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sand bg-white/50 p-10 text-center text-sm text-ink/55">
        Add guests first (Guests tab) — then arrange them onto tables here.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Unseated guests */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div
          className="rounded-2xl border border-sand bg-white/60 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = e.dataTransfer.getData("text/guest");
            if (id) setGuestTable(id, null);
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-serif text-lg text-ink">Unseated</p>
            <span className="text-xs text-ink/45">{unseated.length}</span>
          </div>
          <p className="mt-1 text-xs text-ink/45">
            Click a guest then a table, or drag them across.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {unseated.map((g) => (
              <button
                key={g.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/guest", g.id)}
                onClick={() => setSelected(selected === g.id ? null : g.id)}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  selected === g.id
                    ? "border-ink bg-ink text-cream"
                    : "border-sand bg-white text-ink/70 hover:border-ink/40"
                }`}
                title={g.household || undefined}
              >
                {g.name}
                {g.plusOne ? " +1" : ""}
              </button>
            ))}
            {unseated.length === 0 && (
              <span className="text-xs text-sage">Everyone&apos;s seated 🎉</span>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <button
            onClick={runAutoSeat}
            disabled={tables.length === 0}
            className="rounded-full bg-ink py-2 text-sm text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            ✨ Auto-seat (keeps households together)
          </button>
          <div className="flex gap-2">
            <button
              onClick={addTable}
              className="flex-1 rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
            >
              + Table
            </button>
            <button
              onClick={clearSeating}
              className="flex-1 rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Tables */}
      <div>
        {tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-sand bg-white/50 p-10 text-center">
            <p className="text-sm text-ink/55">No tables yet.</p>
            <button
              onClick={createTablesForGuests}
              className="mt-3 rounded-full bg-ink px-5 py-2 text-sm text-cream hover:bg-ink/90"
            >
              Create {Math.max(1, Math.ceil(seatable.length / 10))} tables
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tables.map((t) => {
              const seated = byTable.get(t.id) ?? [];
              const over = seated.length > t.capacity;
              return (
                <div
                  key={t.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData("text/guest");
                    if (id) setGuestTable(id, t.id);
                  }}
                  onClick={() => selected && seatSelectedTo(t.id)}
                  className={`rounded-2xl border bg-white/60 p-3 transition ${
                    selected ? "cursor-pointer border-clay ring-1 ring-clay/40" : "border-sand"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <input
                      value={t.name}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => patchTable(t.id, { name: e.target.value })}
                      className="w-24 rounded border border-transparent bg-transparent px-1 font-serif text-ink outline-none hover:border-sand focus:border-ink"
                    />
                    <span
                      className={`text-xs ${over ? "font-medium text-red-600" : "text-ink/45"}`}
                    >
                      {seated.length}/
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={t.capacity}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          patchTable(t.id, { capacity: Number(e.target.value) || 1 })
                        }
                        className="w-9 rounded border border-transparent bg-transparent text-xs outline-none hover:border-sand focus:border-ink"
                      />
                    </span>
                  </div>
                  <div className="mt-2 flex min-h-[60px] flex-wrap gap-1.5">
                    {seated.map((g) => (
                      <button
                        key={g.id}
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData("text/guest", g.id);
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setGuestTable(g.id, null);
                        }}
                        className="rounded-full bg-sand px-2 py-0.5 text-xs text-ink/70 hover:bg-red-100 hover:text-red-600"
                        title="Click to unseat"
                      >
                        {g.name}
                        {g.plusOne ? " +1" : ""}
                      </button>
                    ))}
                    {seated.length === 0 && (
                      <span className="self-center text-xs text-ink/30">
                        {selected ? "Click to seat here" : "Drop guests here"}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTable(t.id);
                    }}
                    className="mt-2 text-[11px] text-ink/30 hover:text-red-500"
                  >
                    Remove table
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { newId, type Guest, type Rsvp, type Wedding } from "@/lib/workspace";
import { parseCSV, toObjects, pick } from "@/lib/csv";

const RSVP_OPTS: Rsvp[] = ["invited", "yes", "no", "maybe"];
const RSVP_LABEL: Record<Rsvp, string> = {
  invited: "Invited",
  yes: "Coming",
  no: "Declined",
  maybe: "Maybe",
};

export default function GuestsTab({
  wedding,
  update,
}: {
  wedding: Wedding;
  update: (fn: (w: Wedding) => Wedding) => void;
}) {
  const guests = wedding.guests ?? [];
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);

  // add form
  const [name, setName] = useState("");
  const [household, setHousehold] = useState("");
  const [side, setSide] = useState<"A" | "B" | "both">("A");
  const [plusOne, setPlusOne] = useState(false);

  const counts = useMemo(() => {
    const yes = guests.filter((g) => g.rsvp === "yes");
    return {
      total: guests.length,
      yes: yes.length,
      no: guests.filter((g) => g.rsvp === "no").length,
      maybe: guests.filter((g) => g.rsvp === "maybe").length,
      heads: yes.reduce((n, g) => n + 1 + (g.plusOne ? 1 : 0), 0),
    };
  }, [guests]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return guests.filter(
      (g) =>
        !q ||
        g.name.toLowerCase().includes(q) ||
        g.household.toLowerCase().includes(q)
    );
  }, [guests, query]);

  function addGuest(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const g: Guest = {
      id: newId("g"),
      name: name.trim(),
      household: household.trim(),
      side,
      rsvp: "invited",
      dietary: "",
      plusOne,
      tableId: null,
    };
    update((w) => ({ ...w, guests: [...(w.guests ?? []), g] }));
    setName("");
    setHousehold("");
    setPlusOne(false);
  }
  function patchGuest(id: string, p: Partial<Guest>) {
    update((w) => ({
      ...w,
      guests: (w.guests ?? []).map((g) => (g.id === id ? { ...g, ...p } : g)),
    }));
  }
  function removeGuest(id: string) {
    update((w) => ({ ...w, guests: (w.guests ?? []).filter((g) => g.id !== id) }));
  }
  function importGuests(rows: Record<string, string>[]) {
    const imported: Guest[] = rows
      .map((o) => {
        const nm = pick(o, ["name", "guest", "full name", "guest name"]);
        if (!nm) return null;
        const r = pick(o, ["rsvp", "status"]).toLowerCase();
        const rsvp: Rsvp = r.startsWith("y") || r.includes("com")
          ? "yes"
          : r.startsWith("n") || r.includes("dec")
          ? "no"
          : r.includes("may")
          ? "maybe"
          : "invited";
        return {
          id: newId("g"),
          name: nm,
          household: pick(o, ["household", "family", "group", "party"]),
          side: "both",
          rsvp,
          dietary: pick(o, ["dietary", "dietary requirements", "allergies", "meal"]),
          plusOne: /^(y|true|1)/i.test(pick(o, ["plus one", "plusone", "+1"])),
          tableId: null,
        } as Guest;
      })
      .filter((g): g is Guest => g !== null);
    if (imported.length)
      update((w) => ({ ...w, guests: [...(w.guests ?? []), ...imported] }));
    setShowImport(false);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Stat label="Invited" value={counts.total} />
        <Stat label="Coming" value={counts.yes} accent="sage" />
        <Stat label="Declined" value={counts.no} />
        <Stat label="Maybe" value={counts.maybe} />
        <Stat label="Total heads" value={counts.heads} accent="clay" />
        <div className="ml-auto flex gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guests…"
            className="rounded-full border border-sand bg-white/80 px-4 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            onClick={() => setShowImport(true)}
            className="rounded-full border border-ink/20 px-4 py-2 text-sm text-ink hover:border-ink/40"
          >
            ⬆ Import CSV
          </button>
        </div>
      </div>

      <form
        onSubmit={addGuest}
        className="mb-4 flex flex-wrap items-end gap-2 rounded-2xl border border-sand bg-white/60 p-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Guest name"
          className="min-w-[160px] flex-1 rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <input
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          placeholder="Household / party"
          className="min-w-[140px] flex-1 rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as "A" | "B" | "both")}
          className="rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm outline-none focus:border-ink"
        >
          <option value="A">Side A</option>
          <option value="B">Side B</option>
          <option value="both">Both</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={plusOne}
            onChange={(e) => setPlusOne(e.target.checked)}
            className="accent-ink"
          />
          +1
        </label>
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm text-cream hover:bg-ink/90"
        >
          Add guest
        </button>
      </form>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-white/50 p-8 text-center text-sm text-ink/50">
          No guests yet. Add them above or import a CSV from your current tool.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Household</th>
                <th className="px-3 py-2">RSVP</th>
                <th className="px-3 py-2">Dietary</th>
                <th className="px-3 py-2">+1</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => (
                <tr key={g.id} className="border-t border-sand">
                  <td className="px-3 py-2 font-medium text-ink">{g.name}</td>
                  <td className="px-3 py-2 text-ink/60">{g.household || "—"}</td>
                  <td className="px-3 py-2">
                    <select
                      value={g.rsvp}
                      onChange={(e) => patchGuest(g.id, { rsvp: e.target.value as Rsvp })}
                      className="rounded-lg border border-sand bg-white/80 px-2 py-1 text-xs outline-none focus:border-ink"
                    >
                      {RSVP_OPTS.map((r) => (
                        <option key={r} value={r}>
                          {RSVP_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      value={g.dietary}
                      onChange={(e) => patchGuest(g.id, { dietary: e.target.value })}
                      placeholder="—"
                      className="w-28 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-xs text-ink/70 outline-none hover:border-sand focus:border-ink"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={g.plusOne}
                      onChange={(e) => patchGuest(g.id, { plusOne: e.target.checked })}
                      className="accent-ink"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => removeGuest(g.id)}
                      className="text-ink/30 hover:text-red-500"
                      aria-label="Remove guest"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showImport && (
        <CsvImportModal
          title="Import guests"
          hint="Export your guest list as CSV. Columns like name, household, rsvp, dietary, +1 are matched automatically."
          onClose={() => setShowImport(false)}
          onImport={importGuests}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "sage" | "clay";
}) {
  return (
    <div className="rounded-xl border border-sand bg-white/60 px-3 py-1.5">
      <span
        className={`font-serif text-lg ${
          accent === "sage" ? "text-sage" : accent === "clay" ? "text-clay" : "text-ink"
        }`}
      >
        {value}
      </span>
      <span className="ml-1.5 text-xs text-ink/50">{label}</span>
    </div>
  );
}

export function CsvImportModal({
  title,
  hint,
  onClose,
  onImport,
}: {
  title: string;
  hint: string;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function parse(raw: string) {
    try {
      const rows = toObjects(parseCSV(raw));
      if (rows.length === 0) {
        setError("No rows found. Check the CSV has a header row.");
        setPreview(null);
      } else {
        setError(null);
        setPreview(rows);
      }
    } catch {
      setError("Could not parse that CSV.");
      setPreview(null);
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      setText(raw);
      parse(raw);
    };
    reader.readAsText(file);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-cream p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-2xl text-ink">{title}</h2>
        <p className="mt-1 text-xs text-ink/55">{hint}</p>

        <label className="mt-3 inline-block cursor-pointer rounded-full border border-dashed border-clay px-3 py-1.5 text-sm text-clay hover:bg-clay/10">
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          Choose CSV file
        </label>
        <p className="my-2 text-center text-xs text-ink/40">or paste below</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            parse(e.target.value);
          }}
          placeholder="name,household,rsvp,dietary&#10;Jane Smith,Smith Family,yes,Vegetarian"
          className="h-28 w-full rounded-xl border border-sand bg-white/80 p-3 font-mono text-xs text-ink outline-none focus:border-ink"
        />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {preview && (
          <p className="mt-2 text-xs text-sage">
            {preview.length} row{preview.length === 1 ? "" : "s"} ready to import.
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-full border border-ink/20 py-2.5 text-sm text-ink hover:border-ink/40"
          >
            Cancel
          </button>
          <button
            onClick={() => preview && onImport(preview)}
            disabled={!preview}
            className="flex-1 rounded-full bg-ink py-2.5 text-sm text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            Import{preview ? ` ${preview.length}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

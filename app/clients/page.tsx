"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { STYLES, SAMPLE_VENUES, getVenue } from "@/lib/styles";
import { buildQuote, formatGBP } from "@/lib/quote";
import { pick, normaliseDate } from "@/lib/csv";
import { CsvImportModal } from "@/components/tabs/GuestsTab";
import {
  listWeddings,
  createWedding,
  seedSampleWeddings,
  daysUntil,
  formatDate,
  STATUS_META,
  type Wedding,
} from "@/lib/workspace";

export default function ClientsPage() {
  const router = useRouter();
  const [weddings, setWeddings] = useState<Wedding[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setWeddings(await listWeddings());
      setLoading(false);
    })();
  }, [router]);

  async function refresh() {
    setWeddings(await listWeddings());
  }

  async function loadSamples() {
    setSeeding(true);
    await seedSampleWeddings();
    await refresh();
    setSeeding(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  async function importClients(rows: Record<string, string>[]) {
    const jobs: Promise<unknown>[] = [];
    for (const o of rows) {
      const name = pick(o, [
        "couple",
        "couple names",
        "name",
        "client",
        "clients",
        "partners",
      ]);
      if (!name) continue;
      const venueName = pick(o, ["venue", "location"]).toLowerCase();
      const venue =
        SAMPLE_VENUES.find(
          (v) =>
            venueName &&
            (v.name.toLowerCase().includes(venueName) ||
              venueName.includes(v.name.toLowerCase()))
        ) ?? SAMPLE_VENUES[0];
      jobs.push(
        createWedding({
          coupleName: name,
          weddingDate: normaliseDate(pick(o, ["date", "wedding date", "event date"])),
          venueId: venue.id,
          guestCount: parseInt(pick(o, ["guests", "guest count", "headcount", "pax"])) || 80,
          budget: parseInt(pick(o, ["budget"]).replace(/[^0-9]/g, "")) || 5000,
          styleId: STYLES[0].id,
          email: pick(o, ["email", "e-mail"]),
        })
      );
    }
    await Promise.all(jobs);
    await refresh();
    setShowImport(false);
  }

  return (
    <div className="py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="font-serif text-3xl text-ink">Your weddings</h1>
          <p className="mt-1 text-sm text-ink/55">
            {weddings.length} client{weddings.length === 1 ? "" : "s"} · design,
            budget, timeline, guests & seating in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={signOut}
            className="rounded-full px-3 py-2.5 text-sm text-ink/50 hover:text-ink"
          >
            Sign out
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-full border border-ink/20 px-5 py-2.5 text-sm text-ink hover:border-ink/40"
          >
            ⬆ Import
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="rounded-full bg-ink px-5 py-2.5 text-sm text-cream hover:bg-ink/90"
          >
            + New wedding
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-16 text-center text-ink/40">Loading…</p>
      ) : weddings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sand bg-white/50 p-10 text-center">
          <p className="text-ink/55">No weddings yet.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={() => setShowNew(true)}
              className="rounded-full bg-ink px-5 py-2.5 text-sm text-cream hover:bg-ink/90"
            >
              + Add your first client
            </button>
            <button
              onClick={loadSamples}
              disabled={seeding}
              className="rounded-full border border-ink/20 px-5 py-2.5 text-sm text-ink hover:border-ink/40 disabled:opacity-50"
            >
              {seeding ? "Loading…" : "✨ Load 3 sample weddings"}
            </button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {weddings.map((w) => (
            <WeddingCard key={w.id} wedding={w} />
          ))}
        </div>
      )}

      {showNew && (
        <NewWeddingModal
          onClose={() => setShowNew(false)}
          onCreated={() => {
            refresh();
            setShowNew(false);
          }}
        />
      )}

      {showImport && (
        <CsvImportModal
          title="Import clients"
          hint="Export your clients from Aisle Planner, HoneyBook, Dubsado or a spreadsheet as CSV. Columns like couple, date, venue, guests, budget and email are matched automatically."
          onClose={() => setShowImport(false)}
          onImport={importClients}
        />
      )}
    </div>
  );
}

function WeddingCard({ wedding }: { wedding: Wedding }) {
  const venue = getVenue(wedding.venueId);
  const quote = useMemo(
    () => buildQuote(wedding.selection, wedding.guestCount),
    [wedding.selection, wedding.guestCount]
  );
  const days = daysUntil(wedding.weddingDate);
  const status = STATUS_META[wedding.status];
  const over = quote.subtotal > wedding.budget;
  const pct = Math.min(
    100,
    Math.round((quote.subtotal / Math.max(1, wedding.budget)) * 100)
  );

  return (
    <Link
      href={`/wedding/${wedding.id}`}
      className="group overflow-hidden rounded-2xl border border-sand bg-white/70 transition hover:border-ink/30 hover:shadow-md"
    >
      <div className="relative h-28">
        {venue.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={venue.image}
            alt={venue.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full" style={{ background: venue.gradient }} />
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.className}`}
        >
          {status.label}
        </span>
      </div>
      <div className="p-4">
        <p className="font-serif text-lg text-ink">{wedding.coupleName}</p>
        <p className="text-xs text-ink/50">
          {formatDate(wedding.weddingDate)} · {venue.name}
        </p>
        <div className="mt-3 flex items-center justify-between text-xs text-ink/60">
          <span>{wedding.guestCount} guests</span>
          <span>
            {days != null && days >= 0
              ? `${days} days to go`
              : days != null
              ? "past"
              : ""}
          </span>
        </div>
        <div className="mt-2">
          <div className="flex justify-between text-[11px]">
            <span className="text-ink/50">{formatGBP(quote.subtotal)}</span>
            <span className={over ? "text-red-600" : "text-ink/40"}>
              of {formatGBP(wedding.budget)}
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-sand">
            <div
              className={`h-full rounded-full ${over ? "bg-red-500" : "bg-sage"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}

function NewWeddingModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [coupleName, setCoupleName] = useState("");
  const [weddingDate, setWeddingDate] = useState("");
  const [venueId, setVenueId] = useState(SAMPLE_VENUES[0].id);
  const [guestCount, setGuestCount] = useState(80);
  const [budget, setBudget] = useState(5000);
  const [styleId, setStyleId] = useState(STYLES[0].id);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coupleName.trim()) return;
    await createWedding({
      coupleName: coupleName.trim(),
      weddingDate,
      venueId,
      guestCount,
      budget,
      styleId,
    });
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-cream p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-2xl text-ink">New wedding</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="Couple names" value={coupleName} onChange={setCoupleName} required />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-ink/70">Wedding date</span>
              <input
                type="date"
                value={weddingDate}
                onChange={(e) => setWeddingDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Venue</span>
              <select
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
              >
                {SAMPLE_VENUES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm text-ink/70">Guests</span>
              <input
                type="number"
                min={10}
                max={400}
                value={guestCount}
                onChange={(e) => setGuestCount(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
              />
            </label>
            <label className="block">
              <span className="text-sm text-ink/70">Budget (£)</span>
              <input
                type="number"
                min={0}
                step={250}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-sm text-ink/70">Starting style</span>
            <select
              value={styleId}
              onChange={(e) => setStyleId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
            >
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full border border-ink/20 py-2.5 text-sm text-ink hover:border-ink/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-full bg-ink py-2.5 text-sm text-cream hover:bg-ink/90"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
      />
    </label>
  );
}

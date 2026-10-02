"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import type { Slot } from "@/lib/types";
import { STYLES, getStyle, getVenue } from "@/lib/styles";
import { SLOT_META, getItem } from "@/lib/catalogue";
import { buildQuote, defaultSelection, formatGBP, tablesFor } from "@/lib/quote";
import ConfiguratorStage from "@/components/ConfiguratorStage";
import ItemPicker from "@/components/ItemPicker";
import QuotePanel from "@/components/QuotePanel";
import TimelineTab from "@/components/tabs/TimelineTab";
import GuestsTab from "@/components/tabs/GuestsTab";
import SeatingTab from "@/components/tabs/SeatingTab";
import {
  getWedding,
  saveWedding,
  daysUntil,
  formatDate,
  newId,
  STATUS_META,
  type Comment,
  type Wedding,
  type WeddingStatus,
} from "@/lib/workspace";

type Tab = "overview" | "design" | "budget" | "timeline" | "guests" | "seating";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "design", label: "Design" },
  { id: "budget", label: "Budget" },
  { id: "timeline", label: "Timeline" },
  { id: "guests", label: "Guests" },
  { id: "seating", label: "Seating" },
];

const HERO_RENDER_STYLES = new Set([
  "rustic_barn",
  "garden_romance",
  "classic_elegance",
  "modern_minimal",
]);

export default function WeddingWorkspace() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const hydratedRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeSlot, setActiveSlot] = useState<Slot | null>(SLOT_META[0].slot);
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setWedding((await getWedding(id)) ?? null);
      hydratedRef.current = false;
      setLoaded(true);
    })();
  }, [id, router]);

  // Debounced persistence — skips the initial hydration set.
  useEffect(() => {
    if (!wedding) return;
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const snapshot = wedding;
    saveTimer.current = setTimeout(() => {
      saveWedding(snapshot);
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [wedding]);

  const style = wedding ? getStyle(wedding.styleId) : getStyle(STYLES[0].id);
  const venue = wedding ? getVenue(wedding.venueId) : getVenue("oak_barn");
  const quote = useMemo(
    () =>
      wedding
        ? buildQuote(wedding.selection, wedding.guestCount)
        : buildQuote(defaultSelection(STYLES[0].id), 80),
    [wedding]
  );
  const stageItems = useMemo(() => {
    if (!wedding) return [];
    return SLOT_META.map(({ slot }) => {
      const sid = wedding.selection[slot];
      const item = sid ? getItem(sid) : undefined;
      return item ? { slot, item } : null;
    }).filter(Boolean) as { slot: Slot; item: NonNullable<ReturnType<typeof getItem>> }[];
  }, [wedding]);

  if (loaded && !wedding) {
    return (
      <div className="py-20 text-center">
        <p className="text-ink/60">Wedding not found.</p>
        <Link href="/clients" className="mt-3 inline-block text-clay underline">
          ← Back to clients
        </Link>
      </div>
    );
  }
  if (!wedding) {
    return <div className="py-20 text-center text-ink/40">Loading…</div>;
  }

  const days = daysUntil(wedding.weddingDate);

  function applyStyle(sid: string) {
    setWedding((w) => (w ? { ...w, styleId: sid, selection: defaultSelection(sid) } : w));
    setRenderUrl(null);
  }
  function choose(slot: Slot, itemId: string) {
    setWedding((w) =>
      w ? { ...w, selection: { ...w.selection, [slot]: itemId } } : w
    );
    setRenderUrl(null);
  }
  function toggleOptional(slot: Slot) {
    setWedding((w) =>
      w
        ? {
            ...w,
            selection: {
              ...w.selection,
              [slot]: w.selection[slot] ? null : defaultSelection(w.styleId)[slot],
            },
          }
        : w
    );
    setRenderUrl(null);
  }
  function patch(p: Partial<Wedding>) {
    setWedding((w) => (w ? { ...w, ...p } : w));
  }
  function update(fn: (w: Wedding) => Wedding) {
    setWedding((w) => (w ? fn(w) : w));
  }

  async function generateRender(force = false) {
    if (!wedding) return;
    const isDefault =
      JSON.stringify(wedding.selection) ===
      JSON.stringify(defaultSelection(wedding.styleId));
    if (!force && isDefault && HERO_RENDER_STYLES.has(wedding.styleId)) {
      setRenderError(null);
      setRenderUrl(`/img/renders/${wedding.styleId}.jpg`);
      return;
    }
    setRendering(true);
    setRenderError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId: wedding.styleId,
          itemIds: quote.lines.map((l) => l.item.id),
          venueKind: venue.kind,
          venueName: venue.name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRenderError(data.error ?? "Render failed.");
        return;
      }
      setRenderUrl(data.image);
    } catch {
      setRenderError("Could not reach the renderer.");
    } finally {
      setRendering(false);
    }
  }

  return (
    <div className="py-8">
      {/* Breadcrumb + header */}
      <Link href="/clients" className="text-sm text-ink/50 hover:text-ink">
        ← Clients
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-ink">{wedding.coupleName}</h1>
          <p className="mt-1 text-sm text-ink/55">
            {formatDate(wedding.weddingDate)} · {venue.name} · {wedding.guestCount} guests
            {days != null && days >= 0 && (
              <span className="ml-2 rounded-full bg-sand px-2 py-0.5 text-xs text-clay">
                {days} days to go
              </span>
            )}
          </p>
        </div>
        <select
          value={wedding.status}
          onChange={(e) => patch({ status: e.target.value as WeddingStatus })}
          className="rounded-full border border-sand bg-white/80 px-3 py-1.5 text-sm text-ink outline-none focus:border-ink"
        >
          {(Object.keys(STATUS_META) as WeddingStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-sand">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm transition ${
              tab === t.id
                ? "border-b-2 border-ink font-medium text-ink"
                : "text-ink/50 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && (
          <Overview
            wedding={wedding}
            quote={quote}
            days={days}
            onGoto={setTab}
            update={update}
          />
        )}

        {tab === "design" && (
          <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
            <div>
              <div className="mb-3 flex flex-wrap gap-1">
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => applyStyle(s.id)}
                    className={`rounded-full px-3 py-1 text-xs transition ${
                      wedding.styleId === s.id
                        ? "bg-ink text-cream"
                        : "bg-sand text-ink/60 hover:bg-sand/70"
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>

              <ConfiguratorStage
                venueImage={venue.image}
                venueGradient={venue.gradient}
                uploadedImage={null}
                style={style}
                items={stageItems}
                activeSlot={activeSlot}
                onPinClick={(slot) => setActiveSlot(slot)}
              />

              <div className="mt-4">
                {renderUrl ? (
                  <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={renderUrl} alt="Render" className="w-full" />
                    <span className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/90">
                      AI render · illustrative
                    </span>
                    <button
                      onClick={() => generateRender(true)}
                      disabled={rendering}
                      className="absolute bottom-3 right-3 rounded-full bg-cream/95 px-3 py-1.5 text-xs font-medium text-ink shadow hover:bg-cream disabled:opacity-60"
                    >
                      {rendering ? "Rendering…" : "↻ Regenerate"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => generateRender()}
                    disabled={rendering}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-clay bg-blush/10 py-3 text-sm text-clay transition hover:bg-blush/20 disabled:opacity-60"
                  >
                    {rendering ? (
                      <span className="animate-pulse">Rendering…</span>
                    ) : (
                      <span>✨ Generate a photoreal render</span>
                    )}
                  </button>
                )}
                {renderError && (
                  <p className="mt-2 text-xs text-red-600">{renderError}</p>
                )}
              </div>

              <div className="mt-6">
                <ItemPicker
                  selection={wedding.selection}
                  activeSlot={activeSlot}
                  styleId={wedding.styleId}
                  onOpenSlot={(slot) => setActiveSlot(slot)}
                  onChoose={choose}
                  onToggleOptional={toggleOptional}
                />
              </div>
            </div>

            <div className="lg:sticky lg:top-24 lg:self-start">
              <QuotePanel quote={quote} guestCount={wedding.guestCount} budget={wedding.budget} />
            </div>
          </div>
        )}

        {tab === "budget" && (
          <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
            <div className="rounded-2xl border border-sand bg-white/60 p-5">
              <h3 className="font-serif text-xl text-ink">Budget</h3>
              <label className="mt-4 block text-sm text-ink/70">
                Total budget (£)
                <input
                  type="number"
                  min={0}
                  step={250}
                  value={wedding.budget}
                  onChange={(e) => patch({ budget: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
                />
              </label>
              <label className="mt-3 block text-sm text-ink/70">
                Guest count
                <input
                  type="number"
                  min={10}
                  max={400}
                  value={wedding.guestCount}
                  onChange={(e) => patch({ guestCount: Number(e.target.value) })}
                  className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
                />
              </label>
              <div className="mt-4 space-y-1 border-t border-sand pt-4 text-sm">
                <Row label="Styling & suppliers" value={formatGBP(quote.subtotal)} />
                <Row label="Deposit to secure" value={formatGBP(quote.deposit)} />
                <Row
                  label={quote.subtotal > wedding.budget ? "Over budget" : "Remaining"}
                  value={formatGBP(Math.abs(wedding.budget - quote.subtotal))}
                  accent={quote.subtotal > wedding.budget ? "red" : "sage"}
                />
              </div>
            </div>
            <QuotePanel quote={quote} guestCount={wedding.guestCount} budget={wedding.budget} />
          </div>
        )}

        {tab === "timeline" && <TimelineTab wedding={wedding} update={update} />}
        {tab === "guests" && <GuestsTab wedding={wedding} update={update} />}
        {tab === "seating" && <SeatingTab wedding={wedding} update={update} />}
      </div>
    </div>
  );
}

function Overview({
  wedding,
  quote,
  days,
  onGoto,
  update,
}: {
  wedding: Wedding;
  quote: ReturnType<typeof buildQuote>;
  days: number | null;
  onGoto: (t: Tab) => void;
  update: (fn: (w: Wedding) => Wedding) => void;
}) {
  const over = quote.subtotal > wedding.budget;
  const tasks = wedding.tasks ?? [];
  const tasksDone = tasks.filter((t) => t.done).length;
  const guests = wedding.guests ?? [];
  const guestsYes = guests.filter((g) => g.rsvp === "yes").length;
  const comments = wedding.comments ?? [];

  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const c: Comment = {
      id: newId("c"),
      author: "planner",
      text: text.trim(),
      at: new Date().toISOString(),
    };
    update((w) => ({ ...w, comments: [...(w.comments ?? []), c] }));
    setText("");
  }
  function share() {
    const url = `${window.location.origin}/couple/${wedding.id}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Days to go" value={days != null ? String(Math.max(0, days)) : "—"} />
        <Kpi
          label={over ? "Over budget" : "Budget left"}
          value={formatGBP(Math.abs(wedding.budget - quote.subtotal))}
          accent={over}
        />
        <Kpi
          label="Tasks done"
          value={tasks.length ? `${tasksDone}/${tasks.length}` : "—"}
        />
        <Kpi
          label="Guests coming"
          value={guests.length ? String(guestsYes) : "—"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Jump label="Design the look" onClick={() => onGoto("design")} desc="Style, render & costed plan" />
          <Jump label="Manage budget" onClick={() => onGoto("budget")} desc="Itemised, by supplier" />
          <Jump label="Timeline" onClick={() => onGoto("timeline")} desc="Wedding-year checklist" />
          <Jump label="Guests & seating" onClick={() => onGoto("guests")} desc="RSVPs, households, tables" />
        </div>

        {/* Couple collaboration */}
        <div className="rounded-2xl border border-sand bg-white/60 p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-serif text-lg text-ink">Couple</h3>
            {wedding.approved ? (
              <span className="rounded-full bg-sage/20 px-2.5 py-1 text-xs font-medium text-sage">
                ✓ Approved the look
              </span>
            ) : (
              <span className="rounded-full bg-sand px-2.5 py-1 text-xs text-ink/50">
                Awaiting approval
              </span>
            )}
          </div>
          {wedding.boardSummary && (
            <p className="mt-2 rounded-lg bg-blush/10 px-3 py-2 text-xs text-ink/70">
              ✨ From their board: {wedding.boardSummary}
            </p>
          )}
          <button
            onClick={share}
            className="mt-3 w-full rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
          >
            {copied ? "Link copied ✓" : "🔗 Share with couple"}
          </button>

          <div className="mt-4 max-h-44 space-y-2 overflow-y-auto">
            {comments.length === 0 && (
              <p className="text-xs text-ink/40">No messages yet.</p>
            )}
            {comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg px-3 py-2 text-xs ${
                  c.author === "couple"
                    ? "bg-blush/15 text-ink/80"
                    : "bg-sand/60 text-ink/80"
                }`}
              >
                <span className="font-medium">
                  {c.author === "couple" ? "Couple" : "You"}
                </span>{" "}
                · {new Date(c.at).toLocaleDateString("en-GB")}
                <p className="mt-0.5">{c.text}</p>
              </div>
            ))}
          </div>
          <form onSubmit={addComment} className="mt-3 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Message the couple…"
              className="flex-1 rounded-full border border-sand bg-white/80 px-3 py-1.5 text-sm outline-none focus:border-ink"
            />
            <button
              type="submit"
              className="rounded-full bg-ink px-3 py-1.5 text-sm text-cream hover:bg-ink/90"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "border-red-300 bg-red-50" : "border-sand bg-white/60"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink">{value}</p>
    </div>
  );
}

function Jump({ label, desc, onClick }: { label: string; desc: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-sand bg-white/60 p-5 text-left transition hover:border-ink/30"
    >
      <p className="font-serif text-lg text-ink">{label}</p>
      <p className="mt-1 text-xs text-ink/50">{desc}</p>
    </button>
  );
}

function Row({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "red" | "sage";
}) {
  return (
    <div className="flex justify-between">
      <span className="text-ink/60">{label}</span>
      <span
        className={
          accent === "red"
            ? "font-medium text-red-600"
            : accent === "sage"
            ? "font-medium text-sage"
            : "text-ink"
        }
      >
        {value}
      </span>
    </div>
  );
}


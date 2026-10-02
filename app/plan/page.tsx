"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Slot } from "@/lib/types";
import { STYLES, SAMPLE_VENUES, getStyle, getVenue } from "@/lib/styles";
import { SLOT_META, getItem } from "@/lib/catalogue";
import { buildQuote, defaultSelection, formatGBP } from "@/lib/quote";
import ConfiguratorStage from "@/components/ConfiguratorStage";
import ItemPicker from "@/components/ItemPicker";
import QuotePanel from "@/components/QuotePanel";

type Step = "brief" | "studio" | "book" | "done";

function encodeLook(data: unknown): string {
  try {
    return btoa(encodeURIComponent(JSON.stringify(data)));
  } catch {
    return "";
  }
}
function decodeLook(s: string): any | null {
  try {
    return JSON.parse(decodeURIComponent(atob(s)));
  } catch {
    return null;
  }
}

function PlanInner() {
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("brief");

  // Brief
  const [venueId, setVenueId] = useState(SAMPLE_VENUES[0].id);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [styleId, setStyleId] = useState(STYLES[0].id);
  const [guestCount, setGuestCount] = useState(80);
  const [weddingDate, setWeddingDate] = useState("");
  const [budget, setBudget] = useState(5000);
  const [useBudget, setUseBudget] = useState(true);

  // Studio
  const [selection, setSelection] = useState<Record<Slot, string | null>>(() =>
    defaultSelection(STYLES[0].id)
  );
  const [activeSlot, setActiveSlot] = useState<Slot | null>(
    SLOT_META[0].slot
  );
  const [copied, setCopied] = useState(false);

  // Vision board (AI)
  const [analyzing, setAnalyzing] = useState(false);
  const [boardSummary, setBoardSummary] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // Photoreal render (AI, Stage 3)
  const [renderUrl, setRenderUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);

  // Booking
  const [coupleName, setCoupleName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const style = getStyle(styleId);
  const venue = getVenue(venueId);
  const quote = useMemo(
    () => buildQuote(selection, guestCount),
    [selection, guestCount]
  );

  // Restore a shared look from the URL (?look=...)
  useEffect(() => {
    const look = searchParams.get("look");
    if (!look) return;
    const data = decodeLook(look);
    if (!data) return;
    if (data.venueId) setVenueId(data.venueId);
    if (data.styleId) setStyleId(data.styleId);
    if (typeof data.guestCount === "number") setGuestCount(data.guestCount);
    if (typeof data.budget === "number") setBudget(data.budget);
    if (data.selection) setSelection(data.selection);
    setStep("studio");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageItems = useMemo(
    () =>
      SLOT_META.map(({ slot }) => {
        const id = selection[slot];
        const item = id ? getItem(id) : undefined;
        return item ? { slot, item } : null;
      }).filter(Boolean) as { slot: Slot; item: ReturnType<typeof getItem> }[],
    [selection]
  ) as { slot: Slot; item: NonNullable<ReturnType<typeof getItem>> }[];

  function startStudio() {
    setSelection(defaultSelection(styleId));
    setActiveSlot(SLOT_META[0].slot);
    setBoardSummary(null);
    setStep("studio");
  }

  function applyStyle(id: string) {
    setStyleId(id);
    setSelection(defaultSelection(id));
    setBoardSummary(null);
  }

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setUploadedImage(reader.result as string);
    reader.readAsDataURL(file);
  }

  function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleBoardUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    if (files.length === 0) return;
    setAnalyzeError(null);
    setAnalyzing(true);
    try {
      const images = await Promise.all(files.map(readAsDataURL));
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalyzeError(data.error ?? "Could not read your board.");
        return;
      }
      setStyleId(data.styleId);
      setSelection(data.selection);
      setBoardSummary(data.summary ?? null);
      setActiveSlot(SLOT_META[0].slot);
      setStep("studio");
    } catch {
      setAnalyzeError("Could not reach the board reader. Please try again.");
    } finally {
      setAnalyzing(false);
      e.target.value = "";
    }
  }

  function choose(slot: Slot, id: string) {
    setSelection((s) => ({ ...s, [slot]: id }));
  }
  function toggleOptional(slot: Slot) {
    setSelection((s) => ({
      ...s,
      [slot]: s[slot] ? null : defaultSelection(styleId)[slot],
    }));
  }

  function shareLook() {
    const payload = encodeLook({
      venueId,
      styleId,
      guestCount,
      budget,
      selection,
    });
    const url = `${window.location.origin}/plan?look=${payload}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => setCopied(false)
    );
  }

  // Styles with a pre-baked hero render in /public/img/renders.
  const HERO_RENDER_STYLES = new Set([
    "rustic_barn",
    "garden_romance",
    "classic_elegance",
    "modern_minimal",
  ]);

  async function generateRender(force = false) {
    // Instant: serve the pre-baked hero for the default look of this style.
    const isDefault =
      JSON.stringify(selection) === JSON.stringify(defaultSelection(styleId));
    if (!force && isDefault && HERO_RENDER_STYLES.has(styleId)) {
      setRenderError(null);
      setRenderUrl(`/img/renders/${styleId}.jpg`);
      return;
    }
    setRendering(true);
    setRenderError(null);
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          styleId,
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
      setRenderError("Could not reach the renderer. Please try again.");
    } finally {
      setRendering(false);
    }
  }

  // A render is a snapshot of one look — drop it when the look changes.
  useEffect(() => {
    setRenderUrl(null);
    setRenderError(null);
  }, [selection, styleId]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      coupleName,
      email,
      phone,
      weddingDate,
      venue: venue.name,
      styleId,
      guestCount,
      subtotal: quote.subtotal,
      deposit: quote.deposit,
      commission: quote.commission,
      itemIds: quote.lines.map((l) => l.item.id),
    };
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setOrderId(data.id ?? "REQ-LOCAL");
    } catch {
      setOrderId("REQ-LOCAL");
    } finally {
      setSubmitting(false);
      setStep("done");
    }
  }

  return (
    <div className="py-10">
      <Stepper step={step} />

      {/* STEP 1 — BRIEF */}
      {step === "brief" && (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h1 className="font-serif text-3xl text-ink">
              Let&apos;s style your room
            </h1>
            <p className="mt-2 text-ink/60">
              Pick a venue, choose a look, set your numbers — then style every
              detail and see it come together.
            </p>

            {/* Vision board → AI styling */}
            <div className="mt-6 rounded-2xl border border-clay/30 bg-gradient-to-br from-blush/20 to-sage/10 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-serif text-lg text-ink">
                    ✨ Start from a vision board
                  </p>
                  <p className="mt-0.5 text-xs text-ink/60">
                    Upload your Pinterest board or inspiration pics — our AI reads
                    the look and styles your venue with matching suppliers.
                  </p>
                </div>
              </div>
              <label
                className={`mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-clay px-3 py-2.5 text-sm text-clay transition hover:bg-clay/10 ${
                  analyzing ? "pointer-events-none opacity-60" : ""
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBoardUpload}
                  className="hidden"
                  disabled={analyzing}
                />
                {analyzing ? (
                  <span className="animate-pulse">Reading your board…</span>
                ) : (
                  <span>⬆ Upload vision board (up to 4 images)</span>
                )}
              </label>
              {analyzeError && (
                <p className="mt-2 text-xs text-red-600">{analyzeError}</p>
              )}
            </div>

            <label className="mt-6 block text-sm font-medium text-ink">
              Your venue
            </label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SAMPLE_VENUES.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setVenueId(v.id);
                    setUploadedImage(null);
                  }}
                  className={`overflow-hidden rounded-xl border text-left transition ${
                    venueId === v.id && !uploadedImage
                      ? "border-ink ring-1 ring-ink"
                      : "border-sand hover:border-ink/30"
                  }`}
                >
                  <div className="h-16 w-full">
                    {v.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.image}
                        alt={v.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div
                        className="h-full w-full"
                        style={{ background: v.gradient }}
                      />
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-ink">{v.name}</p>
                    <p className="text-[10px] text-ink/45">{v.kind}</p>
                  </div>
                </button>
              ))}
            </div>

            <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-clay hover:text-gold">
              <input
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <span className="rounded-full border border-dashed border-clay px-3 py-1.5">
                ⬆ Upload a photo of your own venue
              </span>
              {uploadedImage && (
                <span className="text-xs text-sage">Photo added ✓</span>
              )}
            </label>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink">
                  Guests: <span className="text-clay">{guestCount}</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={200}
                  step={10}
                  value={guestCount}
                  onChange={(e) => setGuestCount(Number(e.target.value))}
                  className="mt-2 w-full accent-ink"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink">
                  Wedding date
                </label>
                <input
                  type="date"
                  value={weddingDate}
                  onChange={(e) => setWeddingDate(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-ink"
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="flex items-center justify-between text-sm font-medium text-ink">
                <span>
                  Budget:{" "}
                  <span className="text-clay">
                    {useBudget ? formatGBP(budget) : "no limit"}
                  </span>
                </span>
                <button
                  onClick={() => setUseBudget((b) => !b)}
                  className="text-xs text-ink/50 underline"
                >
                  {useBudget ? "skip" : "set a budget"}
                </button>
              </label>
              {useBudget && (
                <input
                  type="range"
                  min={1500}
                  max={12000}
                  step={250}
                  value={budget}
                  onChange={(e) => setBudget(Number(e.target.value))}
                  className="mt-2 w-full accent-ink"
                />
              )}
            </div>

            <label className="mt-6 block text-sm font-medium text-ink">
              Your style
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={`rounded-xl border p-3 text-left transition ${
                    styleId === s.id
                      ? "border-ink ring-1 ring-ink"
                      : "border-sand hover:border-ink/30"
                  }`}
                >
                  <div className="mb-2 flex gap-1">
                    {s.palette.map((c) => (
                      <span
                        key={c}
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <p className="font-serif text-lg text-ink">{s.name}</p>
                  <p className="text-xs text-ink/50">{s.tagline}</p>
                </button>
              ))}
            </div>

            <button
              onClick={startStudio}
              className="mt-8 w-full rounded-full bg-ink py-3 text-cream hover:bg-ink/90"
            >
              Style my venue →
            </button>
          </div>

          <div className="md:pt-16">
            <ConfiguratorStage
              venueImage={venue.image}
              venueGradient={venue.gradient}
              uploadedImage={uploadedImage}
              style={style}
              items={[]}
              activeSlot={null}
              onPinClick={() => {}}
            />
            <p className="mt-3 text-center text-xs text-ink/40">
              {uploadedImage ? "Your venue" : `${venue.name} · ${venue.area}`}
            </p>
          </div>
        </div>
      )}

      {/* STEP 2 — STUDIO */}
      {step === "studio" && (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="font-serif text-2xl text-ink">
                  {uploadedImage ? "Your venue" : venue.name}
                </h1>
                <div className="mt-1 flex flex-wrap gap-1">
                  {STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => applyStyle(s.id)}
                      className={`rounded-full px-3 py-1 text-xs transition ${
                        styleId === s.id
                          ? "bg-ink text-cream"
                          : "bg-sand text-ink/60 hover:bg-sand/70"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => setStep("brief")}
                className="text-sm text-ink/50 hover:text-ink"
              >
                ← Brief
              </button>
            </div>

            {boardSummary && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-clay/30 bg-blush/10 px-4 py-3 text-sm text-ink/70">
                <span className="text-base">✨</span>
                <span>
                  <span className="font-medium text-ink">From your board: </span>
                  {boardSummary}{" "}
                  <span className="text-ink/45">
                    Swap anything below to make it yours.
                  </span>
                </span>
              </div>
            )}

            <ConfiguratorStage
              venueImage={venue.image}
              venueGradient={venue.gradient}
              uploadedImage={uploadedImage}
              style={style}
              items={stageItems}
              activeSlot={activeSlot}
              onPinClick={(slot) => setActiveSlot(slot)}
            />

            {/* Photoreal AI render (Stage 3) */}
            <div className="mt-4">
              {renderUrl ? (
                <div className="relative overflow-hidden rounded-2xl ring-1 ring-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={renderUrl}
                    alt="Photoreal render of your look"
                    className="w-full"
                  />
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
                    <span className="animate-pulse">
                      Rendering your look… (~20s)
                    </span>
                  ) : (
                    <span>✨ Generate a photoreal render of this look</span>
                  )}
                </button>
              )}
              {renderError && (
                <p className="mt-2 text-xs text-red-600">{renderError}</p>
              )}
            </div>

            <div className="mt-6">
              <ItemPicker
                selection={selection}
                activeSlot={activeSlot}
                styleId={styleId}
                onOpenSlot={(slot) => setActiveSlot(slot)}
                onChoose={choose}
                onToggleOptional={toggleOptional}
              />
            </div>
          </div>

          <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <QuotePanel
              quote={quote}
              guestCount={guestCount}
              budget={useBudget ? budget : undefined}
            />

            {weddingDate && (
              <div className="rounded-xl border border-sage/40 bg-sage/10 px-4 py-3 text-xs text-ink/70">
                ✓ All {quote.bySupplier.length} suppliers show as available for{" "}
                <span className="font-medium">
                  {new Date(weddingDate).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
                .
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={shareLook}
                className="flex-1 rounded-full border border-ink/20 py-2.5 text-sm text-ink hover:border-ink/40"
              >
                {copied ? "Link copied ✓" : "🔗 Save & share look"}
              </button>
            </div>

            <button
              onClick={() => setStep("book")}
              className="w-full rounded-full bg-ink py-3 text-cream hover:bg-ink/90"
            >
              Request to book · deposit {formatGBP(quote.deposit)}
            </button>
            <p className="text-center text-xs text-ink/40">
              No payment now — a stylist confirms availability within one working
              hour.
            </p>
          </div>
        </div>
      )}

      {/* STEP 3 — BOOK */}
      {step === "book" && (
        <div className="mx-auto mt-8 grid max-w-3xl gap-8 md:grid-cols-2">
          <div>
            <h1 className="font-serif text-3xl text-ink">
              Request to book your look
            </h1>
            <p className="mt-2 text-ink/60">
              We hold your date with every supplier for 7 days while you decide.
            </p>
            <form onSubmit={submitBooking} className="mt-6 space-y-3">
              <Field label="Your names" value={coupleName} onChange={setCoupleName} required />
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Field label="Phone" value={phone} onChange={setPhone} />
              <Field
                label="Wedding date"
                type="date"
                value={weddingDate}
                onChange={setWeddingDate}
                required
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-ink py-3 text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                {submitting
                  ? "Sending…"
                  : `Send request · deposit ${formatGBP(quote.deposit)}`}
              </button>
              <button
                type="button"
                onClick={() => setStep("studio")}
                className="w-full text-sm text-ink/50 hover:text-ink"
              >
                ← Back to styling
              </button>
            </form>
          </div>
          <div className="rounded-2xl border border-sand bg-white/60 p-5">
            <p className="font-serif text-lg text-ink">{style.name}</p>
            <p className="text-xs text-ink/50">
              {uploadedImage ? "Your venue" : venue.name} · {guestCount} guests
            </p>
            <div className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm text-ink/70">
              {quote.lines.map((l) => (
                <div key={l.item.id} className="flex justify-between">
                  <span>{l.item.name}</span>
                  <span>{formatGBP(l.lineTotal)}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-between border-t border-sand pt-3 font-serif text-xl text-ink">
              <span>Total</span>
              <span>{formatGBP(quote.subtotal)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm text-ink/60">
              <span>Deposit now</span>
              <span>{formatGBP(quote.deposit)}</span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4 — DONE */}
      {step === "done" && (
        <div className="mx-auto mt-16 max-w-lg text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sage/30 text-3xl">
            💍
          </div>
          <h1 className="font-serif text-4xl text-ink">Request sent!</h1>
          <p className="mt-3 text-ink/60">
            Your reference is{" "}
            <span className="font-mono text-ink">{orderId}</span>. A stylist will
            confirm availability with {quote.bySupplier.length} suppliers and be
            in touch within one working hour to take your{" "}
            {formatGBP(quote.deposit)} deposit.
          </p>
          <div className="mt-6 rounded-2xl border border-sand bg-white/60 p-5 text-left">
            <div className="flex justify-between font-serif text-lg text-ink">
              <span>{style.name}</span>
              <span>{formatGBP(quote.subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-ink/50">
              {uploadedImage ? "Your venue" : venue.name} · {guestCount} guests ·{" "}
              {quote.lines.length} items
            </p>
          </div>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={shareLook}
              className="rounded-full border border-ink/20 px-6 py-3 text-ink hover:border-ink/40"
            >
              {copied ? "Link copied ✓" : "Share our look"}
            </button>
            <a
              href="/plan"
              className="rounded-full bg-ink px-6 py-3 text-cream hover:bg-ink/90"
            >
              Style another
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PlanPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-ink/40">Loading…</div>}>
      <PlanInner />
    </Suspense>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["brief", "studio", "book", "done"];
  const labels: Record<Step, string> = {
    brief: "Brief",
    studio: "Style",
    book: "Book",
    done: "Done",
  };
  const idx = order.indexOf(step);
  return (
    <div className="flex items-center gap-2 text-xs">
      {order.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full ${
              i <= idx ? "bg-ink text-cream" : "bg-sand text-ink/40"
            }`}
          >
            {i + 1}
          </span>
          <span className={i <= idx ? "text-ink" : "text-ink/40"}>
            {labels[s]}
          </span>
          {i < order.length - 1 && <span className="mx-1 text-ink/20">—</span>}
        </div>
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm text-ink/70">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-ink outline-none focus:border-ink"
      />
    </label>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Slot } from "@/lib/types";
import { getStyle, getVenue } from "@/lib/styles";
import { SLOT_META, getItem } from "@/lib/catalogue";
import {
  getCoupleWedding,
  coupleApprove,
  coupleAddComment,
  coupleSetBoard,
  daysUntil,
  formatDate,
  newId,
  type Comment,
  type Wedding,
} from "@/lib/workspace";

const HERO_RENDER_STYLES = new Set([
  "rustic_barn",
  "garden_romance",
  "classic_elegance",
  "modern_minimal",
]);

export default function CouplePortal() {
  const params = useParams();
  const id = String(params.id);

  const [wedding, setWedding] = useState<Wedding | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [text, setText] = useState("");

  useEffect(() => {
    (async () => {
      setWedding((await getCoupleWedding(id)) ?? null);
      setLoaded(true);
    })();
  }, [id]);

  if (loaded && !wedding) {
    return (
      <div className="py-20 text-center text-ink/60">
        This planning link isn&apos;t available.
      </div>
    );
  }
  if (!wedding) return <div className="py-20 text-center text-ink/40">Loading…</div>;

  const style = getStyle(wedding.styleId);
  const venue = getVenue(wedding.venueId);
  const days = daysUntil(wedding.weddingDate);
  const comments = wedding.comments ?? [];
  const elements = SLOT_META.map(({ slot }) => {
    const sid = wedding.selection[slot as Slot];
    return sid ? getItem(sid) : undefined;
  }).filter(Boolean) as NonNullable<ReturnType<typeof getItem>>[];

  const heroSrc = HERO_RENDER_STYLES.has(wedding.styleId)
    ? `/img/renders/${wedding.styleId}.jpg`
    : null;

  function readAsDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function uploadBoard(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 4);
    if (files.length === 0) return;
    setAnalyzing(true);
    setAnalyzeError(null);
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
      const c: Comment = {
        id: newId("c"),
        author: "couple",
        text: `Shared a vision board — we're feeling: ${data.summary ?? "this look"}`,
        at: new Date().toISOString(),
      };
      setWedding((w) =>
        w
          ? { ...w, boardSummary: data.summary ?? w.boardSummary, comments: [...(w.comments ?? []), c] }
          : w
      );
      if (data.summary) await coupleSetBoard(id, data.summary);
    } catch {
      setAnalyzeError("Could not reach the board reader.");
    } finally {
      setAnalyzing(false);
      e.target.value = "";
    }
  }

  function approve() {
    const c: Comment = {
      id: newId("c"),
      author: "couple",
      text: "We love it — approved! 💜",
      at: new Date().toISOString(),
    };
    setWedding((w) => (w ? { ...w, approved: true, comments: [...(w.comments ?? []), c] } : w));
    coupleApprove(id);
  }

  function postComment(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    const body = text.trim();
    const c: Comment = {
      id: newId("c"),
      author: "couple",
      text: body,
      at: new Date().toISOString(),
    };
    setWedding((w) => (w ? { ...w, comments: [...(w.comments ?? []), c] } : w));
    coupleAddComment(id, body);
    setText("");
  }

  return (
    <div className="mx-auto max-w-2xl py-10">
      <p className="text-center text-xs uppercase tracking-wider text-clay">
        Your wedding plan
      </p>
      <h1 className="mt-1 text-center font-serif text-4xl text-ink">
        {wedding.coupleName}
      </h1>
      <p className="mt-1 text-center text-sm text-ink/55">
        {formatDate(wedding.weddingDate)} · {venue.name}
        {days != null && days >= 0 && <> · {days} days to go</>}
      </p>

      {/* The look */}
      <div className="mt-6 overflow-hidden rounded-3xl ring-1 ring-black/5">
        {heroSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroSrc} alt="Your styled wedding" className="w-full" />
        ) : (
          <div className="aspect-[3/2] w-full" style={{ background: venue.gradient }} />
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <p className="font-serif text-xl text-ink">{style.name}</p>
        <span className="text-xs text-ink/45">Illustrative — your planner refines the details</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {elements.map((item) => (
          <span
            key={item.id}
            className="rounded-full border border-sand bg-white/70 px-3 py-1 text-xs text-ink/70"
          >
            {item.name}
          </span>
        ))}
      </div>

      {/* Approve */}
      {wedding.approved ? (
        <div className="mt-6 rounded-2xl bg-sage/15 p-4 text-center text-sm font-medium text-sage">
          ✓ You&apos;ve approved this look — your planner has been notified.
        </div>
      ) : (
        <button
          onClick={approve}
          className="mt-6 w-full rounded-full bg-ink py-3 text-cream hover:bg-ink/90"
        >
          💜 Love it — approve this look
        </button>
      )}

      {/* Vision board */}
      <div className="mt-8 rounded-2xl border border-clay/30 bg-gradient-to-br from-blush/20 to-sage/10 p-5">
        <p className="font-serif text-lg text-ink">Share your vision</p>
        <p className="mt-0.5 text-xs text-ink/60">
          Upload a Pinterest board or inspiration pics — our AI reads the look and
          shares it with your planner.
        </p>
        <label
          className={`mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-clay px-3 py-2.5 text-sm text-clay hover:bg-clay/10 ${
            analyzing ? "pointer-events-none opacity-60" : ""
          }`}
        >
          <input type="file" accept="image/*" multiple onChange={uploadBoard} className="hidden" />
          {analyzing ? (
            <span className="animate-pulse">Reading your board…</span>
          ) : (
            <span>⬆ Upload vision board</span>
          )}
        </label>
        {analyzeError && <p className="mt-2 text-xs text-red-600">{analyzeError}</p>}
      </div>

      {/* Messages */}
      <div className="mt-8">
        <p className="font-serif text-lg text-ink">Messages with your planner</p>
        <div className="mt-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-ink/40">No messages yet — say hello!</p>
          )}
          {comments.map((c) => (
            <div
              key={c.id}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                c.author === "couple"
                  ? "ml-auto bg-ink text-cream"
                  : "bg-sand/70 text-ink/80"
              }`}
            >
              {c.text}
            </div>
          ))}
        </div>
        <form onSubmit={postComment} className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Message your planner…"
            className="flex-1 rounded-full border border-sand bg-white/80 px-4 py-2 text-sm outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="rounded-full bg-ink px-4 py-2 text-sm text-cream hover:bg-ink/90"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

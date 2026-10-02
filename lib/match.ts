import type { CatalogueItem, Slot } from "./types";
import { SLOT_META, itemsForSlot } from "./catalogue";

// The "cater to that area" stage: turn a structured vision-board brief (produced
// by Claude in /api/analyze) into a concrete catalogue selection the configurator
// can render and price. This is deterministic, auditable code — the moat — not AI.

export type Formality = "relaxed" | "classic" | "formal";
export type BudgetSignal = "low" | "mid" | "high";

export interface VisionBrief {
  styleId: string;
  palette: string[]; // hex colours
  formality: Formality;
  budgetSignal: BudgetSignal;
  // Free-text description of the desired look per slot (any subset)
  slotHints?: Partial<Record<Slot, string>>;
  keywords: string[];
  summary: string; // friendly one-liner to show the couple
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// 0 (identical) … 441 (opposite) distance between two hex colours.
function colourDistance(a: string, b: string): number {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return 441;
  return Math.sqrt(
    (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2
  );
}

const STOPWORDS = new Set([
  "the", "a", "and", "with", "of", "for", "to", "in", "on", "our", "my",
  "wedding", "style", "look", "want", "would", "like", "some", "very",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// How well an item's text (name + note) matches the brief's words for this slot.
function textScore(item: CatalogueItem, hintWords: string[]): number {
  if (hintWords.length === 0) return 0;
  const hay = new Set(tokens(`${item.name} ${item.note ?? ""}`));
  let hits = 0;
  for (const w of hintWords) if (hay.has(w)) hits++;
  return Math.min(6, hits * 2);
}

// Nearest-palette-colour score: closer swatch → higher (up to +3).
function paletteScore(item: CatalogueItem, palette: string[]): number {
  if (!palette.length) return 0;
  const nearest = Math.min(...palette.map((c) => colourDistance(item.swatch, c)));
  return Math.max(0, 3 * (1 - nearest / 441));
}

// Does the brief actively want this optional slot (bar / signage)?
function wantsOptional(slot: Slot, brief: VisionBrief): boolean {
  if (brief.slotHints?.[slot]) return true;
  if (brief.budgetSignal === "high") return true;
  const kw = brief.keywords.map((k) => k.toLowerCase());
  if (slot === "bar") {
    return kw.some((k) =>
      /bar|cocktail|prosecco|drinks|horsebox|tipple|gin/.test(k)
    );
  }
  if (slot === "signage") {
    return kw.some((k) => /sign|neon|welcome|mirror|calligraphy/.test(k));
  }
  return false;
}

function scoreItem(
  item: CatalogueItem,
  brief: VisionBrief,
  priceRange: { min: number; max: number }
): number {
  let score = 0;
  if (item.styles.includes(brief.styleId)) score += 5;

  const hintWords = tokens(
    `${brief.slotHints?.[item.slot] ?? ""} ${brief.keywords.join(" ")}`
  );
  score += textScore(item, hintWords);
  score += paletteScore(item, brief.palette);

  // Budget nudge: at high budget prefer the richer option in the slot,
  // at low budget prefer the leaner one. Small effect — style/fit lead.
  const spread = priceRange.max - priceRange.min;
  if (spread > 0) {
    const norm = (item.unitPrice - priceRange.min) / spread; // 0..1
    if (brief.budgetSignal === "high") score += norm * 1.5;
    else if (brief.budgetSignal === "low") score += (1 - norm) * 1.5;
  }

  // Gentle tiebreaker toward better-reviewed items.
  score += (item.rating - 4.5) * 0.5;
  return score;
}

export interface MatchResult {
  styleId: string;
  selection: Record<Slot, string | null>;
  picks: { slot: Slot; itemId: string; reason: string }[];
}

export function matchBriefToSelection(brief: VisionBrief): MatchResult {
  const selection = {} as Record<Slot, string | null>;
  const picks: MatchResult["picks"] = [];

  for (const { slot, optional } of SLOT_META) {
    const candidates = itemsForSlot(slot);
    if (candidates.length === 0) {
      selection[slot] = null;
      continue;
    }

    if (optional && !wantsOptional(slot, brief)) {
      selection[slot] = null;
      continue;
    }

    const prices = candidates.map((c) => c.unitPrice);
    const priceRange = { min: Math.min(...prices), max: Math.max(...prices) };

    let best = candidates[0];
    let bestScore = -Infinity;
    for (const item of candidates) {
      const s = scoreItem(item, brief, priceRange);
      if (s > bestScore) {
        bestScore = s;
        best = item;
      }
    }

    selection[slot] = best.id;
    const onStyle = best.styles.includes(brief.styleId);
    picks.push({
      slot,
      itemId: best.id,
      reason: onStyle ? "matches your style & palette" : "closest to your board",
    });
  }

  return { styleId: brief.styleId, selection, picks };
}

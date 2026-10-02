import type { Slot } from "./types";
import { getItem } from "./catalogue";
import { getStyle } from "./styles";

// Stage 3 of the AI-rendition pipeline: turn the matched catalogue selection into
// a render instruction. The render is "illustrative" and MUST reflect the real,
// bookable items the couple selected — so the picture keeps matching the price list.

// Short scene phrases per slot, composed from the chosen item's name.
function phraseFor(slot: Slot, name: string): string {
  const n = name.toLowerCase();
  switch (slot) {
    case "ceremony_backdrop":
      return `a ${n} as the ceremony backdrop`;
    case "florals":
      return `${n} floral arrangements`;
    case "centrepieces":
      return `${n} on every round guest table`;
    case "chairs":
      return `${n}s for the guests`;
    case "tables_linen":
      return `tables dressed with ${n}`;
    case "lighting":
      return `${n} glowing overhead`;
    case "signage":
      return `a ${n}`;
    case "bar":
      return `a ${n}`;
    default:
      return n;
  }
}

// Build the full text-to-image prompt from the selection, style and venue.
export function buildRenderPrompt(
  selection: Record<Slot, string | null>,
  styleId: string,
  venueKind: string
): string {
  const style = getStyle(styleId);

  const order: Slot[] = [
    "ceremony_backdrop",
    "tables_linen",
    "centrepieces",
    "florals",
    "chairs",
    "lighting",
    "signage",
    "bar",
  ];

  const phrases = order
    .map((slot) => {
      const id = selection[slot];
      const item = id ? getItem(id) : undefined;
      return item ? phraseFor(slot, item.name) : null;
    })
    .filter(Boolean) as string[];

  const elements = phrases.length
    ? `The scene features ${phrases.join(", ")}.`
    : "";

  const palette = style.palette.join(", ");

  return (
    `Photorealistic wide interior photograph of ${
      /^[aeiou]/i.test(venueKind) ? "an" : "a"
    } ${venueKind.toLowerCase()} styled for a wedding reception in a ${style.name} style — ${style.tagline}. ` +
    `${elements} ` +
    `Colour palette ${palette}. ` +
    `Round tables set for dinner, elegant and inviting, soft natural daylight, professional wedding photography, high detail, no people, no text, no watermark.`
  ).trim();
}

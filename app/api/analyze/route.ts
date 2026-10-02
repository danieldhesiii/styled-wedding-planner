import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { STYLES } from "@/lib/styles";
import { SLOT_META } from "@/lib/catalogue";
import { matchBriefToSelection, type VisionBrief } from "@/lib/match";

export const runtime = "nodejs";
export const maxDuration = 60;

// Stage 1 of the AI-rendition pipeline: "read the board".
// A couple uploads an inspiration/vision board (one or more images); Claude reads
// it and returns a STRUCTURED brief in our catalogue's own vocabulary (style ids,
// slot hints, palette, budget signal). We force a single tool call so the output
// is always valid structured data — no fragile text parsing. The brief then flows
// into the deterministic matcher (Stage 2) to produce a priced, bookable selection.

const STYLE_IDS = STYLES.map((s) => s.id);
const SLOT_IDS = SLOT_META.map((s) => s.slot);

const BRIEF_TOOL: Anthropic.Tool = {
  name: "record_wedding_brief",
  description:
    "Record the structured styling brief extracted from the couple's vision board.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      styleId: {
        type: "string",
        enum: STYLE_IDS,
        description:
          "The single closest overall style: rustic_barn (warm wood, foliage, festoon), garden_romance (blush blooms, soft linen, candlelight), classic_elegance (ivory, gold, tall arrangements), modern_minimal (clean lines, muted tones, sculptural stems).",
      },
      palette: {
        type: "array",
        items: { type: "string" },
        description:
          "Up to 5 dominant colours from the board as hex codes, e.g. #d9b7ad.",
      },
      formality: {
        type: "string",
        enum: ["relaxed", "classic", "formal"],
        description: "Overall formality the board conveys.",
      },
      budgetSignal: {
        type: "string",
        enum: ["low", "mid", "high"],
        description:
          "How lavish the look appears: low = simple/pared-back, mid = typical, high = opulent/statement pieces.",
      },
      slotHints: {
        type: "object",
        additionalProperties: false,
        description:
          "For any element clearly present in the board, a short phrase describing the desired look. Omit elements the board doesn't show.",
        properties: Object.fromEntries(
          SLOT_IDS.map((s) => [
            s,
            { type: "string", description: `Desired ${s.replace(/_/g, " ")}.` },
          ])
        ),
      },
      keywords: {
        type: "array",
        items: { type: "string" },
        description:
          "5-12 concrete descriptive keywords seen in the board (e.g. eucalyptus, candlelight, moongate, prosecco bar).",
      },
      summary: {
        type: "string",
        description:
          "One friendly sentence to show the couple, starting with 'We spotted' or similar, describing the look you read from their board.",
      },
    },
    required: ["styleId", "palette", "formality", "budgetSignal", "keywords", "summary"],
  },
};

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)$/i.exec(dataUrl);
  if (!m) return null;
  const mediaType = m[1].toLowerCase() === "image/jpg" ? "image/jpeg" : m[1].toLowerCase();
  return { mediaType, data: m[2] };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function dist(a: number[], b: number[]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

// Keyless demo fallback: no AI, no key, no cost. Reads the board's dominant
// colours with sharp and matches them to the nearest style preset, then runs the
// same catalogue matcher. Genuinely responds to the uploaded board (by palette).
async function colourBrief(base64: string): Promise<VisionBrief> {
  const buf = Buffer.from(base64, "base64");
  const sharp = (await import("sharp")).default;
  const raw = await sharp(buf)
    .resize(16, 16, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer();

  const all: number[][] = [];
  for (let i = 0; i + 2 < raw.length; i += 3) {
    all.push([raw[i], raw[i + 1], raw[i + 2]]);
  }
  // Prefer the accent/saturated colours over a neutral (ivory/beige) background,
  // so the match keys off the board's real character.
  const sat = (c: number[]) => Math.max(...c) - Math.min(...c);
  const sorted = [...all].sort((a, b) => sat(b) - sat(a));
  const accents = sorted.filter((c) => sat(c) > 20);
  const samples = accents.length > 0 ? accents : sorted;
  const palette = samples.slice(0, 5).map((s) => rgbToHex(s[0], s[1], s[2]));

  let bestStyle = STYLES[0];
  let bestD = Infinity;
  for (const s of STYLES) {
    const styleRgb = s.palette
      .map(hexToRgb)
      .filter((c): c is [number, number, number] => c !== null);
    let d = Infinity;
    for (const smp of samples) for (const c of styleRgb) d = Math.min(d, dist(smp, c));
    if (d < bestD) {
      bestD = d;
      bestStyle = s;
    }
  }

  return {
    styleId: bestStyle.id,
    palette,
    formality: "classic",
    budgetSignal: "mid",
    keywords: [],
    slotHints: {},
    summary: `We matched your board's colours to our ${bestStyle.name} look — swap anything below to refine. (Demo colour-match; add an API key for full AI board reading.)`,
  };
}

export async function POST(req: Request) {
  let body: { images?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const images = (body.images ?? []).slice(0, 4);
  const parsed = images
    .map(parseDataUrl)
    .filter((x): x is { mediaType: string; data: string } => x !== null);

  if (parsed.length === 0) {
    return NextResponse.json(
      { error: "Please upload at least one image of your vision board." },
      { status: 400 }
    );
  }

  // No key → keyless colour-match demo (works offline, no cost).
  if (!process.env.ANTHROPIC_API_KEY) {
    try {
      const brief = await colourBrief(parsed[0].data);
      const match = matchBriefToSelection(brief);
      return NextResponse.json({
        ok: true,
        mode: "demo",
        styleId: match.styleId,
        selection: match.selection,
        summary: brief.summary,
        palette: brief.palette,
        keywords: brief.keywords,
      });
    } catch {
      return NextResponse.json(
        { error: "Could not read that image. Please try another." },
        { status: 502 }
      );
    }
  }

  const client = new Anthropic();

  const imageBlocks: Anthropic.ImageBlockParam[] = parsed.map((p) => ({
    type: "image",
    source: {
      type: "base64",
      media_type: p.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
      data: p.data,
    },
  }));

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2000,
      system:
        "You are an experienced UK wedding stylist for a service covering Essex, Hertfordshire and the London fringe. You read a couple's inspiration/vision board and translate it into our catalogue's structured vocabulary so we can style their actual venue with real, bookable supplier items. Map what you genuinely see — do not invent elements that aren't shown. Always respond by calling the record_wedding_brief tool.",
      tools: [BRIEF_TOOL],
      tool_choice: { type: "tool", name: "record_wedding_brief" },
      messages: [
        {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: "Here is our wedding vision board. Read the overall style, colour palette and the specific elements you can see, and record the brief.",
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "Could not read this board. Please try a different image." },
        { status: 422 }
      );
    }

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock =>
        b.type === "tool_use" && b.name === "record_wedding_brief"
    );
    if (!toolUse) {
      return NextResponse.json(
        { error: "Could not interpret the board. Please try again." },
        { status: 502 }
      );
    }

    const brief = toolUse.input as VisionBrief;
    // Guard against an off-vocabulary style id.
    if (!STYLE_IDS.includes(brief.styleId)) brief.styleId = STYLE_IDS[0];

    const match = matchBriefToSelection(brief);

    return NextResponse.json({
      ok: true,
      styleId: match.styleId,
      selection: match.selection,
      summary: brief.summary,
      palette: brief.palette,
      keywords: brief.keywords,
    });
  } catch (err) {
    const msg =
      err instanceof Anthropic.APIError
        ? `Anthropic API error (${err.status}).`
        : "Something went wrong reading the board.";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

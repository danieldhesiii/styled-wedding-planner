import { NextResponse } from "next/server";
import type { Slot } from "@/lib/types";
import { buildRenderPrompt } from "@/lib/renderPrompt";

export const runtime = "nodejs";
export const maxDuration = 120;

// Stage 3: the render engine. The Build Plan treats the AI image as a commodity,
// so it lives behind this one endpoint. It composes a prompt from the matched
// catalogue items (so the picture reflects what's actually bookable) and
// generates a photoreal styled scene.
//
// Default provider: Pollinations (free, no API key). We fetch the image
// server-side and crop its watermark band with sharp before returning a clean
// data URL.
//
// Upgrade path (venue-accurate image-to-image): set IMAGE_MODEL_API_KEY +
// IMAGE_MODEL_PROVIDER and implement the provider branch below — pass the
// couple's own venue photo as a reference image so the render is of THEIR room.

interface RenderRequest {
  selection?: Record<Slot, string | null>;
  itemIds?: string[];
  styleId: string;
  venueKind?: string;
  venueName?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchPollinations(prompt: string): Promise<Buffer> {
  // The free tier rate-limits under load; retry a few times with backoff and a
  // fresh seed each time before giving up.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(4000);
    const seed = Math.floor(Math.random() * 1_000_000);
    const url =
      "https://image.pollinations.ai/prompt/" +
      encodeURIComponent(prompt) +
      `?width=1216&height=832&model=flux&nologo=true&seed=${seed}`;
    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(100_000) });
      if (!resp.ok) {
        lastErr = new Error(`image provider ${resp.status}`);
        continue;
      }
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length < 8000) {
        lastErr = new Error("image too small");
        continue;
      }
      return buf;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("render failed");
}

async function pollinationsRender(prompt: string): Promise<string> {
  const buf = await fetchPollinations(prompt);

  // Crop the bottom watermark band using the image's actual dimensions.
  try {
    const sharp = (await import("sharp")).default;
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 1216;
    const h = meta.height ?? 832;
    const keep = Math.max(1, h - Math.round(h * 0.11));
    const out = await sharp(buf)
      .extract({ left: 0, top: 0, width: w, height: keep })
      .jpeg({ quality: 82 })
      .toBuffer();
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch {
    // sharp unavailable — return uncropped rather than failing the request.
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  }
}

export async function POST(req: Request) {
  let body: RenderRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { styleId } = body;
  if (!styleId) {
    return NextResponse.json({ error: "Missing styleId." }, { status: 400 });
  }

  // Accept either a full selection map or a flat list of item ids.
  let selection = body.selection;
  if (!selection && Array.isArray(body.itemIds)) {
    selection = {} as Record<Slot, string | null>;
    // Reconstruct a slot->item map from the ids.
    const { getItem } = await import("@/lib/catalogue");
    for (const id of body.itemIds) {
      const item = getItem(id);
      if (item) selection[item.slot] = id;
    }
  }
  if (!selection) {
    return NextResponse.json(
      { error: "Provide a selection or itemIds." },
      { status: 400 }
    );
  }

  const venueKind = body.venueKind || "wedding venue";
  const prompt = buildRenderPrompt(selection, styleId, venueKind);

  // Upgrade path: a configured, keyed provider for venue-accurate image-to-image.
  const provider = process.env.IMAGE_MODEL_PROVIDER;
  const key = process.env.IMAGE_MODEL_API_KEY;
  if (provider && key) {
    // Implement e.g. fal.ai FLUX Kontext / OpenAI image edits here, passing the
    // couple's venue photo as the reference image. Falls through to the free
    // provider until implemented so the feature always works.
  }

  try {
    const image = await pollinationsRender(prompt);
    return NextResponse.json({ ok: true, mode: "illustrative", image, prompt });
  } catch {
    return NextResponse.json(
      { error: "The renderer is busy right now — please try again in a moment." },
      { status: 502 }
    );
  }
}

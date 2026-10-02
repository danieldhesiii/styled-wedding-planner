# Styled — Shoppable Wedding Visualiser (Proof of Concept)

Turns a styled render of a couple's wedding into a **priced, bookable order from
real local suppliers**. The platform earns ~12% commission on each confirmed
order. Based on the *Shoppable Wedding Visualiser Company Build Plan* and
*UK Wedding Business Playbook*.

This POC proves the core loop of **Release 1 (the quote app / MVP)** as a live,
IKEA/Nike-style configurator:

> pick/upload venue → choose a style → **click any detail to swap it and watch
> the room + price update instantly** → style to a budget → save & share →
> request to book the whole look with one deposit.

## What's in the POC

| Area | Status in POC |
| --- | --- |
| Live configurator (`/plan`) | ✅ Real item photos pinned on the real venue; click-to-swap updates on the spot |
| Real AI-generated imagery | ✅ 3 venue interiors + all 21 catalogue photos (Higgsfield `gpt_image_2` + Pollinations) |
| Seeded Essex/Herts supplier catalogue | ✅ 9 suppliers, 21 items across 8 slots |
| Live itemised quote grouped by supplier | ✅ Quantities auto-scale to guest count |
| Budget meter | ✅ Set a budget, see over/under live |
| Deposit model | ✅ 25% deposit to secure the date, shown throughout |
| Save & share a look | ✅ Shareable URL that restores the exact configuration |
| Availability check | ✅ Per-date supplier availability (mocked) |
| Ratings & reviews on items | ✅ Shown on every option card |
| "Request to book" lead capture | ✅ Saved to `data/orders.json` |
| Admin dashboard (orders, GMV, commission) | ✅ `/admin` |
| Full AI scene render | ⏳ Pluggable engine at `app/api/render` |
| Stripe Connect checkout, supplier portal | ⏳ Release 2 (not in POC) |

### Imagery
Catalogue photos live in `/public/img`. They were AI-generated so every picture
matches a real catalogue item — **all 21 items and all 3 venues have photos**.
The look-defining items (backdrops, florals, centrepieces, bars, chairs) were
made with Higgsfield (`gpt_image_2`); the rest were generated free with
Pollinations. Every item still has an icon+swatch fallback in the data if an
image is ever missing.

The configurator swaps are **instant client-side** (no per-change AI latency) —
exactly how IKEA/Nike configurators work. A full photoreal re-render is left as a
pluggable step (`app/api/render`); drop in an `IMAGE_MODEL_API_KEY` to wire it.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 — then:
- **/** landing page
- **/plan** the styling tool (the main flow)
- **/admin** booking requests, pipeline value and commission

## Architecture

- **Next.js 15 (App Router) + TypeScript + Tailwind** — the stack named in the
  Build Plan (Next.js on Vercel).
- `lib/catalogue.ts` — seeded suppliers/items (the inventory = the moat).
- `lib/quote.ts` — quantity rules + quote builder + 12% commission.
- `components/VenuePreview.tsx` — the illustrative render.
- `components/QuotePanel.tsx` — the live itemised quote.
- `app/api/orders` — file-based order store (→ Supabase/Postgres in Release 2).
- `app/api/render` — pluggable render engine (→ hosted image model).

## Next steps toward the real build (from the Build Plan)

1. **Supabase** for data/auth/storage (replace the JSON store + add RLS for
   supplier data).
2. **Stripe Connect** checkout: deposit split to suppliers minus commission.
3. **Real render**: wire `app/api/render` to an image-editing model, constrained
   to catalogue reference images.
4. **Supplier portal**: catalogue upload, availability calendar, payouts.
5. **Venue embeds + search pages** for acquisition (Release 4).

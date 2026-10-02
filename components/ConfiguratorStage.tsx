"use client";

import type { CatalogueItem, Slot, StylePreset } from "@/lib/types";
import { formatGBP } from "@/lib/quote";

// The live "render": the couple's venue with their chosen items pinned onto it.
// Clicking a pin opens that slot's options; swapping updates the pin instantly —
// the IKEA/Nike "configure it and watch it change" moment, using real catalogue
// photos. No per-change AI latency: swaps are instant client-side.

// Percentage positions so pins sit sensibly over the room and stay responsive.
const POSITIONS: Record<Slot, { top: string; left: string }> = {
  ceremony_backdrop: { top: "16%", left: "50%" },
  florals: { top: "46%", left: "22%" },
  centrepieces: { top: "58%", left: "50%" },
  chairs: { top: "78%", left: "38%" },
  tables_linen: { top: "60%", left: "76%" },
  lighting: { top: "20%", left: "82%" },
  signage: { top: "80%", left: "16%" },
  bar: { top: "44%", left: "82%" },
};

export default function ConfiguratorStage({
  venueImage,
  venueGradient,
  uploadedImage,
  style,
  items,
  activeSlot,
  onPinClick,
}: {
  venueImage?: string;
  venueGradient: string;
  uploadedImage: string | null;
  style: StylePreset;
  items: { slot: Slot; item: CatalogueItem }[];
  activeSlot: Slot | null;
  onPinClick: (slot: Slot) => void;
}) {
  const bg = uploadedImage || venueImage;

  return (
    <div className="relative aspect-[3/2] w-full overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5">
      {/* Venue photo / fallback */}
      {bg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bg}
          alt="Your venue"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: venueGradient }} />
      )}

      {/* Style wash + depth */}
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{ backgroundColor: style.wash }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-black/10" />

      {/* Item pins */}
      {items.map(({ slot, item }) => {
        const pos = POSITIONS[slot];
        const active = activeSlot === slot;
        return (
          <button
            key={slot}
            onClick={() => onPinClick(slot)}
            style={{ top: pos.top, left: pos.left }}
            className={`group absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 hover:z-20 hover:scale-105 ${
              active ? "z-20 scale-105" : ""
            }`}
            aria-label={`Change ${item.name}`}
          >
            <div
              className={`place-in overflow-hidden rounded-2xl bg-cream shadow-xl ring-2 transition ${
                active ? "ring-ink" : "ring-white/90"
              }`}
              style={{ width: 74, height: 74 }}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-2xl"
                  style={{ backgroundColor: item.swatch }}
                >
                  {item.icon}
                </div>
              )}
            </div>
            {/* Caption */}
            <div className="mt-1 flex -translate-x-1/2 translate-x-0 justify-center">
              <span className="whitespace-nowrap rounded-full bg-cream/95 px-2 py-0.5 text-[10px] font-medium text-ink shadow">
                {item.name} · {formatGBP(item.unitPrice)}
              </span>
            </div>
            {/* Swap hint dot */}
            <span
              className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-cream shadow ${
                active ? "bg-ink" : "bg-clay"
              }`}
            >
              ⇄
            </span>
          </button>
        );
      })}

      {/* Illustrative badge */}
      <div className="absolute left-3 top-3 z-10 rounded-full bg-black/45 px-2.5 py-1 text-[10px] uppercase tracking-wide text-white/90">
        Illustrative render · tap a pin to swap
      </div>

      {/* Palette */}
      <div className="absolute bottom-3 right-3 z-10 flex gap-1">
        {style.palette.map((c) => (
          <span
            key={c}
            className="h-4 w-4 rounded-full ring-1 ring-white/70"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

"use client";

import type { CatalogueItem, Slot } from "@/lib/types";
import { SLOT_META, itemsForSlot, getItem, slotMeta } from "@/lib/catalogue";
import { formatGBP } from "@/lib/quote";

// The configurator control surface: a rail of every slot (showing the current
// choice), and — for the active slot — a grid of real-photo option cards you
// click to switch. Choosing instantly updates the stage and the quote.
export default function ItemPicker({
  selection,
  activeSlot,
  styleId,
  onOpenSlot,
  onChoose,
  onToggleOptional,
}: {
  selection: Record<Slot, string | null>;
  activeSlot: Slot | null;
  styleId: string;
  onOpenSlot: (slot: Slot) => void;
  onChoose: (slot: Slot, id: string) => void;
  onToggleOptional: (slot: Slot) => void;
}) {
  const active = activeSlot ?? SLOT_META[0].slot;
  const meta = slotMeta(active);
  const options = itemsForSlot(active);

  return (
    <div>
      {/* Slot rail */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {SLOT_META.map(({ slot, label }) => {
          const current = selection[slot] ? getItem(selection[slot]!) : null;
          const isActive = active === slot;
          return (
            <button
              key={slot}
              onClick={() => onOpenSlot(slot)}
              className={`flex min-w-[88px] flex-col items-center gap-1 rounded-xl border p-2 transition ${
                isActive
                  ? "border-ink bg-white ring-1 ring-ink"
                  : "border-sand bg-white/60 hover:border-ink/30"
              }`}
            >
              <div className="h-12 w-12 overflow-hidden rounded-lg bg-sand">
                {current?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={current.image}
                    alt={current.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-lg"
                    style={{ backgroundColor: current?.swatch ?? "#efe7db" }}
                  >
                    {current?.icon ?? "—"}
                  </div>
                )}
              </div>
              <span className="text-center text-[10px] leading-tight text-ink/70">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active slot header */}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <h3 className="font-serif text-lg text-ink">{meta.label}</h3>
          <p className="text-xs text-ink/50">{meta.blurb}</p>
        </div>
        {meta.optional && (
          <button
            onClick={() => onToggleOptional(active)}
            className="rounded-full border border-clay px-3 py-1 text-xs text-clay hover:bg-clay/10"
          >
            {selection[active] ? "Remove from look" : "Add to look"}
          </button>
        )}
      </div>

      {/* Option cards */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {options.map((opt) => {
          const chosen = selection[active] === opt.id;
          const suitsStyle = opt.styles.includes(styleId);
          return (
            <button
              key={opt.id}
              onClick={() => onChoose(active, opt.id)}
              className={`group overflow-hidden rounded-xl border text-left transition ${
                chosen
                  ? "border-ink ring-2 ring-ink"
                  : "border-sand hover:border-ink/40"
              }`}
            >
              <div className="relative aspect-square bg-sand">
                {opt.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={opt.image}
                    alt={opt.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-4xl"
                    style={{ backgroundColor: opt.swatch }}
                  >
                    {opt.icon}
                  </div>
                )}
                {chosen && (
                  <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-[11px] text-cream">
                    ✓
                  </span>
                )}
                {suitsStyle && !chosen && (
                  <span className="absolute left-1.5 top-1.5 rounded-full bg-sage/90 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    on style
                  </span>
                )}
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-medium text-ink">
                  {opt.name}
                </p>
                <div className="mt-0.5 flex items-center justify-between text-[11px] text-ink/55">
                  <span>
                    {formatGBP(opt.unitPrice)}
                    <span className="text-ink/35"> {opt.unit}</span>
                  </span>
                  <span className="text-gold">★ {opt.rating}</span>
                </div>
                <p className="mt-0.5 truncate text-[10px] text-ink/40">
                  {opt.supplier}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import type { Quote } from "@/lib/types";
import { formatGBP, tablesFor } from "@/lib/quote";

// The live itemised quote — the heart of the product. Grouped by supplier, with
// quantities scaled to guest count, a deposit-now breakdown, and an optional
// budget meter so couples can style to a number (a key buyer need).
export default function QuotePanel({
  quote,
  guestCount,
  budget,
}: {
  quote: Quote;
  guestCount: number;
  budget?: number;
}) {
  const overBudget = budget != null && quote.subtotal > budget;
  const pct =
    budget && budget > 0
      ? Math.min(100, Math.round((quote.subtotal / budget) * 100))
      : 0;

  return (
    <div className="rounded-2xl border border-sand bg-white/80 p-5">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="font-serif text-xl text-ink">Your itemised quote</h3>
        <span className="text-xs text-ink/50">
          {guestCount} guests · {tablesFor(guestCount)} tables
        </span>
      </div>

      {/* Budget meter */}
      {budget != null && (
        <div className="mb-4">
          <div className="flex justify-between text-xs">
            <span className="text-ink/60">Budget {formatGBP(budget)}</span>
            <span className={overBudget ? "text-red-600" : "text-sage"}>
              {overBudget
                ? `${formatGBP(quote.subtotal - budget)} over`
                : `${formatGBP(budget - quote.subtotal)} to spare`}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sand">
            <div
              className={`h-full rounded-full transition-all ${
                overBudget ? "bg-red-500" : "bg-sage"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
        {quote.bySupplier.map((group) => (
          <div key={group.supplier}>
            <div className="mb-1 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">
                  {group.supplier}
                </p>
                <p className="text-[11px] text-ink/45">{group.area}</p>
              </div>
              <p className="text-sm font-medium text-ink">
                {formatGBP(group.total)}
              </p>
            </div>
            <ul className="space-y-1 border-l border-sand pl-3">
              {group.lines.map((line) => (
                <li
                  key={line.item.id}
                  className="flex items-center justify-between text-xs text-ink/70"
                >
                  <span>
                    {line.item.name}
                    <span className="text-ink/40"> × {line.quantity}</span>
                  </span>
                  <span>{formatGBP(line.lineTotal)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-5 border-t border-sand pt-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-ink/60">Estimated total</span>
          <span className="font-serif text-2xl text-ink">
            {formatGBP(quote.subtotal)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-xl bg-sand/60 px-3 py-2">
          <span className="text-xs text-ink/70">Deposit to secure your date</span>
          <span className="text-sm font-semibold text-ink">
            {formatGBP(quote.deposit)}
          </span>
        </div>
        <p className="mt-2 text-[11px] text-ink/40">
          One deposit holds every supplier for your date. Balance due 6 weeks
          before the wedding. No card charged until a stylist confirms
          availability.
        </p>
      </div>
    </div>
  );
}

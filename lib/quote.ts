import type { CatalogueItem, Quote, QuoteLine, Slot } from "./types";
import { CATALOGUE, SLOT_META, itemsForSlot, getItem } from "./catalogue";

export const GUESTS_PER_TABLE = 10;
export const COMMISSION_RATE = 0.12; // 12% average, per the Build Plan
export const DEPOSIT_RATE = 0.25; // 25% deposit secures every supplier for the date

export function tablesFor(guestCount: number): number {
  return Math.max(1, Math.ceil(guestCount / GUESTS_PER_TABLE));
}

// Quantity for an item given the guest count and its qty rule.
export function quantityFor(item: CatalogueItem, guestCount: number): number {
  switch (item.qtyRule) {
    case "per_guest":
      return guestCount;
    case "per_table":
      return tablesFor(guestCount);
    case "per_venue":
    case "fixed":
    default:
      return 1;
  }
}

// Default selection for a style: the first catalogue item in each required slot
// that suits the style. Optional slots (signage, bar) start selected too so the
// couple sees a complete, aspirational look they can then trim.
export function defaultSelection(styleId: string): Record<Slot, string | null> {
  const selection = {} as Record<Slot, string | null>;
  for (const { slot } of SLOT_META) {
    const match =
      itemsForSlot(slot).find((i) => i.styles.includes(styleId)) ??
      itemsForSlot(slot)[0] ??
      null;
    selection[slot] = match ? match.id : null;
  }
  return selection;
}

// Build a full quote from a selection map + guest count. Groups by supplier so
// the couple sees who supplies what — the core of the product.
export function buildQuote(
  selection: Record<Slot, string | null>,
  guestCount: number
): Quote {
  const lines: QuoteLine[] = [];

  for (const { slot } of SLOT_META) {
    const id = selection[slot];
    if (!id) continue;
    const item = getItem(id);
    if (!item) continue;
    const quantity = quantityFor(item, guestCount);
    const lineTotal = Math.round(item.unitPrice * quantity);
    lines.push({ item, quantity, lineTotal });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  const commission = Math.round(subtotal * COMMISSION_RATE);
  const deposit = Math.round(subtotal * DEPOSIT_RATE);

  const supplierMap = new Map<string, QuoteLine[]>();
  for (const line of lines) {
    const key = line.item.supplier;
    if (!supplierMap.has(key)) supplierMap.set(key, []);
    supplierMap.get(key)!.push(line);
  }

  const bySupplier = Array.from(supplierMap.entries()).map(([supplier, ls]) => ({
    supplier,
    area: ls[0].item.supplierArea,
    total: ls.reduce((s, l) => s + l.lineTotal, 0),
    lines: ls,
  }));

  return { lines, subtotal, commission, deposit, bySupplier };
}

export function formatGBP(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

export function supplierCount(): number {
  return new Set(CATALOGUE.map((i) => i.supplier)).size;
}

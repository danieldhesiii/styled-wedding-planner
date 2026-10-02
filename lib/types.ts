// Core domain types for the shoppable wedding visualiser POC.
// Data model mirrors the Build Plan: Supplier -> Items; Couple -> Wedding ->
// Looks -> Look items; Order -> Order lines.

export type QtyRule = "per_guest" | "per_table" | "fixed" | "per_venue";

// A "slot" is a visual/functional position in the styled render. Each slot holds
// at most one selected item, and offers several swappable alternatives.
export type Slot =
  | "ceremony_backdrop"
  | "centrepieces"
  | "chairs"
  | "tables_linen"
  | "lighting"
  | "florals"
  | "signage"
  | "bar";

export interface CatalogueItem {
  id: string;
  name: string;
  slot: Slot;
  supplier: string;
  supplierArea: string;
  unitPrice: number; // GBP per unit
  unit: string; // e.g. "each", "per table", "package"
  qtyRule: QtyRule;
  styles: string[]; // style ids this item suits
  icon: string; // emoji used as a fallback when there's no photo
  swatch: string; // hex colour used in the preview / fallback
  image?: string; // real catalogue photo (public path)
  rating: number; // supplier item rating out of 5
  reviewCount: number;
  leadTimeDays: number; // how far ahead it must be booked
  note?: string;
}

export interface StylePreset {
  id: string;
  name: string;
  tagline: string;
  palette: string[]; // hex colours
  wash: string; // overlay tint applied to the venue photo in the preview
}

export interface SampleVenue {
  id: string;
  name: string;
  area: string;
  kind: string;
  gradient: string; // CSS gradient fallback when there's no photo
  image?: string; // real empty-venue photo (public path)
}

// A selected line in the quote: an item + the quantity derived from guest count.
export interface QuoteLine {
  item: CatalogueItem;
  quantity: number;
  lineTotal: number;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: number;
  commission: number; // what the platform earns (internal)
  deposit: number; // what the couple pays now to secure the date
  bySupplier: { supplier: string; area: string; total: number; lines: QuoteLine[] }[];
}

export interface Order {
  id: string;
  createdAt: string;
  coupleName: string;
  email: string;
  phone: string;
  weddingDate: string;
  venue: string;
  styleId: string;
  guestCount: number;
  subtotal: number;
  deposit: number;
  commission: number;
  itemIds: string[];
  status: "requested" | "confirmed" | "declined";
}

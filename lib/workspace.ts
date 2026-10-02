import type { Slot } from "./types";
import { defaultSelection } from "./quote";
import { SAMPLE_VENUES } from "./styles";
import { supabase } from "./supabase";

// Planner workspace data model. A planner has many weddings; each wedding holds
// its own design (style + selection), details, timeline, guests, seating and
// couple collaboration. Persisted in Supabase (Postgres) with row-level security
// so each authenticated planner only ever sees their own weddings. Couple-portal
// access is capability-based (the wedding's unguessable id) via security-definer
// RPCs — no login required for the couple.

export type WeddingStatus = "lead" | "booked" | "planning" | "complete";

export const STATUS_META: Record<
  WeddingStatus,
  { label: string; className: string }
> = {
  lead: { label: "Lead", className: "bg-sand text-ink/60" },
  booked: { label: "Booked", className: "bg-clay/20 text-clay" },
  planning: { label: "Planning", className: "bg-sage/20 text-sage" },
  complete: { label: "Complete", className: "bg-ink text-cream" },
};

export interface Wedding {
  id: string;
  coupleName: string;
  email?: string;
  phone?: string;
  weddingDate: string; // yyyy-mm-dd
  venueId: string;
  guestCount: number;
  budget: number;
  styleId: string;
  selection: Record<Slot, string | null>;
  status: WeddingStatus;
  createdAt: string;
  // Phase 2/3 (all optional for backward compatibility)
  tasks?: Task[];
  guests?: Guest[];
  tables?: SeatTable[];
  comments?: Comment[];
  approved?: boolean;
  boardSummary?: string;
}

export interface Task {
  id: string;
  title: string;
  bucket: string;
  dueDate: string; // yyyy-mm-dd
  done: boolean;
}

export type Rsvp = "invited" | "yes" | "no" | "maybe";

export interface Guest {
  id: string;
  name: string;
  household: string;
  side: "A" | "B" | "both";
  rsvp: Rsvp;
  dietary: string;
  plusOne: boolean;
  tableId: string | null;
}

export interface SeatTable {
  id: string;
  name: string;
  capacity: number;
}

export interface Comment {
  id: string;
  author: "planner" | "couple";
  text: string;
  at: string;
}

// --- Row mapping (snake_case DB columns <-> camelCase Wedding) ---

/* eslint-disable @typescript-eslint/no-explicit-any */
function fromRow(r: any): Wedding {
  return {
    id: r.id,
    coupleName: r.couple_name,
    email: r.email ?? undefined,
    phone: r.phone ?? undefined,
    weddingDate: r.wedding_date ?? "",
    venueId: r.venue_id,
    guestCount: r.guest_count,
    budget: r.budget,
    styleId: r.style_id,
    selection: (r.selection ?? {}) as Record<Slot, string | null>,
    status: r.status as WeddingStatus,
    createdAt: r.created_at,
    tasks: r.tasks ?? undefined,
    guests: r.guests ?? undefined,
    tables: r.tables ?? undefined,
    comments: r.comments ?? undefined,
    approved: r.approved ?? undefined,
    boardSummary: r.board_summary ?? undefined,
  };
}

function toRow(w: Wedding): Record<string, unknown> {
  return {
    couple_name: w.coupleName,
    email: w.email ?? null,
    phone: w.phone ?? null,
    wedding_date: w.weddingDate || null,
    venue_id: w.venueId,
    guest_count: w.guestCount,
    budget: w.budget,
    style_id: w.styleId,
    selection: w.selection,
    status: w.status,
    tasks: w.tasks ?? [],
    guests: w.guests ?? [],
    tables: w.tables ?? [],
    comments: w.comments ?? [],
    approved: w.approved ?? false,
    board_summary: w.boardSummary ?? null,
    updated_at: new Date().toISOString(),
  };
}

// --- Planner CRUD (RLS scopes everything to the signed-in planner) ---

export async function listWeddings(): Promise<Wedding[]> {
  const { data, error } = await supabase
    .from("weddings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(fromRow);
}

export async function getWedding(id: string): Promise<Wedding | undefined> {
  const { data } = await supabase
    .from("weddings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? fromRow(data) : undefined;
}

export async function saveWedding(wedding: Wedding): Promise<void> {
  await supabase.from("weddings").update(toRow(wedding)).eq("id", wedding.id);
}

export async function createWedding(input: {
  coupleName: string;
  weddingDate: string;
  venueId: string;
  guestCount: number;
  budget: number;
  styleId: string;
  email?: string;
  phone?: string;
}): Promise<Wedding | null> {
  const { data, error } = await supabase
    .from("weddings")
    .insert({
      couple_name: input.coupleName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      wedding_date: input.weddingDate || null,
      venue_id: input.venueId || SAMPLE_VENUES[0].id,
      guest_count: input.guestCount,
      budget: input.budget,
      style_id: input.styleId,
      selection: defaultSelection(input.styleId),
      status: "lead",
    })
    .select("*")
    .single();
  if (error || !data) return null;
  return fromRow(data);
}

export async function deleteWedding(id: string): Promise<void> {
  await supabase.from("weddings").delete().eq("id", id);
}

// Three sample weddings for a brand-new planner (demo convenience).
export async function seedSampleWeddings(): Promise<void> {
  const samples = [
    { couple_name: "Ella & Sam", wedding_date: "2027-07-10", venue_id: "oak_barn", guest_count: 80, budget: 5000, style_id: "garden_romance", status: "planning" },
    { couple_name: "Priya & Tom", wedding_date: "2027-09-04", venue_id: "county_hall", guest_count: 120, budget: 7500, style_id: "classic_elegance", status: "booked" },
    { couple_name: "Megan & Jo", wedding_date: "2028-05-20", venue_id: "manor_orangery", guest_count: 60, budget: 4000, style_id: "modern_minimal", status: "lead" },
  ].map((s) => ({ ...s, selection: defaultSelection(s.style_id) }));
  await supabase.from("weddings").insert(samples);
}

// --- Couple portal (capability-based, no auth) ---

export async function getCoupleWedding(id: string): Promise<Wedding | undefined> {
  const { data } = await supabase.rpc("get_couple_wedding", { w_id: id });
  return data ? fromRow(data) : undefined;
}
export async function coupleApprove(id: string): Promise<void> {
  await supabase.rpc("couple_approve", { w_id: id });
}
export async function coupleAddComment(id: string, body: string): Promise<void> {
  await supabase.rpc("couple_add_comment", { w_id: id, body });
}
export async function coupleSetBoard(id: string, summary: string): Promise<void> {
  await supabase.rpc("couple_set_board", { w_id: id, summary });
}

export function daysUntil(dateIso: string): number | null {
  if (!dateIso) return null;
  const d = new Date(dateIso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export function formatDate(dateIso: string): string {
  const d = new Date(dateIso + "T00:00:00");
  if (isNaN(d.getTime())) return dateIso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function newId(prefix = "id"): string {
  return prefix + "_" + Math.random().toString(36).slice(2, 10);
}

function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(dateIso + "T00:00:00");
  if (isNaN(d.getTime())) return dateIso;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// A wedding-year checklist on the right cadence, generated from the date.
const TIMELINE_TEMPLATE: { title: string; monthsBefore: number; bucket: string }[] = [
  { title: "Confirm overall budget & guest estimate", monthsBefore: 12, bucket: "12+ months" },
  { title: "Book ceremony & reception venue", monthsBefore: 12, bucket: "12+ months" },
  { title: "Choose a colour palette & overall style", monthsBefore: 12, bucket: "12+ months" },
  { title: "Book photographer & videographer", monthsBefore: 10, bucket: "10–9 months" },
  { title: "Book caterer", monthsBefore: 10, bucket: "10–9 months" },
  { title: "Book florist", monthsBefore: 9, bucket: "10–9 months" },
  { title: "Book entertainment (DJ / band)", monthsBefore: 9, bucket: "10–9 months" },
  { title: "Send save-the-dates", monthsBefore: 8, bucket: "8–6 months" },
  { title: "Order wedding attire", monthsBefore: 7, bucket: "8–6 months" },
  { title: "Book hair & makeup", monthsBefore: 6, bucket: "8–6 months" },
  { title: "Arrange transport", monthsBefore: 6, bucket: "8–6 months" },
  { title: "Book officiant / registrar", monthsBefore: 5, bucket: "5–4 months" },
  { title: "Order invitations", monthsBefore: 4, bucket: "5–4 months" },
  { title: "Plan menu & book tasting", monthsBefore: 4, bucket: "5–4 months" },
  { title: "Send invitations", monthsBefore: 3, bucket: "3 months" },
  { title: "Order the cake", monthsBefore: 3, bucket: "3 months" },
  { title: "Finalise décor & hire items", monthsBefore: 3, bucket: "3 months" },
  { title: "Buy wedding rings", monthsBefore: 2, bucket: "2 months" },
  { title: "Confirm details with all suppliers", monthsBefore: 2, bucket: "2 months" },
  { title: "Chase RSVPs & finalise numbers", monthsBefore: 1, bucket: "1 month" },
  { title: "Create the seating plan", monthsBefore: 1, bucket: "1 month" },
  { title: "Final venue walkthrough", monthsBefore: 1, bucket: "1 month" },
  { title: "Confirm final numbers with caterer", monthsBefore: 0.5, bucket: "Final 2 weeks" },
  { title: "Confirm setup times with all suppliers", monthsBefore: 0.5, bucket: "Final 2 weeks" },
  { title: "Prepare final payments & tips", monthsBefore: 0.25, bucket: "Final week" },
  { title: "Confirm day-of timeline with the couple", monthsBefore: 0.25, bucket: "Final week" },
];

export const TIMELINE_BUCKETS = [
  "12+ months",
  "10–9 months",
  "8–6 months",
  "5–4 months",
  "3 months",
  "2 months",
  "1 month",
  "Final 2 weeks",
  "Final week",
  "Custom",
];

export function generateTimeline(weddingDate: string): Task[] {
  return TIMELINE_TEMPLATE.map((t) => ({
    id: newId("t"),
    title: t.title,
    bucket: t.bucket,
    dueDate: addDaysIso(weddingDate, -Math.round(t.monthsBefore * 30)),
    done: false,
  }));
}

// Deterministic auto-seat: keep households together, first-fit-decreasing into
// tables. Seats every guest who hasn't declined; leaves overflow unseated.
export function autoSeat(guests: Guest[], tables: SeatTable[]): Guest[] {
  const seatable = guests.filter((g) => g.rsvp !== "no");
  const groups = new Map<string, Guest[]>();
  for (const g of seatable) {
    const key = g.household.trim() || g.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(g);
  }
  const ordered = Array.from(groups.values()).sort((a, b) => b.length - a.length);
  const remaining = new Map(tables.map((t) => [t.id, t.capacity]));
  const assigned = new Map<string, string | null>();

  for (const group of ordered) {
    // find a table that fits the whole group, else the emptiest table
    let target =
      tables.find((t) => (remaining.get(t.id) ?? 0) >= group.length) ??
      tables.slice().sort((a, b) => (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0))[0];
    for (const g of group) {
      if (target && (remaining.get(target.id) ?? 0) > 0) {
        assigned.set(g.id, target.id);
        remaining.set(target.id, (remaining.get(target.id) ?? 0) - 1);
      } else {
        // move to next emptiest table
        target = tables.slice().sort((a, b) => (remaining.get(b.id) ?? 0) - (remaining.get(a.id) ?? 0))[0];
        if (target && (remaining.get(target.id) ?? 0) > 0) {
          assigned.set(g.id, target.id);
          remaining.set(target.id, (remaining.get(target.id) ?? 0) - 1);
        } else {
          assigned.set(g.id, null); // no capacity left
        }
      }
    }
  }

  return guests.map((g) =>
    g.rsvp === "no" ? { ...g, tableId: null } : { ...g, tableId: assigned.get(g.id) ?? null }
  );
}

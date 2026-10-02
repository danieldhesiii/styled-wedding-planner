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
  room?: Room;
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
  seatIndex?: number | null; // which seat around the table
}

// A table on the scaled floor plan. Positions and sizes are in metres; the room
// is drawn to scale so planners can see exactly where everyone sits.
export interface SeatTable {
  id: string;
  name: string;
  shape: "round" | "rect";
  seats: number;
  x: number; // metres, table centre from room left
  y: number; // metres, table centre from room top
  size: number; // round: diameter (m); rect: length (m)
  depth: number; // rect: depth (m)
  rotation: number; // rect rotation, degrees
}

export interface Room {
  w: number; // metres (bounding width)
  h: number; // metres (bounding length)
  door: "N" | "E" | "S" | "W"; // which wall the door is on
  points?: { x: number; y: number }[]; // optional custom polygon (metres)
}

export const DEFAULT_ROOM: Room = { w: 12, h: 9, door: "S" };

// The room outline as a polygon — a custom shape if set, else the rectangle.
export function roomPolygon(room: Room): { x: number; y: number }[] {
  if (room.points && room.points.length >= 3) return room.points;
  return [
    { x: 0, y: 0 },
    { x: room.w, y: 0 },
    { x: room.w, y: room.h },
    { x: 0, y: room.h },
  ];
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
  const used = new Map<string, number>(tables.map((t) => [t.id, 0]));
  const free = (t: SeatTable) => t.seats - (used.get(t.id) ?? 0);
  const place = new Map<string, { t: string; i: number } | null>();

  for (const group of ordered) {
    let target =
      tables.find((t) => free(t) >= group.length) ??
      tables.slice().sort((a, b) => free(b) - free(a))[0];
    for (const g of group) {
      if (!target || free(target) <= 0) {
        target = tables.slice().sort((a, b) => free(b) - free(a))[0];
      }
      if (target && free(target) > 0) {
        const i = used.get(target.id) ?? 0;
        place.set(g.id, { t: target.id, i });
        used.set(target.id, i + 1);
      } else {
        place.set(g.id, null);
      }
    }
  }

  return guests.map((g) => {
    if (g.rsvp === "no") return { ...g, tableId: null, seatIndex: null };
    const p = place.get(g.id);
    return p
      ? { ...g, tableId: p.t, seatIndex: p.i }
      : { ...g, tableId: null, seatIndex: null };
  });
}

// Seat centre positions (in metres) around a table, accounting for shape and
// rotation. Index order matches seatIndex.
export function seatPositions(t: SeatTable): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const n = Math.max(1, t.seats);
  if (t.shape === "round") {
    const ring = t.size / 2 + 0.45;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
      pts.push({ x: t.x + ring * Math.cos(a), y: t.y + ring * Math.sin(a) });
    }
  } else {
    const L = t.size;
    const D = t.depth;
    const topN = Math.ceil(n / 2);
    const botN = n - topN;
    const off = D / 2 + 0.45;
    const lay = (count: number, sign: number) => {
      const res: { x: number; y: number }[] = [];
      for (let i = 0; i < count; i++) {
        const frac = count === 1 ? 0.5 : i / (count - 1);
        const lx = -L / 2 + 0.4 + frac * (L - 0.8);
        res.push({ x: lx, y: sign * off });
      }
      return res;
    };
    const local = [...lay(topN, -1), ...lay(botN, 1)];
    const rad = (t.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    for (const p of local) {
      pts.push({
        x: t.x + p.x * cos - p.y * sin,
        y: t.y + p.x * sin + p.y * cos,
      });
    }
  }
  return pts;
}

import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { Order } from "@/lib/types";

// File-based order store for the POC. Replaces Supabase/Postgres in the real
// build (Release 2). Appends each "request to book" to data/orders.json.
const ORDERS_FILE = path.join(process.cwd(), "data", "orders.json");

async function readOrders(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(ORDERS_FILE, "utf-8");
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

async function writeOrders(orders: Order[]) {
  await fs.mkdir(path.dirname(ORDERS_FILE), { recursive: true });
  await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

export async function GET() {
  const orders = await readOrders();
  return NextResponse.json(orders);
}

export async function POST(req: Request) {
  const body = await req.json();
  const orders = await readOrders();

  const id = `REQ-${String(orders.length + 1).padStart(4, "0")}`;
  const order: Order = {
    id,
    createdAt: new Date().toISOString(),
    coupleName: body.coupleName ?? "",
    email: body.email ?? "",
    phone: body.phone ?? "",
    weddingDate: body.weddingDate ?? "",
    venue: body.venue ?? "",
    styleId: body.styleId ?? "",
    guestCount: Number(body.guestCount) || 0,
    subtotal: Number(body.subtotal) || 0,
    deposit: Number(body.deposit) || 0,
    commission: Number(body.commission) || 0,
    itemIds: Array.isArray(body.itemIds) ? body.itemIds : [],
    status: "requested",
  };

  orders.push(order);
  await writeOrders(orders);

  return NextResponse.json({ id, ok: true });
}

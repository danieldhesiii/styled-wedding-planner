import { promises as fs } from "fs";
import path from "path";
import type { Order } from "@/lib/types";
import { getStyle } from "@/lib/styles";
import { formatGBP, supplierCount, COMMISSION_RATE } from "@/lib/quote";
import { CATALOGUE } from "@/lib/catalogue";

export const dynamic = "force-dynamic";

async function getOrders(): Promise<Order[]> {
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "orders.json"),
      "utf-8"
    );
    return JSON.parse(raw) as Order[];
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const orders = await getOrders();
  const totalGMV = orders.reduce((s, o) => s + o.subtotal, 0);
  const totalCommission = orders.reduce((s, o) => s + o.commission, 0);
  const avgOrder = orders.length ? Math.round(totalGMV / orders.length) : 0;

  return (
    <div className="py-10">
      <div className="mb-8 flex items-baseline justify-between">
        <h1 className="font-serif text-3xl text-ink">Admin dashboard</h1>
        <span className="text-xs text-ink/40">
          Internal · {Math.round(COMMISSION_RATE * 100)}% commission model
        </span>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Kpi label="Booking requests" value={String(orders.length)} />
        <Kpi label="Pipeline value (GMV)" value={formatGBP(totalGMV)} />
        <Kpi label="Our commission" value={formatGBP(totalCommission)} accent />
        <Kpi label="Avg order value" value={formatGBP(avgOrder)} />
      </div>

      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Kpi label="Suppliers signed" value={String(supplierCount())} />
        <Kpi label="Catalogue items" value={String(CATALOGUE.length)} />
        <Kpi
          label="Region"
          value="Essex · Herts"
        />
      </div>

      {/* Orders table */}
      <h2 className="mb-3 mt-10 font-serif text-xl text-ink">
        Booking requests
      </h2>
      {orders.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sand bg-white/50 p-8 text-center text-sm text-ink/50">
          No requests yet. Go to{" "}
          <a href="/plan" className="text-clay underline">
            /plan
          </a>
          , style a look and request to book — it will appear here.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-sand">
          <table className="w-full text-left text-sm">
            <thead className="bg-sand/60 text-xs uppercase tracking-wide text-ink/50">
              <tr>
                <th className="px-4 py-3">Ref</th>
                <th className="px-4 py-3">Couple</th>
                <th className="px-4 py-3">Venue · style</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Guests</th>
                <th className="px-4 py-3 text-right">Order</th>
                <th className="px-4 py-3 text-right">Commission</th>
              </tr>
            </thead>
            <tbody>
              {orders
                .slice()
                .reverse()
                .map((o) => (
                  <tr key={o.id} className="border-t border-sand">
                    <td className="px-4 py-3 font-mono text-xs">{o.id}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-ink">
                        {o.coupleName || "—"}
                      </div>
                      <div className="text-xs text-ink/45">{o.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {o.venue}
                      <div className="text-xs text-ink/45">
                        {getStyle(o.styleId).name}
                      </div>
                    </td>
                    <td className="px-4 py-3">{o.weddingDate || "—"}</td>
                    <td className="px-4 py-3 text-right">{o.guestCount}</td>
                    <td className="px-4 py-3 text-right">
                      {formatGBP(o.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-clay">
                      {formatGBP(o.commission)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? "border-clay/40 bg-clay/10" : "border-sand bg-white/60"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-ink/45">{label}</p>
      <p className="mt-1 font-serif text-2xl text-ink">{value}</p>
    </div>
  );
}

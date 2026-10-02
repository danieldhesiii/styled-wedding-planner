"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  autoSeat,
  newId,
  seatPositions,
  roomPolygon,
  DEFAULT_ROOM,
  type Guest,
  type Room,
  type SeatTable,
  type Wedding,
} from "@/lib/workspace";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export default function SeatingTab({
  wedding,
  update,
}: {
  wedding: Wedding;
  update: (fn: (w: Wedding) => Wedding) => void;
}) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const room: Room = wedding.room ?? DEFAULT_ROOM;
  const tables = wedding.tables ?? [];
  const guests = wedding.guests ?? [];
  const seatable = guests.filter((g) => g.rsvp !== "no");
  const unseated = seatable.filter((g) => g.tableId == null);

  const [selected, setSelected] = useState<string | null>(null);
  const [drag, setDrag] = useState<{
    id: string;
    sx: number;
    sy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const [resize, setResize] = useState<string | null>(null);
  const [liveSize, setLiveSize] = useState<{ size: number; depth: number } | null>(null);
  const [editRoom, setEditRoom] = useState(false);
  const [vdrag, setVdrag] = useState<number | null>(null);
  const [livePt, setLivePt] = useState<{ x: number; y: number } | null>(null);

  // Ensure the wedding has a room the first time we open seating.
  useEffect(() => {
    if (!wedding.room) update((w) => ({ ...w, room: DEFAULT_ROOM }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const occupant = useMemo(() => {
    const m = new Map<string, Guest>();
    for (const g of seatable) if (g.tableId != null && g.seatIndex != null) m.set(`${g.tableId}:${g.seatIndex}`, g);
    return m;
  }, [seatable]);

  function patchRoom(p: Partial<Room>) {
    update((w) => ({ ...w, room: { ...(w.room ?? DEFAULT_ROOM), ...p } }));
  }
  const ensurePoints = () => room.points ?? roomPolygon(room);
  function startEditRoom() {
    if (!room.points) patchRoom({ points: roomPolygon(room) });
    setEditRoom(true);
  }
  function addCorner() {
    const pts = ensurePoints();
    const a = pts[0];
    const b = pts[1 % pts.length];
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    patchRoom({ points: [a, mid, ...pts.slice(1)] });
  }
  function removeCorner(i: number) {
    const pts = ensurePoints();
    if (pts.length <= 3) return;
    patchRoom({ points: pts.filter((_, k) => k !== i) });
  }
  function presetRect() {
    patchRoom({
      points: [
        { x: 0, y: 0 },
        { x: room.w, y: 0 },
        { x: room.w, y: room.h },
        { x: 0, y: room.h },
      ],
    });
  }
  function presetL() {
    const { w, h } = room;
    patchRoom({
      points: [
        { x: 0, y: 0 },
        { x: w, y: 0 },
        { x: w, y: h * 0.55 },
        { x: w * 0.5, y: h * 0.55 },
        { x: w * 0.5, y: h },
        { x: 0, y: h },
      ],
    });
  }
  function startVertexDrag(e: React.PointerEvent, i: number) {
    e.stopPropagation();
    setVdrag(i);
    setLivePt(ensurePoints()[i]);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function patchTable(id: string, p: Partial<SeatTable>) {
    update((w) => ({
      ...w,
      tables: (w.tables ?? []).map((t) => (t.id === id ? { ...t, ...p } : t)),
    }));
  }
  function addTable(shape: "round" | "rect") {
    const n = tables.length;
    const t: SeatTable = {
      id: newId("tbl"),
      name: `Table ${n + 1}`,
      shape,
      seats: 8,
      x: clamp(2.2 + (n % 4) * 2.6, 1.5, room.w - 1.5),
      y: clamp(2.2 + Math.floor(n / 4) * 2.8, 1.5, room.h - 1.5),
      size: shape === "round" ? 1.6 : 2.6,
      depth: 1.0,
      rotation: 0,
    };
    update((w) => ({ ...w, tables: [...(w.tables ?? []), t] }));
    setSelected(t.id);
  }
  function removeTable(id: string) {
    update((w) => ({
      ...w,
      tables: (w.tables ?? []).filter((t) => t.id !== id),
      guests: (w.guests ?? []).map((g) =>
        g.tableId === id ? { ...g, tableId: null, seatIndex: null } : g
      ),
    }));
    setSelected(null);
  }
  function seatGuest(guestId: string, tableId: string | null, seatIndex: number | null) {
    update((w) => ({
      ...w,
      guests: (w.guests ?? []).map((g) => {
        if (g.id === guestId) return { ...g, tableId, seatIndex };
        // bump whoever already sits in the target seat
        if (
          tableId != null &&
          g.tableId === tableId &&
          g.seatIndex === seatIndex &&
          g.id !== guestId
        )
          return { ...g, tableId: null, seatIndex: null };
        return g;
      }),
    }));
  }
  function nextFreeSeat(t: SeatTable): number | null {
    for (let i = 0; i < t.seats; i++) if (!occupant.get(`${t.id}:${i}`)) return i;
    return null;
  }
  function runAutoSeat() {
    update((w) => ({ ...w, guests: autoSeat(w.guests ?? [], w.tables ?? []) }));
  }
  function clearSeating() {
    update((w) => ({
      ...w,
      guests: (w.guests ?? []).map((g) => ({ ...g, tableId: null, seatIndex: null })),
    }));
  }

  // --- table dragging (pointer) ---
  function onTablePointerDown(e: React.PointerEvent, t: SeatTable) {
    e.stopPropagation();
    setSelected(t.id);
    setDrag({ id: t.id, sx: e.clientX, sy: e.clientY, ox: t.x, oy: t.y });
    setLive({ x: t.x, y: t.y });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function pointerRoom(e: React.PointerEvent): { x: number; y: number } {
    const rect = svgRef.current!.getBoundingClientRect();
    const s = room.w / rect.width;
    return { x: (e.clientX - rect.left) * s, y: (e.clientY - rect.top) * s };
  }
  // Drag a corner handle to scale the table (round: diameter; long: length & depth).
  function onHandlePointerDown(e: React.PointerEvent, t: SeatTable) {
    e.stopPropagation();
    setSelected(t.id);
    setResize(t.id);
    setLiveSize({ size: t.size, depth: t.depth });
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!svgRef.current) return;
    if (vdrag !== null) {
      const p = pointerRoom(e);
      setLivePt({ x: clamp(p.x, 0, room.w), y: clamp(p.y, 0, room.h) });
      return;
    }
    if (resize) {
      const t = tables.find((x) => x.id === resize);
      if (!t) return;
      const p = pointerRoom(e);
      if (t.shape === "round") {
        const r = Math.hypot(p.x - t.x, p.y - t.y);
        setLiveSize({ size: clamp(r * 2, 0.8, 4.5), depth: t.depth });
      } else {
        const rad = (-t.rotation * Math.PI) / 180;
        const dx = p.x - t.x;
        const dy = p.y - t.y;
        const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
        setLiveSize({
          size: clamp(Math.abs(lx) * 2, 1, 9),
          depth: clamp(Math.abs(ly) * 2, 0.6, 3),
        });
      }
      return;
    }
    if (drag) {
      const rect = svgRef.current.getBoundingClientRect();
      const s = room.w / rect.width;
      const nx = clamp(drag.ox + (e.clientX - drag.sx) * s, 0.9, room.w - 0.9);
      const ny = clamp(drag.oy + (e.clientY - drag.sy) * s, 0.9, room.h - 0.9);
      setLive({ x: nx, y: ny });
    }
  }
  function onPointerUp() {
    if (vdrag !== null && livePt) {
      const pts = ensurePoints().map((pt, k) => (k === vdrag ? livePt : pt));
      patchRoom({ points: pts });
    }
    if (resize && liveSize)
      patchTable(resize, { size: liveSize.size, depth: liveSize.depth });
    if (drag && live) patchTable(drag.id, { x: live.x, y: live.y });
    setDrag(null);
    setLive(null);
    setResize(null);
    setLiveSize(null);
    setVdrag(null);
    setLivePt(null);
  }

  const dz = (e: React.DragEvent) => e.dataTransfer.getData("text/guest");

  if (guests.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-sand bg-white/50 p-10 text-center text-sm text-ink/55">
        Add guests first (Guests tab) — then arrange them onto tables here.
      </div>
    );
  }

  const sel = tables.find((t) => t.id === selected) ?? null;
  const poly = roomPolygon(room);
  const effPoly = poly.map((p, i) => (vdrag === i && livePt ? livePt : p));

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
      {/* Left rail */}
      <div className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        {/* Unseated */}
        <div
          className="rounded-2xl border border-sand bg-white/60 p-3"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const id = dz(e);
            if (id) seatGuest(id, null, null);
          }}
        >
          <div className="flex items-center justify-between">
            <p className="font-serif text-lg text-ink">Unseated</p>
            <span className="text-xs text-ink/45">{unseated.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-ink/45">Drag a guest onto a seat.</p>
          <div className="mt-2 flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
            {unseated.map((g) => (
              <span
                key={g.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/guest", g.id)}
                title={g.household || undefined}
                className="cursor-grab rounded-full border border-sand bg-white px-2.5 py-1 text-xs text-ink/70 hover:border-ink/40 active:cursor-grabbing"
              >
                {g.name}
                {g.plusOne ? " +1" : ""}
              </span>
            ))}
            {unseated.length === 0 && (
              <span className="text-xs text-sage">Everyone&apos;s seated 🎉</span>
            )}
          </div>
        </div>

        {/* Add / actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => addTable("round")}
            className="rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
          >
            ⭕ Round
          </button>
          <button
            onClick={() => addTable("rect")}
            className="rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
          >
            ▭ Long
          </button>
          <button
            onClick={runAutoSeat}
            disabled={tables.length === 0}
            className="col-span-2 rounded-full bg-ink py-2 text-sm text-cream hover:bg-ink/90 disabled:opacity-50"
          >
            ✨ Auto-seat
          </button>
          <button
            onClick={clearSeating}
            className="col-span-2 rounded-full border border-ink/20 py-2 text-sm text-ink hover:border-ink/40"
          >
            Clear seating
          </button>
        </div>

        {/* Room */}
        <div className="rounded-2xl border border-sand bg-white/60 p-3 text-sm">
          <p className="font-serif text-lg text-ink">Room</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-ink/60">
              Width {room.w}m
              <input
                type="range"
                min={6}
                max={20}
                step={0.5}
                value={room.w}
                onChange={(e) => patchRoom({ w: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </label>
            <label className="text-xs text-ink/60">
              Length {room.h}m
              <input
                type="range"
                min={6}
                max={20}
                step={0.5}
                value={room.h}
                onChange={(e) => patchRoom({ h: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </label>
          </div>
          <label className="mt-2 block text-xs text-ink/60">
            Door wall
            <select
              value={room.door}
              onChange={(e) => patchRoom({ door: e.target.value as Room["door"] })}
              className="mt-1 w-full rounded-lg border border-sand bg-white/80 px-2 py-1 text-sm outline-none focus:border-ink"
            >
              <option value="N">Top</option>
              <option value="E">Right</option>
              <option value="S">Bottom</option>
              <option value="W">Left</option>
            </select>
          </label>

          {!editRoom ? (
            <button
              onClick={startEditRoom}
              className="mt-2 w-full rounded-full border border-ink/20 py-1.5 text-xs text-ink hover:border-ink/40"
            >
              ✏️ Edit room shape
            </button>
          ) : (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                <button
                  onClick={presetRect}
                  className="flex-1 rounded-full border border-sand py-1 text-xs text-ink/70"
                >
                  ▭ Rectangle
                </button>
                <button
                  onClick={presetL}
                  className="flex-1 rounded-full border border-sand py-1 text-xs text-ink/70"
                >
                  ⌐ L-shape
                </button>
              </div>
              <button
                onClick={addCorner}
                className="w-full rounded-full border border-sand py-1 text-xs text-ink/70"
              >
                + Add corner
              </button>
              <button
                onClick={() => setEditRoom(false)}
                className="w-full rounded-full bg-ink py-1 text-xs text-cream"
              >
                Done
              </button>
              <p className="text-[11px] text-ink/40">
                Drag corners to reshape · × removes a corner.
              </p>
            </div>
          )}
        </div>

        {/* Selected table */}
        {sel && (
          <div className="rounded-2xl border border-ink/30 bg-white/70 p-3 text-sm ring-1 ring-ink/10">
            <input
              value={sel.name}
              onChange={(e) => patchTable(sel.id, { name: e.target.value })}
              className="w-full rounded-lg border border-transparent bg-transparent px-1 font-serif text-ink outline-none hover:border-sand focus:border-ink"
            />
            <div className="mt-2 flex gap-1">
              {(["round", "rect"] as const).map((sh) => (
                <button
                  key={sh}
                  onClick={() => patchTable(sel.id, { shape: sh })}
                  className={`flex-1 rounded-full py-1 text-xs ${
                    sel.shape === sh ? "bg-ink text-cream" : "bg-sand text-ink/60"
                  }`}
                >
                  {sh === "round" ? "Round" : "Long"}
                </button>
              ))}
            </div>
            <label className="mt-2 flex items-center justify-between text-xs text-ink/60">
              Seats
              <span className="flex items-center gap-2">
                <button
                  onClick={() => patchTable(sel.id, { seats: Math.max(1, sel.seats - 1) })}
                  className="h-6 w-6 rounded-full border border-sand"
                >
                  −
                </button>
                <span className="w-5 text-center font-medium text-ink">{sel.seats}</span>
                <button
                  onClick={() => patchTable(sel.id, { seats: Math.min(16, sel.seats + 1) })}
                  className="h-6 w-6 rounded-full border border-sand"
                >
                  +
                </button>
              </span>
            </label>
            <label className="mt-2 block text-xs text-ink/60">
              {sel.shape === "round" ? "Diameter" : "Length"} {sel.size.toFixed(1)}m
              <input
                type="range"
                min={1}
                max={sel.shape === "round" ? 4.5 : 9}
                step={0.1}
                value={sel.size}
                onChange={(e) => patchTable(sel.id, { size: Number(e.target.value) })}
                className="w-full accent-ink"
              />
            </label>
            {sel.shape === "rect" && (
              <>
                <label className="mt-2 block text-xs text-ink/60">
                  Depth {sel.depth.toFixed(1)}m
                  <input
                    type="range"
                    min={0.6}
                    max={3}
                    step={0.1}
                    value={sel.depth}
                    onChange={(e) => patchTable(sel.id, { depth: Number(e.target.value) })}
                    className="w-full accent-ink"
                  />
                </label>
                <button
                  onClick={() => patchTable(sel.id, { rotation: (sel.rotation + 90) % 360 })}
                  className="mt-1 w-full rounded-full border border-sand py-1 text-xs text-ink/70"
                >
                  ⟳ Rotate
                </button>
              </>
            )}
            <p className="mt-2 text-[11px] text-ink/40">
              Tip: drag the ⤢ handle on the table to resize it.
            </p>
            <button
              onClick={() => removeTable(sel.id)}
              className="mt-2 w-full rounded-full border border-red-200 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              Remove table
            </button>
          </div>
        )}
      </div>

      {/* Floor plan */}
      <div>
        <p className="mb-2 text-xs text-ink/45">
          Drag tables to move them · drag a guest onto a seat · hover a seat for the
          full name.
        </p>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${room.w} ${room.h}`}
          style={{ width: "100%", aspectRatio: `${room.w} / ${room.h}`, touchAction: "none" }}
          className="rounded-2xl border border-sand bg-white shadow-inner"
          onClick={() => setSelected(null)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {/* floor + walls */}
          <polygon
            points={effPoly.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="#faf6f0"
            stroke="#cbbfa9"
            strokeWidth={0.12}
            strokeLinejoin="round"
          />
          <DoorMark room={room} />

          {tables.map((t) => {
            const moved =
              drag?.id === t.id && live ? { ...t, x: live.x, y: live.y } : t;
            const eff =
              resize === t.id && liveSize
                ? { ...moved, size: liveSize.size, depth: liveSize.depth }
                : moved;
            const seats = seatPositions(eff);
            const isSel = selected === t.id;
            // bottom-right corner handle position
            let hx = eff.x;
            let hy = eff.y;
            if (eff.shape === "round") {
              const r = eff.size / 2;
              hx = eff.x + r * Math.SQRT1_2;
              hy = eff.y + r * Math.SQRT1_2;
            } else {
              const rad = (eff.rotation * Math.PI) / 180;
              const lx = eff.size / 2;
              const ly = eff.depth / 2;
              hx = eff.x + lx * Math.cos(rad) - ly * Math.sin(rad);
              hy = eff.y + lx * Math.sin(rad) + ly * Math.cos(rad);
            }
            const seatedCount = seats.filter((_, i) => occupant.get(`${t.id}:${i}`)).length;
            return (
              <g key={t.id}>
                {/* table body (drag handle + drop = next free seat) */}
                <g
                  onPointerDown={(e) => onTablePointerDown(e, t)}
                  onClick={(e) => e.stopPropagation()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    const id = dz(e);
                    const i = nextFreeSeat(t);
                    if (id && i != null) seatGuest(id, t.id, i);
                  }}
                  style={{ cursor: "grab" }}
                >
                  {eff.shape === "round" ? (
                    <circle
                      cx={eff.x}
                      cy={eff.y}
                      r={eff.size / 2}
                      fill="#efe7db"
                      stroke={isSel ? "#2b2622" : "#b98a6a"}
                      strokeWidth={isSel ? 0.1 : 0.05}
                    />
                  ) : (
                    <rect
                      x={eff.x - eff.size / 2}
                      y={eff.y - eff.depth / 2}
                      width={eff.size}
                      height={eff.depth}
                      rx={0.12}
                      transform={`rotate(${eff.rotation} ${eff.x} ${eff.y})`}
                      fill="#efe7db"
                      stroke={isSel ? "#2b2622" : "#b98a6a"}
                      strokeWidth={isSel ? 0.1 : 0.05}
                    />
                  )}
                  <text
                    x={eff.x}
                    y={eff.y + 0.12}
                    textAnchor="middle"
                    fontSize={0.42}
                    fill="#2b2622"
                    style={{ pointerEvents: "none" }}
                  >
                    {t.name.replace(/^Table\s*/i, "T")}
                  </text>
                </g>

                {/* seats */}
                {seats.map((p, i) => {
                  const g = occupant.get(`${t.id}:${i}`);
                  return (
                    <g
                      key={i}
                      onPointerDown={(e) => e.stopPropagation()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.stopPropagation();
                        const id = dz(e);
                        if (id) seatGuest(id, t.id, i);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (g) seatGuest(g.id, null, null);
                      }}
                      style={{ cursor: g ? "pointer" : "default" }}
                    >
                      <title>{g ? g.name + (g.plusOne ? " (+1)" : "") : "Empty seat"}</title>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={0.3}
                        fill={g ? "#8a9a82" : "#fff"}
                        stroke={g ? "#6f7d68" : "#cbbfa9"}
                        strokeWidth={0.04}
                        strokeDasharray={g ? undefined : "0.08 0.08"}
                      />
                      {g && (
                        <text
                          x={p.x}
                          y={p.y + 0.11}
                          textAnchor="middle"
                          fontSize={0.3}
                          fill="#fff"
                          style={{ pointerEvents: "none" }}
                        >
                          {initials(g.name)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {/* resize handle (drag to scale the table) */}
                {isSel && (
                  <g
                    onPointerDown={(e) => onHandlePointerDown(e, t)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ cursor: "nwse-resize" }}
                  >
                    <circle cx={hx} cy={hy} r={0.26} fill="#2b2622" stroke="#fff" strokeWidth={0.05} />
                    <text
                      x={hx}
                      y={hy + 0.1}
                      textAnchor="middle"
                      fontSize={0.3}
                      fill="#fff"
                      style={{ pointerEvents: "none" }}
                    >
                      ⤢
                    </text>
                  </g>
                )}

                {/* count label */}
                <text
                  x={eff.x}
                  y={eff.y + (eff.shape === "round" ? eff.size / 2 : eff.depth / 2) + 0.9}
                  textAnchor="middle"
                  fontSize={0.34}
                  fill="#8a7f70"
                  style={{ pointerEvents: "none" }}
                >
                  {seatedCount}/{t.seats}
                </text>
              </g>
            );
          })}

          {/* room-shape vertex handles */}
          {editRoom &&
            effPoly.map((p, i) => (
              <g key={`v${i}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={0.32}
                  fill="#b98a6a"
                  stroke="#fff"
                  strokeWidth={0.07}
                  onPointerDown={(e) => startVertexDrag(e, i)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ cursor: "move" }}
                />
                {effPoly.length > 3 && (
                  <g
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCorner(i);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <circle
                      cx={p.x + 0.55}
                      cy={p.y - 0.55}
                      r={0.24}
                      fill="#fff"
                      stroke="#cc8888"
                      strokeWidth={0.05}
                    />
                    <text
                      x={p.x + 0.55}
                      y={p.y - 0.44}
                      textAnchor="middle"
                      fontSize={0.34}
                      fill="#c22"
                      style={{ pointerEvents: "none" }}
                    >
                      ×
                    </text>
                  </g>
                )}
              </g>
            ))}
        </svg>

        {tables.length === 0 && (
          <p className="mt-3 text-center text-sm text-ink/50">
            Add a round or long table from the left to start the floor plan.
          </p>
        )}
      </div>
    </div>
  );
}

function DoorMark({ room }: { room: Room }) {
  const dw = 1.1;
  let x1 = 0,
    y1 = 0,
    x2 = 0,
    y2 = 0,
    lx = 0,
    ly = 0;
  if (room.door === "N") {
    x1 = room.w / 2 - dw / 2;
    x2 = room.w / 2 + dw / 2;
    y1 = y2 = 0.11;
    lx = room.w / 2;
    ly = 0.55;
  } else if (room.door === "S") {
    x1 = room.w / 2 - dw / 2;
    x2 = room.w / 2 + dw / 2;
    y1 = y2 = room.h - 0.11;
    lx = room.w / 2;
    ly = room.h - 0.3;
  } else if (room.door === "W") {
    y1 = room.h / 2 - dw / 2;
    y2 = room.h / 2 + dw / 2;
    x1 = x2 = 0.11;
    lx = 0.55;
    ly = room.h / 2;
  } else {
    y1 = room.h / 2 - dw / 2;
    y2 = room.h / 2 + dw / 2;
    x1 = x2 = room.w - 0.11;
    lx = room.w - 0.55;
    ly = room.h / 2;
  }
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b98a6a" strokeWidth={0.22} strokeLinecap="round" />
      <text x={lx} y={ly} textAnchor="middle" fontSize={0.32} fill="#b98a6a" style={{ pointerEvents: "none" }}>
        door
      </text>
    </g>
  );
}

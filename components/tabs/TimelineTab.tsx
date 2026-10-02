"use client";

import { useEffect, useMemo, useState } from "react";
import {
  generateTimeline,
  newId,
  TIMELINE_BUCKETS,
  type Task,
  type Wedding,
} from "@/lib/workspace";

export default function TimelineTab({
  wedding,
  update,
}: {
  wedding: Wedding;
  update: (fn: (w: Wedding) => Wedding) => void;
}) {
  // Generate the wedding-year checklist on first visit.
  useEffect(() => {
    if (!wedding.tasks) {
      update((w) => ({ ...w, tasks: generateTimeline(w.weddingDate) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tasks = wedding.tasks ?? [];
  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const today = new Date().toISOString().slice(0, 10);

  const [newTitle, setNewTitle] = useState("");
  const [newDue, setNewDue] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      if (!map.has(t.bucket)) map.set(t.bucket, []);
      map.get(t.bucket)!.push(t);
    }
    return map;
  }, [tasks]);

  function toggle(id: string) {
    update((w) => ({
      ...w,
      tasks: (w.tasks ?? []).map((t) =>
        t.id === id ? { ...t, done: !t.done } : t
      ),
    }));
  }
  function remove(id: string) {
    update((w) => ({ ...w, tasks: (w.tasks ?? []).filter((t) => t.id !== id) }));
  }
  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const t: Task = {
      id: newId("t"),
      title: newTitle.trim(),
      bucket: "Custom",
      dueDate: newDue || wedding.weddingDate,
      done: false,
    };
    update((w) => ({ ...w, tasks: [...(w.tasks ?? []), t] }));
    setNewTitle("");
    setNewDue("");
  }
  function resetTimeline() {
    update((w) => ({ ...w, tasks: generateTimeline(w.weddingDate) }));
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-ink/60">
              {done} of {tasks.length} tasks complete
            </p>
            <div className="mt-1 h-2 w-64 overflow-hidden rounded-full bg-sand">
              <div
                className="h-full rounded-full bg-sage transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
          <button
            onClick={resetTimeline}
            className="text-xs text-ink/40 underline hover:text-ink"
          >
            Reset to template
          </button>
        </div>

        <div className="space-y-5">
          {TIMELINE_BUCKETS.filter((b) => grouped.has(b)).map((bucket) => (
            <div key={bucket}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink/45">
                {bucket}
              </p>
              <ul className="divide-y divide-sand rounded-xl border border-sand bg-white/60">
                {grouped.get(bucket)!.map((t) => {
                  const overdue = !t.done && t.dueDate < today;
                  return (
                    <li
                      key={t.id}
                      className="group flex items-center gap-3 px-3 py-2.5"
                    >
                      <input
                        type="checkbox"
                        checked={t.done}
                        onChange={() => toggle(t.id)}
                        className="h-4 w-4 flex-none accent-ink"
                      />
                      <span
                        className={`flex-1 text-sm ${
                          t.done ? "text-ink/35 line-through" : "text-ink/80"
                        }`}
                      >
                        {t.title}
                      </span>
                      <span
                        className={`text-xs ${
                          overdue ? "font-medium text-red-600" : "text-ink/40"
                        }`}
                      >
                        {new Date(t.dueDate + "T00:00:00").toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </span>
                      <button
                        onClick={() => remove(t.id)}
                        className="text-ink/20 opacity-0 transition group-hover:opacity-100 hover:text-red-500"
                        aria-label="Delete task"
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <form
          onSubmit={addTask}
          className="rounded-2xl border border-sand bg-white/60 p-4"
        >
          <p className="font-serif text-lg text-ink">Add a task</p>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Final dress fitting"
            className="mt-3 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <input
            type="date"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            className="mt-2 w-full rounded-xl border border-sand bg-white/80 px-3 py-2 text-sm text-ink outline-none focus:border-ink"
          />
          <button
            type="submit"
            className="mt-3 w-full rounded-full bg-ink py-2 text-sm text-cream hover:bg-ink/90"
          >
            Add task
          </button>
        </form>
      </div>
    </div>
  );
}

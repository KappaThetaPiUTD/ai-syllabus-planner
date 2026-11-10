"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EventForm from "@/components/EventForm";
import { CourseChip, ErrorBox, Modal, TYPE_STYLES } from "@/components/ui";
import { api, toISODate, type CalEvent, type Course } from "@/lib/api";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ event: CalEvent | null; date?: string } | null>(null);

  async function load() {
    try {
      const [e, c] = await Promise.all([api<CalEvent[]>("/api/events?confirmed=true"), api<Course[]>("/api/courses")]);
      setEvents(e);
      setCourses(c);
      // Jump to the first month with deadlines if the current month is empty
      if (e.length && !e.some((x) => x.due_date.slice(0, 7) === toISODate(month).slice(0, 7))) {
        const today = toISODate(new Date());
        const next = e.find((x) => x.due_date >= today) ?? e[0];
        const [y, m] = next.due_date.split("-").map(Number);
        setMonth(new Date(y, m - 1, 1));
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - ((month.getDay() + 6) % 7)); // back up to Monday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [month]);

  const byDay = useMemo(() => {
    const m: Record<string, CalEvent[]> = {};
    for (const e of events) if (!hidden.has(e.course_id)) (m[e.due_date] ||= []).push(e);
    return m;
  }, [events, hidden]);

  const todayStr = toISODate(new Date());
  const shift = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <AppShell>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="h1">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h1>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => shift(-1)}>
            ←
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              const d = new Date();
              setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
          >
            Today
          </button>
          <button className="btn-secondary" onClick={() => shift(1)}>
            →
          </button>
          <Link href="/settings" className="btn-primary">
            🔗 Sync to Google
          </Link>
        </div>
      </div>
      <ErrorBox message={error} />

      <div className="mb-4 flex flex-wrap gap-2">
        {courses.map((c) => (
          <button
            key={c.id}
            onClick={() =>
              setHidden((h) => {
                const n = new Set(h);
                n.has(c.id) ? n.delete(c.id) : n.add(c.id);
                return n;
              })
            }
            className={`rounded-full border px-3 py-1 ${hidden.has(c.id) ? "border-slate-200 opacity-40" : "border-slate-300 bg-white"}`}
          >
            <CourseChip code={c.code} color={c.color} />
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[700px] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase text-slate-500">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const key = toISODate(d);
              const inMonth = d.getMonth() === month.getMonth();
              const list = byDay[key] ?? [];
              return (
                <div
                  key={key}
                  onDoubleClick={() => courses.length && setEdit({ event: null, date: key })}
                  className={`min-h-[110px] border-b border-r border-slate-100 p-1.5 ${inMonth ? "" : "bg-slate-50/60 text-slate-400"}`}
                >
                  <div
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      key === todayStr ? "bg-brand-600 font-bold text-white" : ""
                    }`}
                  >
                    {d.getDate()}
                  </div>
                  <div className="space-y-1">
                    {list.slice(0, 4).map((e) => (
                      <button
                        key={e.id}
                        onClick={() => setEdit({ event: e })}
                        title={`${e.course_code}: ${e.title}`}
                        className={`block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${TYPE_STYLES[e.type].bg} ${
                          TYPE_STYLES[e.type].text
                        } ${e.completed ? "line-through opacity-50" : ""}`}
                        style={{ borderLeft: `3px solid ${e.course_color}` }}
                      >
                        {e.course_code} · {e.title}
                      </button>
                    ))}
                    {list.length > 4 && <div className="px-1 text-[11px] text-slate-500">+{list.length - 4} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="muted mt-2">Tip: double-click a day to add a deadline.</p>

      <div className="mt-4 flex flex-wrap gap-3 text-xs">
        {Object.entries(TYPE_STYLES).map(([t, s]) => (
          <span key={t} className={`rounded px-2 py-0.5 capitalize ${s.bg} ${s.text}`}>
            {s.icon} {t}
          </span>
        ))}
      </div>

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit?.event ? "Edit deadline" : "Add deadline"}>
        {edit && (
          <EventForm
            courses={courses}
            event={edit.event}
            defaultDate={edit.date}
            onCancel={() => setEdit(null)}
            onSaved={() => {
              setEdit(null);
              load();
            }}
            onDeleted={() => {
              setEdit(null);
              load();
            }}
          />
        )}
      </Modal>
    </AppShell>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EventForm from "@/components/EventForm";
import { CourseChip, Empty, ErrorBox, Modal, TypeBadge } from "@/components/ui";
import { api, daysUntil, EVENT_TYPES, fmtDate, fmtTime, relativeDay, type CalEvent, type Course } from "@/lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [show, setShow] = useState<"upcoming" | "all" | "done">("upcoming");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<CalEvent | null | "new">(null);

  async function load() {
    try {
      const [e, c] = await Promise.all([api<CalEvent[]>("/api/events?confirmed=true"), api<Course[]>("/api/courses")]);
      setEvents(e);
      setCourses(c);
    } catch (err) {
      setError((err as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!course || e.course_id === Number(course)) &&
          (!type || e.type === type) &&
          (show === "all" || (show === "done" ? e.completed : !e.completed && daysUntil(e.due_date) >= -7)) &&
          (!q || `${e.title} ${e.description}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [events, course, type, show, q],
  );

  async function toggle(e: CalEvent) {
    setEvents((list) => list.map((x) => (x.id === e.id ? { ...x, completed: !x.completed } : x)));
    await api(`/api/events/${e.id}`, { method: "PATCH", json: { completed: !e.completed } });
  }

  // Group by month for readability
  const groups = filtered.reduce<Record<string, CalEvent[]>>((acc, e) => {
    const k = fmtDate(e.due_date, { month: "long", year: "numeric" });
    (acc[k] ||= []).push(e);
    return acc;
  }, {});

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="h1">All deadlines</h1>
          <p className="muted">Every confirmed item from every class. Click one to edit it.</p>
        </div>
        <button className="btn-primary" disabled={!courses.length} onClick={() => setEdit("new")}>
          + Add deadline
        </button>
      </div>
      <ErrorBox message={error} />

      <div className="card mb-4 flex flex-wrap gap-3 p-4">
        <input className="input max-w-xs" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input w-auto" value={course} onChange={(e) => setCourse(e.target.value)}>
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        <select className="input w-auto capitalize" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <div className="flex rounded-lg border border-slate-300 p-0.5 text-sm">
          {(["upcoming", "all", "done"] as const).map((s) => (
            <button key={s} onClick={() => setShow(s)} className={`rounded-md px-3 py-1 capitalize ${show === s ? "bg-slate-900 text-white" : ""}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty title="No deadlines match">Try a different filter, or upload a syllabus.</Empty>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([month, list]) => (
            <div key={month}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{month}</h2>
              <div className="card divide-y divide-slate-100 p-0">
                {list.map((e) => {
                  const overdue = !e.completed && daysUntil(e.due_date) < 0;
                  return (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={e.completed} onChange={() => toggle(e)} />
                      <button className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setEdit(e)}>
                        <span className="w-24 shrink-0 text-sm font-medium">{fmtDate(e.due_date)}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`block truncate ${e.completed ? "text-slate-400 line-through" : "font-medium"}`}>{e.title}</span>
                          <span className="flex flex-wrap items-center gap-2">
                            <CourseChip code={e.course_code} color={e.course_color} />
                            {e.due_time && <span className="text-xs text-slate-500">{fmtTime(e.due_time)}</span>}
                            {e.weight && <span className="text-xs text-slate-500">· {e.weight}</span>}
                            {e.google_event_id && <span className="text-xs text-slate-400" title="On Google Calendar">· 🔗 synced</span>}
                          </span>
                        </span>
                        <TypeBadge type={e.type} />
                        <span className={`hidden w-24 text-right text-xs sm:block ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>
                          {relativeDay(e.due_date)}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={edit !== null} onClose={() => setEdit(null)} title={edit === "new" ? "Add deadline" : "Edit deadline"}>
        {edit !== null && (
          <EventForm
            courses={courses}
            event={edit === "new" ? null : edit}
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

"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import CourseForm from "@/components/CourseForm";
import EventForm from "@/components/EventForm";
import { ErrorBox, Modal, TypeBadge } from "@/components/ui";
import { api, fmtDate, fmtTime, providerName, type CalEvent, type Course, type Syllabus } from "@/lib/api";

const STATUS: Record<string, string> = {
  uploaded: "bg-slate-100 text-slate-600",
  processing: "bg-blue-100 text-blue-700",
  review: "bg-amber-100 text-amber-800",
  confirmed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editEvent, setEditEvent] = useState<CalEvent | null | "new">(null);

  async function load() {
    try {
      const [c, s, e] = await Promise.all([
        api<Course>(`/api/courses/${id}`),
        api<Syllabus[]>(`/api/syllabi?course_id=${id}`),
        api<CalEvent[]>(`/api/events?course_id=${id}`),
      ]);
      setCourse(c);
      setSyllabi(s);
      setEvents(e);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function removeCourse() {
    if (!course || !window.confirm(`Delete ${course.code} and all of its deadlines?`)) return;
    await api(`/api/courses/${course.id}`, { method: "DELETE" });
    router.push("/courses");
  }

  async function removeSyllabus(s: Syllabus) {
    if (!window.confirm(`Delete ${s.filename} and the deadlines extracted from it?`)) return;
    await api(`/api/syllabi/${s.id}`, { method: "DELETE" });
    load();
  }

  if (!course) {
    return (
      <AppShell>
        <ErrorBox message={error} />
        {!error && <p className="muted">Loading…</p>}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href="/courses" className="text-sm text-slate-500 hover:text-slate-700">
        ← All courses
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3 border-l-4 pl-4" style={{ borderColor: course.color }}>
        <div>
          <h1 className="h1">{course.code}</h1>
          <p className="text-slate-600">{course.name}</p>
          <p className="muted">{[course.instructor, course.semester].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/upload?course=${course.id}`} className="btn-primary">
            Upload syllabus
          </Link>
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button className="btn-ghost text-red-600" onClick={removeCourse}>
            Delete
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="h2">Deadlines ({events.length})</h2>
            <button className="btn-secondary" onClick={() => setEditEvent("new")}>
              + Add manually
            </button>
          </div>
          {events.length === 0 ? (
            <p className="muted">No deadlines yet. Upload the syllabus to extract them.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {events.map((e) => (
                <li key={e.id} className="flex cursor-pointer items-center gap-3 py-2.5 hover:bg-slate-50" onClick={() => setEditEvent(e)}>
                  <span className="w-28 shrink-0 text-sm font-medium">{fmtDate(e.due_date)}</span>
                  <span className={`flex-1 truncate text-sm ${e.completed ? "text-slate-400 line-through" : ""}`}>
                    {e.title} {e.due_time && <span className="text-slate-400">· {fmtTime(e.due_time)}</span>}
                  </span>
                  {!e.confirmed && <span className="rounded bg-amber-100 px-1.5 text-xs text-amber-800">unreviewed</span>}
                  <TypeBadge type={e.type} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card">
          <h2 className="h2 mb-3">Syllabi</h2>
          {syllabi.length === 0 ? (
            <p className="muted">None uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {syllabi.map((s) => (
                <li key={s.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="truncate text-sm font-medium">📄 {s.filename}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 ${STATUS[s.status]}`}>{s.status}</span>
                    <span className="text-slate-500">{s.event_count} items</span>
                    {s.method && <span className="text-slate-400">via {s.method === "rules" ? "rules" : providerName(s.method)}</span>}
                  </div>
                  {s.summary && <p className="mt-2 text-xs text-slate-600">{s.summary}</p>}
                  <div className="mt-2 flex gap-3 text-xs">
                    <Link href={`/review/${s.id}`} className="font-medium text-brand-600">
                      {s.status === "review" ? "Review →" : "Open"}
                    </Link>
                    <button className="text-red-600" onClick={() => removeSyllabus(s)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit course">
        <CourseForm
          course={course}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            load();
          }}
        />
      </Modal>
      <Modal open={editEvent !== null} onClose={() => setEditEvent(null)} title={editEvent === "new" ? "Add deadline" : "Edit deadline"}>
        {editEvent !== null && (
          <EventForm
            courses={[course]}
            event={editEvent === "new" ? null : editEvent}
            defaultCourseId={course.id}
            onCancel={() => setEditEvent(null)}
            onSaved={() => {
              setEditEvent(null);
              load();
            }}
            onDeleted={() => {
              setEditEvent(null);
              load();
            }}
          />
        )}
      </Modal>
    </AppShell>
  );
}

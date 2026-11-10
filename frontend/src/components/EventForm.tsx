"use client";

import { useState } from "react";
import { api, EVENT_TYPES, type CalEvent, type Course, type EventType } from "@/lib/api";
import { ErrorBox } from "./ui";

interface Props {
  courses: Course[];
  event?: CalEvent | null; // undefined/null = create
  defaultCourseId?: number;
  defaultDate?: string;
  onSaved: (e: CalEvent) => void;
  onDeleted?: (id: number) => void;
  onCancel: () => void;
}

/** Create or edit a single deadline. Used on the review page, deadlines list, and calendar. */
export default function EventForm({ courses, event, defaultCourseId, defaultDate, onSaved, onDeleted, onCancel }: Props) {
  const [form, setForm] = useState({
    course_id: event?.course_id ?? defaultCourseId ?? courses[0]?.id ?? 0,
    title: event?.title ?? "",
    type: (event?.type ?? "homework") as EventType,
    due_date: event?.due_date ?? defaultDate ?? "",
    due_time: event?.due_time?.slice(0, 5) ?? "",
    description: event?.description ?? "",
    weight: event?.weight ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = { ...form, due_time: form.due_time || null };
    try {
      const saved = event
        ? await api<CalEvent>(`/api/events/${event.id}`, { method: "PATCH", json: payload })
        : await api<CalEvent>("/api/events", { method: "POST", json: { ...payload, confirmed: true } });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!event) return;
    setSaving(true);
    try {
      await api(`/api/events/${event.id}`, { method: "DELETE" });
      onDeleted?.(event.id);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <ErrorBox message={error} />
      <div>
        <label className="label">Title</label>
        <input className="input" required value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Exam 1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Course</label>
          <select className="input" value={form.course_id} onChange={(e) => set("course_id", Number(e.target.value))}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input capitalize" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Due date</label>
          <input type="date" required className="input" value={form.due_date} onChange={(e) => set("due_date", e.target.value)} />
        </div>
        <div>
          <label className="label">Due time (optional)</label>
          <input type="time" className="input" value={form.due_time} onChange={(e) => set("due_time", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Details / material covered</label>
        <textarea className="input" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Chapters 1 through 5" />
      </div>
      <div>
        <label className="label">Grade weight (optional)</label>
        <input className="input" value={form.weight} onChange={(e) => set("weight", e.target.value)} placeholder="20%" />
      </div>
      {event?.source_text && (
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
          <div className="mb-1 font-semibold uppercase tracking-wide text-slate-400">Found in syllabus</div>“{event.source_text}”
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-2">
        {event && onDeleted ? (
          <button type="button" className="btn-danger" onClick={remove} disabled={saving}>
            Delete
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving || !form.course_id}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}

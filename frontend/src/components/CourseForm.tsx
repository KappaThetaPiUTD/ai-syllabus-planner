"use client";

import { useState } from "react";
import { api, type Course } from "@/lib/api";
import { ErrorBox } from "./ui";

export const COLORS = ["#6366f1", "#ef4444", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#ec4899", "#64748b"];

export default function CourseForm({ course, onSaved, onCancel }: { course?: Course; onSaved: (c: Course) => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    code: course?.code ?? "",
    name: course?.name ?? "",
    instructor: course?.instructor ?? "",
    semester: course?.semester ?? "",
    color: course?.color ?? COLORS[Math.floor(Math.random() * COLORS.length)],
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const saved = course
        ? await api<Course>(`/api/courses/${course.id}`, { method: "PUT", json: form })
        : await api<Course>("/api/courses", { method: "POST", json: form });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ErrorBox message={error} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Course code *</label>
          <input className="input" required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="CS 3345" />
        </div>
        <div>
          <label className="label">Semester</label>
          <input className="input" value={form.semester} onChange={(e) => setForm({ ...form, semester: e.target.value })} placeholder="Fall 2026" />
        </div>
      </div>
      <div>
        <label className="label">Course name</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Data Structures" />
      </div>
      <div>
        <label className="label">Instructor</label>
        <input className="input" value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} />
      </div>
      <div>
        <label className="label">Colour</label>
        <div className="flex gap-2">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setForm({ ...form, color: c })}
              className={`h-7 w-7 rounded-full ring-offset-2 ${form.color === c ? "ring-2 ring-slate-900" : ""}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>
      </div>
      <p className="text-xs text-slate-500">Leave fields blank and the AI fills in the name, instructor and semester from the syllabus.</p>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy}>
          {course ? "Save" : "Add course"}
        </button>
      </div>
    </form>
  );
}

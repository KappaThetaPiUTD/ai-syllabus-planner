"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import CourseForm from "@/components/CourseForm";
import { Empty, ErrorBox, Modal } from "@/components/ui";
import { api, type Course } from "@/lib/api";

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [welcome, setWelcome] = useState(false);

  async function load() {
    try {
      setCourses(await api<Course[]>("/api/courses"));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    if (new URLSearchParams(window.location.search).get("welcome")) {
      setWelcome(true);
      setAdding(true);
    }
  }, []);

  return (
    <AppShell>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="h1">Courses</h1>
          <p className="muted">Add each class you&apos;re taking, then upload its syllabus.</p>
        </div>
        <button className="btn-primary" onClick={() => setAdding(true)}>
          + Add course
        </button>
      </div>
      <ErrorBox message={error} />

      {courses && courses.length === 0 && <Empty title="No courses yet">Add your first class, e.g. “CS 3345”.</Empty>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses?.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`} className="card block border-t-4 transition hover:shadow-md" style={{ borderTopColor: c.color }}>
            <div className="text-lg font-bold">{c.code}</div>
            <div className="truncate text-sm text-slate-600">{c.name || "—"}</div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              {c.instructor && <span>👤 {c.instructor}</span>}
              {c.semester && <span>🗓️ {c.semester}</span>}
            </div>
            <div className="mt-4 flex gap-4 text-sm">
              <span>
                <b>{c.event_count}</b> deadlines
              </span>
              <span>
                <b>{c.syllabus_count}</b> syllabi
              </span>
            </div>
          </Link>
        ))}
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title={welcome ? "Welcome! Add your first course" : "Add a course"}>
        <CourseForm
          onCancel={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            load();
          }}
        />
      </Modal>
    </AppShell>
  );
}

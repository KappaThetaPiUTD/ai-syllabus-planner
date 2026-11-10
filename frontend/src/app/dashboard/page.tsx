"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { CourseChip, Empty, ErrorBox, TypeBadge } from "@/components/ui";
import { api, fmtDate, fmtTime, parseDate, relativeDay, toISODate, type CalEvent, type Course, type Health, type Stats } from "@/lib/api";

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [upcoming, setUpcoming] = useState<CalEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const today = toISODate(new Date());
      const [s, ev, cs, h] = await Promise.all([
        api<Stats>("/api/events/stats"),
        api<CalEvent[]>(`/api/events?start=${today}&confirmed=true&completed=false`),
        api<Course[]>("/api/courses"),
        api<Health>("/api/health"),
      ]);
      setStats(s);
      setUpcoming(ev.slice(0, 8));
      setCourses(cs);
      setHealth(h);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggle(e: CalEvent) {
    await api(`/api/events/${e.id}`, { method: "PATCH", json: { completed: !e.completed } });
    load();
  }

  const maxLoad = Math.max(1, ...(stats?.weeks.map((w) => w.load) ?? [1]));
  const thisMonday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toISODate(d);
  })();

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">Hi{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋</h1>
          <p className="muted">Here&apos;s what&apos;s coming up across all your classes.</p>
        </div>
        <Link href="/upload" className="btn-primary">
          + Upload syllabus
        </Link>
      </div>
      <ErrorBox message={error} />

      {health && !health.ai_enabled && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          AI extraction is off. Add a free <code>GEMINI_API_KEY</code> (from aistudio.google.com) to <code>backend/.env</code> and restart the backend. Until then the built-in rule-based parser is used.
        </div>
      )}
      {stats?.needs_review && (
        <Link href="/upload" className="mb-4 block rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-700">
          🔎 You have extracted deadlines waiting for review →
        </Link>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Due in the next 7 days", stats?.due_this_week, "text-brand-700"],
          ["Upcoming exams", stats?.upcoming_exams, "text-red-600"],
          ["Overdue", stats?.overdue, "text-amber-600"],
          ["Completed", stats ? `${stats.completed}/${stats.total}` : undefined, "text-green-600"],
        ].map(([label, val, color]) => (
          <div key={label as string} className="card">
            <div className="muted">{label}</div>
            <div className={`mt-1 text-3xl font-bold ${color}`}>{val ?? "–"}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="h2">Upcoming deadlines</h2>
            <Link href="/events" className="text-sm font-medium text-brand-600">
              View all →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <Empty title="Nothing upcoming">
              {courses.length === 0 ? (
                <>
                  Start by <Link href="/courses" className="text-brand-600">adding a course</Link>.
                </>
              ) : (
                <>
                  <Link href="/upload" className="text-brand-600">Upload a syllabus</Link> to fill your schedule.
                </>
              )}
            </Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((e) => (
                <li key={e.id} className="flex items-center gap-3 py-3">
                  <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={e.completed} onChange={() => toggle(e)} />
                  <div className="w-16 text-center">
                    <div className="text-xs uppercase text-slate-500">{parseDate(e.due_date).toLocaleDateString(undefined, { month: "short" })}</div>
                    <div className="text-xl font-bold">{parseDate(e.due_date).getDate()}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{e.title}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <CourseChip code={e.course_code} color={e.course_color} />
                      <TypeBadge type={e.type} />
                      {e.due_time && <span className="text-xs text-slate-500">{fmtTime(e.due_time)}</span>}
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium text-slate-500">{relativeDay(e.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="h2 mb-1">Workload by week</h2>
            <p className="muted mb-4">Exams and projects count more.</p>
            {!stats || stats.weeks.length === 0 ? (
              <p className="muted">No confirmed deadlines yet.</p>
            ) : (
              <div className="space-y-1.5">
                {stats.weeks.map((w) => (
                  <div key={w.week_start} className="flex items-center gap-2 text-xs">
                    <span className={`w-14 shrink-0 ${w.week_start === thisMonday ? "font-bold text-brand-700" : "text-slate-500"}`}>
                      {fmtDate(w.week_start, { month: "short", day: "numeric" })}
                    </span>
                    <div className="h-4 flex-1 rounded bg-slate-100">
                      <div
                        className={`h-4 rounded ${w.load / maxLoad > 0.7 ? "bg-red-400" : w.load / maxLoad > 0.4 ? "bg-amber-400" : "bg-brand-500"}`}
                        style={{ width: `${(w.load / maxLoad) * 100}%` }}
                        title={`${w.count} items, ${w.exams} exams`}
                      />
                    </div>
                    <span className="w-5 text-right text-slate-500">{w.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="h2">Courses</h2>
              <Link href="/courses" className="text-sm font-medium text-brand-600">
                Manage →
              </Link>
            </div>
            {courses.length === 0 ? (
              <p className="muted">No courses yet.</p>
            ) : (
              <ul className="space-y-2">
                {courses.map((c) => (
                  <li key={c.id}>
                    <Link href={`/courses/${c.id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <CourseChip code={c.code} color={c.color} />
                      <span className="text-xs text-slate-500">{c.event_count} items</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

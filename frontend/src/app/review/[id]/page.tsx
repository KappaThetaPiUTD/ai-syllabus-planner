"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ConfidenceBadge, ErrorBox } from "@/components/ui";
import { api, EVENT_TYPES, providerName, toISODate, type CalEvent, type EventType, type Syllabus } from "@/lib/api";

type Row = CalEvent & { dirty?: boolean; keep: boolean };

/** The extracted-events review page: the student checks and fixes what the AI found. */
export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [syl, setSyl] = useState<Syllabus | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showText, setShowText] = useState(false);
  const [filter, setFilter] = useState<"all" | "low">("all");

  async function load() {
    try {
      const s = await api<Syllabus>(`/api/syllabi/${id}`);
      setSyl(s);
      setRows((s.events ?? []).map((e) => ({ ...e, keep: true })));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function update(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch, dirty: true } : row)));
  }

  async function addRow() {
    if (!syl) return;
    const e = await api<CalEvent>("/api/events", {
      method: "POST",
      json: { course_id: syl.course_id, title: "New item", type: "homework", due_date: toISODate(new Date()), confirmed: false },
    });
    setRows((r) => [...r, { ...e, keep: true, dirty: true }]);
  }

  async function saveAll() {
    setSaving(true);
    setError(null);
    try {
      for (const r of rows) {
        if (!r.keep) {
          await api(`/api/events/${r.id}`, { method: "DELETE" });
        } else if (r.dirty) {
          await api(`/api/events/${r.id}`, {
            method: "PATCH",
            json: {
              title: r.title,
              type: r.type,
              due_date: r.due_date,
              due_time: r.due_time || null,
              description: r.description,
              weight: r.weight,
            },
          });
        }
      }
      const keepIds = rows.filter((r) => r.keep).map((r) => r.id);
      await api(`/api/syllabi/${id}/confirm`, { method: "POST", json: { event_ids: keepIds } });
      // Manually added rows aren't linked to the syllabus, so confirm them directly.
      for (const r of rows) if (r.keep && r.syllabus_id === null) await api(`/api/events/${r.id}`, { method: "PATCH", json: { confirmed: true } });
      router.push("/calendar");
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function reprocess() {
    if (!window.confirm("Re-run extraction? Unconfirmed items from this syllabus will be replaced.")) return;
    await api(`/api/syllabi/${id}/reprocess`, { method: "POST" });
    setSyl((s) => (s ? { ...s, status: "processing" } : s));
    const poll = setInterval(async () => {
      const s = await api<Syllabus>(`/api/syllabi/${id}`);
      if (s.status === "review" || s.status === "failed") {
        clearInterval(poll);
        if (s.status === "failed") setError(s.error);
        load();
      }
    }, 1500);
  }

  if (!syl) {
    return (
      <AppShell>
        <ErrorBox message={error} />
        {!error && <p className="muted">Loading…</p>}
      </AppShell>
    );
  }

  const kept = rows.filter((r) => r.keep).length;
  const low = rows.filter((r) => r.confidence < 0.7).length;
  const shown = rows.map((r, i) => [r, i] as const).filter(([r]) => filter === "all" || r.confidence < 0.7);

  return (
    <AppShell>
      <Link href={`/courses/${syl.course_id}`} className="text-sm text-slate-500 hover:text-slate-700">
        ← Back to course
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="h1">Review extracted deadlines</h1>
          <p className="muted">
            📄 {syl.filename} · found {rows.length} items using {providerName(syl.method)}
            {syl.status === "confirmed" && " · already confirmed"}
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowText((s) => !s)}>
            {showText ? "Hide" : "Show"} syllabus text
          </button>
          <button className="btn-secondary" onClick={reprocess}>
            Re-run extraction
          </button>
        </div>
      </div>

      {syl.status === "processing" && (
        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">⏳ Re-running extraction…</div>
      )}
      {syl.summary && <div className="mt-4 rounded-lg border border-brand-100 bg-brand-50 p-4 text-sm text-brand-900">🤖 {syl.summary}</div>}
      <div className="mt-4">
        <ErrorBox message={error} />
      </div>

      <div className={`mt-4 grid gap-6 ${showText ? "lg:grid-cols-2" : ""}`}>
        <div className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-4">
            <div className="flex gap-1 text-sm">
              <button className={`rounded-md px-3 py-1 ${filter === "all" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`} onClick={() => setFilter("all")}>
                All ({rows.length})
              </button>
              <button className={`rounded-md px-3 py-1 ${filter === "low" ? "bg-slate-900 text-white" : "hover:bg-slate-100"}`} onClick={() => setFilter("low")}>
                Needs checking ({low})
              </button>
            </div>
            <button className="btn-ghost text-sm" onClick={addRow}>
              + Add missing item
            </button>
          </div>
          {rows.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              No dated items were found. {syl.text_length === 0 && "This PDF has no selectable text — it may be scanned."}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {shown.map(([r, i]) => (
                <div key={r.id} className={`p-4 ${r.keep ? "" : "bg-slate-50 opacity-50"} ${r.confidence < 0.7 && r.keep ? "border-l-4 border-l-amber-400" : ""}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} title="Keep this item" />
                    <input className="input min-w-[12rem] flex-1 font-medium" value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
                    <select className="input w-auto capitalize" value={r.type} onChange={(e) => update(i, { type: e.target.value as EventType })}>
                      {EVENT_TYPES.map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <input type="date" className="input w-auto" value={r.due_date} onChange={(e) => update(i, { due_date: e.target.value })} />
                    <input type="time" className="input w-auto" value={r.due_time?.slice(0, 5) ?? ""} onChange={(e) => update(i, { due_time: e.target.value || null })} />
                    <ConfidenceBadge value={r.confidence} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 pl-6">
                    <input className="input flex-1 text-xs" placeholder="Details / material covered" value={r.description} onChange={(e) => update(i, { description: e.target.value })} />
                    <input className="input w-24 text-xs" placeholder="Weight" value={r.weight} onChange={(e) => update(i, { weight: e.target.value })} />
                  </div>
                  {r.source_text && <div className="mt-2 pl-6 text-xs italic text-slate-500">Found: “{r.source_text}”</div>}
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 p-4">
            <span className="text-sm text-slate-600">
              {kept} of {rows.length} items will be saved
            </span>
            <button className="btn-primary" disabled={saving} onClick={saveAll}>
              {saving ? "Saving…" : `Confirm ${kept} deadlines`}
            </button>
          </div>
        </div>

        {showText && (
          <div className="card max-h-[80vh] overflow-y-auto">
            <h2 className="h2 mb-2">Syllabus text</h2>
            <pre className="whitespace-pre-wrap text-xs text-slate-700">{syl.text || "(no selectable text)"}</pre>
          </div>
        )}
      </div>
    </AppShell>
  );
}

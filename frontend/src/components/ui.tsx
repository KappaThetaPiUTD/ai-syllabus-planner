"use client";

import { type EventType } from "@/lib/api";

export const TYPE_STYLES: Record<EventType, { bg: string; text: string; icon: string }> = {
  exam: { bg: "bg-red-100", text: "text-red-700", icon: "📝" },
  quiz: { bg: "bg-orange-100", text: "text-orange-700", icon: "❓" },
  homework: { bg: "bg-blue-100", text: "text-blue-700", icon: "📘" },
  project: { bg: "bg-purple-100", text: "text-purple-700", icon: "🛠️" },
  reading: { bg: "bg-emerald-100", text: "text-emerald-700", icon: "📖" },
  lab: { bg: "bg-cyan-100", text: "text-cyan-700", icon: "🧪" },
  presentation: { bg: "bg-pink-100", text: "text-pink-700", icon: "🎤" },
  other: { bg: "bg-slate-100", text: "text-slate-700", icon: "📌" },
};

export function TypeBadge({ type }: { type: EventType }) {
  const s = TYPE_STYLES[type] ?? TYPE_STYLES.other;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${s.bg} ${s.text}`}>
      {s.icon} {type}
    </span>
  );
}

export function CourseChip({ code, color }: { code: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {code}
    </span>
  );
}

export function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const style =
    value >= 0.85 ? "bg-green-100 text-green-700" : value >= 0.6 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-700";
  const label = value >= 0.85 ? "High" : value >= 0.6 ? "Check" : "Low";
  return (
    <span title={`AI confidence ${pct}%`} className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {label} · {pct}%
    </span>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{message}</div>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
      <div className="font-medium text-slate-700">{title}</div>
      {children && <div className="mt-2 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="h2">{title}</h2>
          <button onClick={onClose} className="btn-ghost px-2" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { CourseChip, TypeBadge } from "@/components/ui";
import { api, fmtDate, providerName, type CalEvent } from "@/lib/api";

interface Msg {
  role: "user" | "assistant";
  text: string;
  events?: CalEvent[];
  method?: string;
}

const SUGGESTIONS = [
  "What do I have due next week?",
  "When are my exams?",
  "What's due this week?",
  "Which week is the busiest?",
  "Make me a study plan for my next exam",
];

export default function AssistantPage() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "assistant", text: "Hi! Ask me anything about your deadlines, e.g. “What do I have due next week?”" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs]);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text: question }]);
    setInput("");
    setBusy(true);
    try {
      const r = await api<{ answer: string; method: string; events: CalEvent[] }>("/api/assistant/ask", {
        method: "POST",
        json: { question },
      });
      setMsgs((m) => [...m, { role: "assistant", text: r.answer, events: r.events, method: r.method }]);
    } catch (e) {
      setMsgs((m) => [...m, { role: "assistant", text: `Sorry, something went wrong: ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <h1 className="h1">Ask the assistant</h1>
      <p className="muted mb-4">Answers come from your confirmed deadlines.</p>

      <div className="card flex h-[calc(100vh-14rem)] min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {msgs.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-800"}`}>
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.events && m.events.length > 0 && m.method !== "rules" && (
                  <div className="mt-3 space-y-1 border-t border-slate-200 pt-2">
                    {m.events.slice(0, 6).map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-xs">
                        <span className="w-20 font-medium">{fmtDate(e.due_date)}</span>
                        <CourseChip code={e.course_code} color={e.course_color} />
                        <span className="flex-1 truncate">{e.title}</span>
                        <TypeBadge type={e.type} />
                      </div>
                    ))}
                  </div>
                )}
                {m.method && <div className="mt-2 text-[10px] uppercase tracking-wide opacity-50">{m.method === "rules" ? "Rule-based answer" : `Answered by ${providerName(m.method)}`}</div>}
              </div>
            </div>
          ))}
          {busy && <div className="w-16 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-500">…</div>}
          <div ref={endRef} />
        </div>
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => ask(s)} className="rounded-full border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50">
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="flex gap-2"
          >
            <input className="input" placeholder="Ask about your deadlines…" value={input} onChange={(e) => setInput(e.target.value)} />
            <button className="btn-primary" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}

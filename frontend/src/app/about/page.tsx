import Link from "next/link";
import PublicNav from "@/components/PublicNav";

/* Everything from the "AI Syllabus Planner" planning document, presented in the app,
   plus how each part was actually implemented in this codebase. */

const SECTIONS = [
  { id: "idea", label: "The idea" },
  { id: "flow", label: "User flow" },
  { id: "features", label: "Features" },
  { id: "ai", label: "How AI fits in" },
  { id: "architecture", label: "Architecture" },
  { id: "data", label: "Database" },
  { id: "google", label: "Google Calendar" },
  { id: "roles", label: "Team roles" },
  { id: "timeline", label: "Timeline" },
  { id: "risks", label: "Risks" },
  { id: "demo", label: "Demo script" },
];

const FEATURES_V1: [string, string, string][] = [
  ["User login / signup", "Email + password, hashed with PBKDF2, JWT session tokens", "/signup"],
  ["Add and manage courses", "Create, edit, colour-code and delete courses", "/courses"],
  ["Upload a syllabus PDF", "PDF or .txt up to 20 MB, processed in the background", "/upload"],
  ["Read the text from the syllabus", "pypdf extracts selectable text page by page", "/upload"],
  ["AI finds dates and course info", "Free Gemini API returns schema-shaped JSON for every dated item", "/upload"],
  ["List of assignments, exams, quizzes, projects", "Filterable deadline list with completion checkboxes", "/events"],
  ["Calendar of upcoming deadlines", "Month view, colour-coded by course", "/calendar"],
  ["Edit or delete an event", "Edit anywhere; changes re-sync to Google automatically", "/events"],
  ["Data saved between visits", "SQLite by default, PostgreSQL/Supabase via one setting", "/dashboard"],
];

const FEATURES_LATER: [string, string, boolean][] = [
  ["Google Calendar integration", "Built: OAuth 2.0 connect + one-click sync", true],
  ["Workload view (busiest weeks)", "Built: weekly workload chart on the dashboard", true],
  ["Chatbot about your syllabus", "Built: “What do I have due next week?” assistant", true],
  ["OCR for scanned syllabi", "Built when AI is enabled: Gemini reads the PDF pages directly", true],
  ["Multiple semesters", "Partly: each course stores its semester", true],
  ["AI study schedules before exams", "Ask the assistant “make me a study plan for my midterm”", true],
  ["Notifications and reminders", "Google Calendar events get a 1-day popup reminder", true],
  ["Canvas integration", "Not built yet (Canvas REST API + OAuth)", false],
];

const ROLES = [
  ["Frontend", "Website, dashboard, calendar, upload page, UI", "Next.js, React, TypeScript, Tailwind", "frontend/src/app/*"],
  ["Backend", "API, users, courses, events, database", "Python, FastAPI, SQLAlchemy", "backend/app/routers/*"],
  ["AI / Data", "Syllabus extraction + accuracy testing", "Gemini / Groq free APIs, JSON schema", "backend/app/services/extractor.py, llm.py"],
  ["Integrations", "Google Calendar, auth, Canvas", "OAuth 2.0, REST", "backend/app/services/gcal.py"],
  ["UI / UX", "Screen design and usability", "Figma", "frontend/src/components/*"],
  ["Testing / Deployment", "Testing, bug-fixing, hosting", "GitHub, Vercel, Render", "README.md"],
];

const TIMELINE = [
  ["Planning", "Decide what v1 needs; design screens", true],
  ["Basic app", "Frontend, backend, database, login", true],
  ["Syllabus upload", "Upload and read PDF syllabi", true],
  ["AI extraction", "Extract assignments, exams and dates", true],
  ["Dashboard", "Calendar + list views", true],
  ["Extra features", "Google Calendar, assistant, workload view", true],
  ["Testing", "Test with many real syllabi and fix issues", false],
  ["Final demo", "Deploy and prepare the presentation", false],
];

const RISKS = [
  ["AI may misread unusual date formats", "Every item has a confidence score and the exact source line; low-confidence items are highlighted on the review page."],
  ["Dates change during the semester", "Edit any event at any time; synced Google events update automatically."],
  ["Scanned PDFs have no selectable text", "With Gemini enabled, the PDF itself is sent to the AI, which reads the page images."],
  ["Questionable dates on the calendar", "Extracted events start unconfirmed. Only events the student confirmed are shown as final or synced to Google."],
  ["Canvas is complicated", "Treated as a later goal, as planned."],
];

const DEMO = [
  "Log into the app.",
  "Create a course called CS 3345.",
  "Upload a CS 3345 syllabus (sample/CS3345_syllabus.pdf is included).",
  "Watch the AI process the syllabus.",
  "Show the exams, assignments and projects it found.",
  "Change one date to show the student can correct the AI.",
  "Open the calendar and show the semester deadlines.",
  "Connect Google Calendar and sync.",
  "Ask the assistant: “What do I have due next week?”",
];

export default function About() {
  return (
    <div>
      <PublicNav />
      <div className="mx-auto max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:flex">
        <aside className="hidden w-48 shrink-0 lg:block">
          <nav className="sticky top-6 space-y-1 text-sm">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="block rounded px-2 py-1 text-slate-600 hover:bg-slate-100">
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 flex-1 space-y-14">
          <header>
            <h1 className="text-3xl font-extrabold tracking-tight">About the AI Syllabus Planner</h1>
            <p className="mt-3 text-lg text-slate-600">
              Everything about the project: the idea, what the app does, how it is built, and who works on what.
            </p>
          </header>

          <section id="idea" className="scroll-mt-6 space-y-3">
            <h2 className="text-xl font-bold">1. The idea, and why students would use it</h2>
            <p className="text-slate-700">
              The app takes a college syllabus and turns it into an organized semester schedule. Instead of reading every syllabus and
              typing dates into a calendar by hand, a student uploads the syllabus and the app finds the important dates.
            </p>
            <p className="text-slate-700">
              Every class has its own syllabus and its own deadlines, and important dates are often buried in a long PDF. The app does the
              first pass, and the student can still review and change anything before it reaches their calendar.
            </p>
          </section>

          <section id="flow" className="scroll-mt-6">
            <h2 className="text-xl font-bold">2. What the user actually does</h2>
            <ol className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                ["Create an account and add classes", "/courses"],
                ["Upload a syllabus PDF", "/upload"],
                ["Wait while the app reads it", "/upload"],
                ["Review the dates that were found", "/upload"],
                ["Fix anything read incorrectly", "/events"],
                ["See every deadline in one place", "/calendar"],
                ["Optionally add them to Google Calendar", "/settings"],
              ].map(([t, href], i) => (
                <li key={t} className="card flex items-center gap-3 p-4">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{t}</span>
                  <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">
                    Open →
                  </Link>
                </li>
              ))}
            </ol>
          </section>

          <section id="features" className="scroll-mt-6">
            <h2 className="text-xl font-bold">3. Features</h2>
            <h3 className="mt-4 font-semibold">First version (all built)</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <tbody>
                  {FEATURES_V1.map(([f, how, href]) => (
                    <tr key={f} className="border-b border-slate-100 last:border-0">
                      <td className="p-3">✅</td>
                      <td className="p-3 font-medium">{f}</td>
                      <td className="p-3 text-slate-600">{how}</td>
                      <td className="p-3">
                        <Link href={href} className="text-brand-600 hover:underline">
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mt-6 font-semibold">Later features</h3>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              {FEATURES_LATER.map(([f, note, done]) => (
                <div key={f} className="card p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <span>{done ? "✅" : "⏳"}</span>
                    {f}
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{note}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="ai" className="scroll-mt-6 space-y-4">
            <h2 className="text-xl font-bold">4. How AI fits into the project</h2>
            <p className="text-slate-700">
              The AI is used to understand the syllabus and return <b>structured data</b> the rest of the app can use, not a summary. The
              backend sends the PDF to Google Gemini (free tier) together with a JSON schema, and Gemini answers in exactly that shape. If
              Gemini is unavailable, Groq&apos;s free Llama model is tried next.
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="card">
                <div className="label">Syllabus says</div>
                <p className="font-mono text-sm">Midterm Exam - October 8 - Chapters 1 through 5</p>
              </div>
              <div className="card">
                <div className="label">AI returns</div>
                <pre className="overflow-x-auto text-xs">{`{
  "title": "Midterm Exam",
  "type": "exam",
  "date": "2026-10-08",
  "time": "",
  "description": "Chapters 1 through 5",
  "weight": "25%",
  "source_text": "Midterm Exam - October 8 - ...",
  "confidence": 0.95
}`}</pre>
              </div>
            </div>
            <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">
              <li>
                <b>Confidence + source line:</b> AI can make mistakes, so each item shows how sure the AI was and the exact line it came from.
              </li>
              <li>
                <b>Review before final:</b> extracted items start <em>unconfirmed</em> until the student approves them.
              </li>
              <li>
                <b>Fallback:</b> with no API key, a built-in rule-based parser (regex + keywords) still extracts dates so the app works
                offline.
              </li>
              <li>
                <b>Assistant:</b> questions like “What do I have due next week?” are answered from the student&apos;s confirmed deadlines.
              </li>
            </ul>
          </section>

          <section id="architecture" className="scroll-mt-6 space-y-4">
            <h2 className="text-xl font-bold">5. Architecture and tech stack</h2>
            <div className="card overflow-x-auto">
              <pre className="text-xs leading-relaxed">{`  Browser (Next.js + React + Tailwind)
        │  REST/JSON + Bearer token
        ▼
  FastAPI backend ──────────────► Database (SQLite / PostgreSQL / Supabase)
        │
        ├─ services/pdf.py        pypdf: read text from the PDF
        ├─ services/extractor.py  Gemini/Groq (free) → structured JSON, or rule-based fallback
        ├─ services/assistant.py  "What's due next week?"
        └─ services/gcal.py ────► Google OAuth 2.0 + Calendar API v3`}</pre>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {[
                ["Frontend", "Next.js 14, React 18, TypeScript, Tailwind CSS"],
                ["Backend", "Python, FastAPI, SQLAlchemy, Pydantic"],
                ["Database", "SQLite (dev) or PostgreSQL / Supabase"],
                ["AI", "Free Google Gemini API (Groq backup) with JSON-schema output"],
                ["File processing", "pypdf text extraction; Gemini reads scanned PDFs"],
                ["Auth", "Email/password + JWT; Google OAuth for Calendar"],
                ["Calendar", "Google Calendar API v3"],
                ["Deployment", "Vercel (frontend) + Render/Railway (backend)"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-lg border border-slate-200 bg-white p-3">
                  <span className="font-semibold">{k}:</span> <span className="text-slate-600">{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="data" className="scroll-mt-6">
            <h2 className="text-xl font-bold">6. What the database stores</h2>
            <p className="mt-2 text-sm text-slate-600">
              Tables: <code>users</code>, <code>courses</code>, <code>syllabi</code>, <code>events</code>. Every event stores:
            </p>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Planned field</th>
                    <th className="p-3">Column</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Course", "course_id"],
                    ["Assignment / event name", "title"],
                    ["Type (exam, homework, quiz, project…)", "type"],
                    ["Due date", "due_date"],
                    ["Due time, if available", "due_time"],
                    ["Description", "description (+ weight)"],
                    ["Whether the student completed it", "completed"],
                    ["Where it came from in the syllabus", "source_text, syllabus_id"],
                    ["Whether the AI was confident", "confidence (0–1), confirmed"],
                    ["Google Calendar link", "google_event_id"],
                  ].map(([a, b]) => (
                    <tr key={a} className="border-t border-slate-100">
                      <td className="p-3">{a}</td>
                      <td className="p-3 font-mono text-xs text-brand-700">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="google" className="scroll-mt-6 space-y-3">
            <h2 className="text-xl font-bold">7. Google Calendar integration</h2>
            <ol className="list-decimal space-y-1 pl-6 text-sm text-slate-700">
              <li>The student clicks <b>Connect Google Calendar</b> on the settings page.</li>
              <li>The backend sends them to Google&apos;s consent screen (scope: calendar events only).</li>
              <li>Google redirects back to the backend, which stores the access and refresh tokens.</li>
              <li>
                <b>Sync</b> creates one event per <em>confirmed</em> deadline, colour-coded by type with a reminder the day before.
              </li>
              <li>Editing or deleting a deadline later updates or removes the Google event too.</li>
            </ol>
          </section>

          <section id="roles" className="scroll-mt-6">
            <h2 className="text-xl font-bold">8. Team roles</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Role</th>
                    <th className="p-3">Works on</th>
                    <th className="p-3">Tools</th>
                    <th className="p-3">Where in the code</th>
                  </tr>
                </thead>
                <tbody>
                  {ROLES.map(([r, w, t, c]) => (
                    <tr key={r} className="border-t border-slate-100">
                      <td className="p-3 font-medium">{r}</td>
                      <td className="p-3 text-slate-600">{w}</td>
                      <td className="p-3 text-slate-600">{t}</td>
                      <td className="p-3 font-mono text-xs text-brand-700">{c}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="timeline" className="scroll-mt-6">
            <h2 className="text-xl font-bold">9. Timeline</h2>
            <ol className="relative mt-4 space-y-4 border-l-2 border-brand-100 pl-6">
              {TIMELINE.map(([stage, goal, done], i) => (
                <li key={stage as string}>
                  <span
                    className={`absolute -left-[9px] mt-1 h-4 w-4 rounded-full border-2 ${done ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"}`}
                  />
                  <div className="font-semibold">
                    Stage {i + 1}: {stage} {done ? <span className="text-xs font-medium text-green-600">· done</span> : <span className="text-xs text-slate-400">· next</span>}
                  </div>
                  <div className="text-sm text-slate-600">{goal}</div>
                </li>
              ))}
            </ol>
          </section>

          <section id="risks" className="scroll-mt-6">
            <h2 className="text-xl font-bold">10. Risks and how the app handles them</h2>
            <div className="mt-3 space-y-3">
              {RISKS.map(([r, m]) => (
                <div key={r} className="card p-4">
                  <div className="font-medium">⚠️ {r}</div>
                  <div className="mt-1 text-sm text-slate-600">{m}</div>
                </div>
              ))}
            </div>
          </section>

          <section id="demo" className="scroll-mt-6">
            <h2 className="text-xl font-bold">11. Final demo script</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-6 text-slate-700">
              {DEMO.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ol>
            <p className="mt-6 rounded-lg bg-brand-50 p-4 text-sm text-brand-700">
              <b>Overall goal:</b> make one thing work really well first: upload a syllabus, understand it, and turn it into a useful
              student calendar. Then add more on top.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}

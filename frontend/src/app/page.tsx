import Link from "next/link";
import PublicNav from "@/components/PublicNav";

const STEPS = [
  ["Add your classes", "Create a course like CS 3345 in a few seconds."],
  ["Upload the syllabus", "Drop in the PDF your professor posted."],
  ["AI reads it", "Exams, quizzes, homework, projects and readings are pulled out with dates."],
  ["You review", "Fix anything the AI got wrong. Nothing is final until you approve it."],
  ["See everything", "One dashboard and calendar for every class."],
  ["Sync to Google", "Send the approved deadlines to Google Calendar in one click."],
];

export default function Home() {
  return (
    <div>
      <PublicNav />
      <section className="bg-gradient-to-b from-brand-50 to-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm">AI-powered semester planning</span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Turn every syllabus into one organized semester calendar.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Stop digging through long PDFs for due dates. Upload a syllabus, let AI find the exams, homework and projects, review the
            results, and send them to Google Calendar.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="btn-primary px-6 py-3 text-base">
              Get started free
            </Link>
            <a href="#how-it-works" className="btn-secondary px-6 py-3 text-base">
              How it works
            </a>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold">How it works</h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="card">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</div>
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="card grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Example</h2>
            <p className="mt-2 text-slate-600">
              The syllabus says <em>“Midterm Exam - October 8 - Chapters 1 through 5”</em>. The AI saves it as an <b>exam</b> on{" "}
              <b>October 8</b> covering <b>Chapters 1 through 5</b>, and shows you the line it came from so you can check it.
            </p>
          </div>
          <div className="space-y-2 rounded-lg bg-slate-50 p-4 font-mono text-sm">
            <div>📘 Sep 29 · Homework 3</div>
            <div>📝 Oct 8 · Exam 1 (Ch. 1–5)</div>
            <div>🛠️ Nov 20 · Final Project</div>
          </div>
        </div>
      </section>
      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">AI Syllabus Planner · Built as a student team project</footer>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import CourseForm from "@/components/CourseForm";
import { ErrorBox, Modal } from "@/components/ui";
import { api, API_URL, getToken, type Course, type Health, type Syllabus } from "@/lib/api";

const STAGES = [
  { key: "uploaded", label: "Uploading file" },
  { key: "processing", label: "Reading the syllabus and finding dates" },
  { key: "review", label: "Ready for your review" },
];

export default function UploadPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState<number | "">("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<Syllabus | null>(null);
  const [pending, setPending] = useState<Syllabus[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function loadCourses(selectId?: number) {
    const cs = await api<Course[]>("/api/courses");
    setCourses(cs);
    const fromUrl = Number(new URLSearchParams(window.location.search).get("course"));
    const pick = selectId ?? (cs.some((c) => c.id === fromUrl) ? fromUrl : cs[0]?.id);
    if (pick) setCourseId(pick);
  }

  useEffect(() => {
    loadCourses().catch((e) => setError(e.message));
    api<Syllabus[]>("/api/syllabi").then((s) => setPending(s.filter((x) => x.status === "review")));
    api<Health>("/api/health").then(setHealth);
  }, []);

  // Poll the background job until extraction finishes.
  useEffect(() => {
    if (!job || job.status === "review" || job.status === "failed" || job.status === "confirmed") return;
    const t = setInterval(async () => {
      const s = await api<Syllabus>(`/api/syllabi/${job.id}`);
      setJob(s);
      if (s.status === "review") router.push(`/review/${s.id}`);
    }, 1500);
    return () => clearInterval(t);
  }, [job, router]);

  async function upload() {
    if (!file || !courseId) return;
    setError(null);
    const fd = new FormData();
    fd.append("course_id", String(courseId));
    fd.append("file", file);
    setJob({ id: 0, status: "uploaded" } as Syllabus);
    try {
      const res = await fetch(`${API_URL}/api/syllabi`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: fd,
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Upload failed");
      setJob(await res.json());
    } catch (e) {
      setJob(null);
      setError((e as Error).message);
    }
  }

  function pickFile(f: File | undefined) {
    if (!f) return;
    if (!/\.(pdf|txt)$/i.test(f.name)) {
      setError("Please choose a PDF file.");
      return;
    }
    setError(null);
    setFile(f);
  }

  const stageIndex = job ? STAGES.findIndex((s) => s.key === job.status) : -1;

  return (
    <AppShell>
      <h1 className="h1">Upload a syllabus</h1>
      <p className="muted mb-6">
        {health?.ai_enabled ? "AI" : "The rule-based parser"} will find exams, quizzes, homework, projects and readings. You&apos;ll review
        everything before it&apos;s saved as final.
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card space-y-5 lg:col-span-2">
          <ErrorBox message={error} />
          {!job || job.status === "failed" ? (
            <>
              <div>
                <label className="label">Course</label>
                {courses.length === 0 ? (
                  <button className="btn-secondary" onClick={() => setAdding(true)}>
                    + Add a course first
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <select className="input" value={courseId} onChange={(e) => setCourseId(Number(e.target.value))}>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} {c.name && `— ${c.name}`}
                        </option>
                      ))}
                    </select>
                    <button className="btn-secondary whitespace-nowrap" onClick={() => setAdding(true)}>
                      + New
                    </button>
                  </div>
                )}
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  pickFile(e.dataTransfer.files[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition ${
                  drag ? "border-brand-500 bg-brand-50" : "border-slate-300 hover:border-brand-400"
                }`}
              >
                <div className="text-4xl">📄</div>
                {file ? (
                  <div className="mt-2 font-medium">
                    {file.name} <span className="text-slate-500">({(file.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <>
                    <div className="mt-2 font-medium">Drop your syllabus PDF here</div>
                    <div className="muted">or click to choose a file (max 20 MB)</div>
                  </>
                )}
                <input ref={inputRef} type="file" accept=".pdf,.txt" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
              </div>

              {job?.status === "failed" && <ErrorBox message={`Processing failed: ${job.error}`} />}

              <button className="btn-primary w-full py-3" disabled={!file || !courseId} onClick={upload}>
                Upload and extract dates
              </button>
            </>
          ) : (
            <div className="py-6">
              <h2 className="h2 mb-6 text-center">Processing {file?.name}</h2>
              <ol className="mx-auto max-w-md space-y-4">
                {STAGES.map((s, i) => (
                  <li key={s.key} className="flex items-center gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                        i < stageIndex ? "bg-green-500 text-white" : i === stageIndex ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {i < stageIndex ? "✓" : i + 1}
                    </span>
                    <span className={i === stageIndex ? "font-medium" : "text-slate-500"}>{s.label}</span>
                    {i === stageIndex && i < 2 && <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />}
                  </li>
                ))}
              </ol>
              <p className="muted mt-6 text-center">AI extraction usually takes 15–60 seconds for a long syllabus.</p>
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="h2 mb-3">Waiting for review</h2>
          {pending.length === 0 ? (
            <p className="muted">Nothing waiting.</p>
          ) : (
            <ul className="space-y-2">
              {pending.map((s) => (
                <li key={s.id}>
                  <Link href={`/review/${s.id}`} className="block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm hover:bg-amber-100">
                    <div className="truncate font-medium">{s.filename}</div>
                    <div className="text-xs text-amber-800">{s.event_count} items to review →</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            <b>Tip:</b> try <code>sample/CS3345_syllabus.pdf</code> from the project folder for a quick demo.
          </div>
        </div>
      </div>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a course">
        <CourseForm
          onCancel={() => setAdding(false)}
          onSaved={(c) => {
            setAdding(false);
            loadCourses(c.id);
          }}
        />
      </Modal>
    </AppShell>
  );
}

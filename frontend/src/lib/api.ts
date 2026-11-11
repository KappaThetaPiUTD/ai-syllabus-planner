// Thin client for the FastAPI backend. The login token lives in localStorage.
// Set in frontend/.env.production for the deployed site; local dev talks to localhost.
const PRODUCTION_API_URL = "https://ai-syllabus-planner-api.onrender.com";
export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "production" ? PRODUCTION_API_URL : "http://localhost:8000")
).replace(/\/+$/, "");

export type EventType = "exam" | "quiz" | "homework" | "project" | "reading" | "lab" | "presentation" | "other";
export const EVENT_TYPES: EventType[] = ["exam", "quiz", "homework", "project", "reading", "lab", "presentation", "other"];

export interface User {
  id: number;
  email: string;
  name: string;
  google_connected: boolean;
  google_email: string | null;
}

export interface Course {
  id: number;
  code: string;
  name: string;
  instructor: string;
  semester: string;
  color: string;
  event_count: number;
  syllabus_count: number;
}

export interface CalEvent {
  id: number;
  course_id: number;
  syllabus_id: number | null;
  title: string;
  type: EventType;
  due_date: string; // YYYY-MM-DD
  due_time: string | null; // HH:MM:SS
  description: string;
  weight: string;
  completed: boolean;
  source_text: string;
  confidence: number;
  confirmed: boolean;
  google_event_id: string | null;
  course_code: string;
  course_color: string;
}

export interface Syllabus {
  id: number;
  course_id: number;
  filename: string;
  status: "uploaded" | "processing" | "review" | "confirmed" | "failed";
  method: string;
  summary: string;
  error: string;
  uploaded_at: string;
  text_length: number;
  event_count: number;
  text?: string;
  events?: CalEvent[];
}

export interface Stats {
  total: number;
  completed: number;
  due_this_week: number;
  overdue: number;
  upcoming_exams: number;
  needs_review: boolean;
  weeks: { week_start: string; count: number; exams: number; load: number }[];
}

export const PROVIDER_NAMES: Record<string, string> = {
  gemini: "Google Gemini",
  groq: "Groq (Llama)",
  claude: "Claude",
  ai: "AI",
  rules: "the rule-based parser",
};
export const providerName = (m: string) => PROVIDER_NAMES[m] ?? m;

export interface Health {
  status: string;
  ai_enabled: boolean;
  ai_providers: string[];
  google_configured: boolean;
}

const TOKEN_KEY = "sp_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = options.body;
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers, body });
  } catch {
    throw new ApiError(0, `Can't reach the backend at ${API_URL}. Is it running?`);
  }
  if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/api/auth/login")) {
    setToken(null);
    if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
  }
  if (!res.ok) {
    let msg = res.statusText;
    try {
      const data = await res.json();
      msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

// ---------- date helpers ----------
export function parseDate(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(y, m - 1, day);
}

export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return parseDate(d).toLocaleDateString(undefined, opts);
}

export function fmtTime(t: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function daysUntil(d: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(d).getTime() - today.getTime()) / 86400000);
}

export function relativeDay(d: string): string {
  const n = daysUntil(d);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n < 0) return `${-n} days ago`;
  return `In ${n} days`;
}

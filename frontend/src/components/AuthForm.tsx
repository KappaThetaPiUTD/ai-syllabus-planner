"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { ErrorBox } from "./ui";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const { login, signup, user } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await signup(email, password, name);
      router.push(mode === "signup" ? "/courses?welcome=1" : "/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-slate-50 p-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 flex items-center justify-center gap-2 text-lg font-bold text-brand-700">
          <span className="text-2xl">🎓</span> AI Syllabus Planner
        </Link>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h1 className="h2 text-center">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <ErrorBox message={error} />
          {mode === "signup" && (
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex Student" />
            </div>
          )}
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
          <p className="text-center text-sm text-slate-500">
            {mode === "login" ? (
              <>
                No account?{" "}
                <Link href="/signup" className="font-medium text-brand-600">
                  Sign up
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-brand-600">
                  Log in
                </Link>
              </>
            )}
          </p>
        </form>
      </div>
    </div>
  );
}

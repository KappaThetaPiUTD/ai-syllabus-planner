"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

export default function PublicNav() {
  const { user } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold text-brand-700">
          <span className="text-2xl">🎓</span> AI Syllabus Planner
        </Link>
        <nav className="flex items-center gap-2">
          <Link href="/about" className="btn-ghost">
            About
          </Link>
          {user ? (
            <Link href="/dashboard" className="btn-primary">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn-ghost">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary">
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

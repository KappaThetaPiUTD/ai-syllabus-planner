"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠" },
  { href: "/courses", label: "Courses", icon: "📚" },
  { href: "/upload", label: "Upload Syllabus", icon: "📄" },
  { href: "/events", label: "All Deadlines", icon: "✅" },
  { href: "/calendar", label: "Calendar", icon: "📅" },
  { href: "/assistant", label: "Ask the Assistant", icon: "💬" },
  { href: "/settings", label: "Google Calendar", icon: "🔗" },
  { href: "/about", label: "About the Project", icon: "ℹ️" },
];

/** Layout for logged-in pages: sidebar navigation + auth guard. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-slate-200 bg-white p-4 transition lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Link href="/dashboard" className="mb-8 flex items-center gap-2 px-2 text-lg font-bold text-brand-700">
          <span className="text-2xl">🎓</span> Syllabus Planner
        </Link>
        <nav className="space-y-1">
          {NAV.map((n) => {
            const active = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 border-t border-slate-200 pt-4">
          <div className="truncate px-2 text-sm font-medium">{user.name || user.email}</div>
          <div className="truncate px-2 text-xs text-slate-500">{user.email}</div>
          <button onClick={logout} className="btn-ghost mt-2 w-full justify-start">
            Log out
          </button>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
      <div className="flex-1">
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <button className="btn-ghost px-2" onClick={() => setOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <span className="font-semibold">Syllabus Planner</span>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

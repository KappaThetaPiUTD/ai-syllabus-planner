"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { ErrorBox } from "@/components/ui";
import { api, API_URL, type CalEvent } from "@/lib/api";

interface GStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
}

export default function SettingsPage() {
  const { refresh } = useAuth();
  const [status, setStatus] = useState<GStatus | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [s, e] = await Promise.all([api<GStatus>("/api/google/status"), api<CalEvent[]>("/api/events?confirmed=true")]);
      setStatus(s);
      setEvents(e);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    load();
    const p = new URLSearchParams(window.location.search);
    if (p.get("google") === "connected") {
      setNotice("Google Calendar connected! You can now sync your deadlines.");
      refresh();
    } else if (p.get("google") === "error") setError(`Google sign-in failed (${p.get("reason")}). Please try again.`);
    if (p.get("google")) window.history.replaceState(null, "", "/settings");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setError(null);
    try {
      const { url } = await api<{ url: string }>("/api/google/auth-url");
      window.location.href = url;
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function disconnect() {
    await api("/api/google/disconnect", { method: "POST" });
    setNotice("Disconnected from Google Calendar.");
    load();
    refresh();
  }

  async function sync(all: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const r = await api<{ created: number; updated: number; failed: number; errors: string[] }>("/api/google/sync", {
        method: "POST",
        json: { event_ids: all ? events.map((e) => e.id) : null },
      });
      setNotice(`Sync complete: ${r.created} created, ${r.updated} updated${r.failed ? `, ${r.failed} failed` : ""}.`);
      if (r.errors.length) setError(r.errors.join("\n"));
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const synced = events.filter((e) => e.google_event_id).length;

  return (
    <AppShell>
      <h1 className="h1">Google Calendar</h1>
      <p className="muted mb-6">Send your reviewed deadlines to Google Calendar. Only confirmed items are ever synced.</p>
      <div className="space-y-4">
        <ErrorBox message={error} />
        {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>}

        <div className="card">
          {!status ? (
            <p className="muted">Loading…</p>
          ) : !status.configured ? (
            <div className="space-y-3 text-sm">
              <h2 className="h2">Google OAuth isn&apos;t set up yet</h2>
              <p className="text-slate-600">The backend needs a Google OAuth client. One-time setup:</p>
              <ol className="list-decimal space-y-1 pl-6 text-slate-600">
                <li>
                  Go to <b>console.cloud.google.com</b>, create a project and enable the <b>Google Calendar API</b>.
                </li>
                <li>
                  Under <b>APIs &amp; Services → OAuth consent screen</b>, choose “External” and add yourself as a test user.
                </li>
                <li>
                  Under <b>Credentials</b>, create an <b>OAuth client ID</b> of type “Web application” with redirect URI{" "}
                  <code className="rounded bg-slate-100 px-1">{API_URL}/api/google/callback</code>
                </li>
                <li>
                  Put the client ID and secret into <code className="rounded bg-slate-100 px-1">backend/.env</code> as{" "}
                  <code>GOOGLE_CLIENT_ID</code> / <code>GOOGLE_CLIENT_SECRET</code> and restart the backend.
                </li>
              </ol>
            </div>
          ) : status.connected ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500" /> Connected
                </div>
                <div className="muted">{status.email ?? "Google account"}</div>
              </div>
              <button className="btn-secondary" onClick={disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="h2">Connect your Google account</h2>
                <p className="muted">We only ask to manage calendar events, nothing else.</p>
              </div>
              <button className="btn-primary" onClick={connect}>
                📅 Connect Google Calendar
              </button>
            </div>
          )}
        </div>

        {status?.connected && (
          <div className="card">
            <h2 className="h2">Sync deadlines</h2>
            <p className="muted mt-1">
              {events.length} confirmed deadlines · {synced} already on Google Calendar · {events.length - synced} not yet synced
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button className="btn-primary" disabled={busy || events.length - synced === 0} onClick={() => sync(false)}>
                {busy ? "Syncing…" : `Sync ${events.length - synced} new deadlines`}
              </button>
              <button className="btn-secondary" disabled={busy || events.length === 0} onClick={() => sync(true)}>
                Re-sync everything
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Events are titled “[COURSE] Title”, colour-coded by type, and get a reminder one day before. Editing or deleting a deadline
              here updates Google Calendar automatically.
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}

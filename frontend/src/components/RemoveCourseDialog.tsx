"use client";

import { useState } from "react";
import { api, type Course } from "@/lib/api";
import { ErrorBox, Modal } from "./ui";

/** Confirmation dialog for permanently removing a course and everything attached to it. */
export default function RemoveCourseDialog({
  course,
  googleConnected,
  onClose,
  onRemoved,
}: {
  course: Course | null;
  googleConnected?: boolean;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!course) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/api/courses/${course.id}`, { method: "DELETE" });
      onRemoved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={course !== null} onClose={busy ? () => {} : onClose} title={`Remove ${course?.code ?? "course"}?`}>
      {course && (
        <div className="space-y-4 text-sm">
          <ErrorBox message={error} />
          <p className="text-slate-700">This permanently deletes the course and everything in it:</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-700">
            <li>
              <b>{course.event_count}</b> deadline{course.event_count === 1 ? "" : "s"}
            </li>
            <li>
              <b>{course.syllabus_count}</b> uploaded syllab{course.syllabus_count === 1 ? "us" : "i"}
            </li>
            {googleConnected && <li>Any of its deadlines you synced to Google Calendar</li>}
          </ul>
          <p className="font-medium text-red-600">This can&apos;t be undone.</p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn-danger" onClick={remove} disabled={busy}>
              {busy ? "Removing…" : "Remove course"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

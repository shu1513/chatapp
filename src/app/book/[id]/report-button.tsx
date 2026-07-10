"use client";

import { useActionState, useState } from "react";
import { reportCounterparty, type ReportState } from "./report-actions";

export function ReportButton({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ReportState, FormData>(
    reportCounterparty,
    {},
  );

  if (state.reported) {
    return (
      <p className="text-sm text-gray-500">
        Report received — we&apos;ll review it.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start text-sm text-gray-400 underline hover:text-red-600"
      >
        Report a problem
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="bookingId" value={bookingId} />
      <textarea
        name="reason"
        required
        minLength={10}
        maxLength={2000}
        rows={3}
        placeholder="What happened?"
        className="rounded border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
        >
          {pending ? "Sending…" : "Submit report"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        >
          Cancel
        </button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

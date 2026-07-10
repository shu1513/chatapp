"use client";

import { useActionState, useEffect, useState } from "react";
import { bookSlot, type BookSlotState } from "./actions";

export function SlotList({
  handle,
  slotStarts,
}: {
  handle: string;
  slotStarts: string[];
}) {
  // Format on the client so times show in the viewer's timezone.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const [state, formAction, pending] = useActionState<BookSlotState, FormData>(
    bookSlot,
    {},
  );

  if (slotStarts.length === 0) {
    return <p className="text-sm text-gray-500">No open slots right now.</p>;
  }
  if (!ready) {
    return <p className="text-sm text-gray-400">Loading times…</p>;
  }

  const byDay = new Map<string, Date[]>();
  for (const iso of slotStarts) {
    const d = new Date(iso);
    const day = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    byDay.set(day, [...(byDay.get(day) ?? []), d]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="handle" value={handle} />
      {[...byDay.entries()].map(([day, times]) => (
        <div key={day}>
          <h3 className="mb-2 text-sm font-medium text-gray-600">{day}</h3>
          <div className="flex flex-wrap gap-2">
            {times.map((t) => (
              <button
                key={t.toISOString()}
                type="submit"
                name="slotStart"
                value={t.toISOString()}
                disabled={pending}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:border-black disabled:opacity-50"
              >
                {t.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </button>
            ))}
          </div>
        </div>
      ))}
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

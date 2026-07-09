"use client";

import { useActionState, useState } from "react";
import { saveAvailability, type AvailabilityState } from "./actions";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const minuteToTime = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

type Row = { enabled: boolean; start: string; end: string };

export function AvailabilityForm({
  initial,
}: {
  initial: { weekday: number; startMinute: number; endMinute: number }[];
}) {
  const [state, formAction, pending] = useActionState<
    AvailabilityState,
    FormData
  >(saveAvailability, {});

  const [rows, setRows] = useState<Row[]>(() =>
    WEEKDAYS.map((_, weekday) => {
      const rule = initial.find((r) => r.weekday === weekday);
      return rule
        ? {
            enabled: true,
            start: minuteToTime(rule.startMinute),
            end: minuteToTime(rule.endMinute),
          }
        : { enabled: false, start: "09:00", end: "17:00" };
    }),
  );

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {WEEKDAYS.map((name, weekday) => {
        const row = rows[weekday];
        return (
          <div key={name} className="flex items-center gap-3">
            <label className="flex w-32 items-center gap-2">
              <input
                type="checkbox"
                checked={row.enabled}
                onChange={(e) => update(weekday, { enabled: e.target.checked })}
              />
              <span className="text-sm">{name}</span>
            </label>
            {row.enabled ? (
              <>
                <input type="hidden" name="weekday" value={weekday} />
                <input
                  type="time"
                  name="start"
                  required
                  value={row.start}
                  onChange={(e) => update(weekday, { start: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  name="end"
                  required
                  value={row.end}
                  onChange={(e) => update(weekday, { end: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1"
                />
              </>
            ) : (
              <span className="text-sm text-gray-400">Unavailable</span>
            )}
          </div>
        );
      })}
      <button
        type="submit"
        disabled={pending}
        className="mt-3 self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save availability"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && (
        <p className="text-sm text-green-700">Saved.</p>
      )}
    </form>
  );
}

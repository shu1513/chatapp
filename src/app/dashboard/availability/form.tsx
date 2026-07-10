"use client";

import { useActionState, useState } from "react";
import {
  addBlackout,
  removeBlackout,
  saveAvailability,
  saveBookingRules,
  type AvailabilityState,
} from "./actions";

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

type Win = { weekday: number; start: string; end: string };

export function AvailabilityForm({
  initial,
}: {
  initial: { weekday: number; startMinute: number; endMinute: number }[];
}) {
  const [state, formAction, pending] = useActionState<
    AvailabilityState,
    FormData
  >(saveAvailability, {});

  const [wins, setWins] = useState<Win[]>(() =>
    initial.map((r) => ({
      weekday: r.weekday,
      start: minuteToTime(r.startMinute),
      end: minuteToTime(r.endMinute),
    })),
  );

  function addWindow(weekday: number) {
    setWins((ws) => [...ws, { weekday, start: "09:00", end: "17:00" }]);
  }
  function removeWindow(idx: number) {
    setWins((ws) => ws.filter((_, i) => i !== idx));
  }
  function update(idx: number, patch: Partial<Win>) {
    setWins((ws) => ws.map((w, i) => (i === idx ? { ...w, ...patch } : w)));
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {WEEKDAYS.map((name, weekday) => {
        const dayWins = wins
          .map((w, idx) => ({ ...w, idx }))
          .filter((w) => w.weekday === weekday);
        return (
          <div key={name} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="w-28 text-sm font-medium">{name}</span>
              {dayWins.length === 0 && (
                <span className="text-sm text-gray-400">Unavailable</span>
              )}
              <button
                type="button"
                onClick={() => addWindow(weekday)}
                className="ml-auto text-sm text-gray-500 hover:text-black"
              >
                + Add window
              </button>
            </div>
            {dayWins.map((w) => (
              <div key={w.idx} className="ml-28 flex items-center gap-2">
                <input type="hidden" name="weekday" value={weekday} />
                <input
                  type="time"
                  name="start"
                  required
                  value={w.start}
                  onChange={(e) => update(w.idx, { start: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="time"
                  name="end"
                  required
                  value={w.end}
                  onChange={(e) => update(w.idx, { end: e.target.value })}
                  className="rounded border border-gray-300 px-2 py-1"
                />
                <button
                  type="button"
                  onClick={() => removeWindow(w.idx)}
                  aria-label="Remove window"
                  className="text-sm text-gray-400 hover:text-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
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

export function BookingRulesForm({
  initial,
}: {
  initial: {
    bufferMin: number;
    minNoticeMin: number;
    horizonDays: number;
    instantRateCentsPerMin: number | null;
  };
}) {
  const [state, formAction, pending] = useActionState<
    AvailabilityState,
    FormData
  >(saveBookingRules, {});

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Buffer between calls</span>
        <select
          name="bufferMin"
          defaultValue={initial.bufferMin}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value={0}>None</option>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Minimum notice</span>
        <select
          name="minNoticeMin"
          defaultValue={initial.minNoticeMin}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value={60}>1 hour</option>
          <option value={180}>3 hours</option>
          <option value={720}>12 hours</option>
          <option value={1440}>24 hours</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Booking horizon</span>
        <select
          name="horizonDays"
          defaultValue={initial.horizonDays}
          className="rounded border border-gray-300 px-2 py-1"
        >
          <option value={7}>1 week</option>
          <option value={14}>2 weeks</option>
          <option value={30}>1 month</option>
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Instant rate ($/min)</span>
        <input
          type="number"
          name="instantRateUsdPerMin"
          min={0.5}
          max={500}
          step={0.5}
          placeholder="off"
          defaultValue={
            initial.instantRateCentsPerMin !== null
              ? initial.instantRateCentsPerMin / 100
              : ""
          }
          className="w-28 rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save rules"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && (
        <p className="text-sm text-green-700">Saved.</p>
      )}
    </form>
  );
}

export function BlackoutForm({
  blackouts,
}: {
  blackouts: { id: string; date: string }[];
}) {
  const [addState, addAction, addPending] = useActionState<
    AvailabilityState,
    FormData
  >(addBlackout, {});
  const [, removeAction] = useActionState<AvailabilityState, FormData>(
    removeBlackout,
    {},
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <form action={addAction} className="flex items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Block a day</span>
          <input
            type="date"
            name="date"
            required
            min={today}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={addPending}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Block
        </button>
      </form>
      {addState.error && (
        <p className="text-sm text-red-600">{addState.error}</p>
      )}
      {blackouts.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {blackouts.map((b) => (
            <li
              key={b.id}
              className="flex items-center gap-2 rounded border border-gray-200 px-3 py-1 text-sm"
            >
              {b.date}
              <form action={removeAction}>
                <input type="hidden" name="id" value={b.id} />
                <button
                  type="submit"
                  aria-label={`Unblock ${b.date}`}
                  className="text-gray-400 hover:text-red-600"
                >
                  ✕
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

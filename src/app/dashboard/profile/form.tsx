"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "./actions";

const CALL_LENGTHS = [10, 15, 30, 60];

export function ProfileForm({
  initial,
}: {
  initial: {
    displayName: string;
    bio: string;
    rateUsd: number;
    callLengthMin: number;
    approvalMode: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(
    updateProfile,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Display name</span>
        <input
          name="displayName"
          required
          maxLength={80}
          defaultValue={initial.displayName}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Bio</span>
        <textarea
          name="bio"
          maxLength={1000}
          rows={3}
          defaultValue={initial.bio}
          className="rounded border border-gray-300 px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Price per call (USD)</span>
        <input
          name="rateUsd"
          type="number"
          required
          min={1}
          max={10000}
          step={1}
          defaultValue={initial.rateUsd}
          className="rounded border border-gray-300 px-3 py-2"
        />
        <span className="text-xs text-gray-500">
          Applies to new bookings; existing bookings keep their price.
        </span>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Call length</span>
        <select
          name="callLengthMin"
          defaultValue={initial.callLengthMin}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {CALL_LENGTHS.map((min) => (
            <option key={min} value={min}>
              {min} minutes
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="approvalMode"
          defaultChecked={initial.approvalMode}
        />
        <span className="text-sm">
          Review each booking request before it&apos;s confirmed
        </span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.saved && !state.error && (
        <p className="text-sm text-green-700">Saved.</p>
      )}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { onboardCreator, type OnboardState } from "./actions";

const CALL_LENGTHS = [10, 15, 30, 60];

export default function OnboardPage() {
  const [state, formAction, pending] = useActionState<OnboardState, FormData>(
    onboardCreator,
    {},
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Become a creator</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Handle</span>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">@</span>
            <input
              name="handle"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9_]+"
              placeholder="yourname"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Display name</span>
          <input
            name="displayName"
            required
            maxLength={80}
            placeholder="Your Name"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Bio</span>
          <textarea
            name="bio"
            maxLength={1000}
            rows={3}
            placeholder="What can fans talk to you about?"
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
            placeholder="25"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Call length</span>
          <select
            name="callLengthMin"
            defaultValue={15}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {CALL_LENGTHS.map((min) => (
              <option key={min} value={min}>
                {min} minutes
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create my page"}
        </button>
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      </form>
    </main>
  );
}

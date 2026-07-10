"use client";

import { useActionState } from "react";
import {
  requestInstantCall,
  type InstantRequestState,
} from "./instant-actions";

export function CallNowButton({
  handle,
  ratePerMin,
}: {
  handle: string;
  ratePerMin: number;
}) {
  const [state, formAction, pending] = useActionState<
    InstantRequestState,
    FormData
  >(requestInstantCall, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="handle" value={handle} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-green-700 px-4 py-3 text-lg font-medium text-white disabled:opacity-50"
      >
        {pending
          ? "Calling…"
          : `Call now · $${(ratePerMin / 100).toFixed(2)}/min`}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

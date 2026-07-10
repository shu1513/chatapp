"use client";

import { useActionState } from "react";
import { blockCustomer, type ReviewState } from "./actions";

export function BlockButton({ bookingId }: { bookingId: string }) {
  const [state, formAction, pending] = useActionState<ReviewState, FormData>(
    blockCustomer,
    {},
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <button
        type="submit"
        disabled={pending}
        title="Block this customer from booking or calling you"
        className="text-xs text-gray-400 underline hover:text-red-600 disabled:opacity-50"
      >
        Block
      </button>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { acceptBooking, declineBooking, type ReviewState } from "./actions";

export function ReviewButtons({ bookingId }: { bookingId: string }) {
  const [acceptState, acceptAction, acceptPending] = useActionState<
    ReviewState,
    FormData
  >(acceptBooking, {});
  const [declineState, declineAction, declinePending] = useActionState<
    ReviewState,
    FormData
  >(declineBooking, {});

  const busy = acceptPending || declinePending;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
          >
            Accept
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
          >
            Decline
          </button>
        </form>
      </div>
      {(acceptState.error || declineState.error) && (
        <p className="text-xs text-red-600">
          {acceptState.error ?? declineState.error}
        </p>
      )}
    </div>
  );
}

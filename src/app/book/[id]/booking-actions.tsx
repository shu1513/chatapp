"use client";

import { useActionState, useEffect } from "react";
import {
  cancelBooking,
  startCheckout,
  type BookingActionState,
} from "./actions";

export function BookingActions({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const [payState, payAction, payPending] = useActionState<
    BookingActionState,
    FormData
  >(startCheckout, {});
  const [cancelState, cancelAction, cancelPending] = useActionState<
    BookingActionState,
    FormData
  >(cancelBooking, {});

  useEffect(() => {
    if (payState.checkoutUrl) {
      window.location.href = payState.checkoutUrl;
    }
  }, [payState.checkoutUrl]);

  const cancellable = [
    "pending_payment",
    "pending_approval",
    "confirmed",
  ].includes(status);

  return (
    <div className="flex flex-col gap-3">
      {status === "pending_payment" && (
        <form action={payAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            disabled={payPending}
            className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-50"
          >
            {payPending ? "Redirecting…" : "Pay now"}
          </button>
        </form>
      )}
      {cancellable && (
        <form action={cancelAction}>
          <input type="hidden" name="bookingId" value={bookingId} />
          <button
            type="submit"
            disabled={cancelPending}
            className="w-full rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
          >
            {cancelPending ? "Cancelling…" : "Cancel booking"}
          </button>
        </form>
      )}
      {(payState.error || cancelState.error) && (
        <p className="text-sm text-red-600">
          {payState.error ?? cancelState.error}
        </p>
      )}
    </div>
  );
}

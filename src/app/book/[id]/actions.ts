"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators } from "@/db/schema";
import { createBookingCheckout, refundBookingPayment } from "@/lib/payments";
import { getSession } from "@/lib/session";

export type BookingActionState = { error?: string; checkoutUrl?: string };

/** Customer cancellations this close to the call keep the payment. */
const FREE_CANCEL_HOURS = 24;

export async function startCheckout(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const id = String(formData.get("bookingId"));

  const [row] = await db
    .select({
      booking: bookings,
      creatorName: creators.displayName,
      callLengthMin: creators.callLengthMin,
    })
    .from(bookings)
    .innerJoin(creators, eq(creators.userId, bookings.creatorId))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, session.user.id)))
    .limit(1);

  if (!row || row.booking.status !== "pending_payment") {
    return { error: "Booking not found or not payable" };
  }

  const url = await createBookingCheckout({
    bookingId: row.booking.id,
    priceCents: row.booking.priceCents,
    creatorName: row.creatorName,
    callLengthMin: row.callLengthMin,
    customerEmail: session.user.email,
  });
  // Cross-origin redirect from a server action is unreliable; the client
  // navigates to Stripe itself.
  return { checkoutUrl: url };
}

export async function cancelBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const id = String(formData.get("bookingId"));

  const [row] = await db
    .select({
      booking: bookings,
      slotStart: sql<string>`lower(${bookings.slot})`,
    })
    .from(bookings)
    .where(and(eq(bookings.id, id), eq(bookings.customerId, session.user.id)))
    .limit(1);
  if (!row) {
    return { error: "Booking not found" };
  }
  const { booking, slotStart } = row;

  if (
    !["pending_payment", "pending_approval", "confirmed"].includes(
      booking.status,
    )
  ) {
    return { error: "This booking can no longer be cancelled" };
  }

  // Paid bookings: full refund outside the late-cancel window, otherwise
  // the payment stays with the platform/creator.
  const paid = booking.status === "confirmed" && booking.paymentIntentId;
  const lateCancel =
    new Date(slotStart).getTime() - Date.now() <
    FREE_CANCEL_HOURS * 3600 * 1000;

  if (paid && !lateCancel) {
    await refundBookingPayment(booking.paymentIntentId!);
  }

  await db
    .update(bookings)
    .set({ status: paid && !lateCancel ? "refunded" : "cancelled" })
    .where(eq(bookings.id, id));

  redirect("/bookings");
}

"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/session";

export type BookingActionState = { error?: string };

/**
 * Development-only stand-in for Stripe Checkout. Confirms a booking without
 * payment. Refuses to exist in production or once Stripe is configured.
 */
export async function devConfirmBooking(
  _prev: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  if (process.env.NODE_ENV === "production" || process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "devConfirmBooking must be replaced by Stripe Checkout — refusing to run",
    );
  }

  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const id = String(formData.get("bookingId"));

  const updated = await db
    .update(bookings)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(bookings.id, id),
        eq(bookings.customerId, session.user.id),
        eq(bookings.status, "pending_payment"),
      ),
    )
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { error: "Booking not found or not payable" };
  }
  redirect(`/book/${id}`);
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

  const booking = await db.query.bookings.findFirst({
    where: and(eq(bookings.id, id), eq(bookings.customerId, session.user.id)),
  });
  if (!booking) {
    return { error: "Booking not found" };
  }
  if (
    !["pending_payment", "pending_approval", "confirmed"].includes(
      booking.status,
    )
  ) {
    return { error: "This booking can no longer be cancelled" };
  }
  // TODO(stripe): refund per cancellation policy when payments land.

  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, id));

  redirect("/bookings");
}

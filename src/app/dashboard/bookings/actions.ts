"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/session";

export type ReviewState = { error?: string };

async function reviewBooking(
  bookingId: string,
  decision: "accept" | "decline",
): Promise<ReviewState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }

  // Accepting doesn't confirm — it moves the booking to pending_payment
  // and the fan completes Checkout (24h window before the hold lapses).
  const updated = await db
    .update(bookings)
    .set(
      decision === "accept"
        ? { status: "pending_payment", approvedAt: new Date() }
        : { status: "declined" },
    )
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.creatorId, session.user.id),
        eq(bookings.status, "pending_approval"),
      ),
    )
    .returning({ id: bookings.id });

  if (updated.length === 0) {
    return { error: "Request not found or already handled" };
  }
  redirect("/dashboard/bookings");
}

export async function acceptBooking(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  return reviewBooking(String(formData.get("bookingId")), "accept");
}

export async function declineBooking(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  return reviewBooking(String(formData.get("bookingId")), "decline");
}

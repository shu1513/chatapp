"use server";

import { redirect } from "next/navigation";
import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { bookings, reports } from "@/db/schema";
import { getSession } from "@/lib/session";

export type ReportState = { error?: string; reported?: boolean };

const reasonSchema = z.string().trim().min(10, "Tell us a bit more").max(2000);

/**
 * Either participant of a booking can report the other. Reports queue
 * for admin review; nothing automatic happens to the reported account.
 */
export async function reportCounterparty(
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const bookingId = String(formData.get("bookingId"));
  const parsed = reasonSchema.safeParse(formData.get("reason"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const booking = await db.query.bookings.findFirst({
    where: and(
      eq(bookings.id, bookingId),
      or(
        eq(bookings.customerId, session.user.id),
        eq(bookings.creatorId, session.user.id),
      ),
    ),
  });
  if (!booking) {
    return { error: "Booking not found" };
  }

  const reportedUserId =
    booking.customerId === session.user.id
      ? booking.creatorId
      : booking.customerId;

  await db.insert(reports).values({
    reporterId: session.user.id,
    reportedUserId,
    bookingId,
    reason: parsed.data,
  });

  return { reported: true };
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import {
  expireStaleHolds,
  getAvailableSlots,
  getCreatorByHandle,
} from "@/lib/booking-data";
import { getSession } from "@/lib/session";

const requestSchema = z.object({
  handle: z.string().min(1),
  slotStart: z.string().datetime(),
});

export type BookSlotState = { error?: string };

export async function bookSlot(
  _prev: BookSlotState,
  formData: FormData,
): Promise<BookSlotState> {
  const parsed = requestSchema.safeParse({
    handle: formData.get("handle"),
    slotStart: formData.get("slotStart"),
  });
  if (!parsed.success) {
    return { error: "Invalid request" };
  }
  const { handle, slotStart } = parsed.data;

  const session = await getSession();
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/@${handle}`)}`);
  }

  const creator = await getCreatorByHandle(handle);
  if (!creator) {
    return { error: "Creator not found" };
  }
  if (creator.userId === session.user.id) {
    return { error: "You cannot book yourself" };
  }

  await expireStaleHolds(creator.userId);

  // The requested slot must be one we would offer right now.
  const available = await getAvailableSlots(creator);
  const start = new Date(slotStart);
  const slot = available.find((s) => s.start.getTime() === start.getTime());
  if (!slot) {
    return { error: "That time is no longer available" };
  }

  let bookingId: string;
  try {
    const [row] = await db
      .insert(bookings)
      .values({
        creatorId: creator.userId,
        customerId: session.user.id,
        slot: `[${slot.start.toISOString()},${slot.end.toISOString()})`,
        // Approval-mode creators review requests first; payment happens on
        // accept. Otherwise the fan pays immediately.
        status: creator.approvalMode ? "pending_approval" : "pending_payment",
        priceCents: creator.rateCents,
      })
      .returning({ id: bookings.id });
    bookingId = row.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("bookings_no_overlap")) {
      return { error: "That time was just taken" };
    }
    throw e;
  }

  redirect(`/book/${bookingId}`);
}

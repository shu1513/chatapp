"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators, instantCallRequests } from "@/db/schema";
import { MAX_BLOCK_MIN } from "@/lib/instant";
import { cancelPaymentAuth } from "@/lib/payments";
import { getSession } from "@/lib/session";

async function requireCreatorId(): Promise<string> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }
  return creator.userId;
}

/** Toggle + heartbeat in one: called on toggle and every ~20s while live. */
export async function setLive(live: boolean): Promise<void> {
  const creatorId = await requireCreatorId();
  await db
    .update(creators)
    .set({ instantAvailable: live, lastSeenAt: new Date() })
    .where(eq(creators.userId, creatorId));
}

export type InstantReviewState = { error?: string };

export async function acceptInstant(
  _prev: InstantReviewState,
  formData: FormData,
): Promise<InstantReviewState> {
  const creatorId = await requireCreatorId();
  const requestId = String(formData.get("requestId"));

  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, creatorId),
  });
  if (!creator?.instantRateCentsPerMin) {
    return { error: "Set an instant rate first" };
  }

  const request = await db.query.instantCallRequests.findFirst({
    where: and(
      eq(instantCallRequests.id, requestId),
      eq(instantCallRequests.creatorId, creatorId),
    ),
  });
  if (!request || request.state !== "pending") {
    return { error: "Request is gone" };
  }
  if (request.expiresAt.getTime() <= Date.now()) {
    await db
      .update(instantCallRequests)
      .set({ state: "expired" })
      .where(eq(instantCallRequests.id, requestId));
    if (request.authPaymentIntentId) {
      await cancelPaymentAuth(request.authPaymentIntentId);
    }
    return { error: "Request expired" };
  }

  // Max-block booking: the slot is the hard cap; actual charge will be
  // per-minute on billable time once payments land.
  let bookingId: string;
  try {
    const [row] = await db
      .insert(bookings)
      .values({
        creatorId,
        customerId: request.customerId,
        slot: sql`tstzrange(now(), now() + interval '${sql.raw(String(MAX_BLOCK_MIN))} minutes')`,
        kind: "instant",
        status: "confirmed",
        priceCents: creator.instantRateCentsPerMin * MAX_BLOCK_MIN,
        paymentIntentId: request.authPaymentIntentId,
      })
      .returning({ id: bookings.id });
    bookingId = row.id;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("bookings_no_overlap")) {
      await db
        .update(instantCallRequests)
        .set({ state: "declined" })
        .where(eq(instantCallRequests.id, requestId));
      return {
        error: `You have a booking within ${MAX_BLOCK_MIN} minutes — request declined`,
      };
    }
    throw e;
  }

  await db
    .update(instantCallRequests)
    .set({ state: "accepted", bookingId })
    .where(eq(instantCallRequests.id, requestId));

  redirect(`/call/${bookingId}`);
}

export async function declineInstant(
  _prev: InstantReviewState,
  formData: FormData,
): Promise<InstantReviewState> {
  const creatorId = await requireCreatorId();
  const requestId = String(formData.get("requestId"));
  const [declined] = await db
    .update(instantCallRequests)
    .set({ state: "declined" })
    .where(
      and(
        eq(instantCallRequests.id, requestId),
        eq(instantCallRequests.creatorId, creatorId),
        eq(instantCallRequests.state, "pending"),
      ),
    )
    .returning({
      authPaymentIntentId: instantCallRequests.authPaymentIntentId,
    });
  if (declined?.authPaymentIntentId) {
    await cancelPaymentAuth(declined.authPaymentIntentId);
  }
  return {};
}

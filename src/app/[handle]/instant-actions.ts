"use server";

import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { instantCallRequests } from "@/db/schema";
import { getCreatorByHandle } from "@/lib/booking-data";
import { getLiveState, MAX_BLOCK_MIN, REQUEST_TTL_SEC } from "@/lib/instant";
import { cancelPaymentAuth, createInstantAuthCheckout } from "@/lib/payments";
import { getSession } from "@/lib/session";

export type InstantRequestState = { error?: string; checkoutUrl?: string };

export async function requestInstantCall(
  _prev: InstantRequestState,
  formData: FormData,
): Promise<InstantRequestState> {
  const handle = String(formData.get("handle"));

  const session = await getSession();
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/@${handle}`)}`);
  }

  const creator = await getCreatorByHandle(handle);
  if (!creator) {
    return { error: "Creator not found" };
  }
  if (creator.userId === session.user.id) {
    return { error: "You cannot call yourself" };
  }

  const { live, rateCentsPerMin } = await getLiveState(creator.userId);
  if (!live || rateCentsPerMin === null) {
    return { error: "Creator just went offline" };
  }

  // One live request per fan+creator at a time.
  const existing = await db.query.instantCallRequests.findFirst({
    where: and(
      eq(instantCallRequests.creatorId, creator.userId),
      eq(instantCallRequests.customerId, session.user.id),
      eq(instantCallRequests.state, "pending"),
    ),
  });
  if (existing && existing.expiresAt.getTime() > Date.now()) {
    redirect(`/instant/${existing.id}`);
  }

  // The ring starts only after the fan authorizes the max-block hold
  // (see the Stripe webhook). Generous expiry covers checkout time.
  const [request] = await db
    .insert(instantCallRequests)
    .values({
      creatorId: creator.userId,
      customerId: session.user.id,
      state: "awaiting_auth",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    })
    .returning({ id: instantCallRequests.id });

  const url = await createInstantAuthCheckout({
    requestId: request.id,
    maxAmountCents: rateCentsPerMin * MAX_BLOCK_MIN,
    ratePerMinCents: rateCentsPerMin,
    creatorName: creator.displayName,
    customerEmail: session.user.email,
  });
  return { checkoutUrl: url };
}

export async function cancelInstantRequest(
  _prev: InstantRequestState,
  formData: FormData,
): Promise<InstantRequestState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const id = String(formData.get("requestId"));
  const [cancelled] = await db
    .update(instantCallRequests)
    .set({ state: "cancelled" })
    .where(
      and(
        eq(instantCallRequests.id, id),
        eq(instantCallRequests.customerId, session.user.id),
        sql`${instantCallRequests.state} IN ('pending', 'awaiting_auth')`,
      ),
    )
    .returning({ authPaymentIntentId: instantCallRequests.authPaymentIntentId });
  if (cancelled?.authPaymentIntentId) {
    await cancelPaymentAuth(cancelled.authPaymentIntentId);
  }
  redirect("/bookings");
}

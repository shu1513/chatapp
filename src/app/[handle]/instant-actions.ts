"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { instantCallRequests } from "@/db/schema";
import { getCreatorByHandle } from "@/lib/booking-data";
import { getLiveState, REQUEST_TTL_SEC } from "@/lib/instant";
import { getSession } from "@/lib/session";

export type InstantRequestState = { error?: string };

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

  const { live } = await getLiveState(creator.userId);
  if (!live) {
    return { error: "Creator just went offline" };
  }

  // One pending request per fan+creator at a time.
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

  // TODO(stripe): authorize max-block hold before ringing the creator.
  const [request] = await db
    .insert(instantCallRequests)
    .values({
      creatorId: creator.userId,
      customerId: session.user.id,
      expiresAt: new Date(Date.now() + REQUEST_TTL_SEC * 1000),
    })
    .returning({ id: instantCallRequests.id });

  redirect(`/instant/${request.id}`);
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
  await db
    .update(instantCallRequests)
    .set({ state: "cancelled" })
    .where(
      and(
        eq(instantCallRequests.id, id),
        eq(instantCallRequests.customerId, session.user.id),
        eq(instantCallRequests.state, "pending"),
      ),
    );
  redirect("/bookings");
}

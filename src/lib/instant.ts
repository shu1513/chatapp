import "server-only";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators } from "@/db/schema";

/** Instant calls run up to this long; the slot (and hard cap) is this size. */
export const MAX_BLOCK_MIN = 30;
/** How long a ring waits for the creator before expiring. */
export const REQUEST_TTL_SEC = 60;
/** Heartbeat staleness: live requires a heartbeat within this window. */
export const HEARTBEAT_STALE_SEC = 60;

export type LiveCreator = {
  userId: string;
  instantRateCentsPerMin: number;
};

/**
 * A creator is live when: toggle on, fresh heartbeat, instant rate set,
 * and no live booking overlapping right now (in a call or about to be).
 */
export async function getLiveState(creatorUserId: string): Promise<{
  live: boolean;
  rateCentsPerMin: number | null;
}> {
  const [row] = await db
    .select({
      instantAvailable: creators.instantAvailable,
      lastSeenAt: creators.lastSeenAt,
      rate: creators.instantRateCentsPerMin,
    })
    .from(creators)
    .where(eq(creators.userId, creatorUserId))
    .limit(1);
  if (!row) return { live: false, rateCentsPerMin: null };

  const fresh =
    row.lastSeenAt !== null &&
    Date.now() - row.lastSeenAt.getTime() < HEARTBEAT_STALE_SEC * 1000;
  if (!row.instantAvailable || !fresh || row.rate === null) {
    return { live: false, rateCentsPerMin: row.rate };
  }

  const busyNow = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.creatorId, creatorUserId),
        notInArray(bookings.status, ["declined", "cancelled", "refunded"]),
        sql`${bookings.slot} && tstzrange(now(), now() + interval '1 minute')`,
      ),
    )
    .limit(1);

  return { live: busyNow.length === 0, rateCentsPerMin: row.rate };
}

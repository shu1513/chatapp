import "server-only";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, bookings, creators } from "@/db/schema";
import { generateSlots, type Interval } from "@/lib/slots";

export const BOOKING_HORIZON_DAYS = 14;
export const MIN_NOTICE_MIN = 60;
/** How long a pending_payment booking holds its slot before going stale. */
export const HOLD_TTL_MIN = 15;

const staleHold = sql`(${bookings.status} = 'pending_payment' AND ${bookings.createdAt} < now() - interval '15 minutes')`;

/**
 * Intervals that block new bookings for a creator: every live booking,
 * except stale payment holds.
 */
export async function getBusyIntervals(creatorId: string): Promise<Interval[]> {
  const rows = await db
    .select({
      start: sql<string>`lower(${bookings.slot})`,
      end: sql<string>`upper(${bookings.slot})`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.creatorId, creatorId),
        notInArray(bookings.status, ["declined", "cancelled", "refunded"]),
        sql`upper(${bookings.slot}) > now()`,
        sql`NOT ${staleHold}`,
      ),
    );
  return rows.map((r) => ({ start: new Date(r.start), end: new Date(r.end) }));
}

/**
 * Cancel stale payment holds so their slots reopen and the exclusion
 * constraint stops counting them. Called before inserting a new booking.
 */
export async function expireStaleHolds(creatorId: string): Promise<void> {
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.creatorId, creatorId), staleHold));
}

export async function getAvailableSlots(creator: {
  userId: string;
  timezone: string;
  callLengthMin: number;
}): Promise<Interval[]> {
  const [rules, busy] = await Promise.all([
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.creatorId, creator.userId),
    }),
    getBusyIntervals(creator.userId),
  ]);
  return generateSlots({
    rules,
    timezone: creator.timezone,
    callLengthMin: creator.callLengthMin,
    now: new Date(),
    horizonDays: BOOKING_HORIZON_DAYS,
    minNoticeMin: MIN_NOTICE_MIN,
    busy,
  });
}

export async function getCreatorByHandle(handle: string) {
  return db.query.creators.findFirst({ where: eq(creators.handle, handle) });
}

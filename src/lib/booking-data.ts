import "server-only";

import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  availabilityExceptions,
  availabilityRules,
  bookings,
  creators,
} from "@/db/schema";
import { generateSlots, type Interval } from "@/lib/slots";

/** How long a pending_payment booking holds its slot before going stale. */
export const HOLD_TTL_MIN = 15;

/**
 * Unpaid holds go stale: 15 minutes for a fresh checkout, 24 hours when
 * the creator approved and the fan hasn't paid yet, 24 hours for an
 * unanswered approval request.
 */
const staleHold = sql`(
  (${bookings.status} = 'pending_payment' AND ${bookings.approvedAt} IS NULL AND ${bookings.createdAt} < now() - interval '15 minutes')
  OR
  (${bookings.status} = 'pending_payment' AND ${bookings.approvedAt} IS NOT NULL AND ${bookings.approvedAt} < now() - interval '24 hours')
  OR
  (${bookings.status} = 'pending_approval' AND ${bookings.createdAt} < now() - interval '24 hours')
)`;

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
  bufferMin: number;
  minNoticeMin: number;
  horizonDays: number;
}): Promise<Interval[]> {
  const [rules, busy, exceptions] = await Promise.all([
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.creatorId, creator.userId),
    }),
    getBusyIntervals(creator.userId),
    db.query.availabilityExceptions.findMany({
      where: eq(availabilityExceptions.creatorId, creator.userId),
    }),
  ]);
  return generateSlots({
    rules,
    timezone: creator.timezone,
    callLengthMin: creator.callLengthMin,
    bufferMin: creator.bufferMin,
    now: new Date(),
    horizonDays: creator.horizonDays,
    minNoticeMin: creator.minNoticeMin,
    busy,
    blackoutDates: new Set(exceptions.map((e) => e.date)),
  });
}

export async function getCreatorByHandle(handle: string) {
  return db.query.creators.findFirst({ where: eq(creators.handle, handle) });
}

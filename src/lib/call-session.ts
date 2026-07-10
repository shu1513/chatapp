import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, callSessions, sessionEvents } from "@/db/schema";
import { bothPresentSeconds, type PresenceEvent } from "@/lib/overlap";
import { refundBookingPayment } from "@/lib/payments";
import { endRoom, roomNameForBooking } from "@/lib/video";

export const GRACE_SECONDS = 60;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * All session mutations run inside a transaction holding a per-booking
 * advisory lock, so concurrent webhook deliveries serialize.
 */
async function withBookingLock<T>(
  bookingId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${bookingId}, 0))`,
    );
    return fn(tx);
  });
}

async function getOrCreateSession(tx: Tx, bookingId: string) {
  const existing = await tx.query.callSessions.findFirst({
    where: eq(callSessions.bookingId, bookingId),
  });
  if (existing) return existing;
  const [created] = await tx
    .insert(callSessions)
    .values({ bookingId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  // Lost a race outside the lock (shouldn't happen, but be safe).
  const row = await tx.query.callSessions.findFirst({
    where: eq(callSessions.bookingId, bookingId),
  });
  if (!row) throw new Error(`No call session for booking ${bookingId}`);
  return row;
}

async function loadPresenceEvents(
  tx: Tx,
  sessionId: string,
): Promise<PresenceEvent[]> {
  const rows = await tx.query.sessionEvents.findMany({
    where: eq(sessionEvents.sessionId, sessionId),
  });
  return rows
    .filter(
      (r) => r.type === "participant_joined" || r.type === "participant_left",
    )
    .map((r) => ({
      type: r.type as PresenceEvent["type"],
      identity: r.identity ?? "",
      at: r.at,
    }));
}

function currentlyPresent(events: PresenceEvent[]): Set<string> {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  const present = new Set<string>();
  for (const e of sorted) {
    if (e.type === "participant_joined") present.add(e.identity);
    else present.delete(e.identity);
  }
  return present;
}

async function getBooking(tx: Tx, bookingId: string) {
  const row = await tx
    .select({
      id: bookings.id,
      creatorId: bookings.creatorId,
      customerId: bookings.customerId,
      status: bookings.status,
      paymentIntentId: bookings.paymentIntentId,
      slotEnd: sql<string>`upper(${bookings.slot})`,
    })
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  return row[0] ?? null;
}

export async function onParticipantJoined(
  bookingId: string,
  identity: string,
  at: Date,
  source = "webhook",
): Promise<void> {
  await withBookingLock(bookingId, async (tx) => {
    const booking = await getBooking(tx, bookingId);
    if (!booking) return;
    const session = await getOrCreateSession(tx, bookingId);
    if (session.state === "ended") return;

    await tx.insert(sessionEvents).values({
      sessionId: session.id,
      type: "participant_joined",
      identity,
      at,
      source,
    });

    const events = await loadPresenceEvents(tx, session.id);
    const present = currentlyPresent(events);
    const bothHere =
      present.has(booking.customerId) && present.has(booking.creatorId);

    if (bothHere && (session.state === "scheduled" || session.state === "grace")) {
      await tx
        .update(callSessions)
        .set({
          state: "active",
          startedAt: session.startedAt ?? at,
          graceExpiresAt: null,
        })
        .where(eq(callSessions.id, session.id));
    }
  });
}

export async function onParticipantLeft(
  bookingId: string,
  identity: string,
  at: Date,
  source = "webhook",
): Promise<void> {
  await withBookingLock(bookingId, async (tx) => {
    const booking = await getBooking(tx, bookingId);
    if (!booking) return;
    const session = await getOrCreateSession(tx, bookingId);
    if (session.state === "ended") return;

    await tx.insert(sessionEvents).values({
      sessionId: session.id,
      type: "participant_left",
      identity,
      at,
      source,
    });

    const events = await loadPresenceEvents(tx, session.id);
    const present = currentlyPresent(events);
    const bothHere =
      present.has(booking.customerId) && present.has(booking.creatorId);

    if (session.state === "active" && !bothHere) {
      await tx
        .update(callSessions)
        .set({
          state: "grace",
          graceExpiresAt: new Date(at.getTime() + GRACE_SECONDS * 1000),
        })
        .where(eq(callSessions.id, session.id));
    }
  });
}

/**
 * Settle a session: compute billable seconds from the event log and
 * finalize the booking. Called on room_finished and by the sweeper.
 *
 * If nobody has talked yet and the slot isn't over, the session returns
 * to `scheduled` so participants can still join (e.g. the room emptied
 * out and LiveKit closed it early).
 */
export async function settleSession(
  bookingId: string,
  at: Date,
  source = "webhook",
): Promise<void> {
  // Stripe calls must not run inside the transaction; collect and act after.
  let refundPaymentIntentId: string | null = null;

  await withBookingLock(bookingId, async (tx) => {
    const booking = await getBooking(tx, bookingId);
    if (!booking) return;
    const session = await getOrCreateSession(tx, bookingId);
    if (session.state === "ended") return;

    await tx.insert(sessionEvents).values({
      sessionId: session.id,
      type: "room_finished",
      at,
      source,
    });

    const events = await loadPresenceEvents(tx, session.id);
    const billable = bothPresentSeconds(
      events,
      booking.customerId,
      booking.creatorId,
      at,
    );
    const slotOver = new Date(booking.slotEnd).getTime() <= at.getTime();

    if (billable > 0) {
      await tx
        .update(callSessions)
        .set({
          state: "ended",
          billableSeconds: billable,
          endedAt: at,
          graceExpiresAt: null,
        })
        .where(eq(callSessions.id, session.id));
      if (booking.status === "confirmed") {
        await tx
          .update(bookings)
          .set({ status: "completed" })
          .where(and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed")));
      }
      return;
    }

    if (!slotOver) {
      // Nobody connected together yet and there's still time — allow retry.
      await tx
        .update(callSessions)
        .set({ state: "scheduled", graceExpiresAt: null })
        .where(eq(callSessions.id, session.id));
      return;
    }

    // Slot over, no call happened: classify the no-show. Fan-protective
    // default — if the creator never showed up, the fan gets refunded,
    // even if the fan didn't show either.
    const everPresent = new Set(events.map((e) => e.identity));
    const creatorShowed = everPresent.has(booking.creatorId);
    const finalStatus = creatorShowed ? "no_show_customer" : "no_show_creator";
    if (finalStatus === "no_show_creator" && booking.paymentIntentId) {
      refundPaymentIntentId = booking.paymentIntentId;
    }

    await tx
      .update(callSessions)
      .set({
        state: "ended",
        billableSeconds: 0,
        endedAt: at,
        graceExpiresAt: null,
      })
      .where(eq(callSessions.id, session.id));
    if (booking.status === "confirmed") {
      await tx
        .update(bookings)
        .set({ status: finalStatus })
        .where(and(eq(bookings.id, bookingId), eq(bookings.status, "confirmed")));
    }
  });

  if (refundPaymentIntentId) {
    try {
      await refundBookingPayment(refundPaymentIntentId);
    } catch (e) {
      // Money-critical: never swallow silently. The booking stays
      // no_show_creator; this log line is the retry queue for now.
      console.error(
        `[settle] REFUND FAILED for booking ${bookingId}, payment ${refundPaymentIntentId}`,
        e,
      );
    }
  }
}

/**
 * Periodic enforcement: end rooms whose paid time is up, expire dead
 * grace periods, and finalize confirmed bookings whose slot passed with
 * no call. Webhooks then settle whatever the room deletion triggers,
 * but we also settle directly in case the webhook never arrives.
 */
export async function sweep(now = new Date()): Promise<void> {
  // 1. Grace expired, or active session past its slot end -> end the room.
  const liveSessions = await db
    .select({
      bookingId: callSessions.bookingId,
      state: callSessions.state,
      graceExpiresAt: callSessions.graceExpiresAt,
      slotEnd: sql<string>`upper(${bookings.slot})`,
    })
    .from(callSessions)
    .innerJoin(bookings, eq(bookings.id, callSessions.bookingId))
    .where(sql`${callSessions.state} IN ('active', 'grace')`);

  for (const s of liveSessions) {
    const slotOver = new Date(s.slotEnd).getTime() <= now.getTime();
    const graceDead =
      s.state === "grace" &&
      s.graceExpiresAt !== null &&
      s.graceExpiresAt.getTime() <= now.getTime();
    if (slotOver || graceDead) {
      await endRoom(roomNameForBooking(s.bookingId));
      await settleSession(s.bookingId, now, "sweeper");
    }
  }

  // 2. Confirmed bookings whose slot fully passed without a settled session.
  const missed = await db
    .select({ id: bookings.id })
    .from(bookings)
    .leftJoin(callSessions, eq(callSessions.bookingId, bookings.id))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        sql`upper(${bookings.slot}) <= ${now.toISOString()}::timestamptz`,
        sql`(${callSessions.state} IS NULL OR ${callSessions.state} IN ('scheduled'))`,
      ),
    );

  for (const b of missed) {
    await endRoom(roomNameForBooking(b.id));
    await settleSession(b.id, now, "sweeper");
  }
}

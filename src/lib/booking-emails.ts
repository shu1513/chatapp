import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators, users } from "@/db/schema";
import { sendEmailSafe } from "@/lib/email";

const baseUrl = () => process.env.BETTER_AUTH_URL ?? "http://localhost:3000";

const fmtTime = (iso: string, tz?: string) =>
  new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz,
    timeZoneName: "short",
  });

type BookingContext = {
  bookingId: string;
  customerEmail: string;
  creatorEmail: string;
  creatorName: string;
  creatorHandle: string;
  creatorTimezone: string;
  slotStart: string;
  priceCents: number;
};

async function loadContext(bookingId: string): Promise<BookingContext | null> {
  const [row] = await db
    .select({
      customerEmail: users.email,
      creatorEmail: sql<string>`(SELECT email FROM users WHERE id = ${bookings.creatorId})`,
      creatorName: creators.displayName,
      creatorHandle: creators.handle,
      creatorTimezone: creators.timezone,
      slotStart: sql<string>`lower(${bookings.slot})`,
      priceCents: bookings.priceCents,
    })
    .from(bookings)
    .innerJoin(users, eq(users.id, bookings.customerId))
    .innerJoin(creators, eq(creators.userId, bookings.creatorId))
    .where(eq(bookings.id, bookingId))
    .limit(1);
  if (!row) return null;
  return { bookingId, ...row };
}

/** Fan requested a slot from an approval-mode creator. */
export async function emailBookingRequested(bookingId: string): Promise<void> {
  const c = await loadContext(bookingId);
  if (!c) return;
  sendEmailSafe({
    to: c.creatorEmail,
    subject: `New booking request — ${fmtTime(c.slotStart, c.creatorTimezone)}`,
    text: `${c.customerEmail} wants a call at ${fmtTime(c.slotStart, c.creatorTimezone)} ($${(c.priceCents / 100).toFixed(2)}).\n\nReview it: ${baseUrl()}/dashboard/bookings`,
  });
  sendEmailSafe({
    to: c.customerEmail,
    subject: `Request sent to ${c.creatorName}`,
    text: `Your request for ${fmtTime(c.slotStart)} is waiting for ${c.creatorName} to approve. We'll email you when they respond.\n\n${baseUrl()}/book/${c.bookingId}`,
  });
}

/** Creator approved; fan needs to pay. */
export async function emailBookingApproved(bookingId: string): Promise<void> {
  const c = await loadContext(bookingId);
  if (!c) return;
  sendEmailSafe({
    to: c.customerEmail,
    subject: `${c.creatorName} accepted — complete your booking`,
    text: `${c.creatorName} accepted your call for ${fmtTime(c.slotStart)}. Finish payment to lock it in (the slot is held for 24 hours):\n\n${baseUrl()}/book/${c.bookingId}`,
  });
}

/** Creator declined the request. */
export async function emailBookingDeclined(bookingId: string): Promise<void> {
  const c = await loadContext(bookingId);
  if (!c) return;
  sendEmailSafe({
    to: c.customerEmail,
    subject: `${c.creatorName} can't make that time`,
    text: `Your request for ${fmtTime(c.slotStart)} was declined. You haven't been charged.\n\nPick another time: ${baseUrl()}/@${c.creatorHandle}`,
  });
}

/** Payment landed; the call is on. */
export async function emailBookingConfirmed(bookingId: string): Promise<void> {
  const c = await loadContext(bookingId);
  if (!c) return;
  const joinUrl = `${baseUrl()}/call/${c.bookingId}`;
  const icsUrl = `${baseUrl()}/book/${c.bookingId}/ics`;
  sendEmailSafe({
    to: c.customerEmail,
    subject: `Confirmed: call with ${c.creatorName} — ${fmtTime(c.slotStart)}`,
    text: `You're booked with ${c.creatorName} at ${fmtTime(c.slotStart)}.\n\nJoin (opens 10 min early): ${joinUrl}\nAdd to calendar: ${icsUrl}`,
  });
  sendEmailSafe({
    to: c.creatorEmail,
    subject: `Booked: ${fmtTime(c.slotStart, c.creatorTimezone)} with ${c.customerEmail}`,
    text: `New confirmed call at ${fmtTime(c.slotStart, c.creatorTimezone)} ($${(c.priceCents / 100).toFixed(2)}).\n\nJoin: ${joinUrl}\nCalendar file: ${icsUrl}`,
  });
}

/**
 * T-60min reminders for confirmed bookings, exactly once per booking.
 * Called on an interval from instrumentation.
 */
export async function sendDueReminders(now = new Date()): Promise<void> {
  const due = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      sql`${bookings.status} = 'confirmed'
        AND ${bookings.reminderSentAt} IS NULL
        AND lower(${bookings.slot}) > ${now.toISOString()}::timestamptz
        AND lower(${bookings.slot}) <= ${now.toISOString()}::timestamptz + interval '60 minutes'`,
    );

  for (const b of due) {
    // Claim before sending so a crash can't double-remind.
    const claimed = await db
      .update(bookings)
      .set({ reminderSentAt: now })
      .where(
        sql`${bookings.id} = ${b.id} AND ${bookings.reminderSentAt} IS NULL`,
      )
      .returning({ id: bookings.id });
    if (claimed.length === 0) continue;

    const c = await loadContext(b.id);
    if (!c) continue;
    const joinUrl = `${baseUrl()}/call/${b.id}`;
    sendEmailSafe({
      to: c.customerEmail,
      subject: `Starting soon: call with ${c.creatorName}`,
      text: `Your call with ${c.creatorName} starts at ${fmtTime(c.slotStart)} — within the hour.\n\nJoin: ${joinUrl}`,
    });
    sendEmailSafe({
      to: c.creatorEmail,
      subject: `Starting soon: call at ${fmtTime(c.slotStart, c.creatorTimezone)}`,
      text: `Your call with ${c.customerEmail} starts at ${fmtTime(c.slotStart, c.creatorTimezone)} — within the hour.\n\nJoin: ${joinUrl}`,
    });
  }
}

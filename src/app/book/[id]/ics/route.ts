import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators } from "@/db/schema";
import { getSession } from "@/lib/session";

const icsDate = (d: Date) =>
  d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    return new Response("unauthorized", { status: 401 });
  }

  const [row] = await db
    .select({
      slotStart: sql<string>`lower(${bookings.slot})`,
      slotEnd: sql<string>`upper(${bookings.slot})`,
      creatorName: creators.displayName,
    })
    .from(bookings)
    .innerJoin(creators, eq(creators.userId, bookings.creatorId))
    .where(
      and(
        eq(bookings.id, id),
        or(
          eq(bookings.customerId, session.user.id),
          eq(bookings.creatorId, session.user.id),
        ),
      ),
    )
    .limit(1);
  if (!row) {
    return new Response("not found", { status: 404 });
  }

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//chatapp//booking//EN",
    "BEGIN:VEVENT",
    `UID:booking-${id}@chatapp`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(new Date(row.slotStart))}`,
    `DTEND:${icsDate(new Date(row.slotEnd))}`,
    `SUMMARY:Video call with ${row.creatorName}`,
    `DESCRIPTION:Join link: ${base}/call/${id}`,
    `URL:${base}/call/${id}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="call-${id}.ics"`,
    },
  });
}

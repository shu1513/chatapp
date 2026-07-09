import { notFound } from "next/navigation";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, bookings, creators } from "@/db/schema";
import { generateSlots } from "@/lib/slots";
import { SlotList } from "./slot-list";

const BOOKING_HORIZON_DAYS = 14;
const MIN_NOTICE_MIN = 60;

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) {
    notFound();
  }
  const handle = decoded.slice(1);

  const creator = await db.query.creators.findFirst({
    where: eq(creators.handle, handle),
  });
  if (!creator) {
    notFound();
  }

  const [rules, busyRows] = await Promise.all([
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.creatorId, creator.userId),
    }),
    db
      .select({
        start: sql<string>`lower(${bookings.slot})`,
        end: sql<string>`upper(${bookings.slot})`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.creatorId, creator.userId),
          notInArray(bookings.status, ["declined", "cancelled", "refunded"]),
          sql`upper(${bookings.slot}) > now()`,
        ),
      ),
  ]);

  const slots = generateSlots({
    rules,
    timezone: creator.timezone,
    callLengthMin: creator.callLengthMin,
    now: new Date(),
    horizonDays: BOOKING_HORIZON_DAYS,
    minNoticeMin: MIN_NOTICE_MIN,
    busy: busyRows.map((b) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    })),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 pt-12">
        <h1 className="text-3xl font-semibold">{creator.displayName}</h1>
        <p className="text-gray-500">@{creator.handle}</p>
      </header>
      {creator.bio && <p className="whitespace-pre-wrap">{creator.bio}</p>}
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-lg font-medium">
          ${(creator.rateCents / 100).toFixed(0)} ·{" "}
          {creator.callLengthMin}-minute video call
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Available times</h2>
        <SlotList slotStarts={slots.map((s) => s.start.toISOString())} />
      </section>
    </main>
  );
}

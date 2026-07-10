import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  availabilityExceptions,
  availabilityRules,
  creators,
} from "@/db/schema";
import { getSession } from "@/lib/session";
import { AvailabilityForm, BlackoutForm, BookingRulesForm } from "./form";

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/dashboard/availability");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  const [rules, blackouts] = await Promise.all([
    db.query.availabilityRules.findMany({
      where: eq(availabilityRules.creatorId, creator.userId),
    }),
    db.query.availabilityExceptions.findMany({
      where: eq(availabilityExceptions.creatorId, creator.userId),
      orderBy: [asc(availabilityExceptions.date)],
    }),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 p-6 pt-12">
      <header>
        <h1 className="text-2xl font-semibold">Weekly availability</h1>
        <p className="mt-1 text-sm text-gray-500">
          Times are in your timezone: {creator.timezone}
        </p>
      </header>
      <AvailabilityForm
        initial={rules.map((r) => ({
          weekday: r.weekday,
          startMinute: r.startMinute,
          endMinute: r.endMinute,
        }))}
      />
      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">Booking rules</h2>
        <BookingRulesForm
          initial={{
            bufferMin: creator.bufferMin,
            minNoticeMin: creator.minNoticeMin,
            horizonDays: creator.horizonDays,
            instantRateCentsPerMin: creator.instantRateCentsPerMin,
          }}
        />
      </section>
      <section className="flex flex-col gap-3 border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold">Days off</h2>
        <BlackoutForm
          blackouts={blackouts.map((b) => ({ id: b.id, date: b.date }))}
        />
      </section>
    </main>
  );
}

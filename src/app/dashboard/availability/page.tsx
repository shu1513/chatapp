import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, creators } from "@/db/schema";
import { getSession } from "@/lib/session";
import { AvailabilityForm } from "./form";

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  const rules = await db.query.availabilityRules.findMany({
    where: eq(availabilityRules.creatorId, creator.userId),
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6 pt-12">
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
    </main>
  );
}

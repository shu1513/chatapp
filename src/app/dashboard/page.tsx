import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { getSession } from "@/lib/session";
import { LivePanel } from "./live-panel";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/dashboard");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 p-6 pt-12">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Creator dashboard</h1>
        <p className="text-sm text-gray-500">
          {creator.displayName} ·{" "}
          <Link href={`/@${creator.handle}`} className="underline">
            @{creator.handle}
          </Link>
        </p>
      </header>

      <LivePanel
        initiallyLive={creator.instantAvailable}
        hasInstantRate={creator.instantRateCentsPerMin !== null}
      />

      <nav className="flex flex-col gap-2">
        <Link
          href="/dashboard/bookings"
          className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
        >
          Incoming bookings
        </Link>
        <Link
          href="/dashboard/availability"
          className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
        >
          Availability &amp; booking rules
        </Link>
        <Link
          href="/dashboard/profile"
          className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
        >
          Profile
        </Link>
        <Link
          href="/dashboard/payouts"
          className="rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
        >
          Payouts
        </Link>
      </nav>
    </main>
  );
}

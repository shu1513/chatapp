import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators } from "@/db/schema";
import { getSession } from "@/lib/session";
import { LocalTime } from "@/components/local-time";

export default async function MyBookingsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/bookings");
  }

  const rows = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      priceCents: bookings.priceCents,
      slotStart: sql<string>`lower(${bookings.slot})`,
      creatorName: creators.displayName,
      creatorHandle: creators.handle,
    })
    .from(bookings)
    .innerJoin(creators, eq(creators.userId, bookings.creatorId))
    .where(eq(bookings.customerId, session.user.id))
    .orderBy(desc(sql`lower(${bookings.slot})`));

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6 pt-12">
      <h1 className="text-2xl font-semibold">Your bookings</h1>
      {rows.length === 0 ? (
        <p className="text-gray-500">No bookings yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((b) => (
            <li key={b.id}>
              <Link
                href={`/book/${b.id}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div>
                  <p className="font-medium">
                    <LocalTime iso={new Date(b.slotStart).toISOString()} />
                  </p>
                  <p className="text-sm text-gray-600">
                    {b.creatorName} · @{b.creatorHandle}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm">${(b.priceCents / 100).toFixed(0)}</p>
                  <p className="text-sm text-gray-500">{b.status}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creators, payouts } from "@/db/schema";
import { getConnectStatus, PLATFORM_FEE_PCT } from "@/lib/payments";
import { getSession } from "@/lib/session";
import { OnboardButton } from "./onboard-button";

export default async function PayoutsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/dashboard/payouts");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  const status = creator.stripeAccountId
    ? await getConnectStatus(creator.stripeAccountId)
    : null;

  const rows = await db
    .select({
      id: payouts.id,
      amountCents: payouts.amountCents,
      createdAt: payouts.createdAt,
    })
    .from(payouts)
    .where(eq(payouts.creatorId, creator.userId))
    .orderBy(desc(payouts.createdAt))
    .limit(50);

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${payouts.amountCents}), 0)` })
    .from(payouts)
    .where(eq(payouts.creatorId, creator.userId));

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-8 p-6 pt-12">
      <header>
        <h1 className="text-2xl font-semibold">Payouts</h1>
        <p className="mt-1 text-sm text-gray-500">
          You keep {100 - PLATFORM_FEE_PCT}% of every call, paid out to your
          bank via Stripe.
        </p>
      </header>

      {!status && <OnboardButton resume={false} />}
      {status && !status.payoutsEnabled && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-amber-700">
            Payout setup isn&apos;t finished yet.
          </p>
          <OnboardButton resume />
        </div>
      )}
      {status?.payoutsEnabled && (
        <p className="text-sm text-green-700">
          ✓ Payouts active — earnings transfer automatically after each call.
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">
          Earnings: ${(Number(total) / 100).toFixed(2)}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No payouts yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((p) => (
              <li
                key={p.id}
                className="flex justify-between rounded border border-gray-200 p-3 text-sm"
              >
                <span>{p.createdAt.toISOString().slice(0, 10)}</span>
                <span>${(p.amountCents / 100).toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

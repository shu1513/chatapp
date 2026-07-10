import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { instantCallRequests, users } from "@/db/schema";
import { getSession } from "@/lib/session";

/** Creator polls for pending rings while on the dashboard. */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const rows = await db
    .select({
      id: instantCallRequests.id,
      expiresAt: instantCallRequests.expiresAt,
      customerEmail: users.email,
    })
    .from(instantCallRequests)
    .innerJoin(users, eq(users.id, instantCallRequests.customerId))
    .where(
      and(
        eq(instantCallRequests.creatorId, session.user.id),
        eq(instantCallRequests.state, "pending"),
        gt(instantCallRequests.expiresAt, new Date()),
      ),
    );

  return NextResponse.json({
    requests: rows.map((r) => ({
      id: r.id,
      customerEmail: r.customerEmail,
      expiresAt: r.expiresAt.toISOString(),
    })),
  });
}

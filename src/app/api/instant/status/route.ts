import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { instantCallRequests } from "@/db/schema";
import { cancelPaymentAuth } from "@/lib/payments";
import { getSession } from "@/lib/session";

/** Fan polls their instant request. Lazily expires overdue rings. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user) {
    return new NextResponse("unauthorized", { status: 401 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return new NextResponse("missing id", { status: 400 });
  }

  const request = await db.query.instantCallRequests.findFirst({
    where: and(
      eq(instantCallRequests.id, id),
      eq(instantCallRequests.customerId, session.user.id),
    ),
  });
  if (!request) {
    return new NextResponse("not found", { status: 404 });
  }

  if (
    (request.state === "pending" || request.state === "awaiting_auth") &&
    request.expiresAt.getTime() <= Date.now()
  ) {
    const [expired] = await db
      .update(instantCallRequests)
      .set({ state: "expired" })
      .where(
        and(
          eq(instantCallRequests.id, id),
          eq(instantCallRequests.state, request.state),
        ),
      )
      .returning({
        authPaymentIntentId: instantCallRequests.authPaymentIntentId,
      });
    if (expired?.authPaymentIntentId) {
      await cancelPaymentAuth(expired.authPaymentIntentId);
    }
    return NextResponse.json({ state: "expired", bookingId: null });
  }

  return NextResponse.json({
    state: request.state,
    bookingId: request.bookingId,
    expiresAt: request.expiresAt.toISOString(),
  });
}

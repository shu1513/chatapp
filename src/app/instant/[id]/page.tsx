import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, instantCallRequests } from "@/db/schema";
import { getSession } from "@/lib/session";
import { WaitingRoom } from "./waiting-room";

export default async function InstantRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }

  const [row] = await db
    .select({
      request: instantCallRequests,
      creatorName: creators.displayName,
      creatorHandle: creators.handle,
      ratePerMin: creators.instantRateCentsPerMin,
    })
    .from(instantCallRequests)
    .innerJoin(creators, eq(creators.userId, instantCallRequests.creatorId))
    .where(
      and(
        eq(instantCallRequests.id, id),
        eq(instantCallRequests.customerId, session.user.id),
      ),
    )
    .limit(1);
  if (!row) {
    notFound();
  }

  if (row.request.state === "accepted" && row.request.bookingId) {
    redirect(`/call/${row.request.bookingId}`);
  }

  return (
    <WaitingRoom
      requestId={row.request.id}
      creatorName={row.creatorName}
      creatorHandle={row.creatorHandle}
      ratePerMin={row.ratePerMin ?? 0}
      initialState={row.request.state}
      expiresAtIso={row.request.expiresAt.toISOString()}
    />
  );
}

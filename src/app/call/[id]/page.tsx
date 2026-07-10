import { notFound, redirect } from "next/navigation";
import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { getSession } from "@/lib/session";
import { ensureRoom, joinToken, roomNameForBooking } from "@/lib/video";
import { CallRoom } from "./call-room";

/** Lobby opens this many minutes before the slot. */
const LOBBY_OPEN_MIN = 10;

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    redirect(`/signin?next=${encodeURIComponent(`/call/${id}`)}`);
  }
  const userId = session.user.id;

  const [row] = await db
    .select({
      booking: bookings,
      slotStart: sql<string>`lower(${bookings.slot})`,
      slotEnd: sql<string>`upper(${bookings.slot})`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.id, id),
        or(eq(bookings.customerId, userId), eq(bookings.creatorId, userId)),
      ),
    )
    .limit(1);
  if (!row) {
    notFound();
  }

  const { booking, slotStart, slotEnd } = row;
  const start = new Date(slotStart);
  const end = new Date(slotEnd);
  const now = new Date();

  if (booking.status !== "confirmed") {
    return (
      <Message
        title="This call isn't joinable"
        body={`Booking status: ${booking.status}.`}
      />
    );
  }
  if (now.getTime() < start.getTime() - LOBBY_OPEN_MIN * 60_000) {
    return (
      <Message
        title="Too early"
        body={`The room opens ${LOBBY_OPEN_MIN} minutes before your call.`}
      />
    );
  }
  if (now.getTime() >= end.getTime()) {
    return (
      <Message title="This call has ended" body="The booked time has passed." />
    );
  }

  const room = roomNameForBooking(booking.id);
  await ensureRoom(room);
  const token = await joinToken({
    room,
    identity: userId,
    name: session.user.name || session.user.email,
  });

  return (
    <CallRoom
      token={token}
      serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
      slotEndIso={end.toISOString()}
    />
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-gray-600">{body}</p>
    </main>
  );
}

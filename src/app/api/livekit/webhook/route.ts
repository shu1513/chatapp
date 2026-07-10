import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import {
  onParticipantJoined,
  onParticipantLeft,
  settleSession,
} from "@/lib/call-session";
import { bookingIdFromRoomName, webhookReceiver } from "@/lib/video";

export async function POST(req: Request) {
  const body = await req.text();
  const authHeader = req.headers.get("authorization");

  let event;
  try {
    event = await webhookReceiver().receive(body, authHeader ?? undefined);
  } catch {
    return new NextResponse("invalid signature", { status: 401 });
  }

  // Idempotency: each LiveKit event has a unique id; replays no-op.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: "livekit",
      eventId: `livekit:${event.id}`,
      payload: JSON.parse(body),
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const room = event.room?.name;
  const bookingId = room ? bookingIdFromRoomName(room) : null;
  if (bookingId) {
    const at = new Date(Number(event.createdAt) * 1000);
    const identity = event.participant?.identity;

    switch (event.event) {
      case "participant_joined":
        if (identity) await onParticipantJoined(bookingId, identity, at);
        break;
      case "participant_left":
        if (identity) await onParticipantLeft(bookingId, identity, at);
        break;
      case "room_finished":
        await settleSession(bookingId, at);
        break;
    }
  }

  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.id, inserted[0].id));

  return NextResponse.json({ ok: true });
}

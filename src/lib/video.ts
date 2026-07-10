import "server-only";

import {
  AccessToken,
  RoomServiceClient,
  WebhookReceiver,
} from "livekit-server-sdk";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

// ws:// for clients, http:// for server API — same host/port.
const httpUrl = () => env("LIVEKIT_URL").replace(/^ws/, "http");

let roomService: RoomServiceClient | null = null;
function rooms(): RoomServiceClient {
  roomService ??= new RoomServiceClient(
    httpUrl(),
    env("LIVEKIT_API_KEY"),
    env("LIVEKIT_API_SECRET"),
  );
  return roomService;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const roomNameForBooking = (bookingId: string) => `booking_${bookingId}`;
export function bookingIdFromRoomName(room: string): string | null {
  if (!room.startsWith("booking_")) return null;
  const id = room.slice("booking_".length);
  return UUID_RE.test(id) ? id : null;
}

export async function ensureRoom(name: string, emptyTimeoutSec = 900) {
  // createRoom is an upsert in LiveKit: existing rooms are returned as-is.
  await rooms().createRoom({
    name,
    emptyTimeout: emptyTimeoutSec,
    maxParticipants: 2,
  });
}

export async function joinToken(opts: {
  room: string;
  identity: string;
  name: string;
}): Promise<string> {
  const token = new AccessToken(
    env("LIVEKIT_API_KEY"),
    env("LIVEKIT_API_SECRET"),
    { identity: opts.identity, name: opts.name, ttl: "15m" },
  );
  token.addGrant({
    room: opts.room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return token.toJwt();
}

export async function endRoom(name: string): Promise<void> {
  try {
    await rooms().deleteRoom(name);
  } catch (e: unknown) {
    // Already gone is fine.
    const msg = e instanceof Error ? e.message : "";
    if (!msg.includes("not found")) throw e;
  }
}

export async function listRoomParticipantIdentities(
  name: string,
): Promise<string[]> {
  try {
    const list = await rooms().listParticipants(name);
    return list.map((p) => p.identity);
  } catch {
    return []; // room doesn't exist
  }
}

let receiver: WebhookReceiver | null = null;
export function webhookReceiver(): WebhookReceiver {
  receiver ??= new WebhookReceiver(
    env("LIVEKIT_API_KEY"),
    env("LIVEKIT_API_SECRET"),
  );
  return receiver;
}

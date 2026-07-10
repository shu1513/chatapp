// Sends a correctly signed LiveKit webhook to the local app.
// Usage: node send-webhook.mjs <event> <roomName> [identity]
import { AccessToken } from "livekit-server-sdk";
import { createHash, randomUUID } from "node:crypto";

const [event, room, identity] = process.argv.slice(2);
const body = JSON.stringify({
  event,
  id: `test-${randomUUID()}`,
  createdAt: String(Math.floor(Date.now() / 1000)),
  room: { name: room },
  ...(identity ? { participant: { identity, name: identity } } : {}),
});

const token = new AccessToken("devkey", "devsecret_at_least_32_chars_long_ok", {
  identity: "webhook-test",
});
token.sha256 = createHash("sha256").update(body).digest("base64");
const jwt = await token.toJwt();

const res = await fetch("http://localhost:3000/api/livekit/webhook", {
  method: "POST",
  headers: { "Content-Type": "application/webhook+json", Authorization: jwt },
  body,
});
console.log(res.status, await res.text());

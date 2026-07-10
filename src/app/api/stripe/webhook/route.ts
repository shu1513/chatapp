import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, webhookEvents } from "@/db/schema";
import { stripe } from "@/lib/payments";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return new NextResponse("missing signature", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe().webhooks.constructEventAsync(body, sig, secret);
  } catch {
    return new NextResponse("invalid signature", { status: 400 });
  }

  const inserted = await db
    .insert(webhookEvents)
    .values({
      provider: "stripe",
      eventId: `stripe:${event.id}`,
      payload: JSON.parse(body),
    })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const bookingId = session.metadata?.bookingId;
    if (bookingId && session.payment_status === "paid") {
      await db
        .update(bookings)
        .set({
          status: "confirmed",
          paymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id,
        })
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.status, "pending_payment"),
          ),
        );
    }
  }

  await db
    .update(webhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(webhookEvents.id, inserted[0].id));

  return NextResponse.json({ ok: true });
}

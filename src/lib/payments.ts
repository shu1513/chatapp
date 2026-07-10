import "server-only";

import Stripe from "stripe";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set`);
  return v;
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(env("STRIPE_SECRET_KEY"));
  return client;
}

const baseUrl = () => env("BETTER_AUTH_URL");

/**
 * Hosted Checkout for a scheduled booking. Charge lands on the platform
 * account; the creator's share moves later via transfer once Connect
 * onboarding exists (separate charges & transfers pattern).
 */
export async function createBookingCheckout(opts: {
  bookingId: string;
  priceCents: number;
  creatorName: string;
  callLengthMin: number;
  customerEmail: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: opts.customerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: opts.priceCents,
          product_data: {
            name: `${opts.callLengthMin}-minute video call with ${opts.creatorName}`,
          },
        },
      },
    ],
    metadata: { bookingId: opts.bookingId },
    payment_intent_data: {
      metadata: { bookingId: opts.bookingId },
    },
    success_url: `${baseUrl()}/book/${opts.bookingId}?paid=1`,
    cancel_url: `${baseUrl()}/book/${opts.bookingId}`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60, // Stripe minimum 30m
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return session.url;
}

export async function refundBookingPayment(
  paymentIntentId: string,
): Promise<void> {
  try {
    await stripe().refunds.create({ payment_intent: paymentIntentId });
  } catch (e: unknown) {
    // Already fully refunded is fine (idempotent from our side).
    if (
      e instanceof Stripe.errors.StripeError &&
      e.code === "charge_already_refunded"
    ) {
      return;
    }
    throw e;
  }
}

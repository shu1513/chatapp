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

/** Platform take on every call; creators keep the rest. */
export const PLATFORM_FEE_PCT = 20;

export function creatorShareCents(priceCents: number): number {
  return Math.round((priceCents * (100 - PLATFORM_FEE_PCT)) / 100);
}

export async function createExpressAccount(email: string): Promise<string> {
  const account = await stripe().accounts.create({
    type: "express",
    email,
    capabilities: { transfers: { requested: true } },
  });
  return account.id;
}

export async function createOnboardingLink(accountId: string): Promise<string> {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${baseUrl()}/dashboard/payouts`,
    return_url: `${baseUrl()}/dashboard/payouts?onboarded=1`,
  });
  return link.url;
}

export async function getConnectStatus(accountId: string): Promise<{
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
}> {
  const account = await stripe().accounts.retrieve(accountId);
  return {
    detailsSubmitted: account.details_submitted ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
  };
}

/**
 * Move the creator's share of a booking to their connected account.
 * source_transaction ties the transfer to the original charge (works even
 * while the charge is still pending); idempotency key = booking id makes
 * retries safe.
 */
export async function transferToCreator(opts: {
  bookingId: string;
  paymentIntentId: string;
  accountId: string;
  amountCents: number;
}): Promise<string> {
  const pi = await stripe().paymentIntents.retrieve(opts.paymentIntentId);
  const chargeId =
    typeof pi.latest_charge === "string"
      ? pi.latest_charge
      : pi.latest_charge?.id;
  if (!chargeId) throw new Error(`No charge on ${opts.paymentIntentId}`);

  const transfer = await stripe().transfers.create(
    {
      amount: opts.amountCents,
      currency: "usd",
      destination: opts.accountId,
      source_transaction: chargeId,
      metadata: { bookingId: opts.bookingId },
    },
    { idempotencyKey: `payout-${opts.bookingId}` },
  );
  return transfer.id;
}

/**
 * Checkout that authorizes (but does not capture) the instant-call max
 * block. The webhook flips the request to `pending` once authorized,
 * which starts the ring.
 */
export async function createInstantAuthCheckout(opts: {
  requestId: string;
  maxAmountCents: number;
  ratePerMinCents: number;
  creatorName: string;
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
          unit_amount: opts.maxAmountCents,
          product_data: {
            name: `Instant call with ${opts.creatorName}`,
            description: `$${(opts.ratePerMinCents / 100).toFixed(2)}/min — you only pay for time used; the rest of this hold is released`,
          },
        },
      },
    ],
    metadata: { instantRequestId: opts.requestId },
    payment_intent_data: {
      capture_method: "manual",
      metadata: { instantRequestId: opts.requestId },
    },
    success_url: `${baseUrl()}/instant/${opts.requestId}`,
    cancel_url: `${baseUrl()}/instant/${opts.requestId}?cancelled=1`,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
  });
  if (!session.url) throw new Error("Checkout session has no URL");
  return session.url;
}

/** Capture part of a manual-capture auth; the remainder is released. */
export async function capturePayment(
  paymentIntentId: string,
  amountCents: number,
): Promise<void> {
  await stripe().paymentIntents.capture(paymentIntentId, {
    amount_to_capture: amountCents,
  });
}

/** Release an uncaptured auth hold entirely. */
export async function cancelPaymentAuth(
  paymentIntentId: string,
): Promise<void> {
  try {
    await stripe().paymentIntents.cancel(paymentIntentId);
  } catch (e: unknown) {
    // Already cancelled / already captured: nothing to release.
    if (
      e instanceof Stripe.errors.StripeError &&
      e.code === "payment_intent_unexpected_state"
    ) {
      return;
    }
    throw e;
  }
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

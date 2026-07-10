"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { createExpressAccount, createOnboardingLink } from "@/lib/payments";
import { getSession } from "@/lib/session";

export type PayoutOnboardState = { error?: string; onboardingUrl?: string };

export async function startPayoutOnboarding(
  _prev: PayoutOnboardState,
  _formData: FormData,
): Promise<PayoutOnboardState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  const creator = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (!creator) {
    redirect("/onboard");
  }

  let accountId = creator.stripeAccountId;
  if (!accountId) {
    accountId = await createExpressAccount(session.user.email);
    await db
      .update(creators)
      .set({ stripeAccountId: accountId })
      .where(eq(creators.userId, creator.userId));
  }

  const url = await createOnboardingLink(accountId);
  // Client navigates (Stripe-hosted page is cross-origin).
  return { onboardingUrl: url };
}

"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { creators, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { eq } from "drizzle-orm";

const RESERVED_HANDLES = new Set([
  "api",
  "admin",
  "signin",
  "signout",
  "onboard",
  "settings",
  "dashboard",
  "about",
  "terms",
  "privacy",
]);

const onboardSchema = z.object({
  handle: z
    .string()
    .min(3, "Handle must be at least 3 characters")
    .max(30, "Handle must be at most 30 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Handle can only contain lowercase letters, numbers, and underscores",
    )
    .refine((h) => !RESERVED_HANDLES.has(h), "This handle is reserved"),
  displayName: z.string().trim().min(1, "Display name is required").max(80),
  bio: z.string().trim().max(1000).optional(),
  rateUsd: z.coerce
    .number()
    .int("Rate must be a whole dollar amount")
    .min(1, "Rate must be at least $1")
    .max(10000, "Rate must be at most $10,000"),
  callLengthMin: z.coerce
    .number()
    .int()
    .refine((v) => [10, 15, 30, 60].includes(v), "Invalid call length"),
});

export type OnboardState = {
  error?: string;
};

export async function onboardCreator(
  _prev: OnboardState,
  formData: FormData,
): Promise<OnboardState> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }

  const parsed = onboardSchema.safeParse({
    handle: formData.get("handle"),
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    rateUsd: formData.get("rateUsd"),
    callLengthMin: formData.get("callLengthMin"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const existing = await db.query.creators.findFirst({
    where: eq(creators.userId, session.user.id),
  });
  if (existing) {
    redirect(`/@${existing.handle}`);
  }

  const { handle, displayName, bio, rateUsd, callLengthMin } = parsed.data;

  try {
    await db.transaction(async (tx) => {
      await tx.insert(creators).values({
        userId: session.user.id,
        handle,
        displayName,
        bio,
        rateCents: rateUsd * 100,
        callLengthMin,
      });
      await tx
        .update(users)
        .set({ role: "creator" })
        .where(eq(users.id, session.user.id));
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("creators_handle_unique")) {
      return { error: "That handle is already taken" };
    }
    throw e;
  }

  redirect(`/@${handle}`);
}

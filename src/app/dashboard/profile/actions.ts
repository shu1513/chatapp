"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";
import { getSession } from "@/lib/session";

const profileSchema = z.object({
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
  approvalMode: z.coerce.boolean(),
});

export type ProfileState = { error?: string; saved?: boolean };

/**
 * Update creator profile. Handle is immutable (it's the public URL).
 * Price changes affect future bookings only — existing bookings keep
 * their snapshot price.
 */
export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
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

  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    bio: formData.get("bio") || undefined,
    rateUsd: formData.get("rateUsd"),
    callLengthMin: formData.get("callLengthMin"),
    approvalMode: formData.get("approvalMode") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { displayName, bio, rateUsd, callLengthMin, approvalMode } =
    parsed.data;

  await db
    .update(creators)
    .set({
      displayName,
      bio: bio ?? null,
      rateCents: rateUsd * 100,
      callLengthMin,
      approvalMode,
    })
    .where(eq(creators.userId, creator.userId));

  return { saved: true };
}

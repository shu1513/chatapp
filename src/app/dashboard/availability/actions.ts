"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { availabilityRules, creators } from "@/db/schema";
import { getSession } from "@/lib/session";

const timeToMinute = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

const windowSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  })
  .refine(
    (w) => timeToMinute(w.start) < timeToMinute(w.end),
    "Window end must be after start",
  );

export type AvailabilityState = {
  error?: string;
  saved?: boolean;
};

export async function saveAvailability(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
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

  // Rows arrive as parallel arrays for enabled weekdays.
  const weekdays = formData.getAll("weekday").map(Number);
  const starts = formData.getAll("start").map(String);
  const ends = formData.getAll("end").map(String);

  if (weekdays.length !== starts.length || starts.length !== ends.length) {
    return { error: "Malformed form data" };
  }

  const windows: z.infer<typeof windowSchema>[] = [];
  for (let i = 0; i < weekdays.length; i++) {
    const parsed = windowSchema.safeParse({
      weekday: weekdays[i],
      start: starts[i],
      end: ends[i],
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message };
    }
    windows.push(parsed.data);
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(availabilityRules)
      .where(eq(availabilityRules.creatorId, creator.userId));
    if (windows.length > 0) {
      await tx.insert(availabilityRules).values(
        windows.map((w) => ({
          creatorId: creator.userId,
          weekday: w.weekday,
          startMinute: timeToMinute(w.start),
          endMinute: timeToMinute(w.end),
        })),
      );
    }
  });

  return { saved: true };
}

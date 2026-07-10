"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  availabilityExceptions,
  availabilityRules,
  creators,
} from "@/db/schema";
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

async function requireCreator() {
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
  return creator;
}

export type AvailabilityState = {
  error?: string;
  saved?: boolean;
};

export async function saveAvailability(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const creator = await requireCreator();

  // Rows arrive as parallel arrays.
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

  // Windows on the same weekday must not overlap, or fans would see
  // duplicate slots.
  for (let day = 0; day < 7; day++) {
    const dayWindows = windows
      .filter((w) => w.weekday === day)
      .sort((a, b) => timeToMinute(a.start) - timeToMinute(b.start));
    for (let i = 1; i < dayWindows.length; i++) {
      if (
        timeToMinute(dayWindows[i].start) < timeToMinute(dayWindows[i - 1].end)
      ) {
        return {
          error: `Overlapping windows on ${
            ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][day]
          }`,
        };
      }
    }
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

const rulesSchema = z.object({
  bufferMin: z.coerce
    .number()
    .int()
    .refine((v) => [0, 5, 10, 15].includes(v), "Invalid buffer"),
  minNoticeMin: z.coerce
    .number()
    .int()
    .refine((v) => [60, 180, 720, 1440].includes(v), "Invalid notice"),
  horizonDays: z.coerce
    .number()
    .int()
    .refine((v) => [7, 14, 30].includes(v), "Invalid horizon"),
  /** dollars per minute; empty disables instant calls */
  instantRateUsdPerMin: z
    .union([
      z.literal("").transform(() => null),
      z.coerce.number().min(0.5, "Min $0.50/min").max(500),
    ])
    .nullable(),
});

export async function saveBookingRules(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const creator = await requireCreator();
  const parsed = rulesSchema.safeParse({
    bufferMin: formData.get("bufferMin"),
    minNoticeMin: formData.get("minNoticeMin"),
    horizonDays: formData.get("horizonDays"),
    instantRateUsdPerMin: formData.get("instantRateUsdPerMin") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { instantRateUsdPerMin, ...rest } = parsed.data;
  await db
    .update(creators)
    .set({
      ...rest,
      instantRateCentsPerMin:
        instantRateUsdPerMin === null
          ? null
          : Math.round(instantRateUsdPerMin * 100),
    })
    .where(eq(creators.userId, creator.userId));
  return { saved: true };
}

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export async function addBlackout(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const creator = await requireCreator();
  const parsed = dateSchema.safeParse(formData.get("date"));
  if (!parsed.success) {
    return { error: "Pick a date" };
  }
  await db
    .insert(availabilityExceptions)
    .values({ creatorId: creator.userId, date: parsed.data })
    .onConflictDoNothing();
  revalidatePath("/dashboard/availability");
  return { saved: true };
}

export async function removeBlackout(
  _prev: AvailabilityState,
  formData: FormData,
): Promise<AvailabilityState> {
  const creator = await requireCreator();
  const id = String(formData.get("id"));
  await db
    .delete(availabilityExceptions)
    .where(
      and(
        eq(availabilityExceptions.id, id),
        eq(availabilityExceptions.creatorId, creator.userId),
      ),
    );
  revalidatePath("/dashboard/availability");
  return { saved: true };
}

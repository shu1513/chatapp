"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators, reports } from "@/db/schema";
import { getSession } from "@/lib/session";

async function requireAdmin(): Promise<string> {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }
  return session.user.id;
}

export type AdminState = { error?: string };

export async function resolveReport(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const id = String(formData.get("reportId"));
  const decision = formData.get("decision") === "dismiss" ? "dismissed" : "resolved";
  await db.update(reports).set({ status: decision }).where(eq(reports.id, id));
  revalidatePath("/admin");
  return {};
}

export async function setCreatorSuspended(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  await requireAdmin();
  const userId = String(formData.get("userId"));
  const suspend = formData.get("suspend") === "true";
  await db
    .update(creators)
    .set({ status: suspend ? "suspended" : "active" })
    .where(eq(creators.userId, userId));
  revalidatePath("/admin");
  return {};
}

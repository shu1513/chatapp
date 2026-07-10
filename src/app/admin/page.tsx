import { redirect } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { creators, reports, users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { AdminReportRow } from "./report-row";

export default async function AdminPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin?next=/admin");
  }
  if (session.user.role !== "admin") {
    redirect("/");
  }

  const rows = await db
    .select({
      id: reports.id,
      reason: reports.reason,
      createdAt: reports.createdAt,
      bookingId: reports.bookingId,
      reporterEmail: sql<string>`(SELECT email FROM users WHERE id = ${reports.reporterId})`,
      reportedEmail: users.email,
      reportedUserId: reports.reportedUserId,
      reportedCreatorStatus: creators.status,
    })
    .from(reports)
    .innerJoin(users, eq(users.id, reports.reportedUserId))
    .leftJoin(creators, eq(creators.userId, reports.reportedUserId))
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.createdAt));

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-6 pt-12">
      <h1 className="text-2xl font-semibold">Open reports</h1>
      {rows.length === 0 ? (
        <p className="text-gray-500">Queue is empty.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <AdminReportRow
              key={r.id}
              report={{
                id: r.id,
                reason: r.reason,
                createdAt: r.createdAt.toISOString(),
                reporterEmail: r.reporterEmail,
                reportedEmail: r.reportedEmail,
                reportedUserId: r.reportedUserId,
                reportedCreatorStatus: r.reportedCreatorStatus,
              }}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

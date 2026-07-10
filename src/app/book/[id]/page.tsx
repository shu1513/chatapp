import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, creators } from "@/db/schema";
import { getSession } from "@/lib/session";
import { LocalTime } from "@/components/local-time";
import { BookingActions } from "./booking-actions";
import { ReportButton } from "./report-button";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Awaiting payment",
  pending_approval: "Waiting for creator approval",
  confirmed: "Confirmed",
  completed: "Completed",
  declined: "Declined by creator",
  cancelled: "Cancelled",
  refunded: "Refunded",
  no_show_customer: "Missed (no-show)",
  no_show_creator: "Creator no-show (refunded)",
};

export default async function BookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getSession();
  if (!session?.user) {
    redirect("/signin");
  }

  const [row] = await db
    .select({
      booking: bookings,
      slotStart: sql<string>`lower(${bookings.slot})`,
      slotEnd: sql<string>`upper(${bookings.slot})`,
      creatorName: creators.displayName,
      creatorHandle: creators.handle,
    })
    .from(bookings)
    .innerJoin(creators, eq(creators.userId, bookings.creatorId))
    .where(and(eq(bookings.id, id), eq(bookings.customerId, session.user.id)))
    .limit(1);

  if (!row) {
    notFound();
  }
  const { booking, slotStart, slotEnd, creatorName, creatorHandle } = row;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">
        Video call with {creatorName}
      </h1>
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="font-medium">
          <LocalTime iso={new Date(slotStart).toISOString()} /> –{" "}
          <LocalTime iso={new Date(slotEnd).toISOString()} withDate={false} />
        </p>
        <p className="mt-1 text-gray-600">@{creatorHandle}</p>
        <p className="mt-2 text-lg">${(booking.priceCents / 100).toFixed(2)}</p>
        <p className="mt-2 text-sm text-gray-500">
          {STATUS_LABEL[booking.status] ?? booking.status}
        </p>
        {["confirmed", "pending_approval"].includes(booking.status) && (
          <a
            href={`/book/${booking.id}/ics`}
            className="mt-2 inline-block text-sm text-gray-600 underline"
          >
            Add to calendar (.ics)
          </a>
        )}
      </div>
      {booking.status === "confirmed" &&
        new Date(slotEnd).getTime() > Date.now() && (
          <Link
            href={`/call/${booking.id}`}
            className="rounded bg-green-700 px-4 py-2 text-center text-white"
          >
            Join call
          </Link>
        )}
      <BookingActions bookingId={booking.id} status={booking.status} />
      <ReportButton bookingId={booking.id} />
    </main>
  );
}

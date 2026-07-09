import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { creators } from "@/db/schema";

export default async function CreatorPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle: raw } = await params;
  const decoded = decodeURIComponent(raw);
  if (!decoded.startsWith("@")) {
    notFound();
  }
  const handle = decoded.slice(1);

  const creator = await db.query.creators.findFirst({
    where: eq(creators.handle, handle),
  });
  if (!creator) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 pt-12">
        <h1 className="text-3xl font-semibold">{creator.displayName}</h1>
        <p className="text-gray-500">@{creator.handle}</p>
      </header>
      {creator.bio && <p className="whitespace-pre-wrap">{creator.bio}</p>}
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-lg font-medium">
          ${(creator.rateCents / 100).toFixed(0)} ·{" "}
          {creator.callLengthMin}-minute video call
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Booking opens soon.
        </p>
      </div>
    </main>
  );
}

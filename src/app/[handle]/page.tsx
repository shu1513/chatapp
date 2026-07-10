import { notFound } from "next/navigation";
import { getAvailableSlots, getCreatorByHandle } from "@/lib/booking-data";
import { getLiveState } from "@/lib/instant";
import { CallNowButton } from "./call-now";
import { SlotList } from "./slot-list";

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

  const creator = await getCreatorByHandle(handle);
  if (!creator || creator.status === "suspended") {
    notFound();
  }

  const [slots, liveState] = await Promise.all([
    getAvailableSlots(creator),
    getLiveState(creator.userId),
  ]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 pt-12">
        <h1 className="flex items-center gap-3 text-3xl font-semibold">
          {creator.displayName}
          {liveState.live && (
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
              ● Live now
            </span>
          )}
        </h1>
        <p className="text-gray-500">@{creator.handle}</p>
      </header>
      {liveState.live && liveState.rateCentsPerMin !== null && (
        <CallNowButton
          handle={creator.handle}
          ratePerMin={liveState.rateCentsPerMin}
        />
      )}
      {creator.bio && <p className="whitespace-pre-wrap">{creator.bio}</p>}
      <div className="rounded-lg border border-gray-200 p-4">
        <p className="text-lg font-medium">
          ${(creator.rateCents / 100).toFixed(0)} ·{" "}
          {creator.callLengthMin}-minute video call
        </p>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">Available times</h2>
        <SlotList
          handle={creator.handle}
          slotStarts={slots.map((s) => s.start.toISOString())}
        />
      </section>
    </main>
  );
}

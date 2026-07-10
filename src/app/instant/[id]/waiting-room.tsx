"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  cancelInstantRequest,
  type InstantRequestState,
} from "@/app/[handle]/instant-actions";

const POLL_MS = 2_000;

export function WaitingRoom({
  requestId,
  creatorName,
  creatorHandle,
  ratePerMin,
  initialState,
  expiresAtIso,
}: {
  requestId: string;
  creatorName: string;
  creatorHandle: string;
  ratePerMin: number;
  initialState: string;
  expiresAtIso: string;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [, cancelAction, cancelPending] = useActionState<
    InstantRequestState,
    FormData
  >(cancelInstantRequest, {});

  useEffect(() => {
    const end = new Date(expiresAtIso).getTime();
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAtIso]);

  useEffect(() => {
    if (state !== "pending") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/instant/status?id=${requestId}`);
        if (!res.ok) return;
        const data: { state: string; bookingId: string | null } =
          await res.json();
        setState(data.state);
        if (data.state === "accepted" && data.bookingId) {
          router.push(`/call/${data.bookingId}`);
        }
      } catch {
        // transient; next tick retries
      }
    }, POLL_MS);
    return () => clearInterval(iv);
  }, [state, requestId, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6 text-center">
      {state === "pending" && (
        <>
          <div className="animate-pulse text-5xl">📞</div>
          <h1 className="text-2xl font-semibold">
            Calling {creatorName}…
          </h1>
          <p className="text-gray-600">
            ${(ratePerMin / 100).toFixed(2)}/minute once you connect
            {secondsLeft !== null && ` · ${secondsLeft}s`}
          </p>
          <form action={cancelAction}>
            <input type="hidden" name="requestId" value={requestId} />
            <button
              type="submit"
              disabled={cancelPending}
              className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
            >
              Cancel
            </button>
          </form>
        </>
      )}
      {state === "declined" && (
        <Result title="Not available" body={`${creatorName} can't talk right now.`} handle={creatorHandle} />
      )}
      {state === "expired" && (
        <Result title="No answer" body={`${creatorName} didn't pick up.`} handle={creatorHandle} />
      )}
      {state === "cancelled" && (
        <Result title="Cancelled" body="You cancelled this call request." handle={creatorHandle} />
      )}
    </main>
  );
}

function Result({
  title,
  body,
  handle,
}: {
  title: string;
  body: string;
  handle: string;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-gray-600">{body}</p>
      <Link href={`/@${handle}`} className="text-sm underline">
        Back to @{handle} — book a time instead
      </Link>
    </>
  );
}

"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import {
  acceptInstant,
  declineInstant,
  setLive,
  type InstantReviewState,
} from "./actions";

type Ring = { id: string; customerEmail: string; expiresAt: string };

const HEARTBEAT_MS = 20_000;
const POLL_MS = 3_000;

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // no audio available — visual ring still shows
  }
}

export function LivePanel({
  initiallyLive,
  hasInstantRate,
}: {
  initiallyLive: boolean;
  hasInstantRate: boolean;
}) {
  const [live, setLiveState] = useState(initiallyLive);
  const [rings, setRings] = useState<Ring[]>([]);
  const knownRings = useRef(new Set<string>());

  const toggle = useCallback(async () => {
    const next = !live;
    setLiveState(next);
    await setLive(next);
  }, [live]);

  // Heartbeat while live.
  useEffect(() => {
    if (!live) return;
    const iv = setInterval(() => setLive(true), HEARTBEAT_MS);
    return () => clearInterval(iv);
  }, [live]);

  // Poll for rings while live.
  useEffect(() => {
    if (!live) {
      setRings([]);
      return;
    }
    let stop = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/instant/requests");
        if (!res.ok) return;
        const data: { requests: Ring[] } = await res.json();
        if (stop) return;
        for (const r of data.requests) {
          if (!knownRings.current.has(r.id)) {
            knownRings.current.add(r.id);
            beep();
          }
        }
        setRings(data.requests);
      } catch {
        // transient poll failure — next tick retries
      }
    };
    poll();
    const iv = setInterval(poll, POLL_MS);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [live]);

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Instant calls</h2>
          <p className="text-sm text-gray-500">
            {hasInstantRate
              ? live
                ? "You're live — fans can call you now."
                : "Go live to take instant calls."
              : "Set an instant rate in Availability first."}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={!hasInstantRate}
          className={`rounded px-4 py-2 text-white disabled:opacity-40 ${
            live ? "bg-red-600" : "bg-green-700"
          }`}
        >
          {live ? "Go offline" : "Go live"}
        </button>
      </div>
      {rings.map((r) => (
        <RingCard key={r.id} ring={r} />
      ))}
    </section>
  );
}

function RingCard({ ring }: { ring: Ring }) {
  const [acceptState, acceptAction, acceptPending] = useActionState<
    InstantReviewState,
    FormData
  >(acceptInstant, {});
  const [, declineAction, declinePending] = useActionState<
    InstantReviewState,
    FormData
  >(declineInstant, {});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const end = new Date(ring.expiresAt).getTime();
    const tick = () =>
      setSecondsLeft(Math.max(0, Math.round((end - Date.now()) / 1000)));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [ring.expiresAt]);

  return (
    <div className="flex animate-pulse items-center justify-between rounded-lg border-2 border-green-600 bg-green-50 p-4 dark:bg-green-950">
      <div>
        <p className="font-medium">📞 {ring.customerEmail}</p>
        <p className="text-sm text-gray-600">
          wants to talk now{secondsLeft !== null && ` · ${secondsLeft}s`}
        </p>
        {acceptState.error && (
          <p className="text-sm text-red-600">{acceptState.error}</p>
        )}
      </div>
      <div className="flex gap-2">
        <form action={acceptAction}>
          <input type="hidden" name="requestId" value={ring.id} />
          <button
            type="submit"
            disabled={acceptPending || declinePending}
            className="rounded bg-green-700 px-4 py-2 text-white disabled:opacity-50"
          >
            Accept
          </button>
        </form>
        <form action={declineAction}>
          <input type="hidden" name="requestId" value={ring.id} />
          <button
            type="submit"
            disabled={acceptPending || declinePending}
            className="rounded border border-gray-300 px-4 py-2 disabled:opacity-50"
          >
            Decline
          </button>
        </form>
      </div>
    </div>
  );
}

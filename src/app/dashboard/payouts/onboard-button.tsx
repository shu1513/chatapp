"use client";

import { useActionState, useEffect } from "react";
import {
  startPayoutOnboarding,
  type PayoutOnboardState,
} from "./actions";

export function OnboardButton({ resume }: { resume: boolean }) {
  const [state, formAction, pending] = useActionState<
    PayoutOnboardState,
    FormData
  >(startPayoutOnboarding, {});

  useEffect(() => {
    if (state.onboardingUrl) {
      window.location.href = state.onboardingUrl;
    }
  }, [state.onboardingUrl]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending
          ? "Redirecting…"
          : resume
            ? "Finish payout setup"
            : "Set up payouts"}
      </button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

/**
 * Server startup hook. Starts the call-session sweeper: a periodic task
 * that ends rooms whose paid time is up, expires dead grace periods, and
 * finalizes bookings whose slot passed with no call.
 *
 * In-process interval is fine for a single-instance deployment; replace
 * with pg-boss when the app runs more than one instance.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const g = globalThis as { __callSweeperStarted?: boolean };
  if (g.__callSweeperStarted) return;
  g.__callSweeperStarted = true;

  const { sweep } = await import("@/lib/call-session");
  setInterval(async () => {
    try {
      await sweep();
    } catch (e) {
      console.error("[sweeper]", e);
    }
  }, 15_000);
}

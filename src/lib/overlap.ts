export type PresenceEvent = {
  type: "participant_joined" | "participant_left";
  identity: string;
  at: Date;
};

/**
 * Seconds during which both identities were present simultaneously,
 * computed from an event log. If someone is still present at `until`
 * (no matching left event), their presence extends to `until`.
 */
export function bothPresentSeconds(
  events: PresenceEvent[],
  a: string,
  b: string,
  until: Date,
): number {
  const sorted = [...events]
    .filter((e) => e.identity === a || e.identity === b)
    .sort((x, y) => x.at.getTime() - y.at.getTime());

  const present = new Set<string>();
  let overlapStart: number | null = null;
  let total = 0;

  for (const e of sorted) {
    if (e.at.getTime() > until.getTime()) break;
    if (e.type === "participant_joined") {
      present.add(e.identity);
      if (present.has(a) && present.has(b) && overlapStart === null) {
        overlapStart = e.at.getTime();
      }
    } else {
      present.delete(e.identity);
      if (overlapStart !== null && !(present.has(a) && present.has(b))) {
        total += e.at.getTime() - overlapStart;
        overlapStart = null;
      }
    }
  }
  if (overlapStart !== null) {
    total += Math.max(0, until.getTime() - overlapStart);
  }
  return Math.round(total / 1000);
}

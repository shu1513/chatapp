import { TZDate } from "@date-fns/tz";

export type AvailabilityRule = {
  /** 0 = Sunday … 6 = Saturday, in the creator's timezone */
  weekday: number;
  /** minutes from local midnight */
  startMinute: number;
  endMinute: number;
};

export type Interval = { start: Date; end: Date };

/**
 * Compute bookable slots from weekly availability rules.
 *
 * All returned Dates are UTC instants. Local-time math (weekdays, minutes
 * from midnight) happens in the creator's IANA timezone via TZDate, so DST
 * transitions shift slot instants but never split or duplicate a local day.
 * Nonexistent local times (spring-forward gap) resolve per TZDate semantics;
 * we drop any slot that would exceed the rule window after resolution.
 */
export function generateSlots(opts: {
  rules: AvailabilityRule[];
  timezone: string;
  callLengthMin: number;
  now: Date;
  horizonDays: number;
  /** slots starting sooner than this many minutes from now are hidden */
  minNoticeMin: number;
  /** existing bookings / blocked intervals (UTC) */
  busy: Interval[];
}): Interval[] {
  const {
    rules,
    timezone,
    callLengthMin,
    now,
    horizonDays,
    minNoticeMin,
    busy,
  } = opts;

  if (rules.length === 0 || callLengthMin <= 0) return [];

  const earliestStart = now.getTime() + minNoticeMin * 60_000;
  const slots: Interval[] = [];

  // Today's calendar date in the creator's timezone.
  const zNow = new TZDate(now, timezone);
  const y = zNow.getFullYear();
  const m = zNow.getMonth();
  const d = zNow.getDate();

  for (let offset = 0; offset <= horizonDays; offset++) {
    // Noon avoids DST edge cases when determining the local weekday.
    const localNoon = new TZDate(y, m, d + offset, 12, 0, timezone);
    const weekday = localNoon.getDay();

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;

      for (
        let startMin = rule.startMinute;
        startMin + callLengthMin <= rule.endMinute;
        startMin += callLengthMin
      ) {
        const start = new TZDate(y, m, d + offset, 0, startMin, timezone);
        const end = new TZDate(
          y,
          m,
          d + offset,
          0,
          startMin + callLengthMin,
          timezone,
        );

        if (start.getTime() < earliestStart) continue;
        if (end.getTime() <= start.getTime()) continue; // DST artifact
        const overlapsBusy = busy.some(
          (b) =>
            start.getTime() < b.end.getTime() &&
            end.getTime() > b.start.getTime(),
        );
        if (overlapsBusy) continue;

        slots.push({
          start: new Date(start.getTime()),
          end: new Date(end.getTime()),
        });
      }
    }
  }

  slots.sort((a, b) => a.start.getTime() - b.start.getTime());
  return slots;
}

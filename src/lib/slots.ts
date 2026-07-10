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
  /** enforced gap between calls, minutes */
  bufferMin?: number;
  now: Date;
  horizonDays: number;
  /** slots starting sooner than this many minutes from now are hidden */
  minNoticeMin: number;
  /** existing bookings / blocked intervals (UTC) */
  busy: Interval[];
  /** whole-day blackouts, local YYYY-MM-DD dates in the creator's timezone */
  blackoutDates?: ReadonlySet<string>;
}): Interval[] {
  const {
    rules,
    timezone,
    callLengthMin,
    bufferMin = 0,
    now,
    horizonDays,
    minNoticeMin,
    busy,
    blackoutDates,
  } = opts;

  if (rules.length === 0 || callLengthMin <= 0) return [];

  const earliestStart = now.getTime() + minNoticeMin * 60_000;
  // The buffer applies around existing bookings too: a slot may not start
  // or end within `bufferMin` of a busy interval.
  const bufferedBusy = busy.map((b) => ({
    start: new Date(b.start.getTime() - bufferMin * 60_000),
    end: new Date(b.end.getTime() + bufferMin * 60_000),
  }));
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

    if (blackoutDates?.has(localDateString(localNoon))) continue;

    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;

      for (
        let startMin = rule.startMinute;
        startMin + callLengthMin <= rule.endMinute;
        startMin += callLengthMin + bufferMin
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
        const overlapsBusy = bufferedBusy.some(
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

/** Local calendar date of a TZDate as YYYY-MM-DD. */
export function localDateString(d: {
  getFullYear(): number;
  getMonth(): number;
  getDate(): number;
}): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}
